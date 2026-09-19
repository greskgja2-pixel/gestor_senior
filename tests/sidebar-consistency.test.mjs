import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const layout=read('app/layout.js');
const shell=read('app/components/AppShell.js');
const css=read('app/app-shell.css');
const frame=read('app/components/ShopeeLiveFrame.js');
const routeFiles=[
  'app/produtos/ProductsDashboard.js',
  'app/super-analise/WebAuditFlow.js',
  'app/super-analise/SuperAnaliseInteligente.js',
  'app/extensao-shopee-intelligence/IntelligenceSections.js',
  'app/extensao-shopee-intelligence/SuperAnuncioMockup.js',
  'app/protecao-roas/ProtectionRoasDashboard.js'
].map(read);

test('RootLayout usa um unico AppShell compartilhado',()=>{
  assert.match(layout,/import AppShell from ".\/components\/AppShell"/);
  assert.match(layout,/<AppShell>\{children\}<\/AppShell>/);
  assert.doesNotMatch(layout,/SidebarOrderGuard/);
  assert.doesNotMatch(layout,/className="topbar"/);
});

test('sidebar desktop tem largura unica de 218px e grid estavel',()=>{
  assert.match(css,/--sidebar-width:218px/);
  assert.match(css,/grid-template-columns:var\(--sidebar-width\) minmax\(0,1fr\)/);
  assert.match(css,/width:var\(--sidebar-width\)/);
  assert.match(css,/min-width:var\(--sidebar-width\)/);
  assert.match(css,/max-width:var\(--sidebar-width\)/);
  assert.match(css,/\*,\*::before,\*::after\{box-sizing:inherit\}/);
});

test('menu canonico contem rotas e grupos exigidos',()=>{
  for(const label of ['Dashboard','Produtos','Super Análise','Super Anúncio','Concorrentes','Reanálises','Prioridades','Relatórios','Pedidos','Shopee Ads','Proteção ROAS','Temas','Configurações']){
    assert.ok(shell.includes("label:'"+label+"'"),'item ausente: '+label);
  }
  assert.match(shell,/STORAGE_GROUPS/);
  assert.match(shell,/localStorage\.setItem\(STORAGE_GROUPS/);
  assert.match(shell,/activeGroup/);
});

test('componentes de rota nao renderizam outra Sidebar ativa',()=>{
  for(const source of routeFiles){
    assert.doesNotMatch(source,/function Sidebar\(/);
    assert.doesNotMatch(source,/<Sidebar\b/);
  }
  assert.match(css,/\.gs-app-main aside\[class\*="_sidebar__"\]\{display:none!important\}/);
});

test('mobile usa o mesmo drawer do AppShell',()=>{
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/data-drawer="open"/);
  assert.match(shell,/gs-mobile-bar/);
  assert.match(shell,/gs-drawer-backdrop/);
});

test('Dashboard LIVE fica dentro do AppShell e nao cria uma segunda lateral visivel',()=>{
  assert.match(frame,/id="gs-hosted-layout"/);
  assert.match(frame,/\.sidebar\{display:none!important\}/);
  assert.match(frame,/\.topbar\{display:none!important\}/);
  assert.doesNotMatch(frame,/position:"fixed",inset:0,width:"100vw"/);
  assert.match(frame,/VERSION="20260919-02"/);
});
