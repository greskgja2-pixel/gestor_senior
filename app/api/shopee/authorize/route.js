// A autorização oficial da Shopee abre uma sessão somente para a loja que
// concedeu acesso. O código de autorização e os tokens nunca chegam ao cliente.
import { NextResponse } from 'next/server';
import { buildShopAuthUrl, currentShopeeEnv } from '../../../../lib/shopee';
import { OAUTH_COOKIE, OAUTH_SECONDS, cookieOptions, newOauthState,createOauthPending } from '../../../../lib/shop-session';
import {getAccount} from '../../../../lib/account';

export const dynamic='force-dynamic';
export const runtime='nodejs';

// O domínio de callback precisa estar cadastrado na Shopee Open Platform.
const SHOPEE_CONSOLE_REDIRECT_DOMAIN='https://shopeeos-real-greskgja.vercel.app';

export async function GET(request){
  try{
    const account=await getAccount();
    if(!account)return NextResponse.redirect(new URL('/login?next=/api/shopee/authorize',request.url));
    const redirect=new URL(process.env.SHOPEE_REDIRECT_URL?.trim()||`${SHOPEE_CONSOLE_REDIRECT_DOMAIN}/api/shopee/callback`);
    if(redirect.protocol!=='https:'&&process.env.NODE_ENV==='production')throw new Error('O callback da Shopee precisa usar HTTPS.');
    // Prévia/alias deve iniciar o login no domínio do callback: cookies host-only
    // do domínio de prévia não acompanham o retorno ao domínio cadastrado.
    if(new URL(request.url).origin!==redirect.origin){
      return NextResponse.redirect(new URL('/api/shopee/authorize',redirect.origin));
    }
    const state=newOauthState();
    redirect.searchParams.set('gs_state',state);
    const authUrl=buildShopAuthUrl(redirect.toString());
    console.log('[shopee:authorize] autorização iniciada',JSON.stringify({env:currentShopeeEnv(),redirectHost:redirect.host}));
    const response=NextResponse.redirect(authUrl);
    response.cookies.set(OAUTH_COOKIE,createOauthPending(state,account.user_id),cookieOptions(OAUTH_SECONDS,'/api/shopee/callback'));
    return response;
  }catch(error){
    console.error('[shopee:authorize] falha',String(error?.message||error));
    return NextResponse.json({error:String(error?.message||error)},{status:500});
  }
}
