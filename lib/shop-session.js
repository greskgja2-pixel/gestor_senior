// Sessões de loja são assinadas no servidor. O navegador recebe somente o ID da
// loja; access_token e refresh_token da Shopee nunca entram no cookie.
import crypto from 'node:crypto';

export const SESSION_COOKIE='gs_shop_session';
export const OAUTH_COOKIE='gs_shop_oauth';
export const SESSION_SECONDS=30*24*60*60;
export const OAUTH_SECONDS=10*60;

function key(){
  const secret=process.env.APP_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret||secret.length<32)throw new Error('Configure APP_SESSION_SECRET (32 caracteres ou mais) ou SUPABASE_SERVICE_ROLE_KEY.');
  return crypto.createHmac('sha256',secret).update('gestor-senior/shop-session/v1').digest();
}

function sign(value){return crypto.createHmac('sha256',key()).update(value).digest('base64url')}

export function createShopSession(shopId,now=Date.now()){
  const id=String(shopId);
  if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))throw new Error('Shop ID inválido.');
  const payload=Buffer.from(JSON.stringify({v:1,shopId:id,expires:now+SESSION_SECONDS*1000})).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function shopIdFromSession(token,now=Date.now()){
  if(typeof token!=='string'||token.length>512)return null;
  const parts=token.split('.');
  if(parts.length!==2||!parts[0]||!parts[1])return null;
  const expected=sign(parts[0]),received=parts[1];
  if(expected.length!==received.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(received)))return null;
  try{
    const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    const id=String(data.shopId||'');
    if(data.v!==1||!Number.isFinite(data.expires)||data.expires<=now||data.expires>now+SESSION_SECONDS*1000||
      !/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return null;
    return id;
  }catch{return null}
}

export function newOauthState(){return crypto.randomBytes(32).toString('base64url')}

export function validOauthState(state,cookie){
  return typeof state==='string'&&typeof cookie==='string'&&
    /^[A-Za-z0-9_-]{43}$/.test(state)&&cookie.length===state.length&&
    crypto.timingSafeEqual(Buffer.from(state),Buffer.from(cookie));
}

export function cookieOptions(maxAge,path='/'){
  return{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path,maxAge};
}
