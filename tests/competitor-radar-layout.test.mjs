import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/IntelligenceSections.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/intelligence-sections.module.css',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../app/api/competitor-monitor/route.js',import.meta.url),'utf8');

test('radar de concorrentes usa o layout aprovado',()=>{
  for(const token of [
    'com queda de preço','com alta de preço','com vendas acelerando','rechecagens vencidas','concorrentes monitorados',
    'Atualizar / Rechecar agora','Alertas do radar competitivo','Distribuição dos concorrentes','Dicas e insights'
  ])assert.ok(ui.includes(token),`token ausente: ${token}`);
  assert.match(css,/\.radarKpis/);
  assert.match(css,/\.radarColumns/);
  assert.match(css,/\.radarCard/);
  assert.match(css,/\.radarAside/);
});

test('cada concorrente oferece acesso ao proprio anuncio e edicao de preco',()=>{
  assert.match(ui,/Ir para meu anúncio/);
  assert.match(ui,/Editar preço do meu anúncio/);
  assert.match(ui,/\/super-analise\?item_id=/);
  assert.match(ui,/tab=price/);
  assert.match(ui,/section=super-anuncio&item_id=/);
  assert.match(ui,/Ver no Super Anúncio/);
});

test('remover do radar preserva historico e nao volta a habilitar automaticamente',()=>{
  assert.match(ui,/enabled:false/);
  assert.match(api,/old\?\.enabled===false\?false:true/);
  assert.match(ui,/O histórico já coletado será preservado/);
});

test('radar mostra variacao, ritmo, historico e rechecagem',()=>{
  assert.match(ui,/Tendência de preço/);
  assert.match(ui,/Tendência de vendas/);
  assert.match(ui,/Ritmo de vendas/);
  assert.match(ui,/Ver histórico/);
  assert.match(ui,/Rechecar a cada/);
});

test('visibilidade da busca fica resumida e detalhes permanecem expansivos',()=>{
  assert.match(ui,/Visibilidade na busca/);
  assert.match(ui,/Meu anúncio/);
  assert.match(ui,/Shopee Ads/);
  assert.match(ui,/Ver análise da busca/);
  assert.match(ui,/Palavra-chave/);
  assert.match(ui,/Páginas verificadas/);
  assert.match(ui,/Diferença/);
  assert.match(ui,/Última leitura/);
});

test('coleta de posição usa ação nova e fallback do Motor Senior 0.14',()=>{
  assert.match(ui,/collectSearchVisibility/);
  assert.match(ui,/megaStartResearch/);
  assert.match(ui,/megaGetStatus/);
  assert.match(ui,/megaGetResult/);
  assert.match(ui,/includeRaw:true/);
  assert.match(ui,/Ads ativo nesta busca/);
  assert.match(ui,/não prova que o vendedor não tenha campanha ativa/);
});


test('radar mostra progresso real durante rechecagem e mantém títulos clicáveis',()=>{
  assert.match(ui,/Rechecando concorrentes/);
  assert.match(ui,/bulkProgress/);
  assert.match(ui,/radarProgressTrack/);
  assert.match(ui,/className=\{styles\.radarTitle\} href=\{r\.link\}/);
  assert.match(ui,/CompetitorThumb/);
});

test('visibilidade principal permanece vertical e legível',()=>{
  assert.match(css,/GS_RADAR_APPROVED_LAYOUT_2026_09_24/);
  assert.match(css,/\.radarVisibility\{grid-column:4!important;grid-row:1!important;align-self:stretch;display:flex!important;flex-direction:column!important/);
  assert.match(css,/\.radarTitle\{[^}]*font-size:14px!important/);
});
