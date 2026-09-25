import crypto from 'node:crypto';

export const ACCOUNT_COOKIE='gs_account_session';
export const ACCOUNT_SECONDS=7*24*60*60;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function key(){
  const configured=process.env.APP_SESSION_SECRET;
  const secret=configured?.length>=32?configured:process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret||secret.length<32)throw new Error('Chave de sessão não configurada.');
  return crypto.createHmac('sha256',secret).update('gestor-senior/account-session/v1').digest();
}
function sign(payload){return crypto.createHmac('sha256',key()).update(payload).digest('base64url')}

export function createAccountSession(userId,version,now=Date.now()){
  if(!UUID.test(userId)||!Number.isSafeInteger(version)||version<1)throw new Error('Conta inválida.');
  const payload=Buffer.from(JSON.stringify({uid:userId,v:version,exp:now+ACCOUNT_SECONDS*1000})).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readAccountSession(token,now=Date.now()){
  if(typeof token!=='string'||token.length>512)return null;
  const parts=token.split('.');
  if(parts.length!==2||!parts[0]||!parts[1])return null;
  const expected=sign(parts[0]);
  if(expected.length!==parts[1].length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(parts[1])))return null;
  try{
    const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if(!UUID.test(data.uid)||!Number.isSafeInteger(data.v)||data.v<1||
      !Number.isSafeInteger(data.exp)||data.exp<=now||data.exp>now+ACCOUNT_SECONDS*1000)return null;
    return{userId:data.uid,version:data.v};
  }catch{return null}
}

export function accountCookieOptions(maxAge=ACCOUNT_SECONDS){
  return{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge};
}
