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

test('selecao em lote executa somente campanhas confirmadas como protegidas',()=>{
  assert.match(view,/canDisable:ps==='valid'/);
  assert.match(view,/Desativar Proteção de ROAS dos selecionados/);
  assert.match(view,/action:'protection_reset'/);
  assert.match(view,/confirmed:true/);
  assert.match(view,/mode:c\.controlMode==='gms'\?'gms':'manual'/);
  assert.match(view,/pausar → retomar → pausar → retomar/);
  assert.match(view,/Aguardando confirmação/);
});

test('layout da Central segue o menu lateral oficial de 218px',()=>{
  assert.match(css,/grid-template-columns:218px minmax\(0,1fr\)/);
  assert.match(css,/\.kpis\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.selectionBar/);
  assert.match(css,/\.modalBackdrop/);
});
