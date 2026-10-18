import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAd,buildAds,classifyAd,referenceOf,adMatches,sortAds,interpret,ADS_THRESHOLDS} from '../app/lib/ads-history-diagnosis.js';

const camp=(id,impressions,clicks,orders,extra={})=>({campaignId:id,title:'Anúncio '+id,impressions,clicks,orders,...extra});
// 6 anúncios "normais" (CTR 4%, clique→pedido 3%) para formar a referência.
const base=()=>Array.from({length:6},(_,i)=>camp(100+i,5000,200,6));
const find=(built,id)=>built.rows.find(r=>r.ad.campaignId===id);

test('CTR e clique→pedido usam as fórmulas existentes; ausente não vira zero',()=>{
  const a=normalizeAd(camp(1,5568,253,5));
  assert.ok(Math.abs(a.ctr-253/5568)<1e-12);
  assert.ok(Math.abs(a.cvr-5/253)<1e-12);
  const missing=normalizeAd({campaignId:2,title:'x'});
  assert.equal(missing.impressions,null);assert.equal(missing.ctr,null);assert.equal(missing.cvr,null);
  assert.equal(normalizeAd(camp(3,0,0,0)).ctr,null);          // sem impressões: sem CTR
  assert.equal(normalizeAd(camp(4,100,-1000000,2)).clicks,null); // sentinela descartada
  assert.equal(normalizeAd(camp(5,100,0,0)).cvr,null);        // sem cliques: sem conversão
});

test('amostra pequena recebe "Amostra limitada" e nunca um diagnóstico forte',()=>{
  const built=buildAds([...base(),camp(1,300,12,0),camp(2,900,40,3)]);
  assert.equal(find(built,1).state.id,'limited');
  assert.equal(find(built,2).state.id,'limited');
  assert.match(find(built,1).interpretation.hypothesis,/sorte ou azar/);
});

test('muito clique e nenhum pedido é "waste", mesmo sem referência (fato objetivo)',()=>{
  const built=buildAds([camp(1,4000,260,0)]);
  assert.equal(find(built,1).state.id,'waste');
  assert.equal(built.ref.cvr,null);
  assert.match(find(built,1).interpretation.fact,/nenhum pedido/);
});

test('conversão abaixo de 60% da mediana (com amostra) é waste; ordenação por oportunidade',()=>{
  const built=buildAds([...base(),camp(1,5000,500,3),camp(2,5000,150,1)]);
  assert.equal(find(built,1).state.id,'waste');
  const sorted=sortAds(built.rows,'opportunity');
  assert.equal(sorted[0].ad.campaignId,1);
  assert.ok(find(built,1).opportunity>find(built,2).opportunity);
});

test('muita exibição e CTR baixo; CTR boa com pouco alcance é promissor, não "melhor"',()=>{
  const built=buildAds([...base(),camp(1,20000,200,6),camp(2,1500,120,4)]);
  assert.equal(find(built,1).state.id,'lowCtr');
  assert.equal(find(built,2).state.id,'promising');
});

test('boa tração exige pedidos e volume; sem referência não compara taxas',()=>{
  const built=buildAds([...base(),camp(1,8000,400,20)]);
  assert.equal(find(built,1).state.id,'strong');
  const lone=buildAds([camp(1,5000,200,6)]);
  assert.equal(lone.ref.ctr,null);
  assert.equal(find(lone,1).state.id,'strong');
});

test('resumo: só destaca melhor CTR/conversão com amostra mínima; zero pedidos contados à parte',()=>{
  const built=buildAds([...base(),camp(1,200,20,2),camp(2,300,3,0)]);
  const s=built.summary;
  assert.equal(s.total,8);
  assert.notEqual(s.bestCtr?.ad.campaignId,1);   // CTR 10% com 200 impressões não vence
  assert.notEqual(s.bestCvr?.ad.campaignId,1);   // 10% de conversão com 20 cliques não vence
  assert.equal(s.zeroOrders,1);
  assert.equal(s.spend,null);                    // sem gasto na fonte, não inventa gasto/ROAS
  assert.equal(s.roas,null);
});

test('gasto, GMV e ROAS só aparecem quando a fonte traz; ROAS exige gasto > 0',()=>{
  const built=buildAds([camp(1,5000,200,6,{spend:50,gmv:200}),camp(2,5000,200,6,{spend:0,gmv:100})]);
  assert.equal(built.rows[0].ad.roas,4);
  assert.equal(built.rows[1].ad.roas,null);
  assert.equal(built.summary.roas,4); // só o anúncio com gasto > 0 entra no ROAS agregado
});

test('filtros e ordenação: ausentes e amostra pequena no fim',()=>{
  const built=buildAds([...base(),camp(1,300,10,0),camp(2,8000,600,0)]);
  const ids=f=>built.rows.filter(r=>adMatches(r,f,built.ref)).map(r=>r.ad.campaignId);
  assert.ok(ids('noOrders').includes(1)&&ids('noOrders').includes(2));
  assert.deepEqual(ids('wasteClicks'),[2]);
  const byCvr=sortAds(built.rows,'cvr');
  assert.ok(byCvr.at(-2).ad.campaignId===1||byCvr.at(-1).ad.campaignId===1); // CVR de amostra pequena não ranqueia
  assert.equal(ADS_THRESHOLDS.minClicks,100);
});

test('interpretação em linguagem simples e sem afirmar causa',()=>{
  const a=normalizeAd(camp(1,5568,253,5));
  const i=interpret(a,classifyAd(a,{ctr:null,cvr:null,impressions:null}),{ctr:null,cvr:null});
  assert.match(i.per100ctr,/De cada 100 impressões, cerca de 4,5 geraram clique/);
  assert.match(i.per100cvr,/De cada 100 cliques, cerca de 2 geraram pedido/);
  const w=interpret(normalizeAd(camp(2,4000,260,0)),{id:'waste'},{cvr:.03});
  assert.doesNotMatch(w.hypothesis,/o problema é|a causa é/i);
  assert.match(w.hypothesis,/não foi comprovado|nada disso foi comprovado/i);
});
