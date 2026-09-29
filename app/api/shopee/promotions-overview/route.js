import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getDiscountList,getDiscount,getShopFlashSaleList,getShopFlashSaleItems} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=55;

const arr=v=>Array.isArray(v)?v:[];
const int=v=>Number.isFinite(Number(v))?Number(v):null;
const num=v=>Number.isFinite(Number(v))?Number(v):null;

function statusFromTime(start,end,now){
  if(start&&start>now)return 'scheduled';
  if(end&&end<=now)return 'ended';
  return 'active';
}
function moneyValue(...values){
  for(const value of values){const n=num(value);if(n!=null&&n>0)return n}
  return null;
}
async function discountRows(shop,status){
  try{
    const raw=await getDiscountList({shopId:shop.shop_id,accessToken:shop.access_token,discountStatus:status,pageNo:1,pageSize:100});
    return arr(raw?.response?.discount_list);
  }catch(error){
    console.warn('[promotions-overview] desconto indisponível',status,error);
    return[];
  }
}
async function enrichDiscount(shop,d,now){
  let detail=null;
  try{detail=await getDiscount({shopId:shop.shop_id,accessToken:shop.access_token,discountId:d.discount_id,pageNo:1,pageSize:100})}catch{}
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
  return{
    kind:'discount',id:int(d?.discount_id),name:response?.discount_name||d?.discount_name||'Campanha de desconto',
    status:statusFromTime(start,end,now),start_time:start,end_time:end,source:int(d?.source),
    item_count:items.length,has_more:!!response?.more,min_promo_price:prices.length?Math.min(...prices):null
  };
}
function flashItemRows(raw){
  const response=raw?.response||{};
  const infos=arr(response?.item_info);
  const models=arr(response?.models);
  const ids=new Set([...infos.map(x=>String(x?.item_id||'')),...models.map(x=>String(x?.item_id||''))].filter(Boolean));
  return{count:ids.size,items:infos.slice(0,4).map(x=>({item_id:int(x?.item_id),name:x?.item_name||null,image:x?.image||null}))};
}
async function enrichFlash(shop,sale,now){
  let itemData={count:0,items:[]};
  try{
    const raw=await getShopFlashSaleItems({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId:sale.flash_sale_id,offset:0,limit:100});
    itemData=flashItemRows(raw);
  }catch(error){console.warn('[promotions-overview] itens flash sale indisponíveis',sale?.flash_sale_id,error)}
  const start=int(sale?.start_time),end=int(sale?.end_time);
  return{kind:'flash_sale',id:int(sale?.flash_sale_id),name:'Oferta Relâmpago',status:statusFromTime(start,end,now),start_time:start,end_time:end,item_count:itemData.count,items:itemData.items};
}

export async function GET(){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const now=Math.floor(Date.now()/1000);
  try{
    const [ongoing,upcoming,expired,flashRaw]=await Promise.all([
      discountRows(shop,'ongoing'),discountRows(shop,'upcoming'),discountRows(shop,'expired'),
      getShopFlashSaleList({shopId:shop.shop_id,accessToken:shop.access_token,type:2,offset:0,limit:100}).catch(error=>({__error:String(error?.message||error)}))
    ]);
    const discountMap=new Map();
    for(const d of [...ongoing,...upcoming,...expired])if(d?.discount_id)discountMap.set(String(d.discount_id),d);
    const discountSeed=[...discountMap.values()].sort((a,b)=>Number(b?.end_time||0)-Number(a?.end_time||0)).slice(0,80);
    const discounts=[];
    for(let i=0;i<discountSeed.length;i+=8){
      const batch=await Promise.all(discountSeed.slice(i,i+8).map(d=>enrichDiscount(shop,d,now)));
      discounts.push(...batch);
    }

    const flashSales=[];
    const flashList=arr(flashRaw?.response?.flash_sale_list).filter(x=>Number(x?.type)===2).sort((a,b)=>Number(b?.end_time||0)-Number(a?.end_time||0)).slice(0,60);
    for(let i=0;i<flashList.length;i+=8){
      const batch=await Promise.all(flashList.slice(i,i+8).map(s=>enrichFlash(shop,s,now)));
      flashSales.push(...batch);
    }

    const active=[...discounts,...flashSales].filter(x=>x.status==='active').sort((a,b)=>Number(a.end_time||0)-Number(b.end_time||0));
    const scheduled=[...discounts,...flashSales].filter(x=>x.status==='scheduled').sort((a,b)=>Number(a.start_time||0)-Number(b.start_time||0));
    return NextResponse.json({
      ok:true,generated_at:now,
      summary:{active:active.length,scheduled:scheduled.length,discounts:discounts.filter(x=>x.status!=='ended').length,flash_sales:flashSales.filter(x=>x.status!=='ended').length},
      active,scheduled,discounts,flashSales,
      warnings:flashRaw?.__error?[flashRaw.__error]:[]
    });
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
