import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
import {readAllRevendaRows} from '../../lib/revenda-read-all';
export const dynamic='force-dynamic';
export async function GET(){
const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
const db=supabaseAdmin();
const {data,error}=await readAllRevendaRows(()=>db.from('gs_revenda_garimpo').select('*').eq('shop_id',shop.shop_id).order('id',{ascending:true}));
if(error)return NextResponse.json({error:error.message},{status:500});
const ads=await readAllRevendaRows(()=>db.from('gs_revenda_anuncios').select('*').eq('shop_id',shop.shop_id).order('id',{ascending:true}));
if(ads.error)return NextResponse.json({error:ads.error.message},{status:500});
const by={};
for(const a of [...ads.data].sort((a,b)=>(b.vendas_30d??-1)-(a.vendas_30d??-1))){(by[a.garimpo_id]=by[a.garimpo_id]||[]).push(a)}
return NextResponse.json({items:data.map(it=>({...it,anuncios:by[it.id]||[]}))});
}
