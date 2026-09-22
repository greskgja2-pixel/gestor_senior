import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const helper=read('app/lib/client-async.js');
const refresh=read('app/components/RefreshButton.js');
const flow=read('app/super-analise/WebAuditFlow.js');
const adsView=read('app/extensao-shopee-intelligence/IntelligenceSections.js');
const roas=read('app/protecao-roas/ProtectionRoasDashboard.js');
const dashboard=read('app/DashboardNative.js');
const adsApi=read('app/api/shopee/ads/route.js');

test('helper compartilhado encerra fetch e Motor Senior por timeout',()=>{
  assert.match(helper,/class TimeoutError/);
  assert.match(helper,/new AbortController/);
  assert.match(helper,/controller\.abort/);
  assert.match(helper,/removeEventListener\('message',onMessage\)/);
  assert.match(helper,/finish\(reject,new TimeoutError/);
});

test('botoes de atualizacao sempre chegam a estado final',()=>{
  assert.match(refresh,/setPhase\("success"\)/);
  assert.match(refresh,/setPhase\(kind\)/);
  assert.match(refresh,/disabled=\{phase==="loading"\}/);
  assert.match(refresh,/Tentar novamente/);
});

test('Super Analise possui estados finais e libera loading',()=>{
  for(const state of ["'loading'","'success'","'empty'","'error'","'timeout'"])assert.ok(flow.includes(state),'estado ausente: '+state);
  assert.match(flow,/setLoading\(false\)/);
  assert.match(flow,/Tentar novamente/);
});

test('Shopee Ads nao depende indefinidamente do Motor Senior',()=>{
  assert.match(adsView,/fetchJsonWithTimeout\('\/api\/shopee\/ads\?days=30'/);
  assert.match(adsView,/motorRequest\('syncShopeeAds'/);
  assert.ok(adsView.includes("'empty'"),'estado empty ausente no fluxo de Shopee Ads');
  assert.match(adsView,/setPhase\(kind\)/);
  assert.match(adsView,/Tentar novamente/);
});

test('Protecao ROAS nao mostra zero antes de confirmar fonte',()=>{
  assert.match(roas,/hasResolved/);
  assert.match(roas,/dataKnown\?rows\.length:'—'/);
  assert.match(roas,/Nenhum zero é assumido/);
  assert.match(roas,/fetchJsonWithTimeout\('\/api\/shopee\/ads/);
  assert.match(roas,/disabled=\{busy\}/);
});

test('Dashboard nativo preserva ausencia de fonte sem transformar em zero',()=>{
  assert.match(dashboard,/Promise\.allSettled/);
  assert.match(dashboard,/\?'Sem dados'/);
  assert.match(dashboard,/Sem dados suficientes/);
  assert.match(dashboard,/não coletado|nao coletado|indisponível|indisponivel/);
});

test('API Ads preserva campanhas reais mesmo sem performance e usa null para metrica ausente',()=>{
  assert.match(adsApi,/normalizeCampaigns\(campaignDaily,settings,campaigns\)/);
  assert.match(adsApi,/a\[key\]=seen\[key\]\?totals\[key\]:null/);
  assert.match(adsApi,/performanceStatus:m\.available/);
  assert.match(adsApi,/const availability=/);
  assert.doesNotMatch(adsApi,/return Number\.isFinite\(n\)\?n:0/);
});
