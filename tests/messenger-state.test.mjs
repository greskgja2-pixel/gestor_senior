import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeConversations,normalizeMessages,awaitingReply,searchConversations,filterConversations,sortConversations,unreadTotal,bridgeStateFromError,automations,contextOf,isSendDisabledError,timeLabel,diagnosticsText} from '../app/lib/messenger-state.js';

const raw=[
  {conversation_id:'c1',buyer_id:11,buyer_name:'Maria Silva',last_message:'Oi, cadê meu pedido?',unread_count:2,timestamp:1_800_000_100},
  {conversation_id:'c2',buyer_id:22,buyer_name:'João',last_message:'Obrigado!',unread_count:0,timestamp:1_800_000_900},
  {conversation_id:'c3',buyer_id:33,buyer_name:'Ana',last_message:'Tem azul?',unread_count:1,timestamp:1_800_000_500}
];

test('normaliza conversas do Motor sem inventar dados',()=>{
  const list=normalizeConversations({conversations:raw});
  assert.equal(list.length,3);
  assert.equal(list[0].unread,2);
  assert.equal(normalizeConversations({conversations:[{id:'x'}]})[0].name,'Comprador Shopee');
  assert.equal(normalizeConversations({conversations:[{id:'x'}]})[0].preview,'');   // sem texto: não finge uma mensagem
  assert.deepEqual(normalizeConversations(null),[]);
});

test('busca por comprador, trecho de mensagem e identificadores; filtro e ordenação',()=>{
  const list=normalizeConversations({conversations:raw});
  assert.deepEqual(searchConversations(list,'maria').map(c=>c.id),['c1']);
  assert.deepEqual(searchConversations(list,'azul').map(c=>c.id),['c3']);
  assert.deepEqual(searchConversations(list,'22').map(c=>c.id),['c2']);
  assert.equal(searchConversations(list,'').length,3);
  assert.deepEqual(filterConversations(list,'unread').map(c=>c.id),['c1','c3']);
  assert.equal(unreadTotal(list),3);
  assert.deepEqual(sortConversations(list).map(c=>c.id),['c3','c1','c2']);   // não lidas primeiro, mais recente antes
});

test('"aguardando resposta" só com histórico aberto e olhando a última mensagem',()=>{
  const m=(mine,ts)=>({type:'text',mine,timestamp:ts});
  assert.equal(awaitingReply([m(true,1),m(false,2)]),true);
  assert.equal(awaitingReply([m(false,1),m(true,2)]),false);
  assert.equal(awaitingReply([]),null);
});

test('estado do WebChat vem do erro real do Motor, não de suposição',()=>{
  assert.equal(bridgeStateFromError('A sessão do WebChat ainda não ficou pronta. Abra o chat da Shopee uma vez e tente novamente.').id,'session');
  assert.equal(bridgeStateFromError('O Motor Senior não respondeu em 25 segundos.').id,'disconnected');
  assert.equal(bridgeStateFromError('Ação de Messenger desconhecida.').id,'connector');
  assert.equal(bridgeStateFromError('HTTP 500').id,'error');
  assert.ok(isSendDisabledError('Envio de texto ainda não habilitado: o payload real...'));
  assert.ok(!isSendDisabledError('HTTP 500'));
});

test('automações: nenhuma está ativa; carrinho abandonado está bloqueado; idempotência pendente',()=>{
  const list=automations({sendSupport:'unavailable'});
  const pay=list.find(a=>a.id==='payment_approved'),cart=list.find(a=>a.id==='abandoned_cart');
  assert.equal(pay.status,'planned');assert.match(pay.statusLabel,/inativo/);
  assert.equal(pay.conditions.find(c=>/Envio de texto/.test(c.text)).ok,false);
  assert.equal(pay.conditions.find(c=>/idempotência/.test(c.text)).ok,false);
  assert.equal(cart.status,'blocked');assert.match(cart.statusLabel,/sem comprador identificável/i);
  assert.equal(cart.template,null);
  assert.ok(list.every(a=>a.status!=='active'));
  assert.equal(automations({sendSupport:'available'})[0].conditions.find(c=>/Envio de texto/.test(c.text)).ok,true);
});

test('contexto: completo, parcial ou ausente; nada é inventado',()=>{
  assert.equal(contextOf({},{}).level,'none');
  assert.equal(contextOf({},{order:{order_sn:'SN1'}}).level,'partial');
  const full=contextOf({},{order:{order_sn:'SN1'},product:{product_id:5,shop_id:9}});
  assert.equal(full.level,'full');assert.equal(full.orderId,'SN1');assert.equal(full.productId,5);
  assert.equal(contextOf({},{product:{name:'x'}}).productId,null);
});

test('mensagens: nunca marca como enviada o que veio do WebChat como recebida; data/hora',()=>{
  const msgs=normalizeMessages({messages:[{id:1,content:{text:'oi'},mine:false},{id:2,text:'resposta',mine:true,__local:'sent'}]});
  assert.equal(msgs[0].state,'received');assert.equal(msgs[1].state,'sent');
  assert.equal(timeLabel(null),'');
});

test('página: sem cookies da Shopee, sem envio automático e com confirmação',()=>{
  const page=fs.readFileSync(new URL('../app/messenger/page.js',import.meta.url),'utf8');
  assert.doesNotMatch(page,/SPC_CDS|csrf_token/);
  assert.match(page,/Cookies do Seller Center não são enviados para a Vercel/);
  assert.match(page,/Confirmar envio/);
  assert.match(page,/nenhuma mensagem é enviada automaticamente/i);
  assert.equal((page.match(/shopeeMessengerSendText/g)||[]).length,1);   // um único ponto de envio, atrás da confirmação
});

test('diagnóstico do Motor vira texto legível, sem dados pessoais',()=>{
  const t=diagnosticsText({attempts:[{biz_id:0,ok:true,shape:'object.data[]',raw_count:0},{biz_id:11,ok:false,error:'HTTP 403'}]});
  assert.match(t,/biz_id 0: 0 item\(ns\), formato object\.data\[\]/);
  assert.match(t,/biz_id 11: erro — HTTP 403/);
  assert.match(diagnosticsText(null),/sem detalhes/);
});
