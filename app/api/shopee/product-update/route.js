import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getItemBaseInfo,updateItem} from '../../../../lib/shopee';

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
  const allowedKeys=new Set(['title','description']);
  const unknownKeys=Object.keys(requested).filter(key=>!allowedKeys.has(key));
  if(unknownKeys.length){
    return NextResponse.json({
      error:'Nesta primeira fase, somente Título e Descrição podem ser publicados diretamente na Shopee.',
      unsupported:unknownKeys
    },{status:409});
  }

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
  if(!Object.keys(itemFields).length){
    return NextResponse.json({error:'Nenhuma alteração real de Título ou Descrição para salvar.'},{status:400});
  }

  try{
    const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
    const current=base?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
    if(!current)return NextResponse.json({error:'O anúncio não pertence à loja conectada ou não está acessível pela Shopee.'},{status:404});

    await updateItem({shopId:shop.shop_id,accessToken:shop.access_token,itemId,fields:itemFields});

    let verified=null;
    for(let attempt=0;attempt<3;attempt++){
      if(attempt>0)await new Promise(resolve=>setTimeout(resolve,700));
      const check=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
      const item=check?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
      if(!item)continue;
      const titleOk=itemFields.item_name===undefined||String(item?.item_name??'').trim()===String(itemFields.item_name).trim();
      const descriptionOk=itemFields.description===undefined||String(item?.description??'').trim()===String(itemFields.description).trim();
      verified={titleOk,descriptionOk};
      if(titleOk&&descriptionOk)break;
    }

    if(!verified?.titleOk||!verified?.descriptionOk){
      return NextResponse.json({
        error:'A Shopee recebeu a alteração, mas a confirmação de persistência ainda não bateu com o valor enviado. Recarregue o anúncio antes de tentar novamente.',
        verification:{title:verified?.titleOk??false,description:verified?.descriptionOk??false}
      },{status:502});
    }

    const applied=[];
    if(itemFields.item_name!==undefined)applied.push('title');
    if(itemFields.description!==undefined)applied.push('description');
    return NextResponse.json({ok:true,item_id:itemId,applied,verified:true});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
