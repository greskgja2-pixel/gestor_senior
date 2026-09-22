import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shell=read('app/components/AppShell.js');
const intelligence=read('app/extensao-shopee-intelligence/page.js');
const sections=read('app/extensao-shopee-intelligence/IntelligenceSections.js');
const utility=read('app/UtilityNative.js');
const home=read('app/page.js');
const superAd=read('app/extensao-shopee-intelligence/SuperAnuncioMockup.js');
const superAnalysisPage=read('app/super-analise/page.js');
const superWorkspace=read('app/super-analise/SuperAnaliseWorkspace.js');
const superAnalysis=read('app/super-analise/SuperAnaliseInteligente.js');

const routes=[
  '/super-analise',
  '/extensao-shopee-intelligence?section=super-anuncio',
  '/extensao-shopee-intelligence?section=reanalises',
  '/extensao-shopee-intelligence?section=prioridades',
  '/extensao-shopee-intelligence?section=relatorios',
  '/extensao-shopee-intelligence?section=shopee-ads',
  '/protecao-roas','/?section=temas','/?section=config'
];

test('AppShell possui todas as rotas oficiais',()=>{
  for(const route of routes)assert.ok(shell.includes("href:'"+route+"'"),'rota ausente: '+route);
});

test('rota ativa usa pathname e query section',()=>{
  assert.match(shell,/usePathname,useSearchParams/);
  assert.match(shell,/searchParams\.get\('section'\)/);
  for(const section of ['super-anuncio','concorrentes','reanalises','prioridades','relatorios','shopee-ads','temas','config'])assert.ok(shell.includes(section));
});

test('intelligence renderiza conteudo real por section',()=>{
  assert.match(intelligence,/initialSection/);
  assert.match(intelligence,/IntelligenceSections/);
  for(const token of ['Concorrentes','Shopee Ads','Reanálises','Prioridades','Relatórios'])assert.ok(sections.includes(token),'secao ausente: '+token);
});

test('Temas e Configuracoes usam interface nativa e a fonte unica de temas',()=>{
  assert.match(utility,/const THEMES=/);
  assert.match(utility,/localStorage\.setItem\('gs_theme'/);
  assert.ok(shell.includes("href:'/?section=temas'"));
  assert.ok(shell.includes("href:'/?section=config'"));
});

test('Dashboard nao depende mais de iframe legado',()=>{
  assert.match(home,/DashboardNative/);
  assert.match(home,/UtilityNative/);
  assert.doesNotMatch(home,/ShopeeLiveFrame|shopeeos-live|iframe/);
});


test('Super Anuncio oferece atalhos para os 7 atributos da Super Analise',()=>{
  for(const tab of ['title','description','images','video','category','price','variations']){
    assert.ok(superAd.includes("'"+tab+"'")||superAd.includes('"'+tab+'"'),'atributo ausente: '+tab);
  }
  assert.match(superAd,/ATTRIBUTE_BLOCKS/);
  assert.match(superAd,/attributeScore/);
});

test('Super Analise abre diretamente no atributo solicitado pela URL',()=>{
  assert.match(superWorkspace,/requestedTab/);
  assert.match(superWorkspace,/initialTab=\{requestedTab\}/);
  assert.match(superAnalysis,/initialTab='title'/);
  assert.match(superAnalysis,/allowedTabs\.has\(initialTab\)/);
});


test('menu lateral nao exibe Concorrentes nem Pedidos',()=>{
  assert.doesNotMatch(shell,/href:'\/pedidos'/);
  assert.doesNotMatch(shell,/href:'\/extensao-shopee-intelligence\?section=concorrentes'/);
});
