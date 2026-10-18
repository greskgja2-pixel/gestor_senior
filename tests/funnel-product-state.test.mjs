import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyProduct,needsRecollect,hasBottleneck,summarizeProducts,matchesFilter,sortRows,STATES} from '../app/lib/funnel-product-state.js';

const row=(id,plan,flags,p={})=>({p:{id,...p},plan,state:classifyProduct(plan,flags)});
const ready=(priority='bad')=>({priority,label:'FAÇA AGORA'});

test('ausência de coleta, amostra pequena e dados parciais são estados diferentes',()=>{
  assert.equal(classifyProduct({priority:'missing',label:'DADOS NÃO COLETADOS'}).id,'missing');
  assert.equal(classifyProduct({priority:'missing',label:'COLETA PARCIAL'}).id,'partial');
  assert.equal(classifyProduct({priority:'data',label:'POUCOS DADOS'}).id,'small');
  assert.equal(classifyProduct(ready('good')).id,'ready');
  assert.equal(classifyProduct(null).id,'missing');
});

test('recoleta em andamento e falha confirmada têm prioridade sobre o estado dos dados',()=>{
  assert.equal(classifyProduct(ready(),{updating:true}),STATES.updating);
  assert.equal(classifyProduct({priority:'missing',label:'DADOS NÃO COLETADOS'},{failed:true}).id,'failed');
  assert.ok(needsRecollect(STATES.failed));
  assert.ok(!needsRecollect(STATES.small));
  assert.ok(!needsRecollect(STATES.ready));
});

test('sem dados nunca vira diagnóstico de desempenho ruim',()=>{
  const missing=row('1',{priority:'missing',label:'DADOS NÃO COLETADOS'});
  const small=row('2',{priority:'data',label:'POUCOS DADOS'});
  const bad=row('3',ready('bad'));
  assert.ok(!hasBottleneck(missing.state,missing.plan));
  assert.ok(!hasBottleneck(small.state,small.plan));
  assert.ok(hasBottleneck(bad.state,bad.plan));
  const s=summarizeProducts([missing,small,bad,row('4',ready('good'))]);
  assert.deepEqual({total:s.total,missing:s.missing,small:s.small,ready:s.ready,bottleneck:s.bottleneck,recollect:s.recollect},{total:4,missing:1,small:1,ready:2,bottleneck:1,recollect:1});
});

test('filtros: recoleta, dados insuficientes, diagnóstico e ação',()=>{
  const rows=[row('m',{priority:'missing',label:'DADOS NÃO COLETADOS'}),row('s',{priority:'data'}),row('b',ready('bad')),row('g',ready('good'))];
  const ids=f=>rows.filter(r=>matchesFilter(r,f)).map(r=>r.p.id);
  assert.deepEqual(ids('all'),['m','s','b','g']);
  assert.deepEqual(ids('recollect'),['m']);
  assert.deepEqual(ids('insufficient'),['s']);
  assert.deepEqual(ids('diagnosis'),['b']);
  assert.deepEqual(ids('action'),['b']);
});

test('prioridade comercial ≠ prioridade de coleta; sem dado vai ao fim da ordenação por métrica',()=>{
  const rows=[
    row('m',{priority:'missing',label:'DADOS NÃO COLETADOS'}),
    row('g',ready('good'),{}, {product_card_impressions:900}),
    row('b',ready('bad'),{}, {product_card_impressions:50}),
    row('s',{priority:'data'},{}, {product_card_impressions:127})
  ];
  assert.deepEqual(sortRows(rows,'commercial').map(r=>r.p.id),['b','s','g','m']);
  assert.equal(sortRows(rows,'collection')[0].p.id,'m');
  assert.deepEqual(sortRows(rows,'impressions').map(r=>r.p.id),['g','s','b','m']);
});
