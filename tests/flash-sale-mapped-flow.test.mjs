import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('app/api/shopee/flash-sale/route.js','utf8');
const ui=fs.readFileSync('app/super-analise/SuperAnaliseInteligente.js','utf8');

test('Oferta Relâmpago revalida data e slot antes de gravar',()=>{
  assert.match(route,/changedSlots/);
  assert.match(route,/A Shopee alterou a data ou o período/);
  assert.match(route,/returnedSlot/);
});

test('Oferta Relâmpago confirma persistência do produto após salvar',()=>{
  assert.match(route,/getShopFlashSaleItems/);
  assert.match(route,/const verified=normalizeOfferItem/);
  assert.match(route,/produto não apareceu nela após a gravação/);
  assert.match(route,/warning_items/);
});

test('UI mostra períodos no horário de Brasília e só confirma sucesso verificado',()=>{
  assert.match(ui,/America\/Sao_Paulo/);
  assert.match(ui,/salva\(s\) e confirmada\(s\) na Shopee/);
  assert.match(ui,/revalida o slot e a data/);
});
