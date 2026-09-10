import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/shopee.js', import.meta.url), 'utf8');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('authorization, token exchange, refresh and shop signing', async (t) => {
  process.env.SHOPEE_ENV = ' test ';
  process.env.SHOPEE_PARTNER_ID = ' 1243923 ';
  process.env.SHOPEE_PARTNER_KEY = 'test-only-key';
  t.mock.method(Date, 'now', () => 1700000000000);
  const hmac = base => crypto.createHmac('sha256', 'test-only-key').update(base).digest('hex');
  const auth = new URL(api.buildShopAuthUrl('https://example.com/api/shopee/callback'));
  assert.equal(auth.origin, 'https://openplatform.sandbox.test-stable.shopee.sg');
  assert.equal(auth.searchParams.get('partner_id'), '1243923');
  assert.equal(auth.searchParams.get('sign'), hmac('1243923/api/v2/shop/auth_partner1700000000'));
  let calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: new URL(url), options });
    return new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expire_in: 14400 }));
  });
  await api.exchangeCodeForToken('code', '123');
  assert.equal(calls[0].url.searchParams.get('sign'), hmac('1243923/api/v2/auth/token/get1700000000'));
  assert.deepEqual(JSON.parse(calls[0].options.body), { code: 'code', shop_id: 123, partner_id: 1243923 });
  assert.equal(calls[0].options.cache, 'no-store');
  await api.refreshAccessToken('refresh', 123);
  assert.equal(calls[1].url.searchParams.get('sign'), hmac('1243923/api/v2/auth/access_token/get1700000000'));
  await api.getItemList({ shopId: 123, accessToken: 'access' });
  assert.equal(calls[2].url.searchParams.get('sign'), hmac('1243923/api/v2/product/get_item_list1700000000access123'));
  await assert.rejects(api.exchangeCodeForToken('code', 'invalid'), /válidos/);
  assert.equal(calls.length, 3);
  process.env.SHOPEE_ENV = 'typo';
  assert.throws(() => api.buildShopAuthUrl('https://example.com'), /test ou live/);
  process.env.SHOPEE_ENV = 'test';
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'error_sign', message: 'Wrong sign.' }));
  await assert.rejects(api.exchangeCodeForToken('code', 123), /error_sign/);
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'partial' }));
  await assert.rejects(api.exchangeCodeForToken('code', 123), /incompleta/);
});
