import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/IntelligenceSections.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/intelligence-sections.module.css',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../app/api/competitor-monitor/route.js',import.meta.url),'utf8');

test('Concorrentes foi reconstruido com estrutura propria do mockup',()=>{
  for(const token of [
    'radarExactToolbar','radarExactKpis','radarExactProgress','radarExactColumns','radarExactCard',
    'radarExactIdentity','radarExactPrice','radarExactSales','radarExactVisibility','radarExactActions',
    'Alertas do radar competitivo','Distribuição dos concorrentes','Dicas e insights'
  ])assert.ok(ui.includes(token),'estrutura ausente: '+token);
  assert.match(css,/GS_RADAR_EXACT_MOCKUP_2026_09_24/);
  assert.doesNotMatch(css,/GS_RADAR_COMPETITIVO_2026_09_24/);
  assert.doesNotMatch(css,/GS_RADAR_APPROVED_LAYOUT_2026_09_24/);
  assert.doesNotMatch(css,/GS_RADAR_MOCKUP_MATCH_2026_09_24/);
});

test('ordem visual segue mockup: toolbar, kpis, progresso e lista',()=>{
  const toolbar=ui.indexOf('radarExactToolbar');
  const kpis=ui.indexOf('radarExactKpis');
  const progress=ui.indexOf('radarExactProgress');
  const columns=ui.indexOf('radarExactColumns');
  assert.ok(toolbar>=0&&kpis>toolbar&&progress>kpis&&columns>progress);
});

test('cada concorrente oferece titulo clicavel e atalhos do anuncio proprio',()=>{
  assert.match(ui,/className=\{styles\.radarExactTitle\} href=\{r\.link\}/);
  assert.match(ui,/Editar preço do meu anúncio/);
  assert.match(ui,/Ir para meu anúncio/);
  assert.match(ui,/Abrir anúncio/);
  assert.match(ui,/section=super-anuncio/);
  assert.match(ui,/tab=price/);
});

test('visibilidade principal tem somente os tres dados essenciais do mockup',()=>{
  assert.match(ui,/Visibilidade na busca/);
  assert.match(ui,/Concorrente/);
  assert.match(ui,/Meu anúncio/);
  assert.match(ui,/Shopee Ads/);
  assert.match(ui,/Ver análise da busca/);
  assert.match(css,/\.radarExactVisibility>div\{display:grid;grid-template-columns:1fr auto/);
});

test('barra de progresso informa avanço real durante a rechecagem',()=>{
  assert.match(ui,/Rechecando concorrentes/);
  assert.match(ui,/bulkProgress\.done\/bulkProgress\.total/);
  assert.match(css,/\.radarExactProgressTrack i\{/);
  assert.match(css,/transition:width \.45s ease/);
});

test('coleta de posição e ads continua integrada ao Motor Senior',()=>{
  assert.match(ui,/collectSearchVisibility/);
  assert.match(ui,/megaStartResearch/);
  assert.match(ui,/megaGetStatus/);
  assert.match(ui,/megaGetResult/);
  assert.match(ui,/Ads ativo nesta busca/);
});

test('remover concorrente continua preservando o historico no backend',()=>{
  assert.match(api,/old\?\.enabled===false\?false:true/);
});
