import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getItemBaseInfo,updateItem,updateItemPrice} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

const positiveInt=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null};
const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const text=(v,max)=>String(v??'').trim().slice(0,max);

export async function POST(request){
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const itemId=positiveInt(body?.item_id??body?.itemId);
  if(!itemId)return NextResponse.json({error:'item_id inválido.'},{status:400});
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});

  const requested=body?.changes&&typeof body.changes==='object'?body.changes:{};
  const itemFields={};
  if(Object.prototype.hasOwnProperty.call(requested,'title')){
    const value=text(requested.title,120);
    if(!value)return NextResponse.json({error:'O título não pode ficar vazio.'},{status:400});
    itemFields.item_name=value;
  }
  if(Object.prototype.hasOwnProperty.call(requested,'description')){
    const value=String(requested.description??'').trim();
    if(!value)return NextResponse.json({error:'A descrição não pode ficar vazia.'},{status:400});
    itemFields.description=value;
  }
  if(Object.prototype.hasOwnProperty.call(requested,'categoryId')){
    const categoryId=positiveInt(requested.categoryId);
    if(!categoryId)return NextResponse.json({error:'Categoria Shopee inválida.'},{status:400});
    itemFields.category_id=categoryId;
  }
  const price=Object.prototype.hasOwnProperty.call(requested,'price')?finite(requested.price):null;
  if(Object.prototype.hasOwnProperty.call(requested,'price')&&!(price>0)){
    return NextResponse.json({error:'O preço precisa ser maior que zero.'},{status:400});
  }
  if(!Object.keys(itemFields).length&&price==null){
    return NextResponse.json({error:'Nenhuma alteração real para salvar.'},{status:400});
  }

  try{
    const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
    const current=base?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
    if(!current)return NextResponse.json({error:'O anúncio não pertence à loja conectada ou não está acessível pela Shopee.'},{status:404});

    if(price!=null&&current?.has_model){
      return NextResponse.json({
        error:'Este anúncio possui variações. O preço precisa ser alterado por variação; nenhuma alteração foi enviada para evitar uma atualização parcial do anúncio.'
      },{status:409});
    }

    const applied=[];
    if(Object.keys(itemFields).length){
      await updateItem({shopId:shop.shop_id,accessToken:shop.access_token,itemId,fields:itemFields});
      if(itemFields.item_name!==undefined)applied.push('title');
      if(itemFields.description!==undefined)applied.push('description');
      if(itemFields.category_id!==undefined)applied.push('categoryId');
    }
    if(price!=null){
      await updateItemPrice({shopId:shop.shop_id,accessToken:shop.access_token,itemId,priceList:[{model_id:0,original_price:price}]});
      applied.push('price');
    }
    return NextResponse.json({ok:true,item_id:itemId,applied});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
