import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const layout=read('app/layout.js');
const css=read('app/sidebar-standard.css');
const guard=read('app/components/SidebarOrderGuard.js');
const dashboardShell=read('public/shell-enhancements.js');
const dashboardCss=read('public/shell-enhancements.css');

const order=['Dashboard','Produtos','Super Análise','Super Anúncio','Concorrentes','Shopee Ads','Reanálises','Prioridades','Relatórios'];
function assertOrder(source,name){let last=-1;for(const label of order){const pos=source.indexOf(`label:'${label}'`);assert.ok(pos>last,`${label} saiu da ordem oficial em ${name}`);last=pos;}}

test('layout global carrega o padrao oficial do menu lateral',()=>{
  assert.match(layout,/import\s+["']\.\/sidebar-standard\.css["']/);
  assert.match(layout,/SidebarOrderGuard/);
});

test('menu lateral oficial permanece branco e com largura fixa de 218px',()=>{
  assert.match(css,/--gs-sidebar-width:218px/);
  assert.match(css,/background:#fbfdff!important/);
  assert.match(css,/border-right:1px solid #e2e9f2!important/);
  assert.match(css,/font-size:12px!important/);
  assert.match(css,/background:#e8f2ff!important/);
  assert.match(css,/color:#1265d8!important/);
  assert.match(dashboardCss,/grid-template-columns:218px/);
  assert.match(dashboardCss,/background:#fbfdff!important/);
});

test('Super Analise nao pode voltar para sidebar azul ou largura 210\/185',()=>{
  assert.match(css,/web-audit_screen__/);
  assert.match(css,/page_screen__/);
  assert.match(css,/grid-template-columns:var\(--gs-sidebar-width\) minmax\(0,1fr\)!important/);
});

test('conteudo da Super Analise sempre ocupa a segunda coluna quando sidebar e fixa',()=>{
  assert.match(css,/web-audit_screen__[^}]*>main\[class\*="_main__"\][^{]*\{[^}]*grid-column:2 \/ -1!important/s);
  assert.match(css,/grid-column:2 \/ -1!important/);
  assert.match(css,/min-width:0!important/);
});

test('ordem das nove paginas acompanha o fluxo operacional em todas as interfaces',()=>{
  assertOrder(guard,'Next');
  assertOrder(dashboardShell,'Dashboard');
  assert.match(guard,/export const GS_MENU_ORDER=/);
  assert.match(guard,/nav\.appendChild\(fragment\)/);
  assert.match(guard,/Motor Senior/);
  assert.match(css,/data-gs-active="true"/);
  assert.match(dashboardShell,/Super Análises — resumo/);
  assert.match(dashboardShell,/\/api\/extension-intelligence\/reports\?limit=200/);
});