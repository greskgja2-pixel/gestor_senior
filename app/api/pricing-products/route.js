import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {getProducts} from '../../../lib/products';
import {getItemModelList} from '../../../lib/shopee';

export const dynamic='force-dynamic';
export const maxDuration=55;
const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
function modelPrice(m){const p=m?.price_info?.[0]||{};return valid(p.current_price??p.original_price??m.current_price??m.price);}
function modelStock(m){return valid(m?.stock_info_v2?.summary_info?.total_available_stock??m?.stock_info?.[0]?.normal_stock??m?.normal_stock??m?.stock);}
export async function GET(){
 const shop=await getActiveShop();
 if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
 try{
  const {items,source,syncedAt}=await getProducts(shop);
  const enriched=(items||[]).map(x=>({...x}));
  const pending=enriched.map((x,i)=>({x,i})).filter(({x})=>x?.has_model&&(x?.price_info?.[0]?.current_price==null||x?.stock_info_v2?.summary_info?.total_available_stock==null));
  for(let i=0;i<pending.length;i+=6){
   await Promise.all(pending.slice(i,i+6).map(async ({x,i:index})=>{
    try{
     const res=await getItemModelList({shopId:shop.shop_id,accessToken:shop.access_token,itemId:x.item_id});
     if(res?.error)return;
     const models=res?.response?.model;
     if(!Array.isArray(models)||!models.length)return;
     const prices=models.map(modelPrice).filter(v=>v!=null&&v>=0);
     const stocks=models.map(modelStock);
     enriched[index].pricing_variants={
      price_min:prices.length?Math.min(...prices):null,
      price_max:prices.length?Math.max(...prices):null,
      stock_total:stocks.every(v=>v!=null)?stocks.reduce((a,b)=>a+b,0):null,
      model_count:models.length
     };
    }catch(error){console.warn('[pricing-products] variações indisponíveis para item',x.item_id,String(error?.message||error));}
   }));
  }
  return NextResponse.json({items:enriched,source,syncedAt});
 }catch(e){return NextResponse.json({error:String(e?.message||e)},{status:502})}
}
