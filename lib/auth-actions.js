import {supabaseAdmin} from './supabase';
import {ACCOUNT_COOKIE,accountCookieOptions,createAccountSession} from './account-session';

export async function loginAccount(response,user){
  const db=supabaseAdmin();
  const email=String(user.email||'').toLowerCase();
  const displayName=String(user.user_metadata?.display_name||'').slice(0,100);
  const {error:insertError}=await db.from('gs_accounts').upsert({user_id:user.id,email,display_name:displayName},{onConflict:'user_id',ignoreDuplicates:true});
  // O cadastro pode ter sido iniciado em outro dispositivo. Nunca sobrescrever shop_id.
  if(insertError&&insertError.code!=='23505')throw insertError;
  const {data,error}=await db.from('gs_accounts')
    .update({email,display_name:displayName,last_login_at:new Date().toISOString()})
    .eq('user_id',user.id).select('session_version').single();
  if(error||!data)throw new Error('Não foi possível iniciar sua sessão.');
  response.cookies.set(ACCOUNT_COOKIE,createAccountSession(user.id,data.session_version),accountCookieOptions());
  return response;
}
