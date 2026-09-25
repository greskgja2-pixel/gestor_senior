import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {getAccount,isAdministrator} from '../../../../lib/account';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(){
  const account=await getAccount();
  if(!account||!(await isAdministrator(account)))return NextResponse.json({error:'Acesso restrito.'},{status:403});
  const code=crypto.randomBytes(24).toString('hex');
  const codeHash=crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
  const {error}=await supabaseAdmin().from('gs_signup_invites').insert({code_hash:codeHash,created_by:account.user_id,expires_at:expiresAt});
  if(error)return NextResponse.json({error:'Não foi possível gerar convite.'},{status:500});
  return NextResponse.json({code,expiresAt},{headers:{'Cache-Control':'private, no-store'}});
}
