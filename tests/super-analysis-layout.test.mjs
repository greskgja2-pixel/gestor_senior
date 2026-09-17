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
const sendButton=read('app/components/SendToSuperAnalysisButton.js');

test('Super Analise usa somente a interface reconstruida',()=>{
  assert.match(page,/import\s+SuperAnaliseInteligente\s+from\s+['"]\.\/SuperAnaliseInteligente['"]/);
  assert.match(page,/import\s+WebAuditFlow\s+from\s+['"]\.\/WebAuditFlow['"]/);
  assert.doesNotMatch(page,/SuperAnalysisPolish|SuperAnaliseBodyMode/);
  assert.equal(existsSync(new URL('../app/super-analise/layout.js',import.meta.url)),false,'Nao recriar layout.js legado nesta rota');
  assert.equal(existsSync(new URL('../app/super-analise/SuperAnalysisPolish.js',import.meta.url)),false,'Nao recriar camada Polish antiga');
  assert.equal(existsSync(new URL('../app/super-analise/SuperAnaliseBodyMode.js',import.meta.url)),false,'Nao recriar BodyMode antigo');
  assert.match(view,/Super Análise Inteligente/);
});

test('Super Analise cobre o shell legado e ocupa a viewport inteira',()=>{
  assert.match(css,/\.screen\{[^}]*position:fixed[^}]*inset:0[^}]*z-index:2147483000/);
  assert.match(css,/\.screen\{[^}]*grid-template-columns:210px\s+minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/\.screen\{[^}]*max-width\s*:/);
  assert.match(flowCss,/\.screen\{[^}]*position:fixed[^}]*inset:0[^}]*z-index:2147483000/);
});

test('estrutura aprovada permanece horizontal no desktop',()=>{
  assert.match(css,/\.workspace\{[^}]*grid-template-columns:minmax\(0,1fr\)\s+255px/);
  assert.match(css,/\.compare\{[^}]*grid-template-columns:minmax\(0,1fr\)\s+44px\s+minmax\(0,1fr\)/);
  assert.match(css,/\.productBar\{[^}]*grid-template-columns:72px\s+minmax\(250px,1\.25fr\)\s+minmax\(620px,2\.4fr\)/);
});

test('fluxo visual obrigatorio continua presente',()=>{
  for(const token of ['Título','Descrição','Imagens','Vídeo','Categoria Shopee','Preço & Concorrência','Atributos & Variações','Sugestão completa da IA','Aplicar sugestão','Por que a IA sugeriu essa alteração?'])assert.match(view,new RegExp(token));
});

test('Motor Senior e somente motor e fluxo acontece no site',()=>{
  assert.match(page,/if\(!requestedReport&&!requestedItem\)return <WebAuditFlow initialUrl=\{startUrl\}\/>/);
  for(const token of ['Objetivo, situação e gargalo','Shopee Ads — dados atuais','Custos e margens','Selecione exatamente 3 concorrentes','Recarregar botões','Analisar Tudo','Motor Senior'])assert.match(flow,new RegExp(token));
  assert.match(flow,/GS_ENGINE_REQUEST/);
  assert.doesNotMatch(flow,/GS_OPEN_SIDE_PANEL/);
});

test('fluxo guiado contempla dados editaveis, Ads completos, custos por variacao e prova de margem',()=>{
  for(const token of ['Qtd. avaliações','GMV R$','Custo por venda R$','Custo unitário padrão R$','Custos por variação','Margem bruta preliminar','passe o mouse para conferir a conta','✎'])assert.match(flow,new RegExp(token));
  assert.match(flow,/allVariationCosts/);
  assert.match(flow,/models\.length>0&&!allVariationCosts/);
  assert.match(flow,/competitors\.length!==3/);
  assert.match(flow,/competitors\.length===3/);
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