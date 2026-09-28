import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export const maxDuration=20;

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
const firstNumber=(...values)=>{for(const value of values){const x=n(value);if(x!=null)return x}return null};
const variationRows=(source,costs=[])=>arr(source?.models||source?.variations||source?.model_list).map((v,index)=>{const id=String(v?.model_id??v?.modelId??v?.id??index);const saved=arr(costs).find(x=>String(x?.model_id??x?.modelId??x?.id)===id);return{id,name:v?.name||v?.model_name||v?.modelName||v?.variation||v?.model_sku||('Variação '+(index+1)),modelId:v?.model_id??v?.modelId??v?.id??null,price:firstNumber(v?.current_price,v?.currentPrice,v?.price,v?.original_price,v?.originalPrice),promoPrice:firstNumber(v?.promotion_price,v?.promo_price,v?.final_price,v?.sale_price),cost:firstNumber(v?.cost,saved?.cost),stock:firstNumber(v?.available_stock,v?.stock,v?.normal_stock)};}).filter(x=>x.name||x.price!=null);
const competitorUrl=c=>c?.url||c?.link||c?.productUrl||c?.product_url||(c?.shopId&&c?.itemId?`https://shopee.com.br/product/${c.shopId}/${c.itemId}`:c?.shop_id&&c?.item_id?`https://shopee.com.br/product/${c.shop_id}/${c.item_id}`:null);
const competitorPrice=c=>{
  if(n(c?.price)!=null)return n(c.price);
  const m=String(c?.searchText||'').match(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/i);
  return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
};
const competitorSold=c=>{
  if(n(c?.sold)!=null)return n(c.sold);
  const m=String(c?.searchText||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*(mil)?\+?\s*Vendido/i);
  if(!m)return null;
  const base=Number(m[1].replace(',','.'));
  return Number.isFinite(base)?Math.round(base*(m[2]?1000:1)):null;
};
const imageOf=c=>{
  const raw=c?.image||c?.imageUrl||c?.image_url||c?.thumbnail||arr(c?.images)[0]||arr(c?.imageUrls)[0];
  return raw?String(raw):null;
};
const flattenSuggestions=value=>{
  const out=[];
  const walk=v=>{
    if(v==null)return;
    if(typeof v==='string'){const s=v.trim();if(s.length>=8)out.push(s);return}
    if(Array.isArray(v)){v.forEach(walk);return}
    if(typeof v==='object')Object.values(v).forEach(walk);
  };
  walk(value);
  return [...new Set(out)].slice(0,30);
};

export async function GET(request){
  let shop;
  try{shop=await getActiveShop();}catch(error){return NextResponse.json({error:String(error?.message||error)},{status:500})}
  if(!shop)return NextResponse.json({error:'Nenhuma loja autorizada.'},{status:400});

  const url=new URL(request.url);
  const requested=[...new Set(String(url.searchParams.get('item_ids')||'').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,100);
  if(!requested.length)return NextResponse.json({items:{},count:0});

  const db=supabaseAdmin();
  const {data,error}=await db.from('extension_analysis_reports')
    .select('id,item_id,analyzed_at,product_snapshot,finance_snapshot,ads_snapshot,competitors,suggestions,report')
    .eq('shop_id',shop.shop_id)
    .in('item_id',requested)
    .order('analyzed_at',{ascending:false})
    .limit(500);
  if(error)return NextResponse.json({error:error.message},{status:500});

  const items={};
  for(const r of data||[]){
    const id=String(r.item_id);
    if(items[id])continue;
    const p=r.product_snapshot||{},f=r.finance_snapshot||{},ai=r?.report?.ai_analysis||{};
    const competitors=arr(r.competitors).slice(0,3).map((c,index)=>({
      index:index+1,
      title:c?.title||c?.name||`Concorrente ${index+1}`,
      price:competitorPrice(c),
      sold:competitorSold(c),
      url:competitorUrl(c),
      image:imageOf(c),
      rating:n(c?.rating),
      variations:variationRows(c)
    })).sort((a,b)=>(b.sold??-1)-(a.sold??-1));
    const variationCosts=arr(p?.variationCosts||f?.variationCosts||f?.variation_costs);
    items[id]={
      reportId:r.id||null,
      itemId:id,
      analyzedAt:r.analyzed_at||null,
      price:n(p?.price??p?.currentPrice),
      finalPrice:firstNumber(p?.finalPrice,p?.final_price,p?.promotionPrice,p?.promotion_price,p?.salePrice,p?.price??p?.currentPrice),
      cost:n(f?.productCost??p?.referenceCost),
      marginPct:n(f?.marginPct),
      adsCost:firstNumber(r?.ads_snapshot?.cost,r?.ads_snapshot?.spend,r?.ads_snapshot?.expense),
      adsOrders:firstNumber(r?.ads_snapshot?.orders,r?.ads_snapshot?.order,r?.ads_snapshot?.direct_orders),
      title:p?.title||p?.item_name||null,
      image:imageOf(p),
      variations:variationRows(p,variationCosts),
      competitors,
      titleSuggestion:typeof ai?.title?.suggestion==='string'?ai.title.suggestion.trim():null,
      titleReason:typeof ai?.title?.reason==='string'?ai.title.reason.trim():(typeof ai?.title?.explanation==='string'?ai.title.explanation.trim():null),
      titleKeywords:arr(ai?.title?.keywords||ai?.title?.keyword_suggestions||ai?.title?.keyphrases).map(x=>String(x||'').trim()).filter(Boolean).slice(0,12),
      suggestions:flattenSuggestions(r.suggestions||r.report?.suggestions||r.report?.ai_analysis)
    };
  }
  return NextResponse.json({count:Object.keys(items).length,items});
}
