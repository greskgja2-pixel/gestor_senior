'use client';

// Central Inteligente de Promoções — SOMENTE LEITURA. Fonte: /api/shopee/promotions-overview (API oficial da Shopee).
// Estados, contagens, alertas e orientações vêm de app/lib/promotions-diagnosis.js.

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Icon,InfoTip,StatusPill,imageFallback,IMAGE_PLACEHOLDER} from '../funil/StoreOverview';
import {stateOf,statusNote,productCount,timeLeft,summarize,filterRows,buildAlerts,guidance,FILTERS,ALERT_THRESHOLDS} from '../lib/promotions-diagnosis';
import styles from './promocoes.module.css';

const fmtDate=v=>v?new Date(Number(v)*1000).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}):'—';
const fmtShort=v=>v?new Date(Number(v)*1000).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}):'—';
const money=v=>Number.isFinite(Number(v))&&v!==null?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const KIND={discount:{label:'Campanha de desconto',icon:'tag',tone:'purple'},flash_sale:{label:'Oferta Relâmpago',icon:'zap',tone:'amber'}};
const ALERT_LEVEL={bad:'bad',warn:'warn',info:'info',data:'data'};

async function getJson(url){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),55000);
  try{const r=await fetch(url,{cache:'no-store',signal:c.signal});const j=await r.json().catch(()=>({}));if(!r.ok||j?.error)throw new Error(j?.error||'Não foi possível consultar as promoções.');return j}finally{clearTimeout(t)}
}

function ProductsTable({row,shopId,analyses}){
  const products=row.products||[];
  if(row.items_state==='failed')return <p className={styles.warnText}>Não foi possível consultar os produtos desta promoção. Atualize para tentar de novo.</p>;
  if(!products.length)return <p className={styles.muted}>{productCount(row).kind==='zero'?productCount(row).text:'Nenhum produto detalhado nesta coleta.'}</p>;
  return <div className={styles.products} role="table" aria-label="Produtos participantes">
    <div className={styles.prodHead} role="row"><span role="columnheader">Produto</span><span role="columnheader">Preço</span><span role="columnheader">Estoque</span><span role="columnheader">Ações</span></div>
    {products.map((p,i)=>{
      const analysed=p.item_id!=null&&analyses?.[String(p.item_id)];
      const publicUrl=shopId&&p.item_id!=null?`https://shopee.com.br/product/${shopId}/${p.item_id}`:null;
      return <div className={styles.prodRow} role="row" key={(p.item_id??'x')+'-'+i}>
        <span className={styles.prodName} role="cell"><img src={p.image||IMAGE_PLACEHOLDER} alt="" onError={imageFallback}/><span><b title={p.name||''}>{p.name||('Produto '+(p.item_id??''))}</b><small>ID {p.item_id??'—'}{p.participating===false?' · fora da promoção':''}</small></span></span>
        <span role="cell" className={styles.price}>{p.promo_price!=null?<><b>{money(p.promo_price)}</b>{p.original_price!=null&&<s>{money(p.original_price)}</s>}{p.discount_pct!=null&&<em>-{p.discount_pct.toLocaleString('pt-BR')}%</em>}</>:<span className={styles.muted}>Preço não informado</span>}</span>
        <span role="cell">{p.stock!=null?p.stock.toLocaleString('pt-BR'):<span className={styles.muted}>—</span>}</span>
        <span role="cell" className={styles.prodActions}>
          {publicUrl?<a href={publicUrl} target="_blank" rel="noreferrer">Ver na Shopee <Icon name="external" size={12}/></a>:null}
          {p.item_id!=null&&(analysed?<Link href={`/super-analise?item_id=${encodeURIComponent(p.item_id)}`}>Super Análise</Link>
            :publicUrl?<Link href={`/super-analise?${new URLSearchParams({start_url:publicUrl,start_item_id:String(p.item_id),start_title:p.name||'',start_image:p.image||''}).toString()}`}>Fazer Super Análise</Link>:null)}
        </span>
      </div>;
    })}
    {productCount(row).kind==='known'&&productCount(row).n>products.length&&<small className={styles.muted}>Mostrando {products.length} de {productCount(row).n}{row.has_more?'+':''} produtos.</small>}
  </div>;
}

function PromoCard({row,now,expanded,onToggle,shopId,analyses}){
  const kind=KIND[row.kind]||{label:'Promoção',icon:'tag',tone:'purple'};
  const st=stateOf(row),pc=productCount(row),tl=timeLeft(row,now),note=statusNote(row);
  return <article className={styles.card} data-tone={kind.tone} data-state={row.status} data-expanded={expanded} id={'promo-'+row.kind+'-'+row.id}>
    <header>
      <span className={styles.cardIcon}><Icon name={kind.icon} size={20}/></span>
      <div className={styles.cardTitle}><small>{kind.label}</small><h3 title={row.name}>{row.name}</h3></div>
      <StatusPill level={st.level} label={st.label}/>
    </header>
    <dl className={styles.facts}>
      <div><dt><Icon name="package" size={13}/>Produtos</dt><dd data-kind={pc.kind}>{pc.kind==='known'?pc.text:pc.kind==='zero'?'0':'—'}</dd></div>
      <div><dt><Icon name="calendar" size={13}/>Início</dt><dd>{fmtShort(row.start_time)}</dd></div>
      <div><dt><Icon name="clock" size={13}/>Término</dt><dd>{fmtShort(row.end_time)}</dd></div>
      {row.min_promo_price!=null&&<div><dt><Icon name="tag" size={13}/>Menor preço</dt><dd>{money(row.min_promo_price)}</dd></div>}
    </dl>
    {tl&&<p className={styles.timeLeft} data-kind={tl.kind}><Icon name="clock" size={14}/>{tl.text.charAt(0).toUpperCase()+tl.text.slice(1)}</p>}
    {(pc.kind==='zero'||pc.kind==='failed'||pc.kind==='unknown')&&<p className={styles.countNote} data-kind={pc.kind}><Icon name={pc.kind==='zero'?'info':'alert'} size={14}/>{pc.text}</p>}
    {note&&<p className={styles.countNote} data-kind="failed"><Icon name="alert" size={14}/>{note}</p>}
    <button type="button" className={styles.detailBtn} aria-expanded={expanded} aria-controls={'det-'+row.kind+'-'+row.id} onClick={()=>onToggle(row.kind+'-'+row.id)}>{expanded?'Fechar detalhes':'Ver detalhes'}<Icon name="chevron" size={14}/></button>
    {expanded&&<div className={styles.details} id={'det-'+row.kind+'-'+row.id}>
      <dl className={styles.info}>
        <div><dt>Tipo</dt><dd>{kind.label}</dd></div>
        <div><dt>Identificador</dt><dd>{row.id??'—'}{row.timeslot_id?` · horário ${row.timeslot_id}`:''}</dd></div>
        <div><dt>Estado (Shopee)</dt><dd>{st.label}{row.shopee_status!=null?` · código ${row.shopee_status}`:''}</dd></div>
        <div><dt>Início</dt><dd>{fmtDate(row.start_time)}</dd></div>
        <div><dt>Término</dt><dd>{fmtDate(row.end_time)}</dd></div>
        <div><dt>Produtos</dt><dd>{pc.text}{row.item_count_source?` (fonte: ${row.item_count_source})`:''}</dd></div>
        {row.kind==='discount'&&row.source!=null&&<div><dt>Origem</dt><dd>{row.source===0?'Desconto da loja':'Código de origem '+row.source}</dd></div>}
      </dl>
      <h4>Produtos participantes</h4>
      <ProductsTable row={row} shopId={shopId} analyses={analyses}/>
      <div className={styles.links}>
        {row.kind==='flash_sale'&&<a className={styles.ghostBtn} href="https://seller.shopee.com.br/portal/marketing/shop-flash-sale/list?type=0" target="_blank" rel="noreferrer">Abrir Ofertas Relâmpago no Seller Center <Icon name="external" size={13}/></a>}
        {row.kind==='discount'&&<small className={styles.muted}>O atalho direto para esta campanha no Seller Center ainda não está confirmado; por isso não é exibido.</small>}
      </div>
    </div>}
  </article>;
}

export default function PromocoesPage(){
  const [state,setState]=useState({loading:true,error:'',data:null,stale:false,at:null});
  const [filter,setFilter]=useState('active');
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState('');
  const [analyses,setAnalyses]=useState({});
  const inFlight=useRef(false);
  const load=async()=>{
    if(inFlight.current)return;
    inFlight.current=true;
    setState(s=>({...s,loading:true,error:''}));
    try{
      const data=await getJson('/api/shopee/promotions-overview');
      setState({loading:false,error:'',data,stale:false,at:Date.now()});
    }catch(e){
      // Preserva a última coleta válida, identificada como dados anteriores.
      setState(s=>({...s,loading:false,error:String(e?.message||e),stale:!!s.data}));
    }finally{inFlight.current=false}
  };
  useEffect(()=>{load()},[]);
  useEffect(()=>{
    // Só para decidir entre "Super Análise" e "Fazer Super Análise" nos produtos; falha silenciosa.
    fetch('/api/funnel/context',{cache:'no-store'}).then(r=>r.json()).then(j=>{const m={};for(const [id,ctx] of Object.entries(j?.items||{}))if(ctx?.analyzedAt)m[id]=true;setAnalyses(m)}).catch(()=>{});
  },[]);
  const data=state.data;
  const rows=useMemo(()=>{
    if(!data)return[];
    const seen=new Set(),out=[];
    for(const r of [...(data.discounts||[]),...(data.flashSales||[])]){const k=r.kind+'-'+r.id;if(!seen.has(k)){seen.add(k);out.push(r)}}
    return out;
  },[data]);
  const now=data?.generated_at||Math.floor(Date.now()/1000);
  const counts=useMemo(()=>summarize(rows),[rows]);
  const shown=useMemo(()=>filterRows(rows,filter,query),[rows,filter,query]);
  const alerts=useMemo(()=>buildAlerts(rows,now),[rows,now]);
  const tips=useMemo(()=>guidance(rows,alerts,now),[rows,alerts,now]);
  const [alertsOpen,setAlertsOpen]=useState(false);
  const stamp=state.at?new Date(state.at):(data?.generated_at?new Date(data.generated_at*1000):null);
  const hhmm=stamp?stamp.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):null;
  const warnings=data?.warnings||[];
  const status=state.loading?{tone:'loading',text:'Consultando as promoções da sua loja na Shopee…'}
    :state.error?{tone:'error',text:`Não foi possível atualizar${state.stale?'. Mostrando os dados anteriores'+(hhmm?` (coletados em ${hhmm})`:''):''}.`}
    :data?(warnings.length?{tone:'partial',text:`Dados parciais: ${warnings.length} fonte(s) não responderam. Coletado em ${hhmm}.`}:{tone:'ok',text:`Atualizado em ${hhmm} · ${rows.length} promoção(ões) coletada(s).`})
    :{tone:'loading',text:'Consultando…'};
  const cards=[
    {id:'active',icon:'zap',title:'Ativas agora',n:counts.active,sub:'promoções em andamento',tone:'green'},
    {id:'scheduled',icon:'calendar',title:'Agendadas',n:counts.scheduled,sub:'próximas promoções',tone:'blue'},
    {id:'discounts',icon:'tag',title:'Campanhas',n:counts.discounts,sub:'descontos ativos/agendados',tone:'purple'},
    {id:'flash',icon:'zap',title:'Ofertas Relâmpago',n:counts.flash,sub:'ativas/agendadas',tone:'amber'}
  ];
  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>CENTRAL DE MARKETING</span><h1>Promoções da Loja</h1><p>Acompanhe campanhas, produtos participantes e oportunidades de melhoria em um só lugar.</p></div>
      <button type="button" onClick={load} disabled={state.loading} aria-busy={state.loading}><Icon name="refresh" size={16}/>{state.loading?'Atualizando…':'Atualizar'}</button>
    </header>

    <div className={styles.statusLine} data-tone={status.tone} role="status" aria-live="polite">
      <Icon name={status.tone==='ok'?'check':status.tone==='loading'?'refresh':'alert'} size={16}/>
      <span>{status.text}</span>
      {state.error&&<button type="button" onClick={load}>Tentar novamente</button>}
    </div>
    {state.error&&<div className={styles.error}><b>Detalhe:</b> <span>{state.error}</span></div>}

    {data&&<>
      <section className={styles.summary} aria-label="Resumo das promoções">
        {cards.map(c=><button key={c.id} type="button" data-tone={c.tone} data-active={filter===c.id} aria-pressed={filter===c.id} onClick={()=>setFilter(c.id)}>
          <span className={styles.sumIcon}><Icon name={c.icon} size={18}/></span><small>{c.title}</small><b>{c.n}</b><em>{c.sub}</em>
        </button>)}
      </section>
      <p className={styles.hintLine}><Icon name="info" size={14}/>Situação (ativas, agendadas) e tipo (campanhas, relâmpago) são cortes diferentes do mesmo conjunto: uma campanha ativa também conta em “Campanhas”. Os números não se somam.</p>

      {alerts.length>0&&<section className={styles.alerts} aria-labelledby="promo-alerts">
        <div className={styles.alertsHead}><h2 id="promo-alerts"><Icon name="alert" size={18}/>Atenção nas promoções <span>{alerts.length}</span></h2>
          <button type="button" aria-expanded={alertsOpen} onClick={()=>setAlertsOpen(v=>!v)}>{alertsOpen?'Mostrar menos':'Ver todos'}</button></div>
        <ul>{(alertsOpen?alerts:alerts.slice(0,3)).map(a=><li key={a.id} data-level={ALERT_LEVEL[a.level]}>
          <span className={styles.alertIcon}><Icon name={a.icon} size={16}/></span>
          <div><b>{a.title}</b><p><span className={styles.tag} data-kind="fact">Fato</span>{a.fact}</p><p><span className={styles.tag} data-kind="action">Ação</span>{a.action}</p></div>
          <button type="button" onClick={()=>{const r=rows.find(x=>x.kind+'-'+x.id===a.rowKey);setFilter(r?.status==='scheduled'?'scheduled':r?.status==='ended'?'ended':'active');setQuery('');setOpen(a.rowKey);setTimeout(()=>{try{document.getElementById('promo-'+a.rowKey)?.scrollIntoView({behavior:'smooth',block:'center'})}catch{}},120)}}>Ver alerta</button>
        </li>)}</ul>
        <small className={styles.muted}>Prazos: “termina em breve” e “começa em breve” = até {ALERT_THRESHOLDS.endingSoonHours} h. Alertas só aparecem com evidência nos dados coletados.</small>
      </section>}

      <section className={styles.toolbar}>
        <nav className={styles.tabs} aria-label="Filtrar promoções">{FILTERS.map(f=><button key={f.id} type="button" data-active={filter===f.id} aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}{f.id==='ended'&&counts.ended>0?` (${counts.ended})`:''}</button>)}</nav>
        <label className={styles.search}><Icon name="search" size={15}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome ou ID" aria-label="Buscar promoção"/></label>
      </section>

      {shown.length?<section className={styles.list}>{shown.map(r=><PromoCard key={r.kind+'-'+r.id} row={r} now={now} expanded={open===r.kind+'-'+r.id} onToggle={k=>setOpen(c=>c===k?'':k)} shopId={data.shop_id} analyses={analyses}/>)}</section>
        :<div className={styles.empty}>{query?'Nenhuma promoção encontrada para esta busca.':'Nenhuma promoção encontrada nesta categoria.'}{filter==='ended'&&' A Shopee só informa as encerradas que ainda estão na lista de descontos/ofertas.'}</div>}

      <section className={styles.tips} aria-labelledby="promo-tips">
        <h2 id="promo-tips"><Icon name="list" size={18}/>O que devo verificar?</h2>
        <div>{tips.map(t=><article key={t.id}>
          <p><span className={styles.tag} data-kind="fact">Fato</span>{t.fact}</p>
          {t.problem!=='—'&&<p><span className={styles.tag} data-kind="cause">Possível problema</span>{t.problem}</p>}
          <p><span className={styles.tag} data-kind="action">Ação</span>{t.action}</p>
        </article>)}</div>
        <small className={styles.muted}>O Gestor não conhece o seu custo nesta tela e por isso não afirma se um desconto dá prejuízo. “Analisar margem” fica para uma integração futura com a Precificação Inteligente.</small>
      </section>

      <details className={styles.source}>
        <summary><span><Icon name="shield" size={17}/>Fonte dos dados</span><em>{rows.length} promoção(ões) · {warnings.length?'dados parciais':'coleta completa'}</em><Icon name="chevron" size={16}/></summary>
        <ul>
          <li><b>Origem:</b> API oficial da Shopee (Marketing: descontos e Ofertas Relâmpago) da loja conectada.</li>
          <li><b>Última coleta:</b> {hhmm||'—'}{state.stale?' (dados anteriores; a última tentativa falhou)':''}. Horários exibidos em Brasília.</li>
          <li><b>Estado:</b> vem da lista operacional da Shopee e é conferido com o horário; divergências são sinalizadas.</li>
          <li><b>Produtos:</b> até 100 por promoção na consulta; falha ao consultar nunca é tratada como “0 produtos”.</li>
          <li><b>Limitações:</b> não há atalho confirmado para abrir uma campanha de desconto específica no Seller Center; “Encerradas” só inclui o que a Shopee ainda lista.</li>
          {warnings.length>0&&<li><b>Avisos da coleta:</b> {warnings.join(' · ').slice(0,500)}</li>}
        </ul>
      </details>
    </>}
    {state.loading&&!data&&<div className={styles.loading}>Consultando as promoções da sua loja na Shopee…</div>}
    <footer className={styles.note}>Somente leitura nesta versão. O Gestor não altera preços, estoque ou períodos desta tela.</footer>
  </main>
}
