import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSource,normalizeTraffic,rankBy,diagnoseTraffic,readField,storeTotals,TRAFFIC_SOURCES,SENTINEL} from '../app/lib/traffic-sources-diagnosis.js';

// Valores reais do print de 17/10/2026 (30 dias).
const traffic={
  product_card:{total:{sales:2196.64,orders:75,product_clicks:5498,product_impressions:150914,ctr:.036,product_clicks_to_orders_rate:.014}},
  live:{total:{sales:0,orders:0,product_clicks:0,ctr:0,product_clicks_to_orders_rate:0}},
  video:{total:{sales:53.96,orders:2,product_clicks:42,ctr:.133,product_clicks_to_orders_rate:.048}},
  affiliate:{total:{sales:19.99,orders:1,product_clicks:19,product_clicks_to_orders_rate:.053}},
  paid_ads:{total:{sales:SENTINEL,orders:SENTINEL,product_impressions:SENTINEL,product_clicks:SENTINEL,ctr:SENTINEL,conversion:SENTINEL}}
};
// Resumo real capturado em 17/10/2026 (30 dias, leitura no Seller Center): Ads só traz o GMV; pct_diff de Afiliados é sentinela.
const overview={total_sales:2270.59,total_sales_pct_diff:.0502,product_card:2196.64,product_card_pct_diff:.0255,product_card_ratio:.9674,live:0,live_pct_diff:0,live_ratio:0,video:53.96,video_pct_diff:1.6993,video_ratio:.0238,affiliate:19.99,affiliate_pct_diff:SENTINEL,affiliate_ratio:.0088,paid_ads:1853.47,paid_ads_pct_diff:.2457,paid_ads_ratio:.8163};
const withOverview={...traffic,overview};
const by=(list,key)=>list.find(s=>s.key===key);

test('-1.000.000 é valor reservado: sem o resumo, Shopee Ads fica indisponível (sem GMV/pedidos/taxas)',()=>{
  const ads=by(normalizeTraffic(traffic),'paid_ads');
  assert.equal(ads.status,'unavailable');
  assert.equal(ads.sentinel,true);
  for(const k of ['sales','orders','clicks','impressions','ctr','conversion'])assert.equal(ads[k],null,k);
  assert.match(ads.reason,/-1\.000\.000/);
  assert.match(ads.hypothesis,/Confirmado em teste/);
});

test('com o resumo (overview), Ads mostra só o GMV real e descarta o resto; participação e variação vêm da Shopee',()=>{
  const list=normalizeTraffic(withOverview);
  const ads=by(list,'paid_ads');
  assert.equal(ads.status,'partial');
  assert.equal(ads.sales,1853.47);
  assert.equal(ads.salesOrigin,'resumo');
  for(const k of ['orders','clicks','impressions','ctr','conversion'])assert.equal(ads[k],null,k);
  assert.ok(Math.abs(ads.share-.8163)<1e-9);
  assert.ok(Math.abs(ads.pctDiff-.2457)<1e-9);
  assert.match(ads.reason,/Histórico Ads/);
  // pct_diff = -1.000.000 (Afiliados) é "sem dado", não -100.000.000%
  assert.equal(by(list,'affiliate').pctDiff,null);
  // variação negativa legítima continua válida
  assert.equal(normalizeSource(TRAFFIC_SOURCES[0],{sales:1,orders:1},{product_card_pct_diff:-.3}).pctDiff,-.3);
  assert.equal(storeTotals(withOverview).sales,2270.59);
  assert.equal(storeTotals(null).sales,null);
});

test('as quatro fontes não pagas somam o GMV total; Ads é parte sobreposta (nunca somada)',()=>{
  const sum=overview.product_card+overview.live+overview.video+overview.affiliate;
  assert.ok(Math.abs(sum-overview.total_sales)<.005);
  assert.ok(overview.paid_ads<=overview.total_sales);
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
  const d2=diagnoseTraffic(normalizeTraffic(withOverview));
  const share=d2.insights.find(i=>i.id==='ads-share');
  assert.ok(share);
  assert.match(share.hypothesis,/Não comprovado/);
  assert.match(share.fact,/não é somado/);
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
