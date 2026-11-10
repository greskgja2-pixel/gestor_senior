import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';
export const dynamic='force-dynamic';
// Backup completo (somente leitura) das análises de revenda da loja da sessão: produtos + anúncios conferidos.
export async function GET(){
const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
const db=supabaseAdmin();
const g=await db.from('gs_revenda_garimpo').select('*').eq('shop_id',shop.shop_id).order('id',{ascending:true}).limit(10000);
if(g.error)return NextResponse.json({error:g.error.message},{status:500});
const a=await db.from('gs_revenda_anuncios').select('*').eq('shop_id',shop.shop_id).order('id',{ascending:true}).limit(50000);
if(a.error)return NextResponse.json({error:a.error.message},{status:500});
const now=new Date();
const body=JSON.stringify({exportado_em:now.toISOString(),total_produtos:(g.data||[]).length,total_anuncios:(a.data||[]).length,garimpo:g.data||[],anuncios:a.data||[]},null,1);
return new NextResponse(body,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="backup-revenda-'+now.toISOString().slice(0,10)+'.json"','Cache-Control':'no-store'}});
}
