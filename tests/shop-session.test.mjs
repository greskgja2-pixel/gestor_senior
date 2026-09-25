import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createShopSession,shopIdFromSession,newOauthState,validOauthState} from '../lib/shop-session.js';

process.env.APP_SESSION_SECRET='test-only-secret-that-is-longer-than-32-characters';

test('cada cookie assinado resolve somente a loja autorizada',()=>{
  const time=Date.now();
  const first=createShopSession('12345',time);
  const second=createShopSession('67890',time);
  assert.equal(shopIdFromSession(first,time),'12345');
  assert.equal(shopIdFromSession(second,time),'67890');
  assert.notEqual(first,second);
  assert.equal(shopIdFromSession(first+'x',time),null);
  assert.equal(shopIdFromSession(first,time+31*86400000),null);
  assert.equal(shopIdFromSession('',time),null);
});

test('callback exige o state do mesmo navegador',()=>{
  const state=newOauthState();
  assert.equal(validOauthState(state,state),true);
  assert.equal(validOauthState(state,newOauthState()),false);
  assert.equal(validOauthState(state,null),false);
});

test('credenciais e cron sempre selecionam shop_id explicitamente',()=>{
  const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const shop=read('lib/shop.js');
  const callback=read('app/api/shopee/callback/route.js');
  const cron=read('app/api/cron/flash-sale/route.js');
  const logout=read('app/api/shopee/logout/route.js');
  assert.match(shop,/\.eq\('shop_id',Number\(shopId\)\)/);
  assert.doesNotMatch(shop,/\.order\("updated_at"/);
  assert.doesNotMatch(shop,/\.not\("id"/);
  assert.ok(callback.indexOf('validOauthState(')<callback.indexOf('exchangeCodeForToken('));
  assert.match(cron,/getShopById\(key\)/);
  assert.match(logout,/response\.cookies\.set\(SESSION_COOKIE,''/);
});
