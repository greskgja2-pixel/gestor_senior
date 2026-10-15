import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/lib/funnel-product-diagnostics.js',import.meta.url),'utf8');
const {needsFunnelRetry,chooseBestFunnelResponse,diagnoseFunnelProducts}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const ui=readFileSync(new URL('../app/funil/page.js',import.meta.url),'utf8');
const now=new Date('2026-10-14T12:00:00Z').getTime();
const context={
  a:{itemId:'111',analyzedAt:'2026-10-12T00:00:00Z'},
  b:{itemId:'222',analyzedAt:'2026-10-12T00:00:00Z'},
  c:{itemId:'333',analyzedAt:'2026-10-12T00:00:00Z'}
};

test('relatório sem métrica por produto merece única retentativa',()=>{
  assert.equal(needsFunnelRetry({keyMetrics:{shop_uv:{value:100}},products:[{}]}),true);
  assert.equal(needsFunnelRetry({products:[{product_card_impressions:0}]}),false);
  assert.equal(needsFunnelRetry({products:[{uv:0}]}),false);
  assert.equal(needsFunnelRetry({products:[]}),true);
});
test('segunda resposta só substitui primeira se possui mais dados objetivos',()=>{
  const a={products:[{id:'111',product_card_impressions:10,uv:3}]};
  const b={products:[{id:'111',product_card_impressions:20,uv:4,product_card_clicks:1}]};
  assert.equal(chooseBestFunnelResponse(a,b),b);
  assert.equal(chooseBestFunnelResponse(b,a),b);
});
test('separa produto ausente da lista de produto presente sem métricas',()=>{
  const data={period:{type:'real_time'},products:[
    {item_id:'111',product_card_impressions:226,product_card_clicks:10,uv:8},
    {itemId:'333'}
  ]};
  const report=diagnoseFunnelProducts(data,context,now);
  assert.equal(report.returnedProductCount,2);
  assert.equal(report.analyzedProductCount,3);
  assert.equal(report.matchedCount,2);
  assert.equal(report.products.find(x=>x.id==='111').status,'partial');
  assert.equal(report.products.find(x=>x.id==='222').status,'not_returned');
  assert.equal(report.products.find(x=>x.id==='333').status,'no_metrics');
  assert.equal(report.products.find(x=>x.id==='111').fields.uv,true);
});
test('campos com valor zero são evidência coletada, nunca ausentes',()=>{
  const report=diagnoseFunnelProducts({products:[{id:'111',product_card_impressions:0,product_card_clicks:0,uv:0,add_to_cart_buyers:0,placed_buyers:0,paid_buyers:0,confirmed_buyers:0}]},{a:context.a},now);
  assert.equal(report.completeCount,1);
  assert.equal(report.products[0].present,7);
});
test('usa somente análises recentes',()=>{
  const report=diagnoseFunnelProducts({products:[]},{a:{itemId:'456',analyzedAt:'2026-08-01T00:00:00Z'}},now);
  assert.equal(report.products.length,0);
});
test('UI mantém cada período separado e coleta diagnóstico por ação explícita',()=>{
  assert.match(ui,/motorData\('sellerFunnel',\{period:selectedPeriod\}/);
  assert.match(ui,/chooseBestFunnelResponse\(first,again\)/);
  assert.match(ui,/requestId!==latestRequest\.current/);
  assert.match(ui,/periodRequested:period/);
  assert.match(ui,/getJsonWithPost\('\/api\/system-health\/report'/);
  assert.match(ui,/Salvar diagnóstico da coleta/);
  assert.match(ui,/Não veio na lista do Motor/);
});
