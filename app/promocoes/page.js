'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './promocoes.module.css';

const fmtDate=v=>v?new Date(Number(v)*1000).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}):'—';
const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const labels={active:'Ativa agora',scheduled:'Agendada',ended:'Encerrada'};
const icons={discount:'🏷️',flash_sale:'⚡'};

async function getData(){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),55000);
  try{const r=await fetch('/api/shopee/promotions-overview',{cache:'no-store',signal:c.signal});const j=await r.json().catch(()=>({}));if(!r.ok||j?.error)throw new Error(j?.error||'Não foi possível consultar as promoções.');return j}finally{clearTimeout(t)}
}
function PromoCard({row}){
  const flash=row.kind==='flash_sale';
  return <article className={styles.card}>
    <div className={styles.cardIcon}>{icons[row.kind]||'◆'}</div>
    <div className={styles.cardBody}>
      <div className={styles.cardTop}><span className={styles.kind}>{flash?'Oferta Relâmpago':'Campanha de desconto'}</span><span className={styles.status} data-status={row.status}>{labels[row.status]||row.status}</span></div>
      <h3>{row.name}</h3>
      <div className={styles.meta}>
        <span><b>{row.item_count??0}</b> produto{Number(row.item_count)===1?'':'s'}{row.has_more?' +':''}</span>
        {row.min_promo_price!=null&&<span>A partir de <b>{money(row.min_promo_price)}</b></span>}
      </div>
      <div className={styles.period}><span>Início <b>{fmtDate(row.start_time)}</b></span><span>Fim <b>{fmtDate(row.end_time)}</b></span></div>
    </div>
  </article>
}
function Empty({text}){return <div className={styles.empty}>{text}</div>}

export default function PromocoesPage(){
  const [state,setState]=useState({loading:true,error:'',data:null});
  const [tab,setTab]=useState('active');
  const load=async()=>{setState(s=>({...s,loading:true,error:''}));try{setState({loading:false,error:'',data:await getData()})}catch(e){setState({loading:false,error:String(e?.message||e),data:null})}};
  useEffect(()=>{load()},[]);
  const rows=useMemo(()=>{
    const d=state.data||{};
    if(tab==='active')return d.active||[];
    if(tab==='scheduled')return d.scheduled||[];
    if(tab==='discounts')return d.discounts||[];
    return d.flashSales||[];
  },[state.data,tab]);
  const s=state.data?.summary||{};
  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>CENTRAL DE MARKETING</span><h1>Promoções da Loja</h1><p>Veja em um só lugar as campanhas de desconto e Ofertas Relâmpago cadastradas na Shopee.</p></div>
      <button type="button" onClick={load} disabled={state.loading}>{state.loading?'Atualizando…':'↻ Atualizar'}</button>
    </header>

    <section className={styles.summary}>
      <button onClick={()=>setTab('active')} data-active={tab==='active'}><small>ATIVAS AGORA</small><b>{s.active??'—'}</b><span>promoções em andamento</span></button>
      <button onClick={()=>setTab('scheduled')} data-active={tab==='scheduled'}><small>AGENDADAS</small><b>{s.scheduled??'—'}</b><span>próximas promoções</span></button>
      <button onClick={()=>setTab('discounts')} data-active={tab==='discounts'}><small>CAMPANHAS</small><b>{s.discounts??'—'}</b><span>descontos ativos/agendados</span></button>
      <button onClick={()=>setTab('flash')} data-active={tab==='flash'}><small>OFERTA RELÂMPAGO</small><b>{s.flash_sales??'—'}</b><span>ativas/agendadas</span></button>
    </section>

    <nav className={styles.tabs}>
      <button data-active={tab==='active'} onClick={()=>setTab('active')}>Ativas agora</button>
      <button data-active={tab==='scheduled'} onClick={()=>setTab('scheduled')}>Agendadas</button>
      <button data-active={tab==='discounts'} onClick={()=>setTab('discounts')}>Campanhas de desconto</button>
      <button data-active={tab==='flash'} onClick={()=>setTab('flash')}>Ofertas Relâmpago</button>
    </nav>

    {state.error&&<div className={styles.error}><b>Não foi possível atualizar.</b><span>{state.error}</span><button onClick={load}>Tentar novamente</button></div>}
    {state.loading?<div className={styles.loading}>Consultando as promoções da sua loja na Shopee…</div>:
      <section className={styles.list}>{rows.length?rows.map((row,i)=><PromoCard key={row.kind+'-'+row.id+'-'+i} row={row}/>):<Empty text="Nenhuma promoção encontrada nesta categoria."/ >}</section>}
    <footer className={styles.note}>Somente leitura nesta versão. O Gestor não altera preços, estoque ou períodos desta tela.</footer>
  </main>
}
