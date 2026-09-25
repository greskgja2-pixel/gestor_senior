import {NextResponse} from 'next/server';
import {ACCOUNT_COOKIE,accountCookieOptions} from '../../../../lib/account-session';

export const dynamic='force-dynamic';
export async function POST(){
  const response=NextResponse.json({ok:true});
  response.cookies.set(ACCOUNT_COOKIE,'',accountCookieOptions(0));
  return response;
}
