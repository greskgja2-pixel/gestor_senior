'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import styles from './intelligence-sections.module.css';
import ReminderButton from '../components/ReminderButton';
import {fetchJsonWithTimeout,motorRequest,classifyAsyncError} from '../lib/client-async';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const when=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR')};
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;
const titles={
  concorrentes:['Concorrentes','Acompanhe os concorrentes vinculados aos anúncios já analisados.','⌘'],
  'shopee-ads':['Shopee Ads','Veja campanhas, ROAS, meta, investimento e resultados sem sair do Gestor.','◎'],
  reanalises:['Reanálises','Confira quais anúncios estão vencidos ou próximos de uma nova análise.','↻'],
  prioridades:['Prioridades','Centralize os anúncios e melhorias que merecem atenção primeiro.','☆'],
  relatorios:['Relatórios','Resumo consolidado das análises, Ads e evolução dos anúncios.','▤']
};

function Empty({text,action,onAction}){return <div className={styles.empty}><span>{text}</span>{action&&<button type="button" onClick={onAction}>{action}</button>}</div>}
function missingKind(obj){
  const status=String(obj?.collectionStatus||obj?.collection_status||obj?.status||'').toLowerCase();
  if(obj?.collectionError||obj?.collection_error||obj?.error||status==='error')return'Erro de coleta';
  if(status==='not_integrated'||status==='unsupported')return'Não integrado';
  if(obj&&Object.keys(obj).length)return'Sem dados';
  return'Não coletado';
}
function dataText(value,formatter,context){return n(value)!=null?formatter(value):missingKind(context)}
function competitorPrice(c){
  if(n(c?.price)!=null)return n(c.price);
  const m=String(c?.searchText||'').match(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/i);
  return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
}
function competitorSold(c){
  if(n(c?.sold)!=null)return n(c.sold);
  const m=String(c?.searchText||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*(mil)?\+?\s*Vendido/i);
  if(!m)return null;
  const base=Number(m[1].replace(',','.'));
  return Number.isFinite(base)?Math.round(base*(m[2]?1000:1)):null;
}
function competitorImage(c){
  const rows=[c?.imageUrl,c?.image_url,...arr(c?.imageUrls),...arr(c?.image_urls)].map(v=>String(v||'').trim()).filter(Boolean).filter(u=>!/\.svg(?:\?|$)/i.test(u)&&!/productdetailspage/i.test(u));
  const score=u=>{let s=0;if(/down-br\.img\.susercontent\.com\/file\//i.test(u))s+=3;if(/\/br-11134207-/i.test(u))s+=8;if(/_tn(?:\?|$)/i.test(u))s-=5;if(/_cover(?:\?|$)/i.test(u))s-=6;return s};
  return rows.map((u,i)=>({u,i,s:score(u)})).sort((a,b)=>b.s-a.s||a.i-b.i)[0]?.u||null;
}

function Competitors({items}){
  const [monitor,setMonitor]=useState({phase:'loading',watches:[],error:''});
  async function loadMonitor(){
    setMonitor(x=>({...x,phase:'loading',error:''}));
    try{
      const data=await fetchJsonWithTimeout('/api/competitor-monitor',{cache:'no-store'},15000);
      setMonitor({phase:'success',watches:arr(data?.watches),error:''});
    }catch(e){setMonitor({phase:'error',watches:[],error:String(e?.message||e)})}
  }
  useEffect(()=>{loadMonitor()},[]);
  const watchMap=useMemo(()=>new Map(arr(monitor.watches).map(w=>[`${w.owner_item_id}:${w.competitor_item_id}`,w])),[monitor.watches]);
  const rows=useMemo(()=>items.flatMap(item=>arr(item.latest?.competitors).slice(0,3).map((comp,i)=>{
    const compItem=String(comp?.itemId??comp?.item_id??comp?.id??'');
    const watch=watchMap.get(`${item.itemId}:${compItem}`)||null;
    const snap=watch?.latest_snapshot||null;
    return{
      ownerItemId:item.itemId,
      owner:item.latest?.product_snapshot?.title||item.latest?.product_snapshot?.item_name||`Produto ${item.itemId}`,
      competitorItemId:compItem,title:snap?.title||comp.title||`Concorrente ${i+1}`,
      price:n(snap?.price)??competitorPrice(comp),sold:n(snap?.sold)??competitorSold(comp),rating:n(snap?.rating)??n(comp.rating),raw:comp,
      image:snap?.image_url||competitorImage(comp),link:comp.link||comp.url||watch?.competitor_url||null,
      collected:snap?.collected_at||item.latest?.analyzed_at,watch,change:watch?.latest_change||null,history:arr(watch?.snapshot_history),confidence:snap?.confidence||null
    };
  })),[items,watchMap]);

  async function updateWatch(watch,patch){
    if(!watch?.id)return;
    try{
      await fetchJsonWithTimeout('/api/competitor-monitor',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:watch.id,...patch})},12000);
      await loadMonitor();
    }catch(e){setMonitor(x=>({...x,phase:'error',error:String(e?.message||e)}))}
  }

  if(!rows.length)return <Empty text="Nenhum concorrente foi coletado/vinculado ainda. Faça uma Super Análise e selecione de 1 a 3 concorrentes."/>;
  return <>
    <section className={styles.monitorSummary}>
      <div><b>Radar de concorrentes</b><p>Quando o Motor Senior estiver conectado, o Gestor rechecа automaticamente os concorrentes vencidos usando a sessão normal do navegador.</p></div>
      <span>{monitor.phase==='loading'?'Carregando…':`${arr(monitor.watches).filter(w=>new Date(w.next_check_at).getTime()<=Date.now()).length} aguardando rechecagem`}</span>
    </section>
    {monitor.phase==='error'&&<div className={styles.error}>{monitor.error}<button onClick={loadMonitor}>Tentar novamente</button></div>}
    <div className={styles.gridCards}>{rows.map((r,i)=><article className={styles.competitor} key={`${r.ownerItemId}:${r.competitorItemId||i}`}>
      {r.image?<img src={r.image} alt=""/>:<div className={styles.noImage}/>}
      <div>
        <small>Vinculado a: {r.owner}</small><b>{r.title}</b>
        <p>{dataText(r.price,money,r.raw)} · {dataText(r.sold,v=>Number(v).toLocaleString('pt-BR'),r.raw)} vendidos · {dataText(r.rating,v=>Number(v).toFixed(1)+'★',r.raw)}</p>
        {r.change&&<div className={styles.deltaLine}>
          {n(r.change.price_change_pct)!=null&&Math.abs(n(r.change.price_change_pct))>=0.1&&<span className={n(r.change.price_change_pct)<0?styles.deltaDown:styles.deltaUp}>Preço {n(r.change.price_change_pct)<0?'↓':'↑'} {Math.abs(n(r.change.price_change_pct)).toLocaleString('pt-BR',{maximumFractionDigits:1})}%</span>}
          {n(r.change.sold_delta)!=null&&<span className={styles.deltaNeutral}>{n(r.change.sold_delta)>=0?'+':''}{n(r.change.sold_delta).toLocaleString('pt-BR')} vendas{n(r.change.sold_per_day)!=null?' · '+n(r.change.sold_per_day).toLocaleString('pt-BR',{maximumFractionDigits:1})+'/dia':''}</span>}
          {n(r.change.rating_change)!=null&&Math.abs(n(r.change.rating_change))>=0.01&&<span className={styles.deltaNeutral}>Nota {n(r.change.rating_change)>0?'+':''}{n(r.change.rating_change).toLocaleString('pt-BR',{maximumFractionDigits:2})}</span>}
          {n(r.change.sold_velocity_change_pct)!=null&&Math.abs(n(r.change.sold_velocity_change_pct))>=25&&<span className={n(r.change.sold_velocity_change_pct)>0?styles.deltaUp:styles.deltaDown}>Ritmo {n(r.change.sold_velocity_change_pct)>0?'↑':'↓'} {Math.abs(n(r.change.sold_velocity_change_pct)).toLocaleString('pt-BR',{maximumFractionDigits:0})}%</span>}
        </div>}
        <span>Última coleta: {when(r.collected)}{r.history.length?' · '+r.history.length+' coleta'+(r.history.length===1?'':'s')+' no histórico':''}{r.confidence==='fallback'?' · baseline aproximado':''}</span>
        {r.watch?<div className={styles.monitorControls}>
          <label>Rechecar a cada <select value={r.watch.frequency_days||7} onChange={e=>updateWatch(r.watch,{frequency_days:Number(e.target.value),reset_next:true})}><option value="2">2 dias</option><option value="3">3 dias</option><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></label>
          <small>Próxima: {when(r.watch.next_check_at)}</small>
          <button type="button" onClick={()=>updateWatch(r.watch,{action:'due_now'})}>↻ Atualizar na próxima passagem da extensão</button>
        </div>:<small>Monitoramento sendo preparado…</small>}
        {r.history.length>1&&<details className={styles.historyDetails}><summary>Ver histórico ({r.history.length})</summary><div className={styles.historyRows}>{r.history.map((h,idx)=>{const older=r.history[idx+1];const soldNow=n(h?.sold),soldBefore=n(older?.sold),priceNow=n(h?.price),priceBefore=n(older?.price);const soldDelta=soldNow!=null&&soldBefore!=null?soldNow-soldBefore:null;const priceChanged=priceNow!=null&&priceBefore!=null&&Math.abs(priceNow-priceBefore)>=0.01;return <div key={h.id||h.collected_at||idx}><span>{when(h.collected_at)}</span><b>{priceNow==null?'Preço sem dados':money(priceNow)}</b><small>{soldNow==null?'Vendas sem dados':soldNow.toLocaleString('pt-BR')+' vendidos'}{soldDelta!=null&&idx<r.history.length-1?' · '+(soldDelta>=0?'+':'')+soldDelta.toLocaleString('pt-BR')+' desde a coleta anterior':''}{priceChanged?' · preço alterado':''}</small></div>})}</div></details>}
        {r.link&&<a href={r.link} target="_blank" rel="noreferrer">Abrir anúncio ↗</a>}
      </div>
    </article>)}</div>
  </>;
}
function Ads(){
  const [data,setData]=useState(null),[phase,setPhase]=useState('loading'),[error,setError]=useState(''),[syncSource,setSyncSource]=useState('');

  async function load(){
    setPhase('loading');setError('');setSyncSource('Consultando dados reais do Shopee Ads…');
    const motorPromise=motorRequest('syncShopeeAds',{days:30,reason:'open-shopee-ads'},12000)
      .then(result=>result?.data?.v7||result?.data?.v5||null)
      .catch(err=>{console.warn('[Shopee Ads] Motor Senior não respondeu',err);return null});
    try{
      const server=await fetchJsonWithTimeout('/api/shopee/ads?days=30',{cache:'no-store'},18000);
      const primary=server?.v7||server?.v5||null;
      if(primary){
        setData(primary);
        const campaigns=arr(primary.campaigns);
        const campaignCapability=primary?.availability?.campaigns;
        if(campaignCapability==='error'&&!campaigns.length){
          setPhase('error');setError(primary?.availability?.messages?.campaigns||'A fonte de campanhas do Shopee Ads não respondeu.');
        }else{
          setPhase(campaigns.length?'success':'empty');
          setSyncSource(primary?.scope==='product_ads'?'Dados reais de campanhas e desempenho da Shopee.':'Dados reais disponíveis; algumas métricas de campanha podem não estar integradas.');
        }
      }else{
        const motor=await motorPromise;
        if(!motor)throw new Error('Nenhuma fonte de Shopee Ads retornou dados.');
        setData(motor);setPhase(arr(motor.campaigns).length?'success':'empty');setSyncSource('Dados atualizados pelo Motor Senior.');
      }
      motorPromise.then(motor=>{
        if(!motor)return;
        const currentCount=arr(primary?.campaigns).length;
        if(arr(motor.campaigns).length>=currentCount){setData(motor);setPhase(arr(motor.campaigns).length?'success':'empty');setSyncSource('Dados atualizados pelo Motor Senior.')}
      });
    }catch(e){
      console.error('[Shopee Ads] carregamento falhou',e);
      const motor=await motorPromise;
      if(motor){setData(motor);setPhase(arr(motor.campaigns).length?'success':'empty');setSyncSource('API do Gestor indisponível; usando retorno real do Motor Senior.');return}
      const kind=classifyAsyncError(e);setPhase(kind);setError(kind==='timeout'?'A consulta do Shopee Ads excedeu o tempo limite.':String(e?.message||e));
    }
  }

  useEffect(()=>{load()},[]);
  const campaigns=arr(data?.campaigns),active=campaigns.filter(c=>String(c.state||'').toLowerCase()==='ongoing'),summary=data?.summary||{};
  if(phase==='loading')return <Empty text="Consultando o Shopee Ads. Esta etapa tem tempo limite e não ficará carregando indefinidamente."/>;
  if(phase==='error'||phase==='timeout')return <div className={styles.error}>{error||'Não foi possível carregar o Shopee Ads.'}<button onClick={load}>Tentar novamente</button></div>;
  if(phase==='empty')return <section className={styles.panel}><div className={styles.panelHead}><div><h2>Shopee Ads</h2><p>{syncSource}</p></div><button onClick={load}>↻ Atualizar</button></div><Empty text="A fonte respondeu corretamente, mas não retornou campanhas para esta loja/período."/></section>;
  return <><div className={styles.kpis}><Kpi label="Campanhas ativas" value={active.length}/><Kpi label="Investimento 30 dias" value={n(summary.spend)==null?'Sem dados':money(summary.spend)}/><Kpi label="GMV via Ads" value={n(summary.gmv)==null?'Sem dados':money(summary.gmv)}/><Kpi label="ROAS" value={n(summary.roas)==null?'Sem dados':num(summary.roas)}/></div><section className={styles.panel}><div className={styles.panelHead}><div><h2>Campanhas</h2><p>{syncSource}</p></div><button onClick={load}>↻ Atualizar</button></div><div className={styles.tableWrap}><table><thead><tr><th>Campanha</th><th>Status</th><th>ROAS</th><th>Meta</th><th>Gasto</th><th>GMV</th><th>Pedidos</th></tr></thead><tbody>{campaigns.map(c=><tr key={c.campaignId}><td><b>{c.productName||c.title||`Campanha ${c.campaignId}`}</b><small>#{c.campaignId}</small></td><td><span className={String(c.state)==='ongoing'?styles.live:styles.mutedBadge}>{String(c.state)==='ongoing'?'Ativo':c.state||'Sem dados'}</span></td><td>{n(c.roas)==null?'Sem dados':num(c.roas)}</td><td>{n(c.targetRoas)==null?'Sem dados':num(c.targetRoas)}</td><td>{n(c.spend)==null?'Sem dados':money(c.spend)}</td><td>{n(c.gmv)==null?'Sem dados':money(c.gmv)}</td><td>{n(c.orders)==null?'Sem dados':n(c.orders).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div></section></>;
}

function Reanalises({items}){
  const rows=items.map(item=>{const s=item.schedule||{};const next=s.next_run_at||item.latest?.next_reanalysis_at;const ts=next?new Date(next).getTime():null;return{...item,next,due:Number.isFinite(ts)&&ts<=Date.now(),title:item.latest?.product_snapshot?.title||item.latest?.product_snapshot?.item_name||s.title||`Produto ${item.itemId}`}}).sort((a,b)=>(b.due?1:0)-(a.due?1:0)||new Date(a.next||8640000000000000)-new Date(b.next||8640000000000000));
  if(!rows.length)return <Empty text="Nenhum anúncio possui histórico de análise ainda."/>;
  return <section className={styles.panel}><div className={styles.tableWrap}><table><thead><tr><th>Anúncio</th><th>Última análise</th><th>Próxima reanálise</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={r.itemId}><td><b>{r.title}</b><small>Produto {r.itemId}</small></td><td>{when(r.latest?.analyzed_at)}</td><td>{when(r.next)}</td><td><span className={r.due?styles.due:styles.live}>{r.due?'Vencida':'Agendada'}</span></td><td><div className={styles.rowActions}><Link className={styles.linkButton} href={`/super-analise?item_id=${r.itemId}`}>{r.due?'Reanalisar agora':'Abrir análise'}</Link><ReminderButton itemId={r.itemId} taskType="reanalysis" priority={r.due?'urgent':'medium'} title="Refazer Super Análise" description={`Refazer a Super Análise de ${r.title}.`} actionUrl={`/super-analise?item_id=${r.itemId}`} label="🔔"/></div></td></tr>)}</tbody></table></div></section>
}

function Prioridades({items}){
  const [tasks,setTasks]=useState([]),[taskPhase,setTaskPhase]=useState('loading');
  async function loadTasks(){
    setTaskPhase('loading');
    try{const r=await fetchJsonWithTimeout('/api/tasks',{cache:'no-store'},12000);setTasks(arr(r?.tasks));setTaskPhase('success')}catch{setTaskPhase('error')}
  }
  useEffect(()=>{loadTasks()},[]);
  async function taskAction(id,action,hours){
    try{await fetchJsonWithTimeout('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,hours})},12000);await loadTasks()}catch{}
  }
  const rows=items.map(item=>{const r=item.latest||{},ai=r.report?.ai_analysis||{},priorities=arr(ai.priorities);return{itemId:item.itemId,title:r.product_snapshot?.title||r.product_snapshot?.item_name||`Produto ${item.itemId}`,score:n(r.score),priority:priorities[0],analyzed:r.analyzed_at}}).sort((a,b)=>(a.score??999)-(b.score??999));
  const urgent=tasks.filter(t=>t.priority==='urgent').length;
  const competitorTasks=tasks.filter(t=>t.task_type==='competitors').length;
  const adsTasks=tasks.filter(t=>t.task_type==='ads').length;
  const dueToday=tasks.filter(t=>{if(!t.due_at)return false;const d=new Date(t.due_at);if(Number.isNaN(d.getTime()))return false;const end=new Date();end.setHours(23,59,59,999);return d.getTime()<=end.getTime()}).length;
  return <div className={styles.priorityStack}>
    <div className={styles.kpis}><Kpi label="Urgentes" value={urgent}/><Kpi label="Concorrentes" value={competitorTasks}/><Kpi label="Shopee Ads" value={adsTasks}/><Kpi label="Até hoje" value={dueToday}/></div>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Tarefas e lembretes</h2><p>O que você pediu para lembrar e o que o Gestor marcou como vencido.</p></div><span>{tasks.length} aberta{tasks.length===1?'':'s'}</span></div>
      {taskPhase==='loading'?<Empty text="Carregando tarefas…"/>:taskPhase==='error'?<Empty text="Não foi possível carregar as tarefas agora." action="Tentar novamente" onAction={loadTasks}/>:tasks.length?<div className={styles.taskList}>{tasks.map(t=><article key={t.id} data-priority={t.priority}><div><b>{t.title}</b><small>{t.due_at?'Prazo: '+when(t.due_at):'Sem prazo definido'} · {t.task_type||'tarefa'}</small><p>{t.description||'Tarefa pendente.'}</p></div><div className={styles.taskActions}>{t.action_url&&<Link href={t.action_url}>Resolver agora</Link>}<button onClick={()=>taskAction(t.id,'snooze',24)}>Amanhã</button><button onClick={()=>taskAction(t.id,'done')}>Concluir</button></div></article>)}</div>:<Empty text="Nenhuma tarefa aberta agora."/>}
    </section>
    <section>
      <div className={styles.sectionCaption}><h2>Prioridades da Super Análise</h2><p>Oportunidades detectadas nas análises dos anúncios.</p></div>
      {rows.length?<div className={styles.priorityList}>{rows.map(r=><article key={r.itemId}><div className={styles.score}>{r.score==null?'—':Math.round(r.score)}</div><div><b>{r.title}</b><small>Última análise: {when(r.analyzed)}</small><p>{r.priority?.why||r.priority?.reason||r.priority?.area||'Revisar os pontos com menor nota na Super Análise.'}</p></div><Link href={`/extensao-shopee-intelligence?section=super-anuncio&item_id=${r.itemId}&tab=analysis`}>Ver anúncio</Link></article>)}</div>:<Empty text="Ainda não há análises suficientes para montar prioridades."/>}
    </section>
  </div>
}

function Reports({items}){
  const latest=items.map(x=>x.latest).filter(Boolean),scores=latest.map(r=>n(r.score)).filter(v=>v!=null),roases=latest.map(r=>n(metric(r,'roas'))).filter(v=>v!=null),withComp=latest.filter(r=>arr(r.competitors).length>0).length,totalRounds=items.reduce((s,x)=>s+arr(x.history).length,0);
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  return <><div className={styles.kpis}><Kpi label="Anúncios analisados" value={items.length}/><Kpi label="Rodadas registradas" value={totalRounds}/><Kpi label="Nota média atual" value={avg(scores)==null?'—':avg(scores).toFixed(1)+'/100'}/><Kpi label="ROAS médio registrado" value={num(avg(roases))}/></div><section className={styles.panel}><div className={styles.reportSummary}><article><b>{withComp}</b><span>anúncios com concorrentes vinculados</span></article><article><b>{items.filter(x=>x.schedule?.enabled).length}</b><span>reanálises automáticas/agendadas</span></article><article><b>{latest.filter(r=>r.report?.ai_analysis).length}</b><span>análises com IA concluída</span></article></div></section></>
}

function Kpi({label,value}){return <article className={styles.kpi}><small>{label}</small><b>{value}</b></article>}

export default function IntelligenceSections({items=[],section='shopee-ads'}){
  const [title,subtitle,icon]=titles[section]||titles['shopee-ads'];
  return <div className={styles.screen}><main className={styles.main}><header className={styles.header}><div><span>{icon}</span><div><h1>{title}</h1><p>{subtitle}</p></div></div></header><div className={styles.body}>{section==='concorrentes'&&<Competitors items={items}/>} {section==='shopee-ads'&&<Ads/>} {section==='reanalises'&&<Reanalises items={items}/>} {section==='prioridades'&&<Prioridades items={items}/>} {section==='relatorios'&&<Reports items={items}/>}</div></main></div>
}
