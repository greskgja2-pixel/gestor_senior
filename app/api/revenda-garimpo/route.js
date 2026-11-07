import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
const {data,error}=await supabaseAdmin().from('gs_revenda_garimpo').select('*').eq('shop_id',shop.shop_id).order('pesquisado_em',{ascending:false}).limit(1000);
if(error)return NextResponse.json({error:error.message},{status:500});
return NextResponse.json({items:data||[]});
}
