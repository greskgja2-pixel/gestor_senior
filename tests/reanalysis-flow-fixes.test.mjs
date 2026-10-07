import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const metricsSource=read('lib/business-metrics.js');
const route=read('app/api/ai/super-analysis/route.js');
const inteligente=read('app/super-analise/SuperAnaliseInteligente.js');
const runner=read('app/super-analise/ReanalysisRunner.js');
const mockup=read('app/extensao-shopee-intelligence/SuperAnuncioMockup.js');

const metrics=await import(`data:text/javascript;base64,${Buffer.from(metricsSource).toString('base64')}`);

test('margem Shopee: implementação única 20% + R$ 4,50 (41,1% para R$ 26,99 com custo R$ 6,00)',()=>{
  const calc=metrics.shopeeMarginCalc(26.99,6);
  assert.equal(calc.fixedFee,4.5);
  assert.equal(calc.commissionRate,0.2);
  assert.equal(calc.marginPct.toFixed(1),'41.1');
  assert.notEqual(calc.marginPct.toFixed(1),'42.9');
  assert.equal(metrics.shopeeMarginCalc(26.99,10).marginPct.toFixed(1),'26.3');
});

test('margem Shopee: sem preço ou custo não inventa valor',()=>{
  assert.equal(metrics.shopeeMarginCalc(26.99,null),null);
  assert.equal(metrics.shopeeMarginCalc(26.99,''),null);
  assert.equal(metrics.shopeeMarginCalc(null,6),null);
  assert.equal(metrics.shopeeMarginCalc(0,6),null);
});

test('Super Análise, Super Anúncio e Reanálise usam a mesma função de margem (sem cópias locais)',()=>{
  for(const [name,src] of [['SuperAnaliseInteligente',inteligente],['SuperAnuncioMockup',mockup],['ReanalysisRunner',runner]]){
    assert.match(src,/import \{shopeeMarginCalc\} from '\.\.\/\.\.\/lib\/business-metrics'/,name);
  }
  assert.doesNotMatch(inteligente,/function shopeeMarginCalc/);
  assert.doesNotMatch(mockup,/const margin=n\(f\.marginPct\);/);
  assert.match(mockup,/shopeeMarginCalc\(price,cost\)/);
});

test('reanálise recalcula o snapshot financeiro em vez de copiar o da rodada anterior',()=>{
  assert.match(runner,/function refreshFinance/);
  assert.match(runner,/finance_snapshot:financeSnapshot/);
  assert.doesNotMatch(runner,/finance_snapshot:report\?\.finance_snapshot\|\|\{\}/);
});

test('IA: venda ausente (null) do concorrente nunca vira zero',()=>{
  const helpers=route.match(/const numberOrNull=[\s\S]*?function capturedSold\(c\)\{[\s\S]*?\n\}/);
  assert.ok(helpers,'helpers capturedPrice/capturedSold não encontrados');
  const {capturedSold,capturedPrice}=new Function(`${helpers[0]};return {capturedSold,capturedPrice}`)();
  assert.equal(capturedSold({sold:null,searchText:'262 Vendido'}),262);
  assert.equal(capturedSold({sold:null}),null);
  assert.equal(capturedSold({sold:''}),null);
  assert.equal(capturedSold({}),null);
  assert.equal(capturedSold({sold:'833'}),833);
  assert.equal(capturedSold({sold:0}),0);
  assert.equal(capturedSold({sold:null,searchText:'1,2 mil Vendido'}),1200);
  assert.equal(capturedPrice({price:null,searchText:'R$ 27,49'}),27.49);
  assert.equal(capturedPrice({price:null}),null);
  assert.doesNotMatch(route,/Number\(c\?\.sold\)/);
});

test('Super Anúncio: editor embutido respeita a aba escolhida (Descrição/Mídia/Financeiro)',()=>{
  const effect=inteligente.match(/useEffect\(\(\)=>\{\s*const storageKey=[\s\S]*?\},\[report\?\.id,report\?\.item_id,allowedTabs,embedded\]\);/);
  assert.ok(effect,'efeito de progresso deve depender de embedded');
  assert.match(effect[0],/if\(!embedded\)\{\s*const firstPending=/);
  assert.match(effect[0],/if\(!embedded\)setTab\('title'\)/);
  assert.match(mockup,/initialTab=\{editorTab\} embedded/);
});

test('Imagens: análise visual pulada nunca aparece como "Imagens aprovadas"',()=>{
  assert.match(inteligente,/const visualSkipped=report\?\.report\?\.ai_images_skipped===true\|\|n\(report\?\.report\?\.visual_images_sent\)===0/);
  assert.match(inteligente,/visualSkipped=\{visualSkipped\}/);
  assert.match(inteligente,/Análise visual não realizada/);
  assert.ok(inteligente.indexOf('{visualSkipped?<article')<inteligente.indexOf('<h2>Imagens aprovadas</h2>'),'aviso de análise pulada deve vir antes do "aprovadas"');
});

test('textos de etapa concluída/aprovada concordam em gênero e número',()=>{
  assert.match(inteligente,/const stepDoneWord=/);
  const word=new Function(`${inteligente.match(/const stepDoneWord=.*\n/)[0]};return stepDoneWord`)();
  assert.equal(`Descrição ${word('description')}`,'Descrição concluída');
  assert.equal(`Imagens ${word('images')}`,'Imagens concluídas');
  assert.equal(`Categoria ${word('category')}`,'Categoria concluída');
  assert.equal(`Título ${word('title')}`,'Título concluído');
  assert.equal(`Vídeo ${word('video')}`,'Vídeo concluído');
  assert.match(inteligente,/\{title==='Descrição'\?'aprovada':'aprovado'\}/);
  assert.doesNotMatch(inteligente,/\$\{TAB_LABEL\[tab\]\|\|tab\} concluído\./);
});

test('Super Anúncio rotula o GMV de Ads como "GMV Ads" (não confunde com GMV total do produto)',()=>{
  assert.match(mockup,/\['GMV Ads',dataText\(pickAds\('gmv'\),money,adsContext\)\]/);
  assert.doesNotMatch(mockup,/\['GMV',dataText\(pickAds\('gmv'\)/);
});

test('cartão de métricas da Super Análise tem cor escura explícita (fundo branco + texto herdado do tema escuro era ilegível)',()=>{
  const css=read('app/super-analise/page.module.css');
  assert.match(css,/\.productBar\{[^}]*background:#fff/);
  assert.match(css,/^\.metric b\{font-size:13px;color:#1b2a41\}/m);
});

test('histórico: "Vendas desde a análise anterior" não pede só 2 rodadas (precisa de 3 para ter 2 variações)',()=>{
  assert.match(mockup,/function HistoryMiniChart\(\{title,values=\[\],format=v=>String\(v\),tone='blue',minPoints=2\}\)/);
  assert.match(mockup,/tone="purple" minPoints=\{3\}/);
});
