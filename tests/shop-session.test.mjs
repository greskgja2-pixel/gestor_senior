import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAccountSession,readAccountSession} from '../lib/account-session.js';
import {newOauthState,createOauthPending,validOauthState} from '../lib/shop-session.js';

process.env.APP_SESSION_SECRET='test-only-secret-that-is-longer-than-32-characters';

test('cookie de conta é assinado, distinto para cada pessoa e expira',()=>{
  const time=Date.now();
  const first=createAccountSession('11111111-1111-4111-8111-111111111111',1,time);
  const second=createAccountSession('22222222-2222-4222-8222-222222222222',1,time);
  assert.deepEqual(readAccountSession(first,time),{userId:'11111111-1111-4111-8111-111111111111',version:1});
  assert.equal(readAccountSession(second,time)?.userId,'22222222-2222-4222-8222-222222222222');
  assert.notEqual(first,second);
  assert.equal(readAccountSession(first+'x',time),null);
  assert.equal(readAccountSession(first,time+8*86400000),null);
  assert.equal(readAccountSession('',time),null);
});

test('callback exige o state do mesmo navegador',()=>{
  const state=newOauthState();
  const user='11111111-1111-4111-8111-111111111111';
  const pending=createOauthPending(state,user);
  assert.equal(validOauthState(state,pending,user),true);
  assert.equal(validOauthState(state,pending,'22222222-2222-4222-8222-222222222222'),false);
  assert.equal(validOauthState(newOauthState(),pending,user),false);
  assert.equal(validOauthState(state,null,user),false);
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
  assert.match(logout,/\.eq\('user_id',account\.user_id\)/);
  assert.match(shop,/const account=await getAccount\(\)/);
  assert.match(callback,/\.eq\('user_id',account\.user_id\)/);
});
