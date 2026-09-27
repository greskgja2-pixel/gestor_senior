import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export const maxDuration=20;

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
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
    .select('item_id,analyzed_at,product_snapshot,finance_snapshot,competitors,suggestions,report')
    .eq('shop_id',shop.shop_id)
    .in('item_id',requested)
    .order('analyzed_at',{ascending:false})
    .limit(500);
  if(error)return NextResponse.json({error:error.message},{status:500});

  const items={};
  for(const r of data||[]){
    const id=String(r.item_id);
    if(items[id])continue;
    const p=r.product_snapshot||{},f=r.finance_snapshot||{};
    const competitors=arr(r.competitors).slice(0,3).map((c,index)=>({
      index:index+1,
      title:c?.title||c?.name||`Concorrente ${index+1}`,
      price:competitorPrice(c),
      sold:competitorSold(c),
      url:competitorUrl(c),
      image:imageOf(c),
      rating:n(c?.rating)
    }));
    items[id]={
      itemId:id,
      analyzedAt:r.analyzed_at||null,
      price:n(p?.price??p?.currentPrice),
      cost:n(f?.productCost??p?.referenceCost),
      marginPct:n(f?.marginPct),
      title:p?.title||p?.item_name||null,
      image:imageOf(p),
      competitors,
      suggestions:flattenSuggestions(r.suggestions||r.report?.suggestions||r.report?.ai_analysis)
    };
  }
  return NextResponse.json({count:Object.keys(items).length,items});
}
