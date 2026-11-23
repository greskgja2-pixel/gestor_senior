import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
import {readAllRevendaRows} from '../../lib/revenda-read-all';
import {cleanMarcadores,MAX_MARCADORES,MAX_MARCADOR_LEN} from '../../lib/revenda-marcadores';
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
// Marcadores do usuário por produto (ex.: "Sem estoque", "Vou testar"). Só mexe na coluna marcadores.
export async function PATCH(request){
const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
let body;try{body=await request.json()}catch{return NextResponse.json({error:'Pedido inválido'},{status:400})}
const id=Number(body&&body.id);
const marcadores=cleanMarcadores(body&&body.marcadores);
if(!Number.isInteger(id)||id<=0||marcadores===null)return NextResponse.json({error:'Marcadores inválidos (até '+MAX_MARCADORES+', com até '+MAX_MARCADOR_LEN+' letras cada)'},{status:400});
const {data,error}=await supabaseAdmin().from('gs_revenda_garimpo').update({marcadores}).eq('id',id).eq('shop_id',shop.shop_id).select('id,marcadores');
if(error)return NextResponse.json({error:error.message},{status:500});
if(!data||!data.length)return NextResponse.json({error:'Produto não encontrado'},{status:404});
return NextResponse.json({id:data[0].id,marcadores:data[0].marcadores||[]});
}
