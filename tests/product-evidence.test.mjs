import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeObservedProduct,beginProductReanalysis,observedValue} from '../app/lib/product-evidence.js';

test('merge de produto preserva dados anteriores e zero real; marca procedência campo a campo',()=>{
  const previous=beginProductReanalysis({itemId:'42',price:30,sold:20,stock:10});
  const merged=mergeObservedProduct(previous,{itemId:'42',price:25,sold:0,rating:null,stock:0},
    {source:'shopee-public-api',expectedItemId:'42',collectedAt:'2026-10-13T12:00:00Z'});
  assert.equal(merged.price,25);
  assert.equal(merged.sold,0);
  assert.equal(merged.stock,0);
  assert.equal(merged.rating,null);
  assert.equal(merged.collectionEvidence.fields.stock.kind,'observed');
  assert.equal(observedValue(mergeObservedProduct(beginProductReanalysis({itemId:'42',historicalSold:33,sold:20}),{itemId:'42',historicalSold:0},{expectedItemId:'42',source:'public'}),'sold'),0);
  assert.equal(merged.collectionEvidence.fields.price.source,'shopee-public-api');
  assert.equal(observedValue(merged,'sold'),0);
});

test('se uma API não atualizar preço/vendas, histórico não vira coleta nova',()=>{
  const previous=beginProductReanalysis({itemId:'42',price:30,sold:20,rating:4.9});
  const merged=mergeObservedProduct(previous,{itemId:'42',rating:4.8}, {source:'public',expectedItemId:'42'});
  assert.equal(merged.price,30);
  assert.equal(merged.sold,20);
  assert.equal(observedValue(merged,'price'),null);
  assert.equal(observedValue(merged,'sold'),null);
  assert.equal(observedValue(merged,'rating'),4.8);
  assert.equal(merged.collectionEvidence.fields.price.kind,'historical');
});

test('não mistura anúncios diferentes, inclusive durante reanálise',()=>{
  const previous=beginProductReanalysis({itemId:'42',shopId:'9',price:20});
  const wrong=mergeObservedProduct(previous,{itemId:'99',price:1},{source:'public',expectedItemId:'42'});
  assert.equal(wrong.price,20);
  assert.equal(observedValue(wrong,'price'),null);
  assert.equal(wrong.collectionEvidence.rejectedSources[0].reason,'item-id-mismatch');
  const wrongShop=mergeObservedProduct(previous,{itemId:'42',shopId:'10',price:1},{source:'public',expectedItemId:'42',expectedShopId:'9'});
  assert.equal(wrongShop.collectionEvidence.rejectedSources[0].reason,'shop-id-mismatch');
});

test('dados oficiais de estoque e preço por price_info enriquecem o snapshot',()=>{
  const out=mergeObservedProduct(beginProductReanalysis({itemId:'42',price:20}),{
    item_id:42,item_name:'Meu Produto',price_info:[{current_price:18.5,original_price:23}],
    stock_info_v2:{summary_info:{total_available_stock:0}}
  },{source:'shopee-open-api',expectedItemId:'42'});
  assert.equal(out.title,'Meu Produto');
  assert.equal(out.price,18.5);
  assert.equal(out.originalPrice,23);
  assert.equal(out.stock,0);
  assert.equal(out.collectionEvidence.fields.stock.kind,'observed');
});

test('Super Análise usa merge compartilhado e verifica correspondência de ID',()=>{
  const audit=fs.readFileSync(new URL('../app/super-analise/WebAuditFlow.js',import.meta.url),'utf8');
  assert.match(audit,/mergeObservedProduct/);
  assert.match(audit,/String\(x\.itemId\?\?x\.item_id\)/);
  assert.match(audit,/fetchJsonWithTimeout/);
  assert.match(audit,/rejectedSources\?\.length/);
  assert.match(audit,/motorData\('collectProduct'/);
});
test('reanálise não apaga custos nem concorrentes e diferencia dados atualizados',()=>{
  const re=fs.readFileSync(new URL('../app/super-analise/ReanalysisRunner.js',import.meta.url),'utf8');
  assert.match(re,/beginProductReanalysis/);
  assert.match(re,/mergeObservedProduct/);
  assert.match(re,/observedValue/);
  assert.match(re,/finance_snapshot:report\?\.finance_snapshot/);
  assert.match(re,/competitors\.push/);
});
test('histórico de concorrentes evita desenhar ponto novo vindo só de snapshot antigo',()=>{
  const radar=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/IntelligenceSections.js',import.meta.url),'utf8');
  assert.match(radar,/observedValue\(snap,'price'\)/);
  assert.match(radar,/observedValue\(snap,'sold'\)/);
});
