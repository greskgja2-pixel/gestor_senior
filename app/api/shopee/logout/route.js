// Sair encerra apenas a sessão deste navegador. Outra loja conectada continua ativa.
import {NextResponse} from 'next/server';
import {SESSION_COOKIE,cookieOptions} from '../../../../lib/shop-session';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function POST(){
  const response=NextResponse.json({ok:true});
  response.cookies.set(SESSION_COOKIE,'',{...cookieOptions(0),maxAge:0});
  return response;
}
