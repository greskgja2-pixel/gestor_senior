import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const page=read('app/super-analise/page.js');
const view=read('app/super-analise/SuperAnaliseInteligente.js');
const css=read('app/super-analise/page.module.css');
const flow=read('app/super-analise/WebAuditFlow.js');
const flowCss=read('app/super-analise/web-audit.module.css');

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

test('extensao e somente motor e fluxo acontece no site',()=>{
  assert.match(page,/if\(!requestedReport&&!requestedItem\)return <WebAuditFlow\/>/);
  for(const token of ['Objetivo, situação e gargalo','Shopee Ads — últimos 7 dias','Custos','Selecione 3 concorrentes','Recarregar botões','Analisar Tudo','Motor da extensão'])assert.match(flow,new RegExp(token));
  assert.match(flow,/GS_ENGINE_REQUEST/);
  assert.doesNotMatch(flow,/GS_OPEN_SIDE_PANEL/);
});
