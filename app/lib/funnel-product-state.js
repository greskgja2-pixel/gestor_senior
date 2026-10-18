// Estado de cada anúncio no Funil por Produto (lógica pura, testada em tests/funnel-product-state.test.mjs).
//
// Separa conceitos que a UI antiga misturava:
//  - ausência de coleta (missing/partial/failed)  ≠  amostra pequena (small)  ≠  desempenho (diagnóstico bad/warn/good);
//  - prioridade de COLETA (o que recoletar) ≠ prioridade COMERCIAL (o que melhorar).
// Os limites de amostra pequena (100 impressões / 10 visitantes) vêm de `productPlan` em page.js. São heurísticas
// do projeto, não critério estatístico validado, e ficam documentadas na UI (tooltip).

export const SAMPLE_LIMITS=Object.freeze({impressions:100,visitors:10});

export const STATES=Object.freeze({
  ready:{id:'ready',label:'Dados suficientes',icon:'check',level:'good'},
  small:{id:'small',label:'Amostra pequena',icon:'info',level:'warn'},
  partial:{id:'partial',label:'Dados parciais',icon:'alert',level:'warn'},
  missing:{id:'missing',label:'Não coletado',icon:'help',level:'data'},
  failed:{id:'failed',label:'Falha de coleta',icon:'alert',level:'bad'},
  updating:{id:'updating',label:'Atualizando',icon:'refresh',level:'info'}
});

// `plan` é o retorno de productPlan(p,med). `flags`: {updating, failed} vindos da recoleta em andamento/erro.
export function classifyProduct(plan,flags={}){
  if(flags.updating)return STATES.updating;
  if(flags.failed)return STATES.failed;
  if(!plan)return STATES.missing;
  if(plan.priority==='missing')return plan.label==='COLETA PARCIAL'?STATES.partial:STATES.missing;
  if(plan.priority==='data')return STATES.small;
  return STATES.ready;
}

export const needsRecollect=state=>state.id==='missing'||state.id==='partial'||state.id==='failed';
// "Com diagnóstico" = há gargalo relevante com amostra suficiente (nunca vem de anúncio sem dados).
export const hasBottleneck=(state,plan)=>state.id==='ready'&&(plan?.priority==='bad'||plan?.priority==='warn');

export function summarizeProducts(rows){
  const out={total:rows.length,ready:0,small:0,partial:0,missing:0,failed:0,updating:0,bottleneck:0,recollect:0};
  for(const r of rows){
    out[r.state.id]++;
    if(hasBottleneck(r.state,r.plan))out.bottleneck++;
    if(needsRecollect(r.state))out.recollect++;
  }
  return out;
}

export const FILTERS=Object.freeze([
  {id:'all',label:'Todos'},
  {id:'recollect',label:'Precisam de recoleta'},
  {id:'insufficient',label:'Dados insuficientes'},
  {id:'diagnosis',label:'Com diagnóstico'},
  {id:'action',label:'Com ação recomendada'}
]);
export function matchesFilter(row,filter){
  if(filter==='recollect')return needsRecollect(row.state);
  if(filter==='insufficient')return row.state.id==='small'||row.state.id==='partial';
  if(filter==='diagnosis')return hasBottleneck(row.state,row.plan);
  // Ação comercial só existe com dados suficientes; recoleta aparece em "Precisam de recoleta".
  if(filter==='action')return row.state.id==='ready'&&row.plan?.priority!=='good';
  return true;
}

export const SORTS=Object.freeze([
  {id:'commercial',label:'Prioridade comercial'},
  {id:'collection',label:'Prioridade de coleta'},
  {id:'impressions',label:'Impressões'},
  {id:'clicks',label:'Cliques'},
  {id:'orders',label:'Pedidos'}
]);
const metric=(p,key)=>{const v=p?.[key];return v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v)};
// Valores ausentes sempre vão para o fim, em qualquer ordenação (ausente ≠ zero).
const byMetricDesc=key=>(a,b)=>{const x=metric(a.p,key),y=metric(b.p,key);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return y-x};
const COMMERCIAL_RANK={bad:0,warn:1,small:2,good:3,missing:4};
const COLLECTION_RANK={failed:0,missing:1,partial:2,small:3,ready:4,updating:5};
export function sortRows(rows,sort){
  const list=[...rows];
  if(sort==='impressions')return list.sort(byMetricDesc('product_card_impressions'));
  if(sort==='clicks')return list.sort(byMetricDesc('product_card_clicks'));
  if(sort==='orders')return list.sort(byMetricDesc('placed_buyers'));
  if(sort==='collection')return list.sort((a,b)=>(COLLECTION_RANK[a.state.id]??9)-(COLLECTION_RANK[b.state.id]??9));
  const rank=r=>r.state.id==='ready'?COMMERCIAL_RANK[r.plan?.priority]??3:r.state.id==='small'?COMMERCIAL_RANK.small:COMMERCIAL_RANK.missing;
  return list.sort((a,b)=>rank(a)-rank(b));
}
