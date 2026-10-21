import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/IntelligenceSections.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/intelligence-sections.module.css',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../app/api/competitor-monitor/route.js',import.meta.url),'utf8');

test('Concorrentes foi reconstruido com estrutura propria do mockup',()=>{
  for(const token of [
    'radarExactToolbar','radarExactKpis','radarExactProgress','radarExactColumns','radarExactCard',
    'radarExactIdentity','radarExactPrice','radarExactSales','radarCompactMenu',
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

// Desde o redesign compacto (82b7ec9) a visibilidade na busca fica no popover "Detalhes do concorrente".
test('detalhes do concorrente mostram posicao na busca, meu anuncio e Ads, com link para a analise',()=>{
  assert.match(ui,/Detalhes do concorrente/);
  assert.match(ui,/<dt>Rank na busca<\/dt>/);
  assert.match(ui,/<dt>Meu anúncio<\/dt>/);
  assert.match(ui,/<dt>Ads<\/dt>/);
  assert.match(ui,/Ver análise da busca/);
  assert.match(css,/\.radarCompactMenu/);
});

test('barra de progresso informa avanço real durante a rechecagem',()=>{
  assert.match(ui,/Rechecando concorrentes/);
  assert.match(ui,/bulkProgress\.done\/bulkProgress\.total/);
  assert.match(css,/\.radarExactProgressTrack i\{/);
  assert.match(css,/transition:width \.45s ease/);
});

test('coleta de posição e ads continua integrada ao Motor Senior',()=>{
  // collectSearchVisibility e as chamadas mega* foram substituídas (ad15140, 82b7ec9) por estas.
  assert.match(ui,/collectVisibilityGroup/);
  assert.match(ui,/visibilityViaMega/);
  assert.match(ui,/motorData\('marketplaceSearch'/);
  assert.match(ui,/\/api\/competitor-visibility/);
  assert.match(ui,/Ads ativo nesta busca/);
});

test('remover concorrente continua preservando o historico no backend',()=>{
  assert.match(api,/old\?\.enabled===false\?false:true/);
});
