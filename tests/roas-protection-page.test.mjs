import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const page=read('app/protecao-roas/page.js');
const view=read('app/protecao-roas/ProtectionRoasDashboard.js');
const css=read('app/protecao-roas/page.module.css');
const adsRoute=read('app/api/shopee/ads/route.js');
const shopeeExtra=read('lib/shopee-extra.js');

test('Central de Protecao ROAS existe e usa os dados reais do Gestor',()=>{
  assert.match(page,/ProtectionRoasDashboard/);
  assert.match(view,/PERIOD_OPTIONS/);
  assert.match(view,/\['1','Hoje'\]/);
  assert.match(view,/\['7','7 dias'\]/);
  assert.match(view,/\['14','14 dias'\]/);
  assert.match(view,/\['30','30 dias'\]/);
  assert.match(view,/\['custom','Personalizado'\]/);
  assert.match(view,/\/api\/shopee\/ads\?\$\{queryString\}/);
  assert.match(view,/syncShopeeAds'.*days:rangeDays/s);
  assert.match(view,/Período do ROAS/);
  assert.match(view,/\/api\/shopee\/ads-protection/);
  assert.match(view,/\/api\/shopee\/products/);
  assert.match(view,/Melhor ROAS/);
  assert.match(view,/Pior ROAS/);
  assert.match(view,/Anúncios Ativos/);
  assert.match(view,/Proteção ROAS Ativa/);
});

test('selecao em lote permite campanhas ativas ou ainda nao confirmadas',()=>{
  assert.match(view,/canDisable:!\['invalid','unsupported'\]\.includes\(ps\)/);
  assert.match(view,/Desativar Proteção de ROAS/);
  assert.match(view,/action:'protection_reset'/);
  assert.match(view,/confirmed:true/);
  assert.match(view,/mode:c\.controlMode==='gms'\?'gms':'manual'/);
  assert.match(view,/pausar → retomar → pausar → retomar/);
  assert.match(view,/Aguardando confirmação/);
  assert.match(view,/syncProtectionStates/);
  assert.match(view,/campaignIds:activeCampaignIds/);
  assert.match(view,/onChange=\{e=>\{e\.stopPropagation\(\);toggle\(r\.campaignId\)\}\}/);
  assert.doesNotMatch(view,/className=\{selectedSet\.has\(String\(r\.campaignId\)\)\?styles\.rowSelected:''\} onClick=/);
});

test('status de protecao nao vira um conjunto de botoes de acao',()=>{
  assert.match(view,/className=\{styles\.statusSummary\}/);
  assert.match(view,/summaryOn}>Ativa/);
  assert.match(view,/Desativada/);
  assert.match(view,/A confirmar/);
  assert.doesNotMatch(view,/<th>Ações<\/th>/);
  assert.doesNotMatch(view,/Desativar Proteção<\/button>/);
  assert.match(view,/disabled=\{running\|\|!selectedRows\.length\}/);
});

test('layout da Central segue o menu lateral oficial de 218px',()=>{
  assert.match(css,/grid-template-columns:218px minmax\(0,1fr\)/);
  assert.match(css,/\.kpis\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.selectionBar/);
  assert.match(css,/\.modalBackdrop/);
});


test('janela semanal de Ads usa o fuso GMT-3 da Shopee',async()=>{
  const {dateRange}=await import('../lib/shopee-extra.js');
  const range=dateRange(7,new Date('2026-09-22T01:30:00.000Z'));
  assert.deepEqual(range,{startDate:'15-09-2026',endDate:'21-09-2026'});
});


test('periodo personalizado do ROAS usa datas exatas e limite de 90 dias',()=>{
  assert.match(adsRoute,/start_date/);
  assert.match(adsRoute,/end_date/);
  assert.match(adsRoute,/days<1\|\|days>90/);
  assert.match(adsRoute,/getAdsCampaignDaily\(shop,ids,period\)/);
  assert.match(shopeeExtra,/function isoToShopeeDate/);
  assert.match(shopeeExtra,/export function adsDateRange/);
  assert.match(view,/customDays\(customStart,customEnd\)/);
  assert.match(view,/localStorage\.setItem\(PERIOD_STORAGE/);
});
