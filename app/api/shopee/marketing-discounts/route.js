import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getDiscountList,getDiscount} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=45;

const int=v=>Number.isSafeInteger(Number(v))?Number(v):null;
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const arr=v=>Array.isArray(v)?v:[];

async function mapDiscount(shop,discount){
  const out=[];
  for(let page=1;page<=10;page++){
    const raw=await getDiscount({shopId:shop.shop_id,accessToken:shop.access_token,discountId:discount.discount_id,pageNo:page,pageSize:100});
    const response=raw?.response||{};
    for(const item of arr(response.item_list)){
      const models=arr(item?.model_list).map(model=>({
        model_id:int(model?.model_id),
        name:model?.model_name||null,
        original_price:num(model?.model_original_price??model?.model_local_price),
        promotion_price:num(model?.model_promotion_price??model?.model_local_promotion_price)
      }));
      out.push({
        item_id:int(item?.item_id),
        discount_id:int(response?.discount_id??discount?.discount_id),
        discount_name:response?.discount_name||discount?.discount_name||'Desconto da loja',
        start_time:int(response?.start_time??discount?.start_time),
        end_time:int(response?.end_time??discount?.end_time),
        source:int(discount?.source),
        original_price:num(item?.item_original_price??item?.item_local_price),
        promotion_price:num(item?.item_promotion_price??item?.item_local_promotion_price),
        models
      });
    }
    if(!response?.more)break;
  }
  return out;
}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const url=new URL(request.url);
  const wanted=new Set(String(url.searchParams.get('item_ids')||'').split(',').map(x=>String(x).trim()).filter(Boolean));
  if(!wanted.size)return NextResponse.json({items:{},count:0});

  try{
    const list=await getDiscountList({shopId:shop.shop_id,accessToken:shop.access_token,discountStatus:'ongoing',pageNo:1,pageSize:100});
    const discounts=arr(list?.response?.discount_list)
      .filter(d=>Number(d?.source)===0)
      .slice(0,60);

    const all=[];
    for(let i=0;i<discounts.length;i+=6){
      const batch=await Promise.allSettled(discounts.slice(i,i+6).map(d=>mapDiscount(shop,d)));
      for(const result of batch)if(result.status==='fulfilled')all.push(...result.value);
    }

    const items={};
    for(const row of all){
      const key=String(row.item_id||'');
      if(!wanted.has(key))continue;
      const prices=[
        num(row.promotion_price),
        ...arr(row.models).map(m=>num(m.promotion_price))
      ].filter(x=>x!=null&&x>0);
      const originals=[
        num(row.original_price),
        ...arr(row.models).map(m=>num(m.original_price))
      ].filter(x=>x!=null&&x>0);
      const candidate={...row,offer_price:prices.length?Math.min(...prices):null,full_price:originals.length?Math.min(...originals):null};
      if(!items[key]||((candidate.offer_price??Infinity)<(items[key].offer_price??Infinity)))items[key]=candidate;
    }
    return NextResponse.json({items,count:Object.keys(items).length});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
