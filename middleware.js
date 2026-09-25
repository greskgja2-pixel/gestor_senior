import {NextResponse} from 'next/server';

const PUBLIC=new Set(['/login','/cadastro','/api/auth/login','/api/auth/register','/api/auth/logout','/api/shopee/callback','/api/cron/flash-sale']);
const MAX_AGE=7*24*60*60*1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder=new TextEncoder();

function decode(value){
  try{return JSON.parse(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)))}
  catch{return null}
}

async function validAccountToken(token){
  if(!token||token.length>512)return false;
  const [payload,signature,...extra]=token.split('.');
  if(!payload||!signature||extra.length)return false;
  const data=decode(payload),now=Date.now();
  if(!data||!UUID.test(data.uid)||!Number.isSafeInteger(data.v)||data.v<1||
    !Number.isSafeInteger(data.exp)||data.exp<=now||data.exp>now+MAX_AGE)return false;
  const configured=process.env.APP_SESSION_SECRET;
  const secret=configured?.length>=32?configured:process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret||secret.length<32)return false;
  const raw=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const derived=await crypto.subtle.sign('HMAC',raw,encoder.encode('gestor-senior/account-session/v1'));
  const key=await crypto.subtle.importKey('raw',derived,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)));
  const expected=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return expected===signature;
}

export async function middleware(request){
  const path=request.nextUrl.pathname;
  if(PUBLIC.has(path))return NextResponse.next();
  if(await validAccountToken(request.cookies.get('gs_account_session')?.value))return NextResponse.next();
  if(path.startsWith('/api/'))return NextResponse.json({error:'Faça login para acessar o Gestor Sênior.'},{status:401});
  const login=new URL('/login',request.url);
  if(path!=='/')login.searchParams.set('next',path);
  return NextResponse.redirect(login);
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)']};
