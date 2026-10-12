import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
const {data,error}=await supabaseAdmin().from('gs_pricing_history').select('id,item_id,model_id,change_type,old_value,new_value,details,created_at').eq('shop_id',shop.shop_id).order('created_at',{ascending:false}).limit(250);
if(error)return NextResponse.json({error:error.message},{status:500});
return NextResponse.json({items:data||[]});
}