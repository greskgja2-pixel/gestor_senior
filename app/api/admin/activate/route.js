import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {getAccount,isAdministrator} from '../../../../lib/account';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request){
  const account=await getAccount();
  if(!account)return NextResponse.json({error:'Faça login.'},{status:401});
  if(await isAdministrator(account))return NextResponse.json({ok:true});
  const {code}=await request.json().catch(()=>({}));
  if(typeof code!=='string'||code.length<32||code.length>128)return NextResponse.json({error:'Código inválido.'},{status:400});
  const hash=crypto.createHash('sha256').update(code.trim()).digest('hex');
  const {data,error}=await supabaseAdmin().from('gs_admin_claim')
    .update({claimed_by:account.user_id,claimed_at:new Date().toISOString(),claim_hash:crypto.randomBytes(32).toString('hex')})
    .eq('id',1).eq('claim_hash',hash).eq('bootstrap_user_id',account.user_id).is('claimed_by',null).select('id').maybeSingle();
  if(error){console.error('[admin:activate]',error.message);return NextResponse.json({error:'Falha ao ativar administrador.'},{status:500})}
  if(!data)return NextResponse.json({error:'Código inválido ou não vinculado a esta conta.'},{status:403});
  return NextResponse.json({ok:true});
}
