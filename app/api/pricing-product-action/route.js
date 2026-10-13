import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {unlistItem,deleteItem,getItemBaseInfo} from '../../../lib/shopee';
export const dynamic='force-dynamic';
export async function POST(request){
 const shop=await getActiveShop();
 if(!shop)return NextResponse.json({error:'Faça login e conecte sua loja Shopee.'},{status:401});
 const body=await request.json().catch(()=>({}));
 const itemId=Number(body.item_id),action=body.action;
 if(!Number.isSafeInteger(itemId)||itemId<=0||!['unlist','delete'].includes(action))return NextResponse.json({error:'Produto ou ação inválida'},{status:400});
 if(body.confirmation!==String(itemId))return NextResponse.json({error:'Confirme digitando exatamente o ID do anúncio.'},{status:400});
 try{
  const info=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
  const exists=info?.response?.item_list?.some(i=>Number(i.item_id)===itemId);
  if(info?.error||!exists)return NextResponse.json({error:'Não foi possível confirmar que o anúncio pertence à loja conectada.'},{status:409});
  const result=action==='unlist'?await unlistItem({shopId:shop.shop_id,accessToken:shop.access_token,itemId,unlist:true}):await deleteItem({shopId:shop.shop_id,accessToken:shop.access_token,itemId});
  if(result?.error)return NextResponse.json({error:result.message||String(result.error)},{status:502});
  const failed=result?.response?.failure_list||result?.response?.failed_list||result?.response?.failed_item_list||[];
  if(Array.isArray(failed)&&failed.length)return NextResponse.json({error:'Shopee recusou a alteração: '+JSON.stringify(failed).slice(0,400)},{status:502});
  return NextResponse.json({ok:true,item_id:itemId,action,result:result?.response??null});
 }catch(e){return NextResponse.json({error:String(e?.message||e)},{status:502})}
}
