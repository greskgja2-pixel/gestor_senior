import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shell=read('app/components/AppShell.js');
const intelligence=read('app/extensao-shopee-intelligence/page.js');
const sections=read('app/extensao-shopee-intelligence/IntelligenceSections.js');
const frame=read('app/components/ShopeeLiveFrame.js');
const live=read('public/live-modules.js');
const superAd=read('app/extensao-shopee-intelligence/SuperAnuncioMockup.js');
const superAnalysisPage=read('app/super-analise/page.js');
const superAnalysis=read('app/super-analise/SuperAnaliseInteligente.js');

const routes=[
  '/produtos','/pedidos','/super-analise',
  '/extensao-shopee-intelligence?section=super-anuncio',
  '/extensao-shopee-intelligence?section=concorrentes',
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

test('Temas e Configuracoes continuam usando a fonte unica de temas',()=>{
  assert.match(live,/const GS_THEMES=/);
  assert.match(live,/window\.parent\.postMessage\(\{source:'GS_GESTOR_THEME'/);
  assert.ok(shell.includes("href:'/?section=temas'"));
  assert.ok(shell.includes("href:'/?section=config'"));
});

test('Dashboard LIVE tem boot finito e retry manual',()=>{
  assert.match(frame,/withBootTimeout/);
  assert.match(frame,/autoRetryRef\.current<1/);
  assert.match(frame,/setPhase\(error\?\.code==="timeout"\?"timeout":"error"\)/);
  assert.match(frame,/>Tentar novamente<\/button>/);
});


test('Super Anuncio oferece atalhos para os 7 atributos da Super Analise',()=>{
  for(const tab of ['title','description','images','video','category','price','variations']){
    assert.ok(superAd.includes(`tab=\${key}`)||superAd.includes("['"+tab+"'"),'atributo ausente: '+tab);
  }
  assert.match(superAd,/ATTRIBUTE_BLOCKS/);
  assert.match(superAd,/attributeScore/);
});

test('Super Analise abre diretamente no atributo solicitado pela URL',()=>{
  assert.match(superAnalysisPage,/requestedTab/);
  assert.match(superAnalysisPage,/initialTab=\{requestedTab\}/);
  assert.match(superAnalysis,/initialTab='title'/);
  assert.match(superAnalysis,/allowedTabs\.has\(initialTab\)/);
});
