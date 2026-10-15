import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/lib/funnel-product-diagnostics.js',import.meta.url),'utf8');
const {needsFunnelRetry,chooseBestFunnelResponse,diagnoseFunnelProducts,mergeRecollectedFunnelProduct}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
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


test('botão de recoleta aparece em cada card, no cabeçalho',()=>{
  assert.match(ui,/function ProductFunnelCard\(\{p,med,mode,context,onRecollect/);
  assert.match(ui,/className=\{styles\.productHeaderActions\}/);
  assert.match(ui,/↻ Recoletar dados/);
  assert.match(ui,/onRecollect=\{recollectProduct\}/);
  assert.match(ui,/recollectDisabled=\{!!recollection\.busyId\}/);
  assert.match(ui,/aria-live="polite"/);
});
test('recoleta inclui somente ID solicitado sem apagar os demais anúncios',()=>{
  const previous={period:{type:'real_time'},products:[
    {id:'111',product_card_impressions:18,uv:2},
    {id:'222',product_card_impressions:null,uv:null}
  ],keyMetrics:{shop_uv:{value:20}}};
  const incoming={period:{type:'real_time'},products:[
    {id:'111',product_card_impressions:999,uv:99},
    {id:'222',product_card_impressions:50,product_card_clicks:3,uv:4}
  ]};
  const result=mergeRecollectedFunnelProduct(previous,incoming,'222','real_time');
  assert.equal(result.status,'updated');
  assert.equal(result.metrics,3);
  assert.equal(result.seller.products.find(x=>x.id==='222').uv,4);
  assert.equal(result.seller.products.find(x=>x.id==='111').uv,2);
  assert.equal(result.seller.keyMetrics.shop_uv.value,20);
  assert.equal(previous.products[1].uv,null);
});
test('período não confirmado ou incompatível não atualiza métricas',()=>{
  const old={products:[{id:'222'}]};
  const wrong={period:{type:'real_time'},products:[{id:'222',uv:12}]};
  const missing={products:[{id:'222',uv:12}]};
  assert.equal(mergeRecollectedFunnelProduct(old,wrong,'222','past30days').status,'period_mismatch');
  assert.equal(mergeRecollectedFunnelProduct(old,missing,'222','past30days').status,'period_unconfirmed');
  assert.equal(mergeRecollectedFunnelProduct(old,wrong,'222','past30days').seller,old);
});
test('Motor pode não devolver ID ou devolver sem métricas, sem falso sucesso',()=>{
  const old={products:[{id:'111',uv:5}]};
  assert.equal(mergeRecollectedFunnelProduct(old,{period:{type:'real_time'},products:[{id:'111',uv:8}]},'222','real_time').status,'not_returned');
  assert.equal(mergeRecollectedFunnelProduct(old,{period:{type:'real_time'},products:[{id:'222'}]},'222','real_time').status,'no_metrics');
});
test('não perde métricas anteriores se resposta for mais incompleta',()=>{
  const old={products:[{id:'222',product_card_impressions:30,product_card_clicks:4,uv:6}]};
  const fresh={period:{type:'real_time'},products:[{id:'222',uv:7}]};
  const result=mergeRecollectedFunnelProduct(old,fresh,'222','real_time');
  assert.equal(result.status,'less_complete');
  assert.equal(result.seller,old);
});
test('zero verdadeiro é aceito e não herda métricas antigas',()=>{
  const old={products:[{id:'222',product_card_impressions:15,uv:2}]};
  const fresh={period:{type:'real_time'},products:[{id:'222',product_card_impressions:0,uv:0}]};
  const result=mergeRecollectedFunnelProduct(old,fresh,'222','real_time');
  assert.equal(result.status,'updated');
  assert.equal(result.seller.products[0].product_card_impressions,0);
  assert.equal(result.seller.products[0].uv,0);
  assert.equal(result.seller.products[0].paid_buyers,null);
});
test('não mantém taxas de um snapshot anterior durante a recoleta',()=>{
  const old={products:[{id:'222',product_card_impressions:15,product_card_clicks:4,uv:7,ctr:0.9,uv_to_add_to_cart_rate:0.8}]};
  const fresh={period:{type:'real_time'},products:[{id:'222',product_card_impressions:22,product_card_clicks:3,uv:8}]};
  const result=mergeRecollectedFunnelProduct(old,fresh,'222','real_time');
  assert.equal(result.status,'updated');
  assert.equal(result.seller.products[0].ctr,null);
  assert.equal(result.seller.products[0].uv_to_add_to_cart_rate,null);
});
