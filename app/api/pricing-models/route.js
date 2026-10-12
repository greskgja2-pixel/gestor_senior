import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {getItemModelList} from '../../../lib/shopee';
export const dynamic='force-dynamic';
export async function GET(request){
 const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
 const id=Number(new URL(request.url).searchParams.get('item_id'));
 if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:'Produto inválido'},{status:400});
 try{const raw=await getItemModelList({shopId:shop.shop_id,accessToken:shop.access_token,itemId:id});
 if(raw?.error)return NextResponse.json({error:raw.message||'Erro da Shopee'},{status:502});
 return NextResponse.json({items:(raw?.response?.model||[]).map(m=>({id:String(m.model_id),name:m.model_name||'Variação',original_price:m.price_info?.[0]?.original_price??null,current_price:m.price_info?.[0]?.current_price??null,stock:m.stock_info_v2?.summary_info?.total_available_stock??null}))});
 }catch(e){return NextResponse.json({error:String(e.message||e)},{status:502})}
}