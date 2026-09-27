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
  '/funil',
  '/super-analise',
  '/pesquisa-produtos',
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


test('menu lateral exibe Concorrentes e continua sem Pedidos',()=>{
  assert.doesNotMatch(shell,/href:'\/pedidos'/);
  assert.match(shell,/href:'\/extensao-shopee-intelligence\?section=concorrentes'/);
});


test('Super Anuncio permite excluir todas as analises do anuncio atual',()=>{
  assert.match(superAd,/deleteAnalysis/);
  assert.match(superAd,/\/api\/extension-intelligence\/reports/);
  assert.match(superAd,/method:'DELETE'/);
  assert.match(superAd,/Excluir análises/);
});

test('sidebar exibe a versao real informada pela extensao conectada',()=>{
  assert.match(shell,/e\.data\.version/);
  assert.match(shell,/meta\?\.content/);
  assert.match(shell,/extensionVersion/);
  assert.match(shell,/Extensão conectada/);
});


test('Pesquisa de Produtos integra inteligencia de mercado com coleta/importacao',()=>{
  const page=read('app/pesquisa-produtos/MarketResearch.js');
  assert.match(shell,/label:'Pesquisa de Produtos'/);
  assert.match(shell,/href:'\/pesquisa-produtos'/);
  assert.match(page,/marketplaceSearch/);
  assert.match(page,/Importar coleta/);
  assert.match(page,/opportunityScore/);
  assert.match(page,/monthlySold/);
  assert.match(page,/seller_location|shop_location/);
});


test('Análise de Funil usa o Motor Sênior e preserva fallback de Ads',()=>{
  const funnel=read('app/funil/page.js');
  assert.match(funnel,/motorData\('sellerFunnel'/);
  for(const token of ['Impressões','Cliques','Visitantes','Carrinho','Pedido criado','Pago','Confirmado'])assert.ok(funnel.includes(token),'etapa ausente: '+token);
  assert.match(funnel,/Fontes de Tráfego/);
  assert.match(funnel,/Histórico Ads/);
  assert.match(funnel,/\/api\/shopee\/ads\?days=7/);
  assert.match(funnel,/versão 0\.17\.1/);
});


test('Análise de Funil oferece plano de destrave por produto',()=>{
  const funnel=read('app/funil/page.js');
  assert.match(funnel,/function productPlan/);
  assert.match(funnel,/Plano de destrave/);
  for(const token of ['Está travando antes do clique','não coloca no carrinho','desiste antes do pedido','poucos viram pagamento','antes da confirmação','O que fazer primeiro'])assert.ok(funnel.includes(token),'orientação ausente: '+token);
  assert.match(funnel,/med\.cartPlaced/);
  assert.match(funnel,/med\.placedPaid/);
  assert.match(funnel,/med\.paidConfirmed/);
});
