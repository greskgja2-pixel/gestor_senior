import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getItemBaseInfo,getItemModelList,updateItemPrice} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

const int=v=>Number.isSafeInteger(Number(v))?Number(v):null;
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const pickPrice=m=>{
  const info=Array.isArray(m?.price_info)?m.price_info[0]||{}:{};
  return num(info?.current_price??info?.original_price??m?.current_price??m?.price);
};

export async function POST(request){
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const itemId=int(body?.item_id??body?.itemId);
  const submitted=Array.isArray(body?.prices)?body.prices:[];
  if(!(itemId>0))return NextResponse.json({error:'item_id inválido.'},{status:400});

  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});

  try{
    const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
    const item=base?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
    if(!item)return NextResponse.json({error:'O anúncio não pertence à loja conectada ou não está acessível pela Shopee.'},{status:404});

    let prices=[];
    if(item?.has_model){
      const raw=await getItemModelList({shopId:shop.shop_id,accessToken:shop.access_token,itemId});
      const models=Array.isArray(raw?.response?.model)?raw.response.model:[];
      const allowed=new Set(models.map(x=>String(x?.model_id)));
      prices=submitted.map(row=>({model_id:int(row?.model_id??row?.modelId),price:num(row?.price??row?.original_price)}))
        .filter(row=>row.model_id!=null&&allowed.has(String(row.model_id))&&row.price>0);
      if(!prices.length)return NextResponse.json({error:'Nenhum preço de variação válido foi informado.'},{status:400});
    }else{
      const row=submitted[0]||{};
      const price=num(row?.price??row?.original_price??body?.price);
      if(!(price>0))return NextResponse.json({error:'Informe um preço válido.'},{status:400});
      prices=[{model_id:0,price}];
    }

    await updateItemPrice({shopId:shop.shop_id,accessToken:shop.access_token,itemId,prices});

    let verified=false,actual=[];
    for(let attempt=0;attempt<3;attempt++){
      if(attempt)await new Promise(resolve=>setTimeout(resolve,700));
      if(item?.has_model){
        const raw=await getItemModelList({shopId:shop.shop_id,accessToken:shop.access_token,itemId});
        const models=Array.isArray(raw?.response?.model)?raw.response.model:[];
        actual=prices.map(row=>{
          const m=models.find(x=>Number(x?.model_id)===Number(row.model_id));
          return{model_id:row.model_id,price:pickPrice(m)};
        });
        verified=actual.every((row,index)=>row.price!=null&&Math.abs(row.price-prices[index].price)<0.011);
      }else{
        const check=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
        const current=check?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
        const price=num(current?.price_info?.[0]?.current_price??current?.price_info?.[0]?.original_price);
        actual=[{model_id:0,price}];
        verified=price!=null&&Math.abs(price-prices[0].price)<0.011;
      }
      if(verified)break;
    }

    if(!verified)return NextResponse.json({error:'A Shopee recebeu a alteração, mas a confirmação do novo preço ainda não bateu. Recarregue o anúncio antes de tentar novamente.',verification:actual},{status:502});
    return NextResponse.json({ok:true,item_id:itemId,prices:actual,verified:true});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
