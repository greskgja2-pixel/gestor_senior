import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('app/super-analise/page.js');
const workspace=read('app/super-analise/SuperAnaliseWorkspace.js');
const view=read('app/super-analise/SuperAnaliseInteligente.js');
const flow=read('app/super-analise/WebAuditFlow.js');
const products=read('app/produtos/ProductsDashboard.js');
const sendButton=read('app/components/SendToSuperAnalysisButton.js');
const autoGemini=read('app/super-analise/AutoGeminiAnalysis.js');
const superAnuncio=read('app/extensao-shopee-intelligence/SuperAnuncioMockup.js');
const appShell=read('app/components/AppShell.js');

test('Super Analise usa a interface reconstruida dentro do AppShell',()=>{
  assert.match(page,/SuperAnaliseWorkspace/);
  assert.match(workspace,/SuperAnaliseInteligente/);
  assert.match(workspace,/WebAuditFlow/);
  assert.match(workspace,/ProductsDashboard/);
  assert.match(appShell,/label:'Super Análise'/);
  assert.doesNotMatch(flow,/function Sidebar\(/);
  assert.doesNotMatch(view,/function Sidebar\(/);
  assert.equal(existsSync(new URL('../app/super-analise/layout.js',import.meta.url)),false);
});

test('fluxo guiado preserva etapas e campos principais',()=>{
  for(const token of ['Objetivo, situação e gargalo','Shopee Ads — últimos 7 dias','Custos e margens','Selecione de 1 até 3 concorrentes','Recarregar botões','Analisar Tudo'])assert.ok(flow.includes(token),'faltando: '+token);
  for(const token of ['Qtd. avaliações','GMV R$','Custo por venda R$','Custo unitário padrão R$','Custos por variação'])assert.ok(flow.includes(token),'faltando: '+token);
});

test('Motor Senior usa request compartilhado com timeout e sem polling sobreposto',()=>{
  assert.match(flow,/motorData\('collectProduct'/);
  assert.match(flow,/35000/);
  assert.match(flow,/pickerDeadlineRef/);
  assert.match(flow,/setTimeout\(\(\)=>pollPickerResult/);
  assert.doesNotMatch(flow,/setInterval\(async\(\)=>\{try\{const r=await engine\('pickerResult'/);
  assert.match(flow,/operation\.status==='timeout'/);
  assert.match(flow,/>Tentar novamente<\/button>/);
});

test('envio de Produtos inicia coleta guiada na mesma rota',()=>{
  assert.match(products,/router\.push/);
  assert.match(products,/\/super-analise\?/);
  assert.match(products,/start_url:shopeeUrl/);
  assert.match(sendButton,/router\.push/);
  assert.match(sendButton,/\/super-analise\?/);
  assert.match(workspace,/initialUrl=\{startUrl\}/);
});

test('IA automatica tem timeout, progresso e retry',()=>{
  assert.match(autoGemini,/fetchJsonWithTimeout/);
  assert.match(autoGemini,/120000/);
  assert.match(autoGemini,/role="progressbar"/);
  assert.match(autoGemini,/state==='timeout'/);
  assert.match(autoGemini,/>Tentar novamente<\/button>/);
});

test('Super Anuncio explica dados ausentes sem inventar zero',()=>{
  for(const token of ['Erro de coleta','Não integrado','Sem dados','Não coletado'])assert.ok(superAnuncio.includes(token),'estado ausente: '+token);
  assert.match(superAnuncio,/explicit===0/);
  assert.match(superAnuncio,/0 variações — a coleta registrou explicitamente/);
  assert.doesNotMatch(superAnuncio,/Status:.*Ativo/);
});

test('lista de produtos permanece abaixo do fluxo da Super Analise',()=>{ assert.match(workspace,/ProductsDashboard embedded/); assert.match(workspace,/!requestedReport&&!requestedItem/); });


test('Super Analise formata avaliacao e mostra formula resumida da margem',()=>{
  assert.match(flow,/ratingText/);
  assert.match(flow,/ratingDraft/);
  assert.match(flow,/20% Shopee/);
  assert.match(flow,/taxa fixa/);
  assert.match(flow,/Margem estimada/);
  assert.doesNotMatch(flow,/passe o mouse para conferir a conta/);
});

test('Super Anuncio tem leitura em cadeia sem inventar dados e com excluir afastado',()=>{
  assert.match(superAnuncio,/function DecisionChain\(/);
  assert.match(superAnuncio,/<DecisionChain steps=\{chainSteps\}/);
  assert.match(superAnuncio,/Cadastrar custo/);
  assert.match(superAnuncio,/label:'Custo',value:dataText\(cost,money,f\)/);
  assert.match(superAnuncio,/label:'ROAS atual',value:dataText\(roasNow,num,adsContext\)/);
  assert.match(superAnuncio,/Gerenciar análise deste anúncio/);
  assert.doesNotMatch(superAnuncio,/selectorActions[^]*?Excluir análises[^]*?<\/div>\s*<\/section>\s*\{deleteError/);
});

test('leitura em cadeia: ROAS minimo = 100 / margem e mensagens por caso',()=>{
  const start=superAnuncio.indexOf('function chainVerdict');
  const end=superAnuncio.indexOf('function DecisionChain');
  assert.ok(start>0&&end>start,'chainVerdict nao encontrado');
  const num=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const chainVerdict=new Function('num',superAnuncio.slice(start,end)+'\nreturn chainVerdict;')(num);
  const semCusto=chainVerdict({cost:null,margin:null,roas:8});
  assert.equal(semCusto.needCost,true);
  assert.equal(semCusto.breakEven,null);
  const negativa=chainVerdict({cost:10,margin:-5,roas:8});
  assert.equal(negativa.tone,'red');
  assert.equal(negativa.breakEven,null);
  const semRoas=chainVerdict({cost:10,margin:20,roas:null});
  assert.equal(semRoas.breakEven,5);
  assert.equal(semRoas.tone,'');
  assert.equal(chainVerdict({cost:10,margin:20,roas:4}).tone,'red');
  assert.equal(chainVerdict({cost:10,margin:20,roas:5.5}).tone,'amber');
  assert.equal(chainVerdict({cost:10,margin:20,roas:6.5}).tone,'green');
  assert.equal(chainVerdict({cost:10,margin:null,roas:6.5}).tone,'');
});

test('QA Super Anuncio: editor embutido nao herda a grade de 2 colunas da tela cheia',()=>{
  const css=read('app/super-analise/page.module.css');
  const rule=css.match(/\.embeddedScreen\{[^}]*\}/);
  assert.ok(rule,'regra .embeddedScreen nao encontrada');
  assert.match(rule[0],/display:block!important/);
  assert.match(rule[0],/grid-template-columns:1fr!important/);
});

test('QA Super Anuncio: sino, busca, zoom e alerta de oferta sem controles mortos',()=>{
  // sino navega para Prioridades e so mostra o ponto vermelho com pendencias reais
  assert.match(superAnuncio,/className=\{styles\.notify\}[^>]*onClick=\{\(\)=>router\.push\('\/extensao-shopee-intelligence\?section=prioridades'\)\}/);
  assert.match(superAnuncio,/arr\(productTasks\.rows\)\.length>0&&<i\/>/);
  // busca avisa quando nao encontra e volta ao resumo quando encontra
  assert.match(superAnuncio,/Nenhum anúncio acompanhado corresponde a/);
  assert.match(superAnuncio,/setEditorTab\(null\);setSearchMsg\(''\)/);
  assert.doesNotMatch(superAnuncio,/placeholder="Buscar produtos, anúncios ou concorrentes/);
  // Esc fecha o zoom
  assert.match(superAnuncio,/e\.key==='Escape'\)onClose\(\)/);
  // contêiner dos botoes do alerta nao pode voltar a ser 28x28
  const css=read('app/extensao-shopee-intelligence/super-anuncio-mockup.module.css');
  assert.match(css,/\.flashAttention>span\.flashAttentionActions\{width:auto!important;height:auto!important/);
});

test('Preço e margem: custo tem botão próprio, usa manual-price e nunca vai para a Shopee',()=>{
  assert.match(view,/\/api\/extension-intelligence\/manual-price/);
  assert.match(view,/method:'PATCH'/);
  assert.match(view,/product_cost:c/);
  assert.match(view,/variation_costs:rows/);
  assert.match(view,/router\.refresh\(\)/);
  assert.match(view,/💾 Salvar custo/);
  assert.match(view,/não é enviado à Shopee/);
  const saveTab=view.slice(view.indexOf('async function saveTab()'),view.indexOf('const activeBefore'));
  assert.ok(saveTab.length>50,'saveTab nao encontrada');
  assert.doesNotMatch(saveTab,/cost/i);
});

test('Barra de ações do editor fica acima do card Editar anúncio e separa Shopee de custo',()=>{
  assert.match(superAnuncio,/id="gs-editor-toolbar"/);
  assert.ok(superAnuncio.indexOf('id="gs-editor-toolbar"')<superAnuncio.indexOf('className={styles.quickActions}'),'a barra deve vir antes do card Editar anúncio');
  assert.match(view,/createPortal\(<EditorToolbar/);
  for(const token of ['↶ Desfazer','↷ Refazer','⟳ Restaurar original','💾 Salvar custo','▣ Salvar na Shopee'])assert.ok(view.includes(token),'faltando: '+token);
  assert.match(view,/embedded&&toolbarSlot/);
});
