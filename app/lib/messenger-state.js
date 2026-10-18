// Messenger Shopee — normalização, estados, busca e automações (lógica pura, testada em
// tests/messenger-state.test.mjs). NADA aqui envia mensagem: envio depende de confirmação humana e do Motor Sênior.
//
// Fatos do Motor (v0.18.x, src/web-engine.js; ver CLAUDE.md 2026-09-28):
//  - `shopeeMessengerList` lê só biz_id=0 e devolve unread_count e a última mensagem (sem remetente);
//  - `shopeeMessengerHistory` devolve mensagens, comprador, pedido e produto quando a conversa tem origem (source_content);
//  - `shopeeMessengerSendText` está deliberadamente em fail-closed ("Envio de texto ainda não habilitado").

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);

export function toDate(value){
  const n=num(value);
  if(n==null)return null;
  const d=new Date(n>1e14?Math.floor(n/1e6):n>1e11?n:n*1000);
  return Number.isNaN(d.getTime())?null:d;
}
export function timeLabel(value,now=new Date()){
  const d=toDate(value);
  if(!d)return'';
  const sameDay=d.toDateString()===now.toDateString();
  const opts={timeZone:'America/Sao_Paulo'};
  return sameDay?new Intl.DateTimeFormat('pt-BR',{...opts,hour:'2-digit',minute:'2-digit'}).format(d)
    :new Intl.DateTimeFormat('pt-BR',{...opts,day:'2-digit',month:'2-digit'}).format(d);
}

export function normalizeConversations(data){
  const rows=data?.conversations||data?.list||data?.items||[];
  return (Array.isArray(rows)?rows:[]).map((row,index)=>({
    id:String(row.conversation_id||row.conversationId||row.id||index),
    buyerId:row.buyer_id||row.to_id||row.oppside_user_id||row.user_id||null,
    buyerShopId:row.buyer_shop_id||row.to_shop_id||null,
    name:row.buyer_name||row.to_user_name||row.user_name||row.username||'Comprador Shopee',
    avatar:row.avatar||row.avatar_url||row.image||'',
    preview:row.last_message?.text||row.last_message||row.preview||row.message||'',
    unread:Number(row.unread_count||row.unread||0)||0,
    timestamp:row.last_message_timestamp||row.timestamp||row.update_time||row.mtime||null,
    bizId:Number(row.biz_id??0)||0,
    lastType:row.latest_message_type||null,
    raw:row
  }));
}

export function normalizeMessages(data){
  const rows=data?.messages||data?.list||data?.items||[];
  return (Array.isArray(rows)?rows:[]).map((row,index)=>{
    const content=row?.content;
    const text=typeof content==='string'?content:(content?.text||row?.text||row?.message||row?.custom_preview_text?.text||'');
    return{
      id:String(row.id||row.message_id||row.msg_id||index),
      text:String(text||''),
      type:row.type||'text',
      mine:Boolean(row.mine||row.is_sender||row.from_me||row.sender_role==='seller'),
      fromId:row.from_id||row.sender_id||null,
      timestamp:row.timestamp||row.create_time||row.ctime||null,
      sourceType:row.source_type||'',
      source:row.source_content||null,
      // Estados de mensagem: só "sent" existe de verdade (veio do WebChat). Sugestões nunca viram "sent" sem envio real.
      state:row.__local==='sent'?'sent':'received'
    };
  });
}

// Conversa "aguardando resposta": só dá para afirmar com o histórico aberto (a lista não informa o remetente).
export function awaitingReply(messages){
  const list=(messages||[]).filter(m=>m.type!=='system');
  if(!list.length)return null;
  const sorted=[...list].sort((a,b)=>(num(a.timestamp)??0)-(num(b.timestamp)??0));
  return sorted.at(-1).mine===false;
}

export function searchConversations(list,query){
  const q=String(query||'').trim().toLowerCase();
  if(!q)return list;
  return list.filter(c=>`${c.name} ${c.preview} ${c.id} ${c.buyerId??''}`.toLowerCase().includes(q));
}
export const FILTERS=Object.freeze([{id:'all',label:'Todas'},{id:'unread',label:'Não lidas'}]);
export function filterConversations(list,filter){return filter==='unread'?list.filter(c=>c.unread>0):list}
export const unreadTotal=list=>list.reduce((n,c)=>n+(c.unread||0),0);
export function sortConversations(list){
  // Não lidas primeiro; dentro de cada grupo, a mais recente primeiro. Sem horário vai ao fim do grupo.
  return [...list].sort((a,b)=>((b.unread>0)-(a.unread>0))||((num(b.timestamp)??0)-(num(a.timestamp)??0)));
}

// Estado do WebChat a partir da resposta/erro REAL do Motor. Não existe "conectado" sem uma leitura bem-sucedida.
export function bridgeStateFromError(message){
  const m=String(message||'');
  if(/sess[ãa]o do WebChat|Seller Center|aba do Seller/i.test(m))return{id:'session',label:'Sessão do WebChat não pronta',help:'Abra o chat da Shopee no Seller Center uma vez e atualize.'};
  if(/n[ãa]o respondeu|excedeu|timeout|demorou/i.test(m))return{id:'disconnected',label:'Motor Sênior não respondeu',help:'Confirme que a extensão está ativa e que há uma aba do Seller Center aberta.'};
  if(/desconhecida|unknown|conector|n[ãa]o suporta/i.test(m))return{id:'connector',label:'Conector WebChat ausente',help:'Esta versão do Motor Sênior não possui o conector de WebChat. Atualize a extensão.'};
  return{id:'error',label:'Erro no WebChat',help:m||'Falha ao consultar o WebChat.'};
}
export const BRIDGE={
  connecting:{id:'connecting',label:'Conectando ao WebChat…',tone:'info'},
  connected:{id:'connected',label:'WebChat conectado',tone:'good'},
  session:{tone:'warn'},disconnected:{tone:'bad'},connector:{tone:'bad'},error:{tone:'bad'}
};

export function isSendDisabledError(message){return/n[ãa]o habilitado|ainda n[ãa]o|bloqueado/i.test(String(message||''))}

// Automações de atendimento: status HONESTO (nenhuma está ativa; nada dispara sozinho).
export function automations({sendSupport}={}){
  const sendReady=sendSupport==='available';
  return[
    {
      id:'payment_approved',label:'Pagamento aprovado',icon:'check',
      status:'planned',statusLabel:sendReady?'Preparado · aguarda confirmação':'Planejado · inativo',
      summary:'Sugere uma mensagem de confirmação quando um pedido é pago. Nunca envia sozinha.',
      template:'Seu pedido foi recebido com sucesso. Obrigado pela compra! 💚',
      conditions:[
        {text:'Pedido e comprador identificados na conversa',ok:null},
        {text:'Envio de texto habilitado no Motor Sênior',ok:sendSupport==='available'?true:sendSupport==='unavailable'?false:null},
        {text:'Confirmação manual antes de cada envio',ok:true},
        {text:'Proteção contra envio repetido (idempotência) implementada',ok:false}
      ]
    },
    {
      id:'abandoned_cart',label:'Carrinho abandonado',icon:'cart',
      status:'blocked',statusLabel:'Sem comprador identificável',
      summary:'Não pode ser executado: a Shopee não informa quem é o comprador de um carrinho abandonado.',
      template:null,
      conditions:[
        {text:'Comprador identificável pela Shopee',ok:false},
        {text:'Pedido “aguardando pagamento” (to_pay) não é carrinho abandonado e não é usado como tal',ok:true}
      ]
    }
  ];
}

// Contexto da conversa aberta: o que existe de verdade vs. o que falta.
export function contextOf(conv,context){
  const buyer=context?.buyer||null,order=context?.order||null,product=context?.product||null;
  const level=(order||product)?(order&&product?'full':'partial'):'none';
  return{buyer,order,product,level,
    orderId:order?.order_sn||order?.serial_number||order?.order_id||null,
    productId:product?.product_id||product?.item_id||product?.id||null,
    productShopId:product?.shop_id||null};
}
