import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractMarketplaceRows,marketplaceItemEvidence} from '../app/lib/marketplace-evidence.js';

test('coletor compartilhado aceita formato nativo da busca e dados do Motor',()=>{
  const example={data:{items:[{item_basic:{itemid:123,shopid:456,name:'Produto real',price:1290000,historical_sold:0,monthly_sold:7,item_rating:{rating_star:4.8,rating_count:[9,0,0,0,0,9]},shop_location:'São Paulo'}}]}};
  const rows=extractMarketplaceRows(example);
  assert.equal(rows.length,1);
  const observed=marketplaceItemEvidence(rows[0],{source:'motor-natural-search',collectedAt:'2026-10-13T12:00:00Z'});
  assert.equal(observed.itemId,'123');
  assert.equal(observed.shopId,'456');
  assert.equal(observed.price,12.9);
  assert.equal(observed.sold,0);
  assert.equal(observed.monthlySold,7);
  assert.equal(observed.reviewCount,9);
  assert.equal(observed.location,'São Paulo');
  assert.equal(observed.provenance.fields.sold.kind,'observed');
  assert.equal(observed.provenance.source,'motor-natural-search');
});

test('ausência de vendas permanece null, nunca zero',()=>{
  const observed=marketplaceItemEvidence({itemId:'42',price:790000});
  assert.equal(observed.sold,null);
  assert.equal(observed.monthlySold,null);
  assert.equal(observed.rating,null);
  assert.equal(observed.provenance.fields.monthlySold.kind,'unavailable');
});

test('venda mensal calculada é excluída da métrica real',()=>{
  const observed=marketplaceItemEvidence({itemId:42,sold:120,monthlySold:20,monthlySoldSource:'estimated'});
  assert.equal(observed.monthlySold,null);
  assert.equal(observed.estimatedMonthlySold,20);
  assert.equal(observed.provenance.fields.monthlySold.kind,'estimated-excluded');
});

test('ads_id isolado e selo Indicado não viram anúncio patrocinado',()=>{
  const fromId=marketplaceItemEvidence({itemId:1,adsid:4939,is_preferred_shop:true});
  assert.equal(fromId.ads.status,'unknown');
  assert.equal(fromId.preferred,true);
  const explicit=marketplaceItemEvidence({itemId:2,item_basic:{itemid:2,is_ads:true}});
  assert.equal(explicit.ads.status,'detected');
  const negative=marketplaceItemEvidence({itemId:3,is_ads:false});
  assert.equal(negative.ads.status,'not_detected');
});

test('normalização mantém pesquisa e checagem dos concorrentes ligadas ao mesmo contrato',()=>{
  const research=fs.readFileSync(new URL('../app/pesquisa-produtos/MarketResearch.js',import.meta.url),'utf8');
  const competitors=fs.readFileSync(new URL('../app/api/competitor-background-check/route.js',import.meta.url),'utf8');
  assert.match(research,/extractMarketplaceRows\(payload\)/);
  assert.match(research,/marketplaceItemEvidence\(row/);
  assert.match(research,/motorData\('marketplaceSearch'/);
  assert.match(competitors,/marketplaceItemEvidence\(raw/);
  assert.doesNotMatch(competitors,/ads_id\s*\?\?/);
  assert.match(competitors,/getPublicItemInfo/);
});

test('buscas vazias e discovery antigo continuam sem inventar resultados',()=>{
  assert.deepEqual(extractMarketplaceRows({data:{items:[]}}),[]);
  assert.deepEqual(extractMarketplaceRows({discovery:{candidates:{x:{itemid:1}}}}),[{itemid:1}]);
  assert.equal(marketplaceItemEvidence({title:'sem identificação'}),null);
});
