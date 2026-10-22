import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const page=read('app/extensao-shopee-intelligence/IntelligenceSections.js');
const monitor=read('app/api/competitor-monitor/route.js');

test('coleta sem dado não vira "última coleta": o servidor ignora snapshots vazios e a tela não grava mais coleta vazia', () => {
  assert.match(monitor,/function isUsefulSnapshot/);
  assert.match(monitor,/if\(!isUsefulSnapshot\(row\)\)continue/);
  // imagem sozinha não é dado
  assert.match(monitor,/snapshot\.price==null&&snapshot\.sold==null&&snapshot\.rating==null&&!hasMetadata/);
  // undefined!==null era sempre verdadeiro e gravava uma coleta vazia a cada checagem
  assert.doesNotMatch(page,/market\.preferred!==null/);
  assert.match(page,/market\.preferred===true\|\|market\.preferred===false/);
});

test('checagem de concorrente usa a extensão (collectCompetitorDetails) antes da busca pública do servidor', () => {
  assert.match(page,/async function collectViaMotor/);
  assert.match(page,/motorData\('collectCompetitorDetails'/);
  assert.match(page,/source:'motor-senior'/);
  // só conta como atualizado quando houve dado de verdade
  assert.match(page,/motorDone\.has\(String\(row\.watch\.id\)\)\|\|hasMarketData\)updated\+\+;else failed\+\+/);
});
