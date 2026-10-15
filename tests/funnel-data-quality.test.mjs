import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const funnelModule=readFileSync(new URL('../app/lib/funnel-health.js',import.meta.url),'utf8');
const {deriveStoreFunnel}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(funnelModule));
const ui=readFileSync(new URL('../app/funil/page.js',import.meta.url),'utf8');

function planFor(product){
  const snippet=ui.match(/function productPlan\(p,med\)\{[\s\S]*?\n\}\s*function specificPlan/);
  assert.ok(snippet,'Função productPlan encontrada');
  const source=snippet[0].replace(/\s*function specificPlan$/,'');
  const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const int=v=>num(v)==null?'—':String(v);
  const pct=v=>num(v)==null?'—':String(v);
  const money=v=>String(v);
  const plan=Function('num','int','pct','money',source+'\nreturn productPlan;')(num,int,pct,money);
  return plan(product,{});
}

test('sem coleta não vira POUCOS DADOS nem saudável',()=>{
  const p=planFor({id:'123'});
  assert.equal(p.priority,'missing');
  assert.equal(p.label,'DADOS NÃO COLETADOS');
  assert.match(p.why,/não significa/i);
});
test('uma métrica ausente indica coleta parcial',()=>{
  const p=planFor({product_card_impressions:1000});
  assert.equal(p.priority,'missing');
  assert.equal(p.label,'COLETA PARCIAL');
});
test('tráfego realmente pequeno só com números recebidos',()=>{
  const p=planFor({product_card_impressions:0,uv:0});
  assert.equal(p.priority,'data');
  assert.equal(p.label,'POUCOS DADOS');
});
test('volume alto sem conversões não vira saudável',()=>{
  const p=planFor({product_card_impressions:300,uv:25});
  assert.equal(p.priority,'missing');
  assert.equal(p.label,'COLETA PARCIAL');
});
test('não soma produtos com impressões ausentes',()=>{
  const result=deriveStoreFunnel({products:[{product_card_impressions:80,product_card_clicks:4},{product_card_clicks:2}]});
  assert.equal(result.totals.impressions,null);
  assert.equal(result.totals.clicks,6);
  assert.equal(result.coverage.stageCount,1);
  assert.equal(result.evidence.productFields.impressions,1);
});
test('zero declarado é zero real; ausência permanece null',()=>{
  const reported=deriveStoreFunnel({products:[{product_card_impressions:0,product_card_clicks:0}]});
  assert.equal(reported.totals.impressions,0);
  assert.equal(reported.totals.clicks,0);
  const absent=deriveStoreFunnel({products:[{},{}]});
  assert.equal(absent.totals.impressions,null);
  assert.equal(absent.totals.clicks,null);
});
test('usa agregado oficial quando o total dos produtos falta',()=>{
  const result=deriveStoreFunnel({products:[{}],keyMetrics:{product_impressions:{value:25},product_clicks:{value:3}}});
  assert.equal(result.totals.impressions,25);
  assert.equal(result.totals.clicks,3);
});
test('a tela permite retentativa e não mascara fontes',()=>{
  assert.match(ui,/Métricas não coletadas ou incompletas/);
  assert.match(ui,/Tentar novamente/);
  assert.match(ui,/Testar Hoje/);
  assert.match(ui,/Saúde do Sistema/);
  assert.doesNotMatch(ui,/\(impressions\?\?0\)<100/);
});
