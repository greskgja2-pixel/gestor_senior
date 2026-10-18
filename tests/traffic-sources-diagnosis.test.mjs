import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSource,normalizeTraffic,rankBy,diagnoseTraffic,readField,TRAFFIC_SOURCES,SENTINEL} from '../app/lib/traffic-sources-diagnosis.js';

// Valores reais do print de 17/10/2026 (30 dias).
const traffic={
  product_card:{total:{sales:2196.64,orders:75,product_clicks:5498,product_impressions:150914,ctr:.036,product_clicks_to_orders_rate:.014}},
  live:{total:{sales:0,orders:0,product_clicks:0,ctr:0,product_clicks_to_orders_rate:0}},
  video:{total:{sales:53.96,orders:2,product_clicks:42,ctr:.133,product_clicks_to_orders_rate:.048}},
  affiliate:{total:{sales:19.99,orders:1,product_clicks:19,product_clicks_to_orders_rate:.053}},
  paid_ads:{total:{sales:SENTINEL,orders:SENTINEL,product_impressions:SENTINEL,product_clicks:SENTINEL,ctr:SENTINEL,conversion:SENTINEL}}
};
const by=(list,key)=>list.find(s=>s.key===key);

test('-1.000.000 é valor reservado: Shopee Ads fica indisponível, sem GMV/pedidos/taxas',()=>{
  const ads=by(normalizeTraffic(traffic),'paid_ads');
  assert.equal(ads.status,'unavailable');
  assert.equal(ads.sentinel,true);
  for(const k of ['sales','orders','clicks','impressions','ctr','conversion'])assert.equal(ads[k],null,k);
  assert.match(ads.reason,/-1\.000\.000/);
  assert.match(ads.hypothesis,/need_paid_ads_data=false/);
  assert.match(ads.hypothesis,/Não confirmado/);
});

test('qualquer valor negativo é inválido e nunca vira zero',()=>{
  assert.deepEqual(readField({sales:-5},['sales']),{state:'invalid',value:null,raw:-5,sentinel:false});
  assert.equal(readField({},['sales']).state,'missing');
  assert.equal(readField({sales:0},['sales']).state,'ok');
  const s=normalizeSource(TRAFFIC_SOURCES[0],{sales:100,orders:-3,product_clicks:50});
  assert.equal(s.status,'partial');
  assert.equal(s.orders,null);
  assert.deepEqual(s.invalidFields,['pedidos']);
});

test('fonte ausente ≠ zero real ≠ inválida',()=>{
  const list=normalizeTraffic({...traffic,affiliate:undefined});
  assert.equal(by(list,'affiliate').status,'missing');
  assert.equal(by(list,'live').status,'ok');
  assert.equal(by(list,'live').sales,0);
  assert.equal(by(list,'live').orders,0);
});

test('CTR e conversão só com base válida na mesma fonte (Live sem impressões não tem CTR 0%)',()=>{
  const list=normalizeTraffic(traffic);
  const live=by(list,'live'),card=by(list,'product_card');
  assert.equal(live.ctr,null);
  assert.equal(live.conversion,null);
  assert.ok(Math.abs(card.ctr-5498/150914)<1e-9);
  assert.ok(Math.abs(card.conversion-.014)<1e-9);
  // sem taxa da Shopee, calcula pedidos ÷ cliques e informa a origem
  const calc=normalizeSource(TRAFFIC_SOURCES[0],{sales:10,orders:5,product_clicks:100});
  assert.equal(calc.conversion,.05);
  assert.equal(calc.conversionOrigin,'calculada');
});

test('ranking só usa valores válidos e amostra mínima; amostra pequena não ganha conversão',()=>{
  const list=normalizeTraffic(traffic);
  const conv=rankBy(list,'conversion');
  assert.deepEqual(conv.ranked.map(r=>r.source.key),['product_card']);
  assert.ok(conv.excluded.some(e=>e.source.key==='video'&&/Amostra pequena/.test(e.why)));
  const sales=rankBy(list,'sales');
  assert.equal(sales.ranked[0].source.key,'product_card');
  assert.ok(!sales.ranked.some(r=>r.source.key==='paid_ads'));
  assert.ok(sales.excluded.some(e=>e.source.key==='paid_ads'&&e.why==='Dados indisponíveis'));
});

test('diagnóstico: líder de GMV, fonte sem dados e nenhuma soma de fontes',()=>{
  const d=diagnoseTraffic(normalizeTraffic(traffic));
  assert.equal(d.summary.topSales.source.key,'product_card');
  assert.ok(d.insights.some(i=>i.id==='top-sales'));
  const ads=d.insights.find(i=>i.id==='nodata-paid_ads');
  assert.ok(ads);
  assert.match(ads.action,/Histórico Ads/);
  assert.ok(!d.insights.some(i=>/total geral|soma/i.test(i.title)));
  assert.equal(d.usableCount,4);
});

test('volume alto com conversão baixa vira alerta como hipótese, não como causa comprovada',()=>{
  const mk=(sales,orders,clicks)=>({total:{sales,orders,product_clicks:clicks,product_impressions:clicks*20}});
  const d=diagnoseTraffic(normalizeTraffic({product_card:mk(900,90,3000),live:mk(500,50,1000),video:mk(100,3,2500),affiliate:mk(300,30,800)}));
  const low=d.insights.find(i=>i.id==='low-conv-video');
  assert.ok(low);
  assert.match(low.hypothesis,/Nada disso foi comprovado/);
});

test('sem fontes válidas não há recomendação de desempenho inventada',()=>{
  const d=diagnoseTraffic(normalizeTraffic(null));
  assert.equal(d.usableCount,0);
  assert.equal(d.summary.topSales,null);
  assert.ok(d.insights.every(i=>i.tone==='data'));
});
