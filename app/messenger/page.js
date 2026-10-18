'use client';

// Central de atendimento (Messenger Shopee). O Gestor lê conversas pelo Motor Sênior (sessão local do Seller Center).
// NENHUMA mensagem é enviada automaticamente: o envio exige revisão + "Confirmar envio" e depende do Motor.
// Lógica pura (estados, busca, automações) em app/lib/messenger-state.js.

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {motorData} from '../lib/client-async';
import {Icon,StatusPill,imageFallback} from '../funil/StoreOverview';
import {
  normalizeConversations,normalizeMessages,awaitingReply,searchConversations,filterConversations,sortConversations,unreadTotal,
  timeLabel,bridgeStateFromError,isSendDisabledError,automations,contextOf,FILTERS
} from '../lib/messenger-state';
import styles from './messenger.module.css';

const QUICK_REPLIES=[
  'Olá! 😊 Como posso ajudar?',
  'Seu pedido foi recebido com sucesso. Obrigado pela compra! 💚',
  'Vou verificar essa informação para você.',
  'Qualquer dúvida, estou à disposição. 😊'
];
const BRIDGE_UI={
  connecting:{label:'Conectando ao WebChat…',tone:'info',icon:'refresh'},
  connected:{label:'WebChat conectado',tone:'good',icon:'check'},
  session:{tone:'warn',icon:'alert'},disconnected:{tone:'bad',icon:'alert'},connector:{tone:'bad',icon:'alert'},error:{tone:'bad',icon:'alert'}
};
const AUTO_LEVEL={planned:'info',blocked:'warn'};

function Avatar({conv}){
  return <span className={styles.avatar} data-hue={(conv.name.charCodeAt(0)||0)%6}>{conv.avatar?<img src={conv.avatar} alt="" onError={imageFallback}/>:conv.name.slice(0,1).toUpperCase()}</span>;
}

export default function MessengerPage(){
  const [conversations,setConversations]=useState([]);
  const [selected,setSelected]=useState(null);
  const [messages,setMessages]=useState([]);
  const [context,setContext]=useState({});
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [draft,setDraft]=useState('');
  const [draftSource,setDraftSource]=useState('manual');
  const [confirming,setConfirming]=useState(false);
  const [loading,setLoading]=useState(true);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [sending,setSending]=useState(false);
  const [bridge,setBridge]=useState({id:'connecting'});
  const [listError,setListError]=useState('');
  const [historyError,setHistoryError]=useState('');
  const [sendNotice,setSendNotice]=useState('');
  const [sendSupport,setSendSupport]=useState('unknown');
  const [lastSync,setLastSync]=useState(null);
  const [awaiting,setAwaiting]=useState({});
  const [autoOpen,setAutoOpen]=useState('');
  const [autosOpen,setAutosOpen]=useState(false);
  const [view,setView]=useState('list');
  const [copied,setCopied]=useState('');
  const selectedRef=useRef(null);
  const listBusy=useRef(false);
  selectedRef.current=selected;

  const setBridgeError=message=>setBridge(bridgeStateFromError(message));

  async function loadConversations(){
    if(listBusy.current)return;
    listBusy.current=true;
    setLoading(true);setListError('');
    try{
      const data=await motorData('shopeeMessengerList',{bizIds:[0,11,12],limit:40},25000);
      const rows=normalizeConversations(data);
      setConversations(rows);
      setBridge({id:'connected'});setLastSync(Date.now());
      // Preserva a conversa aberta (atualiza só os dados da lista, sem reabrir nem apagar o histórico).
      const cur=selectedRef.current;
      if(cur){const fresh=rows.find(r=>r.id===cur.id);if(fresh)setSelected(fresh)}
    }catch(err){
      const message=String(err?.message||err);
      setListError(message);setBridgeError(message);
    }finally{setLoading(false);listBusy.current=false}
  }

  async function openConversation(conv){
    setSelected(conv);setMessages([]);setContext({});setHistoryLoading(true);setHistoryError('');setConfirming(false);setSendNotice('');setView('chat');
    try{
      const data=await motorData('shopeeMessengerHistory',{
        conversationId:conv.id,buyerId:conv.buyerId,buyerShopId:conv.buyerShopId,bizId:conv.bizId,limit:30
      },25000);
      if(selectedRef.current?.id!==conv.id)return;   // o usuário já trocou de conversa
      const list=normalizeMessages(data);
      setMessages(list);
      setContext({buyer:data?.buyer||data?.user||null,order:data?.order||null,product:data?.product||null});
      setAwaiting(a=>({...a,[conv.id]:awaitingReply(list)}));
      setBridge({id:'connected'});
    }catch(err){
      if(selectedRef.current?.id!==conv.id)return;
      const message=String(err?.message||err);
      setHistoryError(message);setBridgeError(message);
    }finally{if(selectedRef.current?.id===conv.id)setHistoryLoading(false)}
  }

  // Único ponto de envio. Só é chamado depois de "Confirmar envio".
  async function sendConfirmed(){
    const text=draft.trim();
    if(!text||!selected||sending)return;
    setSending(true);setSendNotice('');
    try{
      const data=await motorData('shopeeMessengerSendText',{
        conversationId:selected.id,buyerId:selected.buyerId,buyerShopId:selected.buyerShopId,bizId:selected.bizId,text
      },25000);
      setSendSupport('available');
      setDraft('');setDraftSource('manual');setConfirming(false);
      if(data?.message)setMessages(prev=>[...prev,...normalizeMessages({messages:[{...data.message,__local:'sent'}]})]);
      else await openConversation(selected);
      setSendNotice('Mensagem enviada pelo WebChat.');
    }catch(err){
      const message=String(err?.message||err);
      setConfirming(false);
      if(isSendDisabledError(message)){setSendSupport('unavailable');setSendNotice('O envio de texto ainda não está habilitado no Motor Sênior. Nada foi enviado. Copie a mensagem e envie pelo WebChat da Shopee.')}
      else setSendNotice('Não foi possível confirmar o envio ('+message+'). Considere a mensagem como NÃO enviada.');
    }finally{setSending(false)}
  }

  async function copy(text,key){
    try{await navigator.clipboard.writeText(text);setCopied(key);setTimeout(()=>setCopied(''),1800)}
    catch{setSendNotice('Não foi possível copiar automaticamente neste navegador.')}
  }

  function useTemplate(text,source='template'){
    setDraft(text);setDraftSource(source);setConfirming(false);setSendNotice('');
    if(selected)setView('chat');
  }

  useEffect(()=>{loadConversations()},[]);

  const shown=useMemo(()=>sortConversations(filterConversations(searchConversations(conversations,query),filter)),[conversations,query,filter]);
  const unread=unreadTotal(conversations);
  const autos=useMemo(()=>automations({sendSupport}),[sendSupport]);
  const ctx=contextOf(selected,context);
  const origin=[...messages].reverse().find(m=>m.sourceType)?.sourceType||null;
  const bridgeUi=bridge.id==='connected'||bridge.id==='connecting'?{...BRIDGE_UI[bridge.id]}:{...BRIDGE_UI[bridge.id],label:bridge.label};
  const stamp=lastSync?new Date(lastSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):null;
  const sendDisabledUi=sendSupport==='unavailable';

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>ATENDIMENTO</span><h1>Messenger Shopee</h1><p>Converse com compradores sem sair do Gestor Sênior.</p></div>
      <div className={styles.headStatus}>
        <div className={styles.status} data-tone={bridgeUi.tone} role="status" aria-live="polite"><Icon name={bridgeUi.icon} size={15}/>{bridgeUi.label}</div>
        <div className={styles.counters}>
          <span data-on={unread>0}><Icon name="mail" size={14}/>{unread} não lida{unread===1?'':'s'}</span>
          <span><Icon name="bot" size={14}/>{autos.length} automações · nenhuma ativa</span>
          {stamp&&<span><Icon name="clock" size={14}/>Sincronizado às {stamp}</span>}
        </div>
      </div>
    </header>
    {bridge.help&&bridge.id!=='connected'&&bridge.id!=='connecting'&&<div className={styles.notice} data-tone={bridgeUi.tone} role="alert"><Icon name="alert" size={16}/><div><b>{bridge.label}</b><p>{bridge.help}</p></div><button type="button" onClick={loadConversations} disabled={loading}>Tentar novamente</button></div>}

    <section className={styles.automations} aria-labelledby="auto-title">
      <button type="button" className={styles.autoHead} aria-expanded={autosOpen} onClick={()=>setAutosOpen(v=>!v)}>
        <span className={styles.autoIcon}><Icon name="bot" size={18}/></span>
        <span className={styles.autoTitle}><b id="auto-title">Automações de atendimento</b><small>Prepare mensagens por evento sem disparar nada sem confirmação.</small></span>
        <span className={styles.autoPills}>{autos.map(a=><span key={a.id} data-level={AUTO_LEVEL[a.status]}><Icon name={a.icon} size={13}/>{a.label} <em>{a.statusLabel}</em></span>)}</span>
        <Icon name="chevron" size={16}/>
      </button>
      {autosOpen&&<div className={styles.autoBody}>
        {autos.map(a=><article key={a.id} data-level={AUTO_LEVEL[a.status]}>
          <header><span><Icon name={a.icon} size={16}/></span><b>{a.label}</b><StatusPill level={AUTO_LEVEL[a.status]} label={a.statusLabel}/></header>
          <p>{a.summary}</p>
          <ul aria-label={'Condições de '+a.label}>{a.conditions.map((c,i)=><li key={i} data-ok={c.ok===null?'unknown':c.ok}><Icon name={c.ok===true?'check':c.ok===false?'alert':'help'} size={13}/>{c.text}{c.ok===null?' (verificado por conversa)':''}</li>)}</ul>
          {a.template&&<div className={styles.templateBox}><small>Modelo para revisão (não enviado)</small><p>{a.template}</p>
            <button type="button" disabled={!selected} title={selected?'Carrega o modelo no campo de resposta, sem enviar':'Abra uma conversa para usar o modelo'} onClick={()=>useTemplate(a.template,'automation')}>Usar na conversa aberta</button></div>}
        </article>)}
        <p className={styles.fine}><Icon name="shield" size={13}/>Nenhuma automação está ativa: nenhuma mensagem é enviada automaticamente. O envio de qualquer texto exige sua confirmação e ainda depende do Motor Sênior.</p>
      </div>}
    </section>

    <nav className={styles.viewTabs} aria-label="Painéis do Messenger">
      {[['list','Conversas','chat'],['chat','Conversa','mail'],['details','Detalhes','info']].map(([id,label,icon])=><button key={id} type="button" data-active={view===id} aria-pressed={view===id} onClick={()=>setView(id)}><Icon name={icon} size={15}/>{label}</button>)}
    </nav>

    <div className={styles.layout} data-view={view}>
      <aside className={styles.conversations} aria-label="Lista de conversas">
        <div className={styles.listTop}>
          <div><b>Conversas</b><small>{unread} não lida{unread===1?'':'s'} · {conversations.length} no total</small></div>
          <button type="button" onClick={loadConversations} disabled={loading} aria-label="Atualizar conversas" title="Sincronizar conversas com o WebChat"><Icon name="refresh" size={17}/></button>
        </div>
        <label className={styles.search}><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar comprador, mensagem ou ID" aria-label="Buscar conversas"/></label>
        <div className={styles.filters} role="group" aria-label="Filtrar conversas">{FILTERS.map(f=><button key={f.id} type="button" data-active={filter===f.id} aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}{f.id==='unread'&&unread>0?` (${unread})`:''}</button>)}</div>
        <div className={styles.list}>
          {loading&&!conversations.length&&<div className={styles.empty}><Icon name="refresh" size={20}/><b>Carregando conversas…</b><span>Consultando o WebChat pelo Motor Sênior.</span></div>}
          {!loading&&!conversations.length&&!listError&&<div className={styles.empty}><Icon name="chat" size={22}/><b>Nenhuma conversa encontrada</b><span>Verifique se há novas mensagens no WebChat da Shopee e atualize para sincronizar de novo.</span><button type="button" onClick={loadConversations}>Atualizar conversas</button></div>}
          {!loading&&!conversations.length&&listError&&<div className={styles.empty} data-tone="bad"><Icon name="alert" size={22}/><b>Não foi possível carregar as conversas</b><span>{bridge.help||listError}</span><button type="button" onClick={loadConversations}>Tentar novamente</button></div>}
          {conversations.length>0&&listError&&<div className={styles.stale} role="status"><Icon name="alert" size={14}/>Última sincronização falhou; exibindo as conversas anteriores{stamp?` (de ${stamp})`:''}.</div>}
          {conversations.length>0&&!shown.length&&<div className={styles.empty}><Icon name="search" size={20}/><b>Nada encontrado</b><span>{query?'Nenhuma conversa corresponde à busca.':'Nenhuma conversa neste filtro.'}</span><button type="button" onClick={()=>{setQuery('');setFilter('all')}}>Limpar busca e filtros</button></div>}
          {shown.map(conv=><button key={conv.id} type="button" className={styles.conv} data-active={selected?.id===conv.id} data-unread={conv.unread>0} onClick={()=>openConversation(conv)} aria-current={selected?.id===conv.id?'true':undefined}>
            <Avatar conv={conv}/>
            <span className={styles.convText}><b>{conv.name}</b><small>{conv.preview||(conv.lastType&&conv.lastType!=='text'?'['+conv.lastType+']':'Sem prévia da mensagem')}</small>
              {awaiting[conv.id]===true&&<i className={styles.awaiting}><Icon name="clock" size={11}/>Aguardando resposta</i>}</span>
            <span className={styles.convMeta}><small>{timeLabel(conv.timestamp)}</small>{conv.unread>0&&<em aria-label={conv.unread+' não lidas'}>{conv.unread>99?'99+':conv.unread}</em>}</span>
          </button>)}
        </div>
      </aside>

      <main className={styles.chat} aria-label="Conversa">
        {!selected?<div className={styles.welcome}>
          <span className={styles.welcomeIcon}><Icon name="chat" size={34}/></span>
          <h2>Central de conversas</h2>
          <p>Selecione uma conversa para ver o histórico e responder pelo Gestor.</p>
          <ul>
            <li><Icon name="mail" size={15}/>{unread>0?`Você tem ${unread} mensagem(ns) não lida(s): elas aparecem primeiro na lista.`:'Quando houver mensagens não lidas, elas aparecem primeiro na lista.'}</li>
            <li><Icon name="user" size={15}/>Ao abrir uma conversa, o painel de detalhes mostra comprador, pedido e produto quando a Shopee os informa.</li>
            <li><Icon name="shield" size={15}/>Respostas e modelos são sempre revisados por você: nada é enviado automaticamente.</li>
          </ul>
          <div className={styles.welcomeActions}><button type="button" onClick={loadConversations} disabled={loading}><Icon name="refresh" size={15}/>Atualizar conversas</button><button type="button" onClick={()=>setAutosOpen(true)}><Icon name="bot" size={15}/>Revisar automações</button></div>
        </div>:<>
          <header className={styles.chatHead}>
            <button type="button" className={styles.back} onClick={()=>setView('list')} aria-label="Voltar para a lista de conversas"><Icon name="chevron" size={16}/></button>
            <Avatar conv={selected}/>
            <div><b>{selected.name}</b><small>Comprador Shopee · conversa #{selected.id.slice(-6)}{selected.unread>0?` · ${selected.unread} não lida(s)`:''}</small></div>
            <div className={styles.chips}>
              {awaiting[selected.id]===true&&<StatusPill level="warn" label="Aguardando resposta"/>}
              {awaiting[selected.id]===false&&<StatusPill level="good" label="Respondida por você"/>}
              <StatusPill level={ctx.level==='full'?'good':ctx.level==='partial'?'warn':'data'} label={ctx.level==='full'?'Contexto completo':ctx.level==='partial'?'Contexto parcial':'Sem contexto de pedido'}/>
              <button type="button" className={styles.detailsBtn} onClick={()=>setView('details')}>Detalhes</button>
            </div>
          </header>
          <div className={styles.messages} aria-live="polite">
            {historyLoading&&<div className={styles.empty}><Icon name="refresh" size={20}/><b>Abrindo conversa…</b></div>}
            {!historyLoading&&historyError&&<div className={styles.empty} data-tone="bad"><Icon name="alert" size={22}/><b>Não foi possível abrir esta conversa</b><span>{bridgeStateFromError(historyError).help}</span><button type="button" onClick={()=>openConversation(selected)}>Tentar novamente</button></div>}
            {!historyLoading&&!historyError&&!messages.length&&<div className={styles.empty}><Icon name="chat" size={22}/><b>Sem mensagens nesta conversa</b><span>O WebChat não devolveu mensagens para esta conversa.</span></div>}
            {messages.map(msg=><div key={msg.id} className={msg.mine?styles.mine:styles.theirs} data-state={msg.state}><div>{msg.type==='text'?msg.text:'['+msg.type+']'}</div><small>{timeLabel(msg.timestamp)}{msg.state==='sent'?' · Enviada':''}</small></div>)}
          </div>

          <div className={styles.composerWrap}>
            <div className={styles.quickReplies} role="group" aria-label="Modelos de resposta (não enviam)"><small>Modelos · carregam no campo, não enviam:</small>{QUICK_REPLIES.map(text=><button key={text} type="button" onClick={()=>useTemplate(text,'template')}>{text}</button>)}</div>
            {sendNotice&&<div className={styles.sendNotice} role="status" data-tone={/Nada foi enviado|NÃO enviada|Não foi possível/.test(sendNotice)?'warn':'good'}>{sendNotice}</div>}
            {draft.trim()&&<div className={styles.draftState}><Icon name="info" size={13}/>{draftSource==='manual'?'Rascunho':'Modelo carregado'} — <b>não enviado</b>{confirming?' · aguardando sua confirmação':''}</div>}
            {confirming&&<div className={styles.confirm} role="alertdialog" aria-label="Confirmar envio da mensagem">
              <p><b>Enviar para {selected.name}?</b> A mensagem sairá pelo WebChat da Shopee e não poderá ser desfeita.</p>
              <blockquote>{draft.trim()}</blockquote>
              <div><button type="button" className={styles.confirmBtn} onClick={sendConfirmed} disabled={sending}>{sending?'Enviando…':'Confirmar envio'}</button><button type="button" onClick={()=>setConfirming(false)} disabled={sending}>Cancelar</button></div>
            </div>}
            <div className={styles.composer}>
              <textarea value={draft} onChange={e=>{setDraft(e.target.value);setDraftSource('manual');setConfirming(false)}} placeholder="Digite sua resposta…" rows={2} aria-label="Resposta ao comprador"/>
              <div className={styles.composerBtns}>
                {sendDisabledUi
                  ?<button type="button" className={styles.sendBtn} disabled={!draft.trim()} onClick={()=>copy(draft.trim(),'draft')}><Icon name="copy" size={15}/>{copied==='draft'?'Copiado!':'Copiar mensagem'}</button>
                  :<button type="button" className={styles.sendBtn} disabled={!draft.trim()||sending||confirming} onClick={()=>setConfirming(true)}><Icon name="send" size={15}/>Revisar e enviar</button>}
              </div>
            </div>
            <small className={styles.fine}><Icon name="shield" size={13}/>{sendDisabledUi?'Envio de texto indisponível no Motor Sênior: copie a mensagem e envie pelo WebChat da Shopee. ':''}Nenhuma mensagem é enviada automaticamente.</small>
          </div>
        </>}
      </main>

      <aside className={styles.details} aria-label="Detalhes da conversa">
        <h3><Icon name="info" size={16}/>Detalhes</h3>
        {!selected?<div className={styles.empty}><Icon name="user" size={22}/><b>Nenhuma conversa aberta</b><span>Os detalhes aparecem quando uma conversa com contexto for aberta: comprador, pedido, produto e origem.</span></div>:<>
          <div className={styles.detailCard} data-tone="blue"><span><Icon name="user" size={18}/></span><div><small>COMPRADOR</small><b>{ctx.buyer?.name||ctx.buyer?.username||selected.name}</b><p>{selected.buyerId?'ID '+selected.buyerId:'ID não informado pela Shopee'}</p></div></div>
          <div className={styles.detailCard} data-tone="green"><span><Icon name="package" size={18}/></span><div><small>PEDIDO RELACIONADO</small>
            {ctx.orderId?<><b>{ctx.orderId}</b><p>{ctx.order?.status||'Status não informado.'}</p><button type="button" className={styles.linkBtn} onClick={()=>copy(String(ctx.orderId),'order')}><Icon name="copy" size={12}/>{copied==='order'?'Copiado!':'Copiar nº do pedido'}</button></>
              :<><b>Sem pedido vinculado</b><p>{historyLoading?'Carregando…':'A Shopee não informou um pedido para esta conversa.'}</p></>}</div></div>
          <div className={styles.detailCard} data-tone="amber"><span><Icon name="tag" size={18}/></span><div><small>PRODUTO</small>
            {ctx.product?<><b>{ctx.product?.name||ctx.product?.title||'Produto '+(ctx.productId??'')}</b><p>{ctx.product?.actual_prices?.[0]?'R$ '+ctx.product.actual_prices[0]:'Preço não informado.'}</p>
              <div className={styles.linksCol}>
                {ctx.productId&&ctx.productShopId&&<a href={`https://shopee.com.br/product/${ctx.productShopId}/${ctx.productId}`} target="_blank" rel="noreferrer">Ver anúncio na Shopee <Icon name="external" size={12}/></a>}
                {ctx.productId&&<Link href={`/super-analise?item_id=${encodeURIComponent(ctx.productId)}`}>Abrir Super Análise do produto</Link>}
              </div></>
              :<><b>Sem produto vinculado</b><p>{historyLoading?'Carregando…':'A Shopee não informou um produto para esta conversa.'}</p></>}</div></div>
          <div className={styles.detailCard} data-tone="purple"><span><Icon name="bot" size={18}/></span><div><small>ORIGEM / AUTOMAÇÃO</small><b>{origin?'Evento: '+origin:'Conversa direta'}</b><p>Nenhuma automação ativa para esta conversa. Os modelos são sugestões revisadas por você.</p></div></div>
        </>}
        <div className={styles.safety}><b><Icon name="shield" size={14}/>Sessão local</b><p>O Messenger usa a sessão da Shopee no navegador através do Motor Sênior. Cookies do Seller Center não são enviados para a Vercel.</p></div>
        <details className={styles.source}><summary>Fonte e confiabilidade<Icon name="chevron" size={14}/></summary><ul>
          <li><b>Origem:</b> WebChat do Seller Center, lido pelo Motor Sênior na sua sessão.</li>
          <li><b>Sincronização:</b> manual (botão atualizar){stamp?`; última às ${stamp}`:''}. Não há atualização automática.</li>
          <li><b>Lista:</b> mostra só a prévia da última mensagem; “aguardando resposta” só é calculado depois de abrir a conversa.</li>
          <li><b>Contexto:</b> pedido e produto aparecem quando a Shopee vincula a conversa a eles; carrinho abandonado não tem comprador identificável.</li>
          <li><b>Envio:</b> evento detectado ≠ mensagem enviada. Só é “enviada” depois de “Confirmar envio” e resposta do WebChat; hoje o Motor pode bloquear o envio de texto.</li>
        </ul></details>
      </aside>
    </div>
  </div>;
}
