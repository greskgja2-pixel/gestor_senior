'use client';

// Funil por Produto: resumo, filtros, lista compacta e detalhe expansível (um anúncio por vez).
// Estados e ordenações vêm de app/lib/funnel-product-state.js; aqui só há apresentação.

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {summarizeProducts,matchesFilter,sortRows,needsRecollect,hasBottleneck,FILTERS,SORTS,SAMPLE_LIMITS} from '../lib/funnel-product-state';
import {Icon,InfoTip,StatusPill,imageFallback,IMAGE_PLACEHOLDER} from './StoreOverview';
import styles from './lista.module.css';

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');

function Summary({s,filter,onFilter}){
  const parts=[
    {id:'all',n:s.total,label:'disponíveis',icon:'package'},
    {id:'ready',n:s.ready,label:'com dados suficientes',icon:'check',level:'good'},
    {id:'insufficient',n:s.small+s.partial,label:'com amostra pequena ou dados parciais',icon:'info',level:'warn'},
    {id:'recollect',n:s.missing+s.failed,label:'sem métricas coletadas',icon:'help',level:'data'},
    {id:'diagnosis',n:s.bottleneck,label:'com gargalo relevante',icon:'target',level:'bad'}
  ];
  return <div className={styles.summary} role="group" aria-label="Resumo dos anúncios">
    {parts.map(x=><button key={x.id} type="button" data-level={x.level||'info'} aria-pressed={filter===x.id} onClick={()=>onFilter(filter===x.id?'all':x.id)} disabled={x.n===0&&x.id!=='all'}>
      <span><Icon name={x.icon} size={16}/></span><b>{x.n}</b><small>{x.label}</small>
    </button>)}
  </div>;
}

function ActionsMenu({row,onRecollect,busy,disabled}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  const btn=useRef(null);
  const {p,ctx}=row;
  const competitor=(ctx?.competitors||[]).find(c=>c?.url)||null;
  useEffect(()=>{
    if(!open)return;
    const onDown=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    const onKey=e=>{if(e.key==='Escape'){setOpen(false);btn.current?.focus()}};
    document.addEventListener('pointerdown',onDown);document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('pointerdown',onDown);document.removeEventListener('keydown',onKey)};
  },[open]);
  const label=row.p.name||row.p.id;
  return <span className={styles.menu} ref={ref}>
    <button ref={btn} type="button" className={styles.iconBtn} aria-haspopup="menu" aria-expanded={open} aria-label={'Mais ações do anúncio '+label} onClick={()=>setOpen(v=>!v)}><Icon name="dots" size={18}/></button>
    {open&&<div className={styles.menuList} role="menu">
      <button type="button" role="menuitem" disabled={disabled} onClick={()=>{setOpen(false);onRecollect(String(p.id))}}><Icon name="refresh" size={15}/>{busy?'Coletando…':'Recoletar dados'}</button>
      {ctx?<Link role="menuitem" href={`/super-analise?item_id=${encodeURIComponent(p.id)}${ctx.reportId?`&report_id=${encodeURIComponent(ctx.reportId)}`:''}`}><Icon name="chart" size={15}/>Abrir Super Análise deste anúncio</Link>
        :<Link role="menuitem" href="/super-analise"><Icon name="chart" size={15}/>Fazer Super Análise</Link>}
      <Link role="menuitem" href="/extensao-shopee-intelligence?section=shopee-ads" title="Abre a visão geral de Shopee Ads; o vínculo anúncio → campanha ainda não está disponível."><Icon name="ads" size={15}/>Ver Shopee Ads</Link>
      {competitor&&<a role="menuitem" href={competitor.url} target="_blank" rel="noreferrer"><Icon name="users" size={15}/>Ver concorrente</a>}
      {needsRecollect(row.state)&&<Link role="menuitem" href="/?section=config"><Icon name="shield" size={15}/>Saúde do Sistema</Link>}
    </div>}
  </span>;
}

function diagnosisText(row){
  const {state,plan}=row;
  if(state.id==='updating')return'Atualizando métricas deste anúncio…';
  if(state.id==='failed')return'A última recoleta falhou; os dados anteriores foram preservados.';
  if(state.id==='missing')return'Métricas do funil não coletadas neste período.';
  if(state.id==='partial')return'Faltam impressões ou visitas para montar o funil.';
  if(state.id==='small')return'Conclusão limitada: volume ainda pequeno.';
  if(hasBottleneck(state,plan))return plan.title;
  return'Nenhum gargalo forte agora.';
}

function Row({row,expanded,onToggle,onRecollect,recollection,renderDetail}){
  const {p,ctx,state}=row;
  const title=p.name||ctx?.title||('Anúncio '+p.id);
  const busy=recollection.busyId===String(p.id);
  const feedback=recollection.feedback[String(p.id)];
  const hasData=state.id==='ready'||state.id==='small'||state.id==='partial';
  return <li className={styles.item} data-expanded={expanded} data-state={state.id} id={'produto-'+p.id}>
    <div className={styles.row}>
      <div className={styles.ident}>
        <img src={p.image||ctx?.image||IMAGE_PLACEHOLDER} alt="" onError={imageFallback}/>
        <div><b title={title}>{title}</b><small>ID {p.id}</small></div>
      </div>
      <div className={styles.status}><StatusPill level={state.level} label={state.label}/></div>
      <dl className={styles.metrics} aria-label="Métricas principais">
        <div><dt><Icon name="eye" size={13}/>Impressões</dt><dd>{hasData?int(p.product_card_impressions):'—'}</dd></div>
        <div><dt><Icon name="cursor" size={13}/>Cliques</dt><dd>{hasData?int(p.product_card_clicks):'—'}</dd></div>
        <div><dt><Icon name="package" size={13}/>Pedidos</dt><dd>{hasData?int(p.placed_buyers):'—'}</dd></div>
      </dl>
      <p className={styles.diag}>{diagnosisText(row)}</p>
      <div className={styles.actions}>
        {needsRecollect(state)&&<button type="button" className={styles.recollect} disabled={!!recollection.busyId} onClick={()=>onRecollect(String(p.id))}><Icon name="refresh" size={14}/>{busy?'Coletando…':'Recoletar'}</button>}
        <button type="button" className={styles.expand} aria-expanded={expanded} aria-controls={'detalhe-'+p.id} onClick={()=>onToggle(String(p.id))}>{expanded?'Fechar análise':'Ver análise'}<Icon name="chevron" size={14}/></button>
        <ActionsMenu row={row} onRecollect={onRecollect} busy={busy} disabled={!!recollection.busyId}/>
      </div>
    </div>
    {busy&&<div className={styles.feedback} role="status" aria-live="polite" data-tone="info"><Icon name="refresh" size={14}/>Atualizando métricas deste anúncio…</div>}
    {!busy&&!expanded&&feedback?.message&&<div className={styles.feedback} role="status" aria-live="polite" data-tone={feedback.tone}>{feedback.message}</div>}
    {expanded&&<div className={styles.detail} id={'detalhe-'+p.id}>{renderDetail(row)}</div>}
  </li>;
}

export default function ProductList({rows,expandedId,onToggle,onRecollect,recollection,renderDetail,initialSort='commercial',children}){
  const [filter,setFilter]=useState('all');
  const [sort,setSort]=useState(initialSort);
  const summary=useMemo(()=>summarizeProducts(rows),[rows]);
  const shown=useMemo(()=>sortRows(rows.filter(r=>matchesFilter(r,filter)),sort),[rows,filter,sort]);
  // O anúncio aberto nunca some ao trocar de filtro: se ficou de fora, o filtro volta para "Todos".
  useEffect(()=>{if(expandedId&&!shown.some(r=>String(r.p.id)===String(expandedId))&&rows.some(r=>String(r.p.id)===String(expandedId)))setFilter('all')},[expandedId,shown,rows]);
  return <div className={styles.root}>
    <Summary s={summary} filter={filter} onFilter={setFilter}/>
    {children}
    <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label="Filtrar anúncios">{FILTERS.map(f=><button key={f.id} type="button" aria-pressed={filter===f.id} data-active={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}</button>)}</div>
      <label className={styles.sort}><span>Ordenar por</span>
        <select value={sort} onChange={e=>setSort(e.target.value)}>{SORTS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <InfoTip label="Prioridade comercial e de coleta" align="right">Prioridade comercial: anúncios com gargalo e dados suficientes primeiro. Prioridade de coleta: anúncios sem métricas primeiro. São coisas diferentes; anúncio sem dados nunca é tratado como pior desempenho. Amostra pequena = menos de {SAMPLE_LIMITS.impressions} impressões ou {SAMPLE_LIMITS.visitors} visitantes (limite heurístico do projeto, não estatístico).</InfoTip>
      </label>
    </div>
    {shown.length?<ul className={styles.list}>{shown.map(r=><Row key={r.p.id} row={r} expanded={String(expandedId)===String(r.p.id)} onToggle={onToggle} onRecollect={onRecollect} recollection={recollection} renderDetail={renderDetail}/>)}</ul>
      :<p className={styles.empty}>Nenhum anúncio neste filtro. <button type="button" onClick={()=>setFilter('all')}>Mostrar todos</button></p>}
  </div>;
}
