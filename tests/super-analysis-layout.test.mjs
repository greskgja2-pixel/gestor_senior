import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const page=read('app/super-analise/page.js');
const view=read('app/super-analise/SuperAnaliseInteligente.js');
const css=read('app/super-analise/page.module.css');
const flow=read('app/super-analise/WebAuditFlow.js');
const flowCss=read('app/super-analise/web-audit.module.css');
const products=read('app/produtos/ProductsDashboard.js');
const productsPage=read('app/produtos/page.js');
const sendButton=read('app/components/SendToSuperAnalysisButton.js');
const autoGemini=read('app/super-analise/AutoGeminiAnalysis.js');
const motorTheme=read('app/motor-senior-theme.css');
const superAnuncioPage=read('app/extensao-shopee-intelligence/page.js');
const superAnuncio=read('app/extensao-shopee-intelligence/SuperAnuncioMockup.js');
const superAnuncioCss=read('app/extensao-shopee-intelligence/super-anuncio-mockup.module.css');

test('Super Analise usa somente a interface reconstruida',()=>{
  assert.match(page,/import\s+SuperAnaliseInteligente\s+from\s+['"]\.\/SuperAnaliseInteligente['"]/);
  assert.match(page,/import\s+WebAuditFlow\s+from\s+['"]\.\/WebAuditFlow['"]/);
  assert.doesNotMatch(page,/SuperAnalysisPolish|SuperAnaliseBodyMode/);
  assert.equal(existsSync(new URL('../app/super-analise/layout.js',import.meta.url)),false,'Nao recriar layout.js legado nesta rota');
  assert.equal(existsSync(new URL('../app/super-analise/SuperAnalysisPolish.js',import.meta.url)),false,'Nao recriar camada Polish antiga');
  assert.equal(existsSync(new URL('../app/super-analise/SuperAnaliseBodyMode.js',import.meta.url)),false,'Nao recriar BodyMode antigo');
  assert.match(view,/Super Análise Inteligente/);
});

test('Super Analise voltou ao visual anterior e nao recebe o mockup do Super Anuncio',()=>{
  assert.match(css,/\.screen\{[^}]*position:fixed[^}]*inset:0[^}]*z-index:2147483000/);
  assert.match(css,/\.screen\{[^}]*grid-template-columns:210px\s+minmax\(0,1fr\)/);
  assert.match(css,/\.workspace\{[^}]*grid-template-columns:minmax\(0,1fr\)\s+255px/);
  assert.match(css,/\.compare\{[^}]*grid-template-columns:minmax\(0,1fr\)\s+44px\s+minmax\(0,1fr\)/);
  assert.match(css,/\.productBar\{[^}]*grid-template-columns:72px\s+minmax\(250px,1\.25fr\)\s+minmax\(620px,2\.4fr\)/);
  assert.doesNotMatch(view,/Anúncio acompanhado|Retrato atual do anúncio/);
  assert.match(flowCss,/\.screen\{[^}]*position:fixed[^}]*inset:0[^}]*z-index:2147483000/);
});

test('fluxo visual da Super Analise continua presente',()=>{
  for(const token of ['Título','Descrição','Imagens','Vídeo','Categoria Shopee','Preço & Concorrência','Atributos & Variações','Sugestão completa da IA','Aplicar sugestão','Por que a IA sugeriu essa alteração?'])assert.ok(view.includes(token),`faltando: ${token}`);
});

test('mockup aprovado pertence a pagina Super Anuncio',()=>{
  assert.match(superAnuncioPage,/import\s+SuperAnuncioMockup\s+from\s+['"]\.\/SuperAnuncioMockup['"]/);
  assert.match(superAnuncioPage,/initialItemId=\{initialItemId\}/);
  assert.match(superAnuncioPage,/initialTab=\{sectionTab\}/);
  for(const token of ['Super Anúncio','Anúncio acompanhado','Visão geral','Shopee Ads','Super Análise','Concorrentes','Histórico','Atributos & Variações','Nota geral do anúncio','Retrato atual do anúncio','Comparação com a análise anterior'])assert.ok(superAnuncio.includes(token),`faltando no Super Anuncio: ${token}`);
  assert.match(superAnuncioCss,/\.workspace\{[^}]*grid-template-columns:minmax\(0,1fr\)\s+300px/);
  assert.match(superAnuncioCss,/\.compare\{[^}]*grid-template-columns:minmax\(0,1fr\)\s+46px\s+minmax\(0,1fr\)/);
  assert.match(superAnuncioCss,/\.productBar\{[^}]*grid-template-columns:112px\s+minmax\(310px,1\.25fr\)\s+minmax\(660px,2fr\)/);
});

test('Motor Senior e somente motor e fluxo acontece no site',()=>{
  assert.match(page,/if\(!requestedReport&&!requestedItem\)return <WebAuditFlow initialUrl=\{startUrl\}\/>/);
  for(const token of ['Objetivo, situação e gargalo','Shopee Ads — dados atuais','Custos e margens','Selecione de 1 até 3 concorrentes','Recarregar botões','Analisar Tudo','Motor Senior'])assert.ok(flow.includes(token),`faltando: ${token}`);
  assert.match(flow,/GS_ENGINE_REQUEST/);
  assert.doesNotMatch(flow,/GS_OPEN_SIDE_PANEL/);
});

test('fluxo guiado contempla dados editaveis, Ads completos, custos por variacao e prova de margem',()=>{
  for(const token of ['Qtd. avaliações','GMV R$','Custo por venda R$','Custo unitário padrão R$','Custos por variação','Margem bruta preliminar','passe o mouse para conferir a conta','✎'])assert.ok(flow.includes(token),`faltando: ${token}`);
  assert.match(flow,/allVariationCosts/);
  assert.match(flow,/models\.length>0&&!allVariationCosts/);
  assert.match(flow,/competitors\.length<1\|\|competitors\.length>3/);
  assert.match(flow,/competitors\.length>=1&&competitors\.length<=3/);
  assert.match(flow,/coletado\(s\) em profundidade/);
});

test('analise automatica mostra progresso central e abre Super Anuncio no produto analisado',()=>{
  assert.match(page,/AutoGeminiAnalysis/);
  assert.match(page,/needsGemini=Boolean\(selected\?\.id&&!selected\?\.report\?\.ai_analysis\)/);
  assert.match(page,/itemId=\{selected\.item_id\}/);
  assert.match(autoGemini,/\/api\/ai\/super-analysis/);
  assert.match(autoGemini,/report_id:reportId/);
  assert.match(autoGemini,/gs-ai-progress-overlay/);
  assert.match(autoGemini,/role="progressbar"/);
  assert.match(autoGemini,/setProgress\(100\)/);
  assert.match(autoGemini,/\/extensao-shopee-intelligence\?/);
  assert.match(autoGemini,/q\.set\('item_id',targetItem\)/);
  assert.match(autoGemini,/q\.set\('tab','analysis'\)/);
  assert.match(superAnuncio,/initialItemId/);
  assert.match(superAnuncio,/initialTab/);
  assert.match(motorTheme,/\.gs-ai-progress-overlay/);
  assert.match(motorTheme,/\.gs-ai-progress-track/);
});

test('cards do Motor Senior e IA seguem o tema atual em vez de trocar para azul ou rosa',()=>{
  assert.match(motorTheme,/--gs-theme-card:#ffffff/);
  assert.match(motorTheme,/--gs-theme-control:#ffffff/);
  assert.match(motorTheme,/\.gs-theme-floating-card/);
  assert.match(autoGemini,/gs-theme-floating-card gs-ai-progress-card/);
  assert.match(autoGemini,/className="gs-theme-control"/);
  assert.doesNotMatch(autoGemini,/#fff5f5|#f3b8b8|background:'#1769e8'/);
});

test('Produtos nunca reaproveita margem historica como margem atual',()=>{
  assert.match(productsPage,/margem exibida como atual precisa usar preço atual válido \+ custo atual válido/i);
  assert.match(productsPage,/marginR=price-totalCost/);
  assert.match(productsPage,/marginPct=marginR\/price\*100/);
  assert.match(productsPage,/lastAnalysisMarginPct/);
});

test('envio da lista de produtos inicia a analise guiada automaticamente',()=>{
  assert.match(page,/const startUrl=String\(params\?\.start_url\|\|''\)\.trim\(\)/);
  assert.match(flow,/export default function WebAuditFlow\(\{initialUrl=''\}\)/);
  assert.match(flow,/if\(!initialUrl\|\|!connected\|\|autoStartedRef\.current\)return/);
  assert.match(flow,/loadProduct\(initialUrl\)/);
  assert.match(products,/router\.push\(`\/super-analise\?\$\{q\.toString\(\)\}`\)/);
  assert.match(products,/start_url:shopeeUrl/);
  assert.doesNotMatch(products,/window\.open\(`https:\/\/shopee\.com\.br\/product/);
  assert.match(sendButton,/router\.push\(`\/super-analise\?\$\{q\.toString\(\)\}`\)/);
});
