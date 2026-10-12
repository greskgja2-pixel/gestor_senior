import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
 const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
 const {data,error}=await supabaseAdmin().from('product_costs').select('item_id,model_id,cost,packaging_cost').eq('shop_id',shop.shop_id);
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({items:data||[]});
}
export async function POST(req){
 const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
 let body;try{body=await req.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
 const entries=Array.isArray(body.items)?body.items:[];
 if(!entries.length||entries.length>100)return NextResponse.json({error:'Informe entre 1 e 100 produtos'},{status:400});
 const rows=[];
 for(const x of entries){
 const itemId=Number(x.item_id),modelId=Number(x.model_id??0),cost=Number(x.cost),pack=Number(x.packaging_cost);
 if(!Number.isSafeInteger(itemId)||itemId<=0||!Number.isSafeInteger(modelId)||modelId<0||!Number.isFinite(cost)||cost<0||!Number.isFinite(pack)||pack<0)return NextResponse.json({error:'Valores inválidos'},{status:400});
 rows.push({shop_id:shop.shop_id,item_id:itemId,model_id:modelId,cost,packaging_cost:pack,updated_at:new Date().toISOString()});
 }
 const {error}=await supabaseAdmin().from('product_costs').upsert(rows,{onConflict:'shop_id,item_id,model_id'});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true,count:rows.length});
}