import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {getDiscountList,getDiscount} from '../../../lib/shopee';
export const dynamic='force-dynamic';
export const maxDuration=55;
const arr=v=>Array.isArray(v)?v:[];
export async function GET(){
 const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
 try{
 const lists=await Promise.all(['ongoing','upcoming'].map(async status=>{try{const r=await getDiscountList({shopId:shop.shop_id,accessToken:shop.access_token,discountStatus:status,pageNo:1,pageSize:100});return arr(r?.response?.discount_list)}catch{return []}}));
 const found=new Map();for(const d of lists.flat())if(d?.discount_id)found.set(String(d.discount_id),d);
 const promos=[];const seeds=[...found.values()].slice(0,60);
 for(let i=0;i<seeds.length;i+=6){
 const chunk=await Promise.all(seeds.slice(i,i+6).map(async d=>{try{
 const v=await getDiscount({shopId:shop.shop_id,accessToken:shop.access_token,discountId:d.discount_id,pageNo:1,pageSize:100});
 const x=v?.response||{};
 return {id:String(d.discount_id),name:x.discount_name||d.discount_name||'Promoção',start_time:x.start_time??d.start_time,end_time:x.end_time??d.end_time,items:arr(x.item_list).map(it=>({item_id:String(it.item_id),promotion_price:it.item_promotion_price??it.item_local_promotion_price??null,models:arr(it.model_list).map(m=>({model_id:String(m.model_id),name:m.model_name||'',promotion_price:m.model_promotion_price??m.model_local_promotion_price??null}))}))};
 }catch{return null}}));promos.push(...chunk.filter(Boolean))}
 return NextResponse.json({items:promos,partial:found.size>seeds.length});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:502})}
}
