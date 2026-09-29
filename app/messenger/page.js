'use client';

import {useEffect,useMemo,useState} from 'react';
import {motorData} from '../lib/client-async';
import styles from './messenger.module.css';

const QUICK_REPLIES=[
  'Olá! 😊 Como posso ajudar?',
  'Seu pedido foi recebido com sucesso. Obrigado pela compra! 💚',
  'Vou verificar essa informação para você.',
  'Qualquer dúvida, estou à disposição. 😊'
];

function timeLabel(value){
  if(!value)return'';
  const n=Number(value);
  const date=new Date(n>1e14?Math.floor(n/1e6):n>1e11?n:n*1000);
  if(Number.isNaN(date.getTime()))return'';
  return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(date);
}

function normalizeConversations(data){
  const rows=data?.conversations||data?.list||data?.items||[];
  return (Array.isArray(rows)?rows:[]).map((row,index)=>({
    id:String(row.conversation_id||row.conversationId||row.id||index),
    buyerId:row.buyer_id||row.to_id||row.oppside_user_id||row.user_id||null,
    buyerShopId:row.buyer_shop_id||row.to_shop_id||null,
    name:row.buyer_name||row.to_user_name||row.user_name||row.username||'Comprador Shopee',
    avatar:row.avatar||row.avatar_url||row.image||'',
    preview:row.last_message?.text||row.last_message||row.preview||row.message||'Conversa Shopee',
    unread:Number(row.unread_count||row.unread||0),
    timestamp:row.last_message_timestamp||row.timestamp||row.update_time||row.mtime||null,
    bizId:Number(row.biz_id??0),
    raw:row
  }));
}

function normalizeMessages(data){
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
      timestamp:row.timestamp||row.create_time||row.ctime||null
    };
  });
}

export default function MessengerPage(){
  const [conversations,setConversations]=useState([]);
  const [selected,setSelected]=useState(null);
  const [messages,setMessages]=useState([]);
  const [context,setContext]=useState({});
  const [query,setQuery]=useState('');
  const [draft,setDraft]=useState('');
  const [loading,setLoading]=useState(true);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const [bridgeReady,setBridgeReady]=useState(false);

  async function loadConversations(){
    setLoading(true);setError('');
    try{
      const data=await motorData('shopeeMessengerList',{bizIds:[0,11,12],limit:40},25000);
      const rows=normalizeConversations(data);
      setConversations(rows);
      setBridgeReady(true);
      if(rows.length&&!selected)openConversation(rows[0]);
    }catch(err){
      setBridgeReady(false);
      setError('O Messenger está instalado no Gestor, mas esta versão do Motor Sênior ainda não possui o conector de WebChat. Atualize a extensão quando a versão com Messenger estiver disponível.');
    }finally{setLoading(false)}
  }

  async function openConversation(conv){
    setSelected(conv);setMessages([]);setContext({});setHistoryLoading(true);setError('');
    try{
      const data=await motorData('shopeeMessengerHistory',{
        conversationId:conv.id,buyerId:conv.buyerId,buyerShopId:conv.buyerShopId,bizId:conv.bizId,limit:30
      },25000);
      setMessages(normalizeMessages(data));
      setContext({buyer:data?.buyer||data?.user||null,order:data?.order||null,product:data?.product||null});
      setBridgeReady(true);
    }catch(err){
      setBridgeReady(false);
      setError('Não foi possível abrir esta conversa pelo Motor Sênior. O conector de WebChat precisa estar habilitado na extensão.');
    }finally{setHistoryLoading(false)}
  }

  async function sendMessage(){
    const text=draft.trim();
    if(!text||!selected||sending)return;
    setSending(true);setError('');
    try{
      const data=await motorData('shopeeMessengerSendText',{
        conversationId:selected.id,buyerId:selected.buyerId,buyerShopId:selected.buyerShopId,bizId:selected.bizId,text
      },25000);
      setDraft('');
      if(data?.message)setMessages(prev=>[...prev,...normalizeMessages({messages:[data.message]})]);
      else await openConversation(selected);
    }catch(err){
      setBridgeReady(false);
      setError('Envio de texto bloqueado: o payload de mensagem de texto ainda precisa ser confirmado no Motor Sênior. Não enviamos um formato presumido para a Shopee.');
    }finally{setSending(false)}
  }

  useEffect(()=>{loadConversations()},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return conversations;
    return conversations.filter(c=>(c.name+' '+c.preview).toLowerCase().includes(q));
  },[conversations,query]);

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>ATENDIMENTO</span><h1>Messenger Shopee</h1><p>Converse com compradores sem sair do Gestor Sênior.</p></div>
      <div className={styles.status} data-ready={bridgeReady?'true':'false'}><i/>{bridgeReady?'WebChat conectado':'Aguardando conector WebChat'}</div>
    </header>

    <section className={styles.automationBar}>
      <div><span className={styles.autoIcon}>⚙</span><div><b>Automações de atendimento</b><small>Prepare mensagens por evento sem disparar nada sem confirmação.</small></div></div>
      <div className={styles.automationPills}>
        <span data-state="planned">✓ Pagamento aprovado <small>preparado</small></span>
        <span data-state="blocked">! Carrinho abandonado <small>sem comprador identificável</small></span>
      </div>
    </section>

    <div className={styles.layout}>
      <aside className={styles.conversations}>
        <div className={styles.listTop}><div><b>Conversas</b><small>{conversations.reduce((n,c)=>n+c.unread,0)} não lidas</small></div><button onClick={loadConversations} disabled={loading} title="Atualizar">↻</button></div>
        <label className={styles.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar comprador ou mensagem"/></label>
        <div className={styles.list}>
          {loading&&<div className={styles.empty}>Carregando conversas…</div>}
          {!loading&&!filtered.length&&<div className={styles.empty}>Nenhuma conversa disponível.</div>}
          {filtered.map(conv=><button key={conv.id} className={selected?.id===conv.id?styles.activeConversation:''} onClick={()=>openConversation(conv)}>
            <span className={styles.avatar}>{conv.avatar?<img src={conv.avatar} alt=""/>:conv.name.slice(0,1).toUpperCase()}</span>
            <span className={styles.convText}><b>{conv.name}</b><small>{conv.preview}</small></span>
            <span className={styles.convMeta}><small>{timeLabel(conv.timestamp)}</small>{conv.unread>0&&<em>{conv.unread>99?'99+':conv.unread}</em>}</span>
          </button>)}
        </div>
      </aside>

      <main className={styles.chat}>
        {!selected?<div className={styles.welcome}><span>💬</span><h2>Central de conversas</h2><p>Selecione uma conversa para ver o histórico e responder pelo Gestor.</p></div>:<>
          <div className={styles.chatHead}><span className={styles.avatar}>{selected.name.slice(0,1).toUpperCase()}</span><div><b>{selected.name}</b><small>Comprador Shopee · conversa #{selected.id.slice(-6)}</small></div></div>
          <div className={styles.messages}>
            {historyLoading&&<div className={styles.empty}>Abrindo conversa…</div>}
            {!historyLoading&&!messages.length&&<div className={styles.empty}>O histórico aparecerá aqui quando o conector WebChat estiver ativo.</div>}
            {messages.map(msg=><div key={msg.id} className={msg.mine?styles.mine:styles.theirs}><div>{msg.type==='text'?msg.text:'['+msg.type+']'}</div><small>{timeLabel(msg.timestamp)}</small></div>)}
          </div>
          <div className={styles.quickReplies}>{QUICK_REPLIES.map(text=><button key={text} onClick={()=>setDraft(text)}>{text}</button>)}</div>
          <div className={styles.composer}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Digite sua mensagem…" rows={2}/><button onClick={sendMessage} disabled={!draft.trim()||sending}>{sending?'Enviando…':'Enviar ➤'}</button></div>
        </>}
      </main>

      <aside className={styles.details}>
        <h3>Detalhes</h3>
        {!selected?<div className={styles.empty}>Abra uma conversa para ver comprador, pedido e produto.</div>:<>
          <div className={styles.detailCard}><span>👤</span><div><small>COMPRADOR</small><b>{context.buyer?.name||context.buyer?.username||selected.name}</b><p>{selected.buyerId?'ID '+selected.buyerId:'Dados via WebChat'}</p></div></div>
          <div className={styles.detailCard}><span>📦</span><div><small>PEDIDO RELACIONADO</small><b>{context.order?.order_sn||context.order?.serial_number||'Aguardando WebChat'}</b><p>{context.order?.status||'A Shopee mostrará o pedido vinculado à conversa.'}</p></div></div>
          <div className={styles.detailCard}><span>🛍️</span><div><small>PRODUTO</small><b>{context.product?.name||context.product?.title||'Aguardando WebChat'}</b><p>{context.product?.actual_prices?.[0]?'R$ '+context.product.actual_prices[0]:'Produto relacionado à conversa.'}</p></div></div>
          <div className={styles.safety}><b>🔒 Sessão local</b><p>O Messenger usa a sessão da Shopee no navegador através do Motor Sênior. Cookies do Seller Center não são enviados para a Vercel.</p></div>
        </>}
      </aside>
    </div>

    {error&&<div className={styles.notice}><b>Motor Sênior</b><span>{error}</span></div>}
  </div>;
}
