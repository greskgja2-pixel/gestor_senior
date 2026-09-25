import {cookies} from 'next/headers';
import {supabaseAdmin} from './supabase';
import {ACCOUNT_COOKIE,readAccountSession} from './account-session';

export async function getAccount(){
  const session=readAccountSession(cookies().get(ACCOUNT_COOKIE)?.value);
  if(!session)return null;
  const {data,error}=await supabaseAdmin().from('gs_accounts').select('*').eq('user_id',session.userId).maybeSingle();
  if(error)throw new Error(`Erro consultando conta: ${error.message}`);
  return data?.session_version===session.version?data:null;
}

export async function isAdministrator(account){
  if(!account)return false;
  const {data,error}=await supabaseAdmin().from('gs_admin_claim').select('id').eq('claimed_by',account.user_id).maybeSingle();
  if(error)throw new Error(`Erro consultando administrador: ${error.message}`);
  return !!data;
}
