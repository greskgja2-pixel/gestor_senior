// O state da Shopee fica vinculado à conta autenticada que iniciou o fluxo.
import crypto from 'node:crypto';

export const OAUTH_COOKIE='gs_shop_oauth';
export const OAUTH_SECONDS=10*60;

function key(){
  const configured=process.env.APP_SESSION_SECRET;
  const secret=configured?.length>=32?configured:process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret||secret.length<32)throw new Error('Configure APP_SESSION_SECRET (32 caracteres ou mais) ou SUPABASE_SERVICE_ROLE_KEY.');
  return crypto.createHmac('sha256',secret).update('gestor-senior/shop-session/v1').digest();
}

function sign(value){return crypto.createHmac('sha256',key()).update(value).digest('base64url')}

export function newOauthState(){return crypto.randomBytes(32).toString('base64url')}

export function createOauthPending(state,userId){
  return `${state}.${sign(`oauth:${state}:${userId}`)}`;
}

export function validOauthState(state,cookie,userId){
  if(typeof state!=='string'||typeof cookie!=='string'||typeof userId!=='string'||
    !/^[A-Za-z0-9_-]{43}$/.test(state))return false;
  const expected=createOauthPending(state,userId);
  return expected.length===cookie.length&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(cookie));
}

export function cookieOptions(maxAge,path='/'){
  return{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path,maxAge};
}
