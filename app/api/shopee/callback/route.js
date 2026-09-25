// A Shopee redireciona com code e shop_id. O state vincula esse retorno ao
// navegador que iniciou a autorização antes de salvar qualquer credencial.
import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '../../../../lib/shopee';
import { supabaseAdmin } from '../../../../lib/supabase';
import { OAUTH_COOKIE, cookieOptions, validOauthState } from '../../../../lib/shop-session';
import {getAccount} from '../../../../lib/account';

export const dynamic='force-dynamic';
export const runtime='nodejs';

function clearPending(response){
  response.cookies.set(OAUTH_COOKIE,'',{...cookieOptions(0,'/api/shopee/callback'),maxAge:0});
  return response;
}

export async function GET(request){
  const url=new URL(request.url);
  const account=await getAccount();
  if(!account)return NextResponse.redirect(new URL('/login',url.origin));
  const state=url.searchParams.get('gs_state');
  if(!validOauthState(state,request.cookies.get(OAUTH_COOKIE)?.value,account.user_id)){
    return clearPending(NextResponse.json({error:'Autorização expirada ou iniciada em outro navegador. Volte ao Gestor e tente novamente.'},{status:403}));
  }
  const shopeeError=url.searchParams.get('error');
  if(shopeeError){
    return clearPending(NextResponse.json({error:`Shopee retornou erro na autorização: ${shopeeError}`},{status:400}));
  }
  const code=url.searchParams.get('code'),shopId=url.searchParams.get('shop_id');
  if(!code||!shopId||!/^[1-9]\d*$/.test(shopId)||!Number.isSafeInteger(Number(shopId))){
    return clearPending(NextResponse.json({error:'Callback sem code/shop_id válidos.'},{status:400}));
  }
  try{
    const token=await exchangeCodeForToken(code,shopId);
    const {error}=await supabaseAdmin().from('shop_credentials').upsert({
      shop_id:Number(shopId),access_token:token.access_token,refresh_token:token.refresh_token,
      expire_in:token.expire_in,obtained_at:new Date().toISOString(),updated_at:new Date().toISOString(),paused:false
    },{onConflict:'shop_id'});
    if(error)throw new Error(`Erro salvando credenciais no Supabase: ${error.message}`);
    const {data:linked,error:linkError}=await supabaseAdmin().from('gs_accounts')
      .update({shop_id:Number(shopId)}).eq('user_id',account.user_id)
      .eq('session_version',account.session_version).select('user_id').single();
    if(linkError||!linked)throw new Error('Não foi possível vincular a loja à sua conta.');
    const response=NextResponse.redirect(new URL('/?authorized=1',url.origin));
    console.log('[shopee:callback] loja autorizada',JSON.stringify({shopId}));
    return clearPending(response);
  }catch(error){
    console.error('[shopee:callback] falha',String(error?.message||error));
    return clearPending(NextResponse.json({error:String(error?.message||error)},{status:500}));
  }
}
