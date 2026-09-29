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
  assert.match(funnel,/\/api\/shopee\/ads\?days=/);
  assert.match(funnel,/versão 0\.17\.4/);
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


test('Análise de Funil possui modos padrão e específico com evidências reais',()=>{
  const funnel=read('app/funil/page.js');
  const contextApi=read('app/api/funnel/context/route.js');
  assert.match(funnel,/guidanceMode/);
  assert.match(funnel,/Padrão/);
  assert.match(funnel,/Específico · me diga o que fazer/);
  assert.match(funnel,/function specificPlan/);
  // Desde "Funil desacoplado da coleta do Motor" (2026-09-29), o Funil busca
  // o contexto recente da loja sem filtrar por item_ids (a API mantém o
  // parâmetro opcional para outros consumidores, mas esta tela usa a lista
  // completa e resolve o item específico no cliente via `context`).
  assert.match(funnel,/getJson\('\/api\/funnel\/context'\)/);
  assert.match(funnel,/Concorrentes usados como referência/);
  assert.match(funnel,/Base da sugestão específica/);
  assert.match(funnel,/nenhuma alteração é aplicada/i);
  assert.match(contextApi,/extension_analysis_reports/);
  assert.match(contextApi,/competitors/);
  assert.match(contextApi,/finance_snapshot/);
  assert.match(contextApi,/marginPct/);
  assert.match(contextApi,/productCost/);
});


test('Análise de Funil usa funil visual real e destaca maior gargalo',()=>{
  const funnel=read('app/funil/page.js');
  const css=read('app/funil/funil.module.css');
  assert.match(funnel,/function FunnelVisual/);
  assert.match(funnel,/function StoreMiniFunnel/);
  assert.match(funnel,/function KpiStrip/);
  assert.match(funnel,/Maior gargalo:/);
  assert.match(funnel,/Plano de Destrave/);
  assert.match(funnel,/label:'Hoje'/);
  assert.match(funnel,/tempo real/);
  assert.match(css,/\.storeMiniFunnel/);
  assert.match(css,/clip-path:polygon/);
  assert.match(css,/\.storeFunnelCard/);
  assert.match(css,/\.kpiStrip/);
});


test('Análise de Funil usa 30 dias como padrão e períodos históricos confirmados',()=>{
  const funnel=read('app/funil/page.js');
  assert.match(funnel,/useState\('past30days'\)/);
  assert.match(funnel,/\{id:'past7days',label:'7 dias'/);
  assert.match(funnel,/\{id:'past30days',label:'30 dias'/);
  assert.match(funnel,/motorData\('sellerFunnel',\{period:selectedPeriod\}/);
  assert.match(funnel,/productOverview/);
  assert.match(funnel,/ComparisonStrip/);
  assert.match(funnel,/v0\.17\.4/);
  assert.doesNotMatch(funnel,/products\.reduce\(\(a,p\)=>a\+\(num\(p\.add_to_cart_buyers\)/);
});

test('Funil preserva null e não converte ausência em zero',()=>{
  const funnel=read('app/funil/page.js');
  assert.match(funnel,/v===null\|\|v===undefined\|\|v===''/);
});


test('Análise de Funil aproveita séries diárias e pós-venda mapeados',()=>{
  const funnel=read('app/funil/page.js');
  assert.match(funnel,/function TrendPanel/);
  assert.match(funnel,/productMetricTrends/);
  assert.match(funnel,/function PostOrderPanel/);
  assert.match(funnel,/orderPerformance/);
  assert.match(funnel,/cancelled_orders/);
  assert.match(funnel,/return_refund_orders/);
});


test('Gestor mostra atividade global do Motor Sênior',()=>{
  const shell=read('app/components/AppShell.js');
  const asyncClient=read('app/lib/client-async.js');
  const css=read('app/app-shell.css');
  assert.match(shell,/function MotorActivityCard/);
  assert.match(shell,/gs-motor-activity/);
  assert.match(shell,/Motor Sênior trabalhando/);
  assert.match(asyncClient,/gs-motor-activity/);
  assert.match(asyncClient,/activity\(action,'start'/);
  assert.match(asyncClient,/phase='done'/);
  assert.match(css,/\.gs-motor-activity\{/);
  assert.match(css,/position:fixed/);
});


test('Card do Motor recebe progresso intermediário da extensão',()=>{
  const asyncClient=read('app/lib/client-async.js');
  const shell=read('app/components/AppShell.js');
  assert.match(asyncClient,/GS_ENGINE_PROGRESS/);
  assert.match(asyncClient,/activity\(action,'progress'/);
  assert.match(shell,/d\.phase==='progress'/);
  assert.match(shell,/activity\.percent/);
});


test('Por Produto usa cards com mini funil visual aprovado',()=>{
  const funnel=read('app/funil/page.js');
  const css=read('app/funil/funil.module.css');
  assert.match(funnel,/function ProductFunnelCard/);
  assert.match(funnel,/function MiniProductFunnel/);
  assert.match(funnel,/Maior gargalo: Carrinho → Pedido/);
  assert.match(funnel,/Concorrente de referência/);
  assert.match(funnel,/Faça assim/);
  assert.match(funnel,/productFunnelList/);
  assert.doesNotMatch(funnel,/className=\{styles\.actionIntro\}/);
  assert.match(css,/\.productMiniFunnel/);
  assert.match(css,/\.productFunnelCard/);
  assert.match(css,/\.productDiagnosis/);
});


test('Funil por Produto tem calculadora inline de preço e variações',()=>{
  const funnel=read('app/funil/page.js');
  const context=read('app/api/funnel/context/route.js');
  const priceApi=read('app/api/shopee/product-price/route.js');
  const shopee=read('lib/shopee.js');
  const css=read('app/funil/funil.module.css');
  assert.match(funnel,/function PriceCalculator/);
  assert.match(funnel,/Abrir calculadora/);
  assert.match(funnel,/Concorrente que mais vende/);
  assert.match(funnel,/Minhas variações/);
  assert.match(funnel,/Ads por pedido/);
  assert.match(funnel,/Salvar novo preço/);
  assert.match(funnel,/\/api\/products\/manage\?item_id=/);
  assert.match(funnel,/\/api\/shopee\/product-price/);
  assert.match(context,/variations:variationRows\(c\)/);
  assert.match(context,/variations:variationRows\(p,variationCosts\)/);
  assert.match(priceApi,/updateItemPrice/);
  assert.match(shopee,/\/api\/v2\/product\/update_price/);
  assert.match(css,/\.inlinePriceCalculator/);
});

test('Calculadora de preço não inventa sugestão sem custo ou concorrente',()=>{
  const funnel=read('app/funil/page.js');
  assert.match(funnel,/baseCandidate!=null&&baseCalc\?\.profit>0\?baseCandidate:null/);
  assert.match(funnel,/Não há dados suficientes para sugerir preço com segurança/);
  assert.match(funnel,/Ads por pedido indisponível|Sem atribuição suficiente/);
});


test('Produtos permite custo/estoque editáveis, colunas configuráveis e ofertas de marketing',()=>{
  const products=read('app/produtos/ProductsDashboard.js');
  const css=read('app/produtos/products.module.css');
  const marketing=read('app/api/shopee/marketing-discounts/route.js');
  const manage=read('app/api/products/manage/route.js');
  const shopee=read('lib/shopee.js');
  assert.match(products,/Cadastre o custo dos produtos/);
  assert.match(products,/Configurar taxas/);
  assert.match(products,/Opções de exibição/);
  assert.match(products,/Preço \/ oferta/);
  assert.match(products,/Editar variações/);
  assert.match(products,/\/api\/shopee\/marketing-discounts/);
  assert.match(products,/\/api\/products\/manage/);
  assert.match(marketing,/discountStatus:'ongoing'/);
  assert.match(marketing,/Number\(d\?\.source\)===0/);
  assert.doesNotMatch(marketing,/flash-sale/);
  assert.match(manage,/updateItemStock/);
  assert.match(shopee,/\/api\/v2\/discount\/get_discount_list/);
  assert.match(shopee,/\/api\/v2\/discount\/get_discount/);
  assert.match(shopee,/\/api\/v2\/product\/update_stock/);
  assert.match(css,/\.columnPopover/);
  assert.match(css,/\.feeModal/);
});

test('Taxas padrão da tabela respeitam faixas Shopee 2026 e continuam editáveis',()=>{
  const products=read('app/produtos/ProductsDashboard.js');
  assert.match(products,/lowCommissionPct:20/);
  assert.match(products,/highCommissionPct:14/);
  assert.match(products,/fixed80:16/);
  assert.match(products,/fixed100:20/);
  assert.match(products,/fixed200:26/);
  assert.match(products,/2026-10-01T00:00:00-03:00/);
  assert.match(products,/campaignExtraPct:0/);
});


test('Funil por Produto tem editor inline de título baseado em Super Análise e concorrentes',()=>{
  const funnel=read('app/funil/page.js');
  const context=read('app/api/funnel/context/route.js');
  const css=read('app/funil/funil.module.css');
  const productUpdate=read('app/api/shopee/product-update/route.js');
  assert.match(funnel,/function TitleEditor/);
  assert.match(funnel,/✎ Editar título/);
  assert.match(funnel,/Título sugerido pelo Motor Sênior/);
  assert.match(funnel,/Palavras-chave encontradas/);
  assert.match(funnel,/Concorrentes usados como base/);
  assert.match(funnel,/Aplicar no anúncio/);
  assert.match(funnel,/\/api\/shopee\/product-update/);
  assert.match(funnel,/changes:\{title:value\}/);
  assert.match(funnel,/não vai inventar um título/i);
  assert.match(context,/titleSuggestion/);
  assert.match(context,/titleKeywords/);
  assert.match(context,/ai\?\.title\?\.suggestion/);
  assert.match(productUpdate,/allowedKeys=new Set\(\['title','description'\]\)/);
  assert.match(css,/\.inlineTitleEditor/);
  assert.match(css,/\.titleCompareGrid/);
  assert.match(css,/\.titleKeywords/);
});

test('Editor de título só publica após confirmação explícita',()=>{
  const funnel=read('app/funil/page.js');
  assert.match(funnel,/window\.confirm\('Aplicar este novo título no anúncio da Shopee\?'\)/);
  assert.match(funnel,/if\(!changed\)/);
  assert.match(funnel,/value\.length>120/);
});


test('Super Análise mostra disponibilidade do Funil por produto no novo layout',()=>{
  const page=read('app/super-analise/page.js');
  const products=read('app/produtos/ProductsDashboard.js');
  const css=read('app/produtos/products.module.css');
  assert.match(page,/analysisAgeDays/);
  assert.match(page,/analysisAgeDays>30\?'stale':'available'/);
  assert.match(products,/O Funil por Produto mostra apenas anúncios que já passaram pela Super Análise/);
  assert.match(products,/Disponíveis no Funil/);
  assert.match(products,/Pendentes/);
  assert.match(products,/Precisam reanálise/);
  assert.match(products,/Funil de vendas/);
  assert.match(products,/Abrir Funil/);
  assert.match(products,/Enviar para Super Análise/);
  assert.match(products,/Reanalisar/);
  assert.match(css,/\.funnelSummary/);
  assert.match(css,/\.funnelStatusCell/);
});

test('Funil por Produto só lista Super Análises recentes e aceita atalho da tabela',()=>{
  const funnel=read('app/funil/page.js');
  // A disponibilidade agora nasce do histórico real de Super Análise (context),
  // não apenas dos produtos que vieram na coleta atual do Motor.
  assert.match(funnel,/const analyzedProducts=Object\.values\(context\|\|\{\}\)\.map/);
  assert.match(funnel,/ctx\?\.analyzedAt/);
  assert.match(funnel,/age>30/);
  assert.match(funnel,/funnelMetricsUnavailable:true/);
  assert.match(funnel,/Super Análise obrigatória/);
  assert.match(funnel,/Gerenciar na Super Análise/);
  assert.match(funnel,/orderedAnalyzed\.map/);
  assert.match(funnel,/params\.get\('tab'\)==='produto'/);
  assert.match(funnel,/params\.get\('item_id'\)/);
});


test('Super Análise esconde etapas até o usuário iniciar uma análise',()=>{
  const workspace=read('app/super-analise/SuperAnaliseWorkspace.js');
  const products=read('app/produtos/ProductsDashboard.js');
  assert.match(workspace,/if\(startUrl\|\|startItem\)return <WebAuditFlow initialUrl=\{startUrl\}\/>/);
  assert.match(workspace,/return <ProductsDashboard embedded superAnalysisLanding/);
  assert.match(products,/superAnalysisLandingHeader/);
  assert.match(products,/Produtos analisados/);
  assert.match(products,/Disponíveis no Funil/);
  assert.match(products,/Precisam reanálise/);
  assert.doesNotMatch(products,/As etapas da Super Análise aparecem/);
});

test('Tabela de Produtos/Super Análise ordena pelos cabeçalhos em vez do seletor "Ordenar"',()=>{
  const products=read('app/produtos/ProductsDashboard.js');
  const css=read('app/produtos/products.module.css');
  // O seletor "Ordenar" (e suas opções antigas) foi removido; a ordenação agora é feita
  // clicando no cabeçalho de cada coluna.
  assert.doesNotMatch(products,/>Ordenar</);
  assert.doesNotMatch(products,/price-asc|price-desc|stock-desc|margin-desc/);
  assert.match(products,/const \[sortKey,setSortKey\]=useState\('title'\)/);
  assert.match(products,/const \[sortDir,setSortDir\]=useState\('asc'\)/);
  assert.match(products,/function toggleSort\(key\)\{/);
  assert.match(products,/function sortHeader\(key,label\)\{/);
  assert.match(products,/sortHeader\('title','Produto'\)/);
  assert.match(products,/sortHeader\('status','Status do anúncio'\)/);
  assert.match(products,/sortHeader\('price','Preço \/ oferta'\)/);
  assert.match(products,/sortHeader\('cost','Custo'\)/);
  assert.match(products,/sortHeader\('margin','Margem'\)/);
  assert.match(products,/sortHeader\('stock','Estoque'\)/);
  assert.match(products,/sortHeader\('funnel','Funil de vendas'\)/);
  // Ações continua sem ordenação (cabeçalho simples, sem onClick).
  assert.match(products,/<th>Ações<\/th>/);
  // Filtros que devem continuar existindo depois de remover "Ordenar".
  assert.match(products,/Buscar produto/);
  assert.match(products,/Por página/);
  assert.match(css,/\.sortHeader\{cursor:pointer;user-select:none/);
  assert.match(css,/\.sortHeaderActive\{color:#173653;font-weight:950\}/);
});

test('Ordenação usa dados reais por coluna: custo/margem sem valor vão para o fim, funil usa a prioridade Disponível > Análise antiga > Indisponível',()=>{
  const products=read('app/produtos/ProductsDashboard.js');
  assert.match(products,/function costForSort\(item\)\{return item\.hasModel\?decimal\(item\.variationCostMin\):decimal\(item\.cost\)\}/);
  assert.match(products,/function marginForSort\(item\)\{if\(item\.hasModel\)return null;/);
  assert.match(products,/if\(key==='price'\)return finalPriceFor\(item\);/);
  assert.match(products,/if\(key==='stock'\)return decimal\(item\.stock\);/);
  assert.match(products,/const FUNNEL_SORT_RANK=\{available:0,stale:1,unavailable:2\};/);
  assert.match(products,/if\(key==='funnel'\)return FUNNEL_SORT_RANK\[funnelStatus\(item\)\];/);
  // Produto sem valor na coluna (custo/margem/estoque/preço ausentes) sempre cai para o
  // final da lista, crescente ou decrescente — nunca se mistura com "zero".
  assert.match(products,/if\(aMissing\)return 1;/);
  assert.match(products,/if\(bMissing\)return -1;/);
});

test('Título do produto quebra em no máximo 2 linhas e a coluna não cresce indefinidamente',()=>{
  const css=read('app/produtos/products.module.css');
  assert.match(css,/\.product b\{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis/);
  assert.match(css,/\.product\{display:flex;align-items:center;gap:10px;min-width:310px;max-width:340px\}/);
  assert.match(css,/\.productInfo\{min-width:0;max-width:300px\}/);
});

test('Coluna Ações mostra Reanalisar para produto já analisado (disponível ou análise antiga) e só mostra Enviar para Super Análise quando nunca foi analisado',()=>{
  const products=read('app/produtos/ProductsDashboard.js');
  assert.match(products,/onClick=\{\(\)=>sendToAnalysis\(item\)\}>\{fStatus==='unavailable'\?'➤ Enviar para Super Análise':'↻ Reanalisar'\}/);
});

test('Reanalisar cria uma nova rodada de Super Análise sem apagar o histórico anterior do produto',()=>{
  const reportsApi=read('app/api/extension-intelligence/reports/route.js');
  const products=read('app/produtos/ProductsDashboard.js');
  // Cada análise (primeira vez ou reanálise) grava um INSERT novo em
  // extension_analysis_reports — nunca um update/upsert por item_id — então toda rodada
  // vira uma linha própria com seu analyzed_at e o histórico completo fica preservado.
  assert.match(reportsApi,/\.from\("extension_analysis_reports"\)\.insert\(row\)/);
  assert.doesNotMatch(reportsApi,/extension_analysis_reports"\)\.upsert\(/);
  // "Reanalisar" e "Enviar para Super Análise" chamam o mesmo sendToAnalysis(item), que
  // sempre entra pelo fluxo guiado (start_url) e termina nesse mesmo INSERT.
  assert.match(products,/function sendToAnalysis\(item\)\{/);
  assert.match(products,/router\.push\(`\/super-analise\?\$\{q\.toString\(\)\}`\)/);
});


test('Integração v13 usa descontos do Motor com fallback oficial',()=>{
  const funnel=read('app/funil/page.js');
  const products=read('app/produtos/ProductsDashboard.js');
  const flow=read('app/super-analise/WebAuditFlow.js');
  const context=read('app/api/funnel/context/route.js');
  assert.match(funnel,/motorData\('sellerDiscounts'/);
  assert.match(funnel,/sellerOffer\|\|offer\|\|ctx\.marketingDiscount/);
  assert.match(funnel,/offerVariationStrip/);
  assert.match(products,/motorData\('sellerDiscounts'/);
  assert.match(products,/\.\.\.officialItems,\.\.\.motorItems/);
  assert.match(flow,/marketingDiscount\?\.offer_price/);
  assert.match(context,/marketingDiscount:p\?\.marketingDiscount\|\|f\?\.marketingDiscount/);
});

test('Manifesto do Motor aponta para v0.17.9',()=>{
  const latest=read('app/api/extension/latest/route.js');
  assert.match(latest,/version:'0\.17\.9'/);
  assert.match(latest,/Gestor-Senior-Shopee-Intelligence-v0\.17\.9\.zip/);
});


test('Funil da Loja implementa modo específico acionável',()=>{
  const funnel=read('app/funil/page.js');
  const css=read('app/funil/funil.module.css');
  assert.match(funnel,/function StoreSpecificPlan/);
  assert.match(funnel,/function storeStageProductRate/);
  assert.match(funnel,/ME DIGA O QUE FAZER · 1ª PRIORIDADE/);
  assert.match(funnel,/guidanceMode==='specific'[\s\S]*?<StoreSpecificPlan/);
  assert.match(funnel,/gap ponderado pelo volume/);
  assert.match(funnel,/Nenhuma alteração de preço, anúncio ou campanha é aplicada automaticamente/);
  assert.match(css,/\.storeSpecificProductGrid/);
  assert.match(css,/@media\(max-width:560px\)/);
});


test('Funil da Loja usa layout compacto inspirado no Funil por Produto',()=>{
  const funnel=read('app/funil/page.js');
  const css=read('app/funil/funil.module.css');
  assert.match(funnel,/function StoreMiniFunnel/);
  assert.match(funnel,/className=\{styles\.storeFunnelCard\}/);
  assert.match(funnel,/Maior gargalo:/);
  assert.match(funnel,/Passagem por etapa/);
  assert.match(css,/\.storeFunnelBody\{display:grid/);
  assert.match(css,/\.storeMiniStage\[data-index="6"\]/);
  assert.match(css,/@media\(max-width:720px\)/);
});


test('manifesto de atualização do Motor é público para a extensão consultar sem login',()=>{
  const middleware=read('middleware.js');
  assert.match(middleware,/\/api\/extension\/latest/);
});
