import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diagnoseStore,evaluateTransition,rankProductsForStage,judgeChange,periodChanges,
  transitionById,THRESHOLDS,FUNNEL_TRANSITIONS,storeStageProductRate,median
} from '../app/lib/funnel-store-diagnosis.js';

// Gera um anúncio com taxas controladas.
const product=(id,{imp=5000,ctr=.05,vc=.1,cp=.5,pp=.7,pc=.9}={})=>{
  const clicks=Math.round(imp*ctr),uv=Math.round(clicks*.8),carts=Math.round(uv*vc),placed=Math.round(carts*cp),paid=Math.round(placed*pp),confirmed=Math.round(paid*pc);
  return{id:String(id),product_card_impressions:imp,product_card_clicks:clicks,uv,add_to_cart_buyers:carts,placed_buyers:placed,paid_buyers:paid,confirmed_buyers:confirmed};
};
const many=(n,opts)=>Array.from({length:n},(_,i)=>product(i+1,opts));
const run=(products,totals={},rates={},comparison={})=>diagnoseStore({totals,rates,products,comparison,evidence:{}});

test('gargalo não é a menor porcentagem: CTR uniforme baixo não vira prioridade',()=>{
  // Todos os anúncios têm o mesmo CTR (baixo por natureza); o problema real está em Carrinho → Pedido de alguns.
  const products=[...many(8,{ctr:.03,vc:.1,cp:.5,imp:6000}),...many(4,{ctr:.03,vc:.1,cp:.1,imp:6000}).map((p,i)=>({...p,id:'x'+i}))];
  const d=run(products);
  assert.equal(d.state,'bottleneck');
  assert.equal(d.primary.id,'cartPlaced');
  assert.notEqual(d.evaluated.find(e=>e.id==='ctr').level,'bad');
});

test('anúncios abaixo da mediana concentram volume e viram prioridade com explicação verificável',()=>{
  const products=[...many(10,{ctr:.06}),...many(4,{ctr:.015,imp:12000}).map((p,i)=>({...p,id:'low'+i}))];
  const d=run(products);
  assert.equal(d.primary.id,'ctr');
  assert.equal(d.primary.level,'bad');
  assert.ok(d.primary.reference>.05&&d.primary.reference<.07);
  assert.equal(d.primary.laggards.length,4);
  assert.ok(d.primary.laggardShare>.4);
  assert.ok(d.primary.productCount>=THRESHOLDS.minProductsForReference);
});

test('Cliques → Visitantes é relação entre fontes: nunca é gargalo nem conversão, mesmo acima de 100%',()=>{
  const t=transitionById('clickVisit');
  assert.equal(t.kind,'ratio');
  const ev=evaluateTransition(t,many(6),1.14,3244);
  assert.equal(ev.level,'info');
  assert.equal(ev.exceeds,true);
  const d=run(many(6),{clicks:3244,visitors:3699},{clickVisit:1.14});
  assert.ok(!d.actionable.some(e=>e.id==='clickVisit'));
  assert.notEqual(d.primary?.id,'clickVisit');
});

test('poucos anúncios com volume não geram diagnóstico (dados insuficientes ≠ saudável)',()=>{
  const d=run(many(2));
  assert.equal(d.state,'insufficient');
  assert.equal(d.primary,null);
  assert.ok(d.evaluated.filter(e=>e.kind==='conversion').every(e=>e.level==='data'));
  assert.match(d.evaluated.find(e=>e.id==='ctr').reason,/Poucos anúncios/);
});

test('ausência de coleta não vira zero nem tráfego pequeno',()=>{
  const d=run([{id:'1'},{id:'2'},{id:'3'},{id:'4'}]);
  assert.equal(d.state,'insufficient');
  assert.equal(storeStageProductRate({id:'1'},'ctr').rate,null);
  assert.equal(storeStageProductRate({product_card_impressions:0,product_card_clicks:0},'ctr').rate,null);
});

test('taxas de anúncio acima de 100% são excluídas da referência e contadas',()=>{
  const bad=many(3).map((p,i)=>({...p,id:'b'+i,add_to_cart_buyers:p.uv*2}));
  const ev=evaluateTransition(transitionById('visitCart'),[...many(4),...bad],.1,4000);
  assert.equal(ev.inconsistent,3);
  assert.equal(ev.productCount,4);
});

test('loja dentro da referência não inventa gargalo',()=>{
  const d=run(many(10));
  assert.equal(d.state,'healthy');
  assert.equal(d.primary,null);
  assert.ok(d.watch);
});

test('base parcial de anúncios é sinalizada',()=>{
  const d=diagnoseStore({totals:{},rates:{},products:many(5),comparison:{},evidence:{productsExpected:30,productCount:5,rankingsPagesFailed:2}});
  assert.equal(d.reliability.partialBase,true);
  assert.equal(d.reliability.failedPages,2);
});

test('comparação com período anterior: melhora/piora/estável sem assumir que todo aumento é bom',()=>{
  assert.equal(judgeChange(.2).verdict,'better');
  assert.equal(judgeChange(-.18).verdict,'worse');
  assert.equal(judgeChange(.04).verdict,'stable');
  assert.equal(judgeChange(null).verdict,'none');
  // Para uma métrica em que cair é bom (ex.: cancelamentos) o veredito se inverte.
  assert.equal(judgeChange(-.2,'down').verdict,'better');
  assert.equal(judgeChange(.2,'down').verdict,'worse');
  const list=periodChanges({visitors:-.12,paidOrders:.3,paidGmv:null,confirmedOrders:0});
  assert.deepEqual(list.map(x=>x.verdict),['worse','better','none','stable']);
  // O nome da métrica não pode ser sobrescrito pelo rótulo do veredito (bug real encontrado no QA visual).
  assert.deepEqual(list.map(x=>x.label),['Visitantes','Pedidos pagos','GMV pago','Confirmados']);
});

test('produtos para começar: maior oportunidade (gap × volume) primeiro e nada para etapa de relação',()=>{
  const products=[...many(8,{ctr:.06}),product('grande',{ctr:.02,imp:20000}),product('pequeno',{ctr:.02,imp:800})];
  const {ranked,reference,hasGap}=rankProductsForStage(products,'ctr',3);
  assert.equal(ranked[0].p.id,'grande');
  assert.equal(ranked[1].p.id,'pequeno');
  assert.ok(reference>.05);
  assert.equal(hasGap,true);
  assert.deepEqual(rankProductsForStage(products,'clickVisit').ranked,[]);
});

test('todas as conversões têm hipóteses e passos, sem promessa de resultado',()=>{
  for(const t of FUNNEL_TRANSITIONS.filter(x=>x.kind==='conversion')){
    assert.ok(t.causes.length>=3,t.id+' sem hipóteses');
    assert.equal(t.steps.length,3,t.id+' sem 3 passos');
    assert.match(t.per100(.5),/De cada 100/);
    assert.doesNotMatch(t.why+t.steps.join(' ')+t.causes.join(' '),/garant|vai aumentar|certamente/i);
  }
  assert.equal(median([3,1,2]),2);
});
