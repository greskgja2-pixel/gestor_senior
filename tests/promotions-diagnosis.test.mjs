import test from 'node:test';
import assert from 'node:assert/strict';
import {productCount,timeLeft,summarize,filterRows,buildAlerts,guidance,statusNote,stateOf,ALERT_THRESHOLDS} from '../app/lib/promotions-diagnosis.js';
import fs from 'node:fs';

const NOW=1_800_000_000;
const row=(over={})=>({kind:'discount',id:1,name:'make',status:'active',time_status:'active',status_mismatch:false,start_time:NOW-3600,end_time:NOW+30*86400,item_count:4,items_state:'ok',products:[],...over});

test('zero confirmado, quantidade indisponível e falha de consulta são três coisas diferentes',()=>{
  assert.equal(productCount(row({item_count:0})).kind,'zero');
  assert.match(productCount(row({item_count:0})).text,/não possui produtos participantes/);
  assert.equal(productCount(row({item_count:null,items_state:'ok'})).kind,'unknown');
  assert.match(productCount(row({item_count:null,items_state:'ok'})).text,/indisponível/);
  const failed=productCount(row({item_count:null,items_state:'failed'}));
  assert.equal(failed.kind,'failed');assert.match(failed.text,/Não foi possível consultar/);
  assert.equal(productCount(row({item_count:1})).text,'1 produto');
  assert.match(productCount(row({item_count:100,has_more:true})).text,/ou mais/);
});

test('promoção ativa com 0 produtos confirmados gera alerta; falha de coleta NÃO a trata como vazia',()=>{
  const empty=buildAlerts([row({kind:'flash_sale',id:9,name:'Oferta Relâmpago',item_count:0})],NOW);
  assert.ok(empty.some(a=>a.id==='empty-flash_sale-9'));
  const unknown=buildAlerts([row({kind:'flash_sale',id:9,item_count:null,items_state:'failed'})],NOW);
  assert.ok(!unknown.some(a=>a.id.startsWith('empty-')));
  assert.ok(unknown.some(a=>a.id.startsWith('nodata-')));
});

test('alertas de prazo usam limite configurável e só para ativa/agendada',()=>{
  const soon=row({end_time:NOW+10*3600});
  assert.ok(buildAlerts([soon],NOW).some(a=>a.id.startsWith('ending-')));
  assert.ok(!buildAlerts([row({end_time:NOW+5*86400})],NOW).some(a=>a.id.startsWith('ending-')));
  assert.ok(buildAlerts([row({end_time:NOW+5*86400})],NOW,{endingSoonHours:200}).some(a=>a.id.startsWith('ending-')));
  assert.ok(buildAlerts([row({status:'scheduled',time_status:'scheduled',start_time:NOW+3*3600})],NOW).some(a=>a.id.startsWith('starting-')));
  assert.ok(!buildAlerts([row({status:'ended',time_status:'ended',end_time:NOW-10})],NOW).some(a=>/ending|empty/.test(a.id)));
  assert.equal(ALERT_THRESHOLDS.endingSoonHours,48);
});

test('estado operacional da Shopee prevalece sobre o horário e a divergência é explicada',()=>{
  const r=row({kind:'flash_sale',status:'disabled',time_status:'active',status_mismatch:true,shopee_status:2});
  assert.equal(stateOf(r).label,'Desativada');
  assert.match(statusNote(r),/Shopee informa/);
  const alerts=buildAlerts([r],NOW);
  assert.ok(alerts.some(a=>a.id.startsWith('status-')));
  assert.equal(stateOf({status:'xyz'}).id,'unknown');
  assert.match(statusNote(row({status:'active',time_status:'ended',status_mismatch:true})),/Prevalece a informação da Shopee/);
  assert.equal(statusNote(row()),null);
});

test('tempo restante só quando válido',()=>{
  assert.match(timeLeft(row({end_time:NOW+90*60}),NOW).text,/termina em 1 h 30 min/);
  assert.match(timeLeft(row({end_time:NOW+3*86400}),NOW).text,/3 dias/);
  assert.equal(timeLeft(row({status:'ended'}),NOW),null);
  assert.match(timeLeft(row({status:'scheduled',start_time:NOW+7200}),NOW).text,/começa em 2 h/);
  assert.equal(timeLeft(row({end_time:null}),NOW),null);
});

test('contagens: situação e tipo são cortes diferentes (não somam); filtros e busca',()=>{
  const rows=[row({id:1}),row({id:2,kind:'flash_sale',name:'Oferta Relâmpago'}),row({id:3,status:'scheduled'}),row({id:4,status:'ended'})];
  const s=summarize(rows);
  assert.deepEqual(s,{active:2,scheduled:1,ended:1,discounts:2,flash:1});
  assert.equal(filterRows(rows,'active').length,2);
  assert.equal(filterRows(rows,'discounts').length,2);          // ativa + agendada, sem encerrada
  assert.equal(filterRows(rows,'flash').length,1);
  assert.equal(filterRows(rows,'ended').length,1);
  assert.deepEqual(filterRows(rows,'active','relâmpago').map(r=>r.id),[2]);
});

test('orientações são determinísticas e só citam margem quando há desconto alto',()=>{
  const none=guidance([row()],buildAlerts([row()],NOW),NOW);
  assert.equal(none[0].id,'g-ok');
  const high=row({products:[{discount_pct:55}]});
  assert.ok(guidance([high],buildAlerts([high],NOW),NOW).some(g=>g.id==='g-margin'));
  const g=guidance([row({item_count:0})],buildAlerts([row({item_count:0})],NOW),NOW);
  assert.match(g[0].action,/produtos cadastrados e elegíveis/);
  assert.doesNotMatch(JSON.stringify(g),/prejuízo/i);
});

test('API e página continuam somente leitura e a API não trata falha como zero',()=>{
  const api=fs.readFileSync(new URL('../app/api/shopee/promotions-overview/route.js',import.meta.url),'utf8');
  const page=fs.readFileSync(new URL('../app/promocoes/page.js',import.meta.url),'utf8');
  assert.doesNotMatch(api,/export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(api,/updateShopFlashSale|addShopFlashSaleItems|createShopFlashSale/);
  assert.match(api,/items_state:itemsError\?'failed':'ok'/);
  assert.match(api,/item_count:itemsError\?null:items\.length/);
  assert.match(page,/Somente leitura nesta versão/);
});
