import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const layout=read('app/layout.js');
const shell=read('app/components/AppShell.js');
const css=read('app/app-shell.css');
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
  for(const label of ['Dashboard','Super Análise','Super Anúncio','Reanálises','Prioridades','Relatórios','Shopee Ads','Proteção ROAS','Temas','Configurações']){
    assert.ok(shell.includes("label:'"+label+"'"),'item ausente: '+label);
  }
  assert.doesNotMatch(shell,/label:'Produtos'.*href:/);
  assert.doesNotMatch(shell,/label:'Concorrentes'.*href:/);
  assert.doesNotMatch(shell,/label:'Pedidos'.*href:/);
});

test('menu nao tem accordion: sem botao de recolher/expandir nem submenu escondido',()=>{
  assert.doesNotMatch(shell,/toggleGroup/);
  assert.doesNotMatch(shell,/aria-expanded/);
  assert.doesNotMatch(shell,/Recolher \$\{entry\.label\}/);
  assert.doesNotMatch(shell,/Expandir \$\{entry\.label\}/);
  assert.doesNotMatch(shell,/STORAGE_GROUPS/);
  assert.doesNotMatch(css,/\.gs-nav-submenu\{display:none/);
  assert.match(css,/\.gs-nav-submenu\{display:grid/);
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

test('Dashboard principal usa apenas o AppShell nativo',()=>{
  const page=read('app/page.js');
  assert.doesNotMatch(page,/ShopeeLiveFrame|iframe|shopeeos-live/);
  assert.match(page,/DashboardNative/);
});

test('itens do menu (principais e do submenu) tem a mesma altura de linha',()=>{
  // Pedido do usuario: as linhas de "Produtos"/"Shopee Ads" (itens principais) nao podem ficar
  // mais altas que as linhas dos filhos ("Super Analise", "Protecao ROAS" etc).
  // Regressao real: usar `min-height` igual (37px) nos dois grupos NAO bastava, porque o icone do
  // item principal e maior (27px) que o do submenu (23px) — com `min-height`, o icone maior do
  // item principal empurra a linha alem do valor declarado (vira ~42px), enquanto o submenu fica
  // no minimo (~37px), e a diferenca volta a aparecer visualmente. A correcao usa `height` FIXO
  // (nao `min-height`) nos dois grupos de link, com o mesmo valor, para que a altura da linha seja
  // sempre identica independente do tamanho do icone/fonte de cada nivel.
  assert.doesNotMatch(css,/\.gs-nav>a,\.gs-nav-parent-link,\.gs-nav-submenu>a\{[^}]*min-height/,'item principal nao pode usar min-height (icone maior estoura a altura)');
  assert.doesNotMatch(css,/\.gs-nav-submenu>a\{min-height/,'submenu nao pode usar min-height (fica mais baixo que o item principal)');
  const topLevelHeight=css.match(/\.gs-nav>a,\.gs-nav-parent-link,\.gs-nav-submenu>a\{[^}]*[;{]height:(\d+)px/);
  const submenuHeight=css.match(/(?<!,)\.gs-nav-submenu>a\{height:(\d+)px/);
  assert.ok(topLevelHeight,'regra base do menu nao encontrada');
  assert.ok(submenuHeight,'regra do submenu nao encontrada');
  assert.equal(submenuHeight[1],topLevelHeight[1],'submenu tem altura diferente do menu principal');
});

test('nav do menu nao espalha espaco vazio entre as linhas (align-content:start)',()=>{
  // Regressao real (print do usuario): ".gs-nav" e um grid com "flex:1 1 auto", ou seja, ele cresce
  // para ocupar o espaco vertical sobrando entre a marca e o rodape de status da sidebar. Sem
  // "align-content:start", o comportamento padrao do CSS Grid ("normal", que age como "stretch")
  // distribui esse espaco sobrando IGUALMENTE entre as linhas do grid (Dashboard, grupo Produtos,
  // Pedidos, grupo Shopee Ads, Temas, Configuracoes) — criando gaps enormes e desiguais entre os
  // itens principais em vez de deixar o espaco sobrando compactado no final da lista.
  assert.match(css,/\.gs-nav\{display:grid;align-content:start;/,'.gs-nav precisa de align-content:start para nao espalhar espaco vazio entre as linhas');
});
