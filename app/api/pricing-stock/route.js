import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {updateItemStock} from '../../../lib/shopee';
import {supabaseAdmin} from '../../../lib/supabase';
export async function POST(req){
 const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
 const b=await req.json().catch(()=>({}));const itemId=Number(b.item_id),modelId=Number(b.model_id??0),quantity=Number(b.stock);
 if(!Number.isSafeInteger(itemId)||itemId<=0||!Number.isSafeInteger(modelId)||modelId<0||!Number.isSafeInteger(quantity)||quantity<0)return NextResponse.json({error:'Estoque inválido'},{status:400});
 try{
 const result=await updateItemStock({shopId:shop.shop_id,accessToken:shop.access_token,itemId,stocks:[{model_id:modelId,stock:quantity}]});
 if(result?.error)return NextResponse.json({error:result.message||String(result.error)},{status:502});
 const audit=await supabaseAdmin().from('gs_pricing_history').insert({shop_id:shop.shop_id,item_id:itemId,model_id:modelId,change_type:'stock',new_value:quantity,details:{source:'precificacao',confirmed:true}});return NextResponse.json({ok:true,result:result?.response??null,auditSaved:!audit.error,auditError:audit.error?.message||null});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:502})}
}