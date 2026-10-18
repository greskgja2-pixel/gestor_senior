import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getDiscountList,getDiscount,getShopFlashSaleList,getShopFlashSaleItems} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=55;

// SOMENTE LEITURA: nenhuma escrita em campanhas, preços, estoque ou períodos.
const arr=v=>Array.isArray(v)?v:[];
const int=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const PRODUCT_PREVIEW=20;

function statusFromTime(start,end,now){
  if(start&&start>now)return 'scheduled';
  if(end&&end<=now)return 'ended';
  return 'active';
}
const LISTED={ongoing:'active',upcoming:'scheduled',expired:'ended'};
function moneyValue(...values){
  for(const value of values){const n=num(value);if(n!=null&&n>0)return n}
  return null;
}
async function discountRows(shop,status){
  try{
    const raw=await getDiscountList({shopId:shop.shop_id,accessToken:shop.access_token,discountStatus:status,pageNo:1,pageSize:100});
    return{rows:arr(raw?.response?.discount_list),error:null};
  }catch(error){
    console.warn('[promotions-overview] desconto indisponível',status,error);
    return{rows:[],error:`Descontos ${status}: ${String(error?.message||error)}`};
  }
}
function pct(original,promo){
  return original>0&&promo!=null&&promo>=0&&promo<=original?Math.round((1-promo/original)*1000)/10:null;
}
function discountProducts(items){
  return items.slice(0,PRODUCT_PREVIEW).map(item=>{
    const original=moneyValue(item?.item_original_price,item?.item_local_price);
    const promo=moneyValue(item?.item_promotion_price,item?.item_local_promotion_price);
    const models=arr(item?.model_list);
    const modelPromos=models.map(m=>moneyValue(m?.model_promotion_price,m?.model_local_promotion_price)).filter(Boolean);
    const modelOriginals=models.map(m=>moneyValue(m?.model_original_price,m?.model_local_price)).filter(Boolean);
    const p=promo??(modelPromos.length?Math.min(...modelPromos):null);
    const o=original??(modelOriginals.length?Math.min(...modelOriginals):null);
    return{item_id:int(item?.item_id),name:item?.item_name||null,image:null,original_price:o,promo_price:p,discount_pct:pct(o,p),stock:num(item?.item_promotion_stock??item?.normal_stock),participating:null,variations:models.length||null};
  });
}
async function enrichDiscount(shop,d,now,listedAs){
  let detail=null,itemsError=null;
  try{detail=await getDiscount({shopId:shop.shop_id,accessToken:shop.access_token,discountId:d.discount_id,pageNo:1,pageSize:100})}
  catch(error){itemsError=String(error?.message||error)}
  const response=detail?.response||{};
  const items=arr(response?.item_list);
  const prices=[];
  for(const item of items){
    const p=moneyValue(item?.item_promotion_price,item?.item_local_promotion_price);
    if(p)prices.push(p);
    for(const model of arr(item?.model_list)){
      const mp=moneyValue(model?.model_promotion_price,model?.model_local_promotion_price);
      if(mp)prices.push(mp);
    }
  }
  const start=int(response?.start_time??d?.start_time),end=int(response?.end_time??d?.end_time);
  const timeStatus=statusFromTime(start,end,now);
  return{
    kind:'discount',id:int(d?.discount_id),name:response?.discount_name||d?.discount_name||'Campanha de desconto',
    // `status` = estado operacional informado pela Shopee (lista de onde veio); `time_status` = o que o horário indica.
    status:listedAs||timeStatus,listed_as:listedAs||null,time_status:timeStatus,status_mismatch:!!listedAs&&listedAs!==timeStatus,
    start_time:start,end_time:end,source:int(d?.source),
    // Falha ao consultar os produtos NÃO é "0 produtos": item_count fica null e items_state='failed'.
    item_count:itemsError?null:items.length,has_more:itemsError?false:!!response?.more,
    items_state:itemsError?'failed':'ok',items_error:itemsError,
    min_promo_price:prices.length?Math.min(...prices):null,
    products:itemsError?[]:discountProducts(items)
  };
}
function flashProducts(raw){
  const response=raw?.response||{};
  const infos=arr(response?.item_info);
  const models=arr(response?.models);
  return infos.slice(0,PRODUCT_PREVIEW).map(info=>{
    const itemModels=models.filter(m=>Number(m?.item_id)===Number(info?.item_id));
    const enabledModels=itemModels.filter(m=>Number(m?.status??1)===1);
    const prices=[moneyValue(info?.item_promotion_price,info?.item_input_promo_price,info?.promotion_price_with_tax,info?.input_promotion_price),...enabledModels.map(m=>moneyValue(m?.promotion_price_with_tax,m?.input_promotion_price,m?.input_promo_price))].filter(Boolean);
    const originals=[moneyValue(info?.item_original_price,info?.original_price),...itemModels.map(m=>moneyValue(m?.original_price))].filter(Boolean);
    const stocks=[num(info?.item_promotion_stock??info?.campaign_stock),...enabledModels.map(m=>num(m?.campaign_stock??m?.stock))].filter(v=>v!=null&&v>=0);
    const promo=prices.length?Math.min(...prices):null,orig=originals.length?Math.min(...originals):null;
    return{item_id:int(info?.item_id),name:info?.item_name||null,image:info?.image||null,original_price:orig,promo_price:promo,discount_pct:pct(orig,promo),
      stock:stocks.length?stocks.reduce((a,b)=>a+b,0):null,participating:info?.status==null?null:Number(info.status)===1,variations:itemModels.length||null};
  });
}
async function enrichFlash(shop,sale,now){
  let products=[],detailCount=null,itemsError=null,hasDetail=false;
  try{
    const raw=await getShopFlashSaleItems({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId:sale.flash_sale_id,offset:0,limit:100});
    if(raw?.error)throw new Error(raw?.message||String(raw.error));
    const response=raw?.response||{};
    const ids=new Set([...arr(response?.item_info),...arr(response?.models)].map(x=>String(x?.item_id||'')).filter(Boolean));
    detailCount=ids.size;hasDetail=true;
    products=flashProducts(raw);
  }catch(error){itemsError=String(error?.message||error);console.warn('[promotions-overview] itens flash sale indisponíveis',sale?.flash_sale_id,error)}
  const start=int(sale?.start_time),end=int(sale?.end_time);
  const timeStatus=statusFromTime(start,end,now);
  // Contagem: a lista da Shopee (enabled_item_count/item_count) é a fonte primária; o detalhe só complementa.
  const listCount=int(sale?.enabled_item_count)??int(sale?.item_count);
  const itemCount=listCount??(hasDetail?detailCount:null);
  const code=int(sale?.status);
  // Código de status da Shopee (documentação Open Platform: 0 removida, 1 ativa/habilitada, 2 desativada, 3 rejeitada).
  // Não confirmado em captura do projeto; por isso o código bruto também é exposto (`shopee_status`).
  const operational=code===0?'removed':code===2?'disabled':code===3?'rejected':null;
  return{
    kind:'flash_sale',id:int(sale?.flash_sale_id),name:'Oferta Relâmpago',timeslot_id:int(sale?.timeslot_id),
    status:operational||timeStatus,time_status:timeStatus,status_mismatch:!!operational,shopee_status:code,
    start_time:start,end_time:end,
    item_count:itemCount,item_count_source:listCount!=null?'lista':(hasDetail?'detalhe':null),
    enabled_item_count:int(sale?.enabled_item_count),listed_item_count:int(sale?.item_count),
    items_state:itemsError?'failed':'ok',items_error:itemsError,
    items:products.slice(0,4).map(x=>({item_id:x.item_id,name:x.name,image:x.image})),products
  };
}

export async function GET(){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const now=Math.floor(Date.now()/1000);
  try{
    const warnings=[];
    const flashTypes=[1,2,3];
    const [ongoing,upcoming,expired,...flashResults]=await Promise.all([
      discountRows(shop,'ongoing'),discountRows(shop,'upcoming'),discountRows(shop,'expired'),
      ...flashTypes.map(type=>getShopFlashSaleList({shopId:shop.shop_id,accessToken:shop.access_token,type,offset:0,limit:100}).catch(error=>({__error:`Oferta Relâmpago (tipo ${type}): ${String(error?.message||error)}`})))
    ]);
    for(const r of [ongoing,upcoming,expired])if(r.error)warnings.push(r.error);
    for(const f of flashResults)if(f?.__error)warnings.push(f.__error);

    const discountMap=new Map();
    for(const [list,listedAs] of [[expired.rows,'ended'],[upcoming.rows,'scheduled'],[ongoing.rows,'active']]){
      for(const d of list)if(d?.discount_id)discountMap.set(String(d.discount_id),{d,listedAs});
    }
    const discountSeed=[...discountMap.values()].sort((a,b)=>Number(b.d?.end_time||0)-Number(a.d?.end_time||0)).slice(0,80);
    const discounts=[];
    for(let i=0;i<discountSeed.length;i+=8){
      const batch=await Promise.all(discountSeed.slice(i,i+8).map(x=>enrichDiscount(shop,x.d,now,x.listedAs)));
      discounts.push(...batch);
    }

    // Ofertas Relâmpago: junta as listas (tipos 1,2,3), sem duplicar pelo flash_sale_id. Deleções ficam fora.
    const flashMap=new Map();
    for(const f of flashResults)for(const sale of arr(f?.response?.flash_sale_list))if(sale?.flash_sale_id)flashMap.set(String(sale.flash_sale_id),sale);
    const flashList=[...flashMap.values()].sort((a,b)=>Number(b?.end_time||0)-Number(a?.end_time||0)).slice(0,60);
    const flashSales=[];
    for(let i=0;i<flashList.length;i+=8){
      const batch=await Promise.all(flashList.slice(i,i+8).map(s=>enrichFlash(shop,s,now)));
      flashSales.push(...batch);
    }

    const all=[...discounts,...flashSales];
    const active=all.filter(x=>x.status==='active').sort((a,b)=>Number(a.end_time||0)-Number(b.end_time||0));
    const scheduled=all.filter(x=>x.status==='scheduled').sort((a,b)=>Number(a.start_time||0)-Number(b.start_time||0));
    const ended=all.filter(x=>x.status==='ended').sort((a,b)=>Number(b.end_time||0)-Number(a.end_time||0));
    const live=x=>x.status==='active'||x.status==='scheduled';
    return NextResponse.json({
      ok:true,generated_at:now,shop_id:String(shop.shop_id),
      summary:{active:active.length,scheduled:scheduled.length,ended:ended.length,discounts:discounts.filter(live).length,flash_sales:flashSales.filter(live).length},
      active,scheduled,ended,discounts,flashSales,
      warnings
    });
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
