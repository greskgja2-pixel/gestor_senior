import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const page=read('app/protecao-roas/page.js');
const view=read('app/protecao-roas/ProtectionRoasDashboard.js');
const css=read('app/protecao-roas/page.module.css');

test('Central de Protecao ROAS existe e usa os dados reais do Gestor',()=>{
  assert.match(page,/ProtectionRoasDashboard/);
  assert.match(view,/\/api\/shopee\/ads\?days=30/);
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
  assert.match(view,/onClick=\{\(\)=>\{if\(r\.canDisable&&!running\)toggle\(r\.campaignId\)\}\}/);
});

test('status de protecao nao vira um conjunto de botoes de acao',()=>{
  assert.match(view,/className=\{styles\.statusSummary\}/);
  assert.match(view,/Proteção Ativa/);
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
