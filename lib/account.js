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
  const {data,error}=await supabaseAdmin().from('gs_admin_claim')
    .select('id,claimed_by,bootstrap_user_id')
    .eq('id',1)
    .maybeSingle();
  if(error)throw new Error(`Erro consultando administrador: ${error.message}`);
  if(!data)return false;
  // A primeira conta proprietária continua sendo administradora mesmo antes de
  // concluir o antigo fluxo de ativação por código.
  return data.claimed_by===account.user_id||data.bootstrap_user_id===account.user_id;
}
