'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import styles from './intelligence-sections.module.css';
import ReminderButton from '../components/ReminderButton';
import {fetchJsonWithTimeout,motorRequest,motorData,classifyAsyncError} from '../lib/client-async';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const when=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR')};
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;
const titles={
  concorrentes:['Concorrentes','Acompanhe preço, vendas e mudanças dos concorrentes vinculados aos anúncios já analisados.','⌘'],
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

function relativeTime(value){
  if(!value)return'';
  const d=new Date(value),diff=Date.now()-d.getTime();
  if(Number.isNaN(d.getTime()))return'';
  const abs=Math.max(0,diff),min=Math.floor(abs/60000),hours=Math.floor(abs/3600000),days=Math.floor(abs/86400000);
  if(min<2)return'agora';
  if(min<60)return min+' min atrás';
  if(hours<24)return hours+'h atrás';
  return days+' dia'+(days===1?'':'s')+' atrás';
}
function dueInfo(value){
  if(!value)return{due:false,label:'Sem data'};
  const ts=new Date(value).getTime();
  if(!Number.isFinite(ts))return{due:false,label:'Sem data'};
  const days=Math.ceil((ts-Date.now())/86400000);
  if(days<0)return{due:true,label:'Vencida há '+Math.abs(days)+' dia'+(Math.abs(days)===1?'':'s')};
  if(days===0)return{due:true,label:'Vence hoje'};
  return{due:false,label:'em '+days+' dia'+(days===1?'':'s')};
}
function MiniTrend({values=[],bars=false,tone='blue'}){
  const clean=values.map(n).filter(v=>v!=null);
  if(!clean.length)return <div className={styles.radarSparkEmpty}>Sem histórico</div>;
  if(bars){
    const max=Math.max(...clean,1);
    return <div className={styles.radarBars} data-tone={tone}>{clean.slice(-14).map((v,i)=><i key={i} style={{height:Math.max(10,(v/max)*100)+'%'}}/>)}</div>;
  }
  const data=clean.slice(-14),min=Math.min(...data),max=Math.max(...data),span=max-min||1;
  const points=data.map((v,i)=>`${data.length===1?50:(i/(data.length-1))*100},${88-((v-min)/span)*70}`).join(' ');
  return <svg className={styles.radarLine} data-tone={tone} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points}/></svg>;
}
function competitorPriority(row){
  const due=dueInfo(row.watch?.next_check_at).due;
  const pricePct=n(row.change?.price_change_pct),velocity=n(row.change?.sold_velocity_change_pct);
  if(due&&pricePct!=null&&pricePct<0)return{rank:0,label:'Alta urgência',tone:'urgent'};
  if(pricePct!=null&&pricePct<0)return{rank:1,label:'Atenção',tone:'attention'};
  if(velocity!=null&&velocity>=50)return{rank:1,label:'Atenção',tone:'attention'};
  if(pricePct!=null&&pricePct>0)return{rank:2,label:'Oportunidade',tone:'opportunity'};
  if(row.price==null&&row.sold==null)return{rank:4,label:'Sem dados',tone:'nodata'};
  return{rank:3,label:'Estável',tone:'stable'};
}
function mainSignal(row){
  const pricePct=n(row.change?.price_change_pct),velocity=n(row.change?.sold_velocity_change_pct);
  if(pricePct!=null&&pricePct<-.1)return'down';
  if(pricePct!=null&&pricePct>.1)return'up';
  if(velocity!=null&&velocity>=25)return'accelerating';
  if(dueInfo(row.watch?.next_check_at).due)return'due';
  return'stable';
}

function Competitors({items}){
  const [monitor,setMonitor]=useState({phase:'loading',watches:[],error:''});
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const [sort,setSort]=useState('priority');
  const [period,setPeriod]=useState('7');
  const [openHistory,setOpenHistory]=useState('');
  const [openMenu,setOpenMenu]=useState('');
  const [bulkPhase,setBulkPhase]=useState('idle');

  async function loadMonitor(){
    setMonitor(x=>({...x,phase:'loading',error:''}));
    try{
      const data=await fetchJsonWithTimeout('/api/competitor-monitor',{cache:'no-store'},15000);
      setMonitor({phase:'success',watches:arr(data?.watches),error:''});
    }catch(e){setMonitor({phase:'error',watches:[],error:String(e?.message||e)})}
  }
  useEffect(()=>{loadMonitor()},[]);
  useEffect(()=>{
    const close=()=>setOpenMenu('');
    window.addEventListener('click',close);
    return()=>window.removeEventListener('click',close);
  },[]);

  const watchMap=useMemo(()=>new Map(arr(monitor.watches).map(w=>[`${w.owner_item_id}:${w.competitor_item_id}`,w])),[monitor.watches]);

  const rows=useMemo(()=>items.flatMap(item=>arr(item.latest?.competitors).slice(0,3).map((comp,i)=>{
    const compItem=String(comp?.itemId??comp?.item_id??comp?.id??'');
    const watch=watchMap.get(`${item.itemId}:${compItem}`)||null;
    const snap=watch?.latest_snapshot||null;
    const ownerSnapshot=item.latest?.product_snapshot||{};
    return{
      key:`${item.itemId}:${compItem||i}`,ownerItemId:item.itemId,
      owner:ownerSnapshot.title||ownerSnapshot.item_name||`Produto ${item.itemId}`,
      ownerCategory:ownerSnapshot.category||ownerSnapshot.category_name||'',
      competitorItemId:compItem,title:snap?.title||comp.title||`Concorrente ${i+1}`,
      price:n(snap?.price)??competitorPrice(comp),sold:n(snap?.sold)??competitorSold(comp),rating:n(snap?.rating)??n(comp.rating),raw:comp,
      image:snap?.image_url||competitorImage(comp),link:comp.link||comp.url||watch?.competitor_url||null,
      collected:snap?.collected_at||item.latest?.analyzed_at,watch,change:watch?.latest_change||null,
      history:arr(watch?.snapshot_history),confidence:snap?.confidence||null
    };
  }).filter(r=>monitor.phase!=='success'||!!r.watch)),[items,watchMap,monitor.phase]);

  async function updateWatch(watch,patch){
    if(!watch?.id)return;
    try{
      await fetchJsonWithTimeout('/api/competitor-monitor',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:watch.id,...patch})},12000);
      await loadMonitor();
    }catch(e){setMonitor(x=>({...x,phase:'error',error:String(e?.message||e)}))}
  }

  async function recheckAll(){
    const targets=filtered.map(r=>r.watch).filter(Boolean).slice(0,12);
    if(!targets.length)return;
    setBulkPhase('loading');
    let updated=0,failed=0;
    for(const watch of targets){
      try{
        const data=await motorData('collectProduct',{url:watch.competitor_url,reason:'manual-competitor-refresh',expectedItemId:String(watch.competitor_item_id)},45000);
        const p=data?.product||data;
        const itemId=String(p?.itemId??p?.item_id??''),shopId=String(p?.shopId??p?.shop_id??'');
        if(itemId!==String(watch.competitor_item_id)||shopId!==String(watch.competitor_shop_id))throw new Error('A extensão retornou outro anúncio.');
        const source=String(p?.ratingSource||p?.validationSource||p?.source||data?.source||'').toLowerCase();
        const structured=/pdp_get_pc|structured|api/.test(source)||p?.ratingDebug?.pdpGetPc?.ok===true||p?.rating_debug?.pdp_get_pc?.ok===true||p?.validation?.pdpGetPc?.ok===true;
        if(!structured)throw new Error('A coleta estruturada deste concorrente não foi confirmada.');
        await fetchJsonWithTimeout('/api/competitor-monitor',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            watch_id:watch.id,title:p?.title||p?.item_name||watch.competitor_title,
            price:p?.price??p?.currentPrice??null,sold:p?.sold??p?.historicalSold??null,rating:p?.rating??null,stock:p?.stock??null,
            image_url:competitorImage(p),source:source||'pdp_get_pc_intercepted',confidence:'structured',
            raw:{ratingSource:p?.ratingSource||null,validationSource:p?.validationSource||null,categoryId:p?.categoryId??p?.category_id??null}
          })
        },15000);
        updated++;
      }catch(error){
        failed++;
        try{await fetchJsonWithTimeout('/api/competitor-monitor',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:watch.id,action:'record_error',last_error:String(error?.message||error).slice(0,900)})},8000)}catch{}
      }
      if(targets.length>1)await new Promise(resolve=>setTimeout(resolve,1600));
    }
    await loadMonitor();
    setBulkPhase(failed?'error':'success');
    if(failed)setMonitor(x=>({...x,error:`${updated} atualizado(s); ${failed} falharam e ficarão para nova tentativa.`}));
    setTimeout(()=>setBulkPhase('idle'),3000);
  }

  async function removeWatch(row){
    if(!row.watch?.id)return;
    const ok=window.confirm(`Remover “${row.title}” do Radar de concorrentes? O histórico já coletado será preservado.`);
    if(!ok)return;
    setOpenMenu('');
    await updateWatch(row.watch,{enabled:false});
  }

  const counts=useMemo(()=>{
    const down=rows.filter(r=>n(r.change?.price_change_pct)!=null&&n(r.change.price_change_pct)<-.1).length;
    const up=rows.filter(r=>n(r.change?.price_change_pct)!=null&&n(r.change.price_change_pct)>.1).length;
    const accelerating=rows.filter(r=>n(r.change?.sold_velocity_change_pct)!=null&&n(r.change.sold_velocity_change_pct)>=25).length;
    const due=rows.filter(r=>dueInfo(r.watch?.next_check_at).due).length;
    return{down,up,accelerating,due,total:rows.length};
  },[rows]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const matchesStatus=r=>{
      const signal=mainSignal(r);
      if(status==='all')return true;
      if(status==='down')return signal==='down';
      if(status==='up')return signal==='up';
      if(status==='accelerating')return n(r.change?.sold_velocity_change_pct)!=null&&n(r.change.sold_velocity_change_pct)>=25;
      if(status==='due')return dueInfo(r.watch?.next_check_at).due;
      if(status==='nodata')return r.price==null&&r.sold==null;
      return true;
    };
    const list=rows.filter(r=>(!q||[r.title,r.owner,r.competitorItemId,r.ownerItemId].some(v=>String(v||'').toLowerCase().includes(q)))&&matchesStatus(r));
    return [...list].sort((a,b)=>{
      if(sort==='price')return Math.abs(n(b.change?.price_change_pct)||0)-Math.abs(n(a.change?.price_change_pct)||0);
      if(sort==='sales')return (n(b.change?.sold_delta)||0)-(n(a.change?.sold_delta)||0);
      if(sort==='collected')return new Date(b.collected||0)-new Date(a.collected||0);
      if(sort==='recheck')return new Date(a.watch?.next_check_at||8640000000000000)-new Date(b.watch?.next_check_at||8640000000000000);
      return competitorPriority(a).rank-competitorPriority(b).rank;
    });
  },[rows,query,status,sort]);

  const alerts=useMemo(()=>{
    const out=[];
    for(const r of rows){
      const pricePct=n(r.change?.price_change_pct),priceDelta=n(r.change?.price_change),soldDelta=n(r.change?.sold_delta);
      if(pricePct!=null&&Math.abs(pricePct)>=.1)out.push({
        key:r.key+':price',tone:pricePct<0?'down':'up',image:r.image,at:r.collected,
        text:`${r.title} ${pricePct<0?'reduziu':'aumentou'} ${priceDelta==null?Math.abs(pricePct).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':money(Math.abs(priceDelta))+' ('+(pricePct>0?'+':'')+pricePct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%)'}`
      });
      if(soldDelta!=null&&soldDelta>0)out.push({key:r.key+':sales',tone:'sales',image:r.image,at:r.collected,text:`${r.title} vendeu +${soldDelta.toLocaleString('pt-BR')} desde a última coleta`});
      if(!r.image)out.push({key:r.key+':image',tone:'image',image:null,at:r.collected,text:`${r.title} está sem imagem confiável`});
    }
    if(counts.due)out.push({key:'due',tone:'due',image:null,at:null,text:`${counts.due} concorrente${counts.due===1?' está':'s estão'} com rechecagem vencida`});
    return out.sort((a,b)=>new Date(b.at||Date.now())-new Date(a.at||Date.now())).slice(0,6);
  },[rows,counts.due]);

  const distribution=useMemo(()=>{
    const bucket={down:0,up:0,accelerating:0,due:0,stable:0};
    rows.forEach(r=>{bucket[mainSignal(r)]++});
    return bucket;
  },[rows]);

  const donut=useMemo(()=>{
    const total=Math.max(1,rows.length),parts=[
      ['#27b36a',distribution.down],['#ef5360',distribution.up],['#2d77e5',distribution.accelerating],['#f2a323',distribution.due],['#b7c4d4',distribution.stable]
    ];
    let cursor=0;const stops=[];
    parts.forEach(([color,count])=>{const from=cursor;cursor+=(count/total)*360;stops.push(`${color} ${from}deg ${cursor}deg`)});
    if(cursor<360)stops.push(`#e7edf5 ${cursor}deg 360deg`);
    return`conic-gradient(${stops.join(',')})`;
  },[distribution,rows.length]);

  if(monitor.phase==='loading'&&!rows.length)return <Empty text="Carregando Radar de concorrentes…"/>;
  if(!rows.length&&monitor.phase!=='error')return <Empty text="Nenhum concorrente monitorado. Faça uma Super Análise e selecione de 1 a 3 concorrentes."/>;
  return <div className={styles.radarPage}>
    <section className={styles.radarKpis}>
      <article data-tone="down"><span>↓</span><div><b>{counts.down}</b><strong>com queda de preço</strong><small>{counts.total?((counts.down/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="up"><span>↑</span><div><b>{counts.up}</b><strong>com alta de preço</strong><small>{counts.total?((counts.up/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="sales"><span>▥</span><div><b>{counts.accelerating}</b><strong>com vendas acelerando</strong><small>{counts.total?((counts.accelerating/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="due"><span>◷</span><div><b>{counts.due}</b><strong>rechecagens vencidas</strong><small>{counts.total?((counts.due/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="total"><span>♟</span><div><b>{counts.total}</b><strong>concorrentes monitorados</strong><small>100% do total</small></div></article>
    </section>

    <section className={styles.radarFilters}>
      <label className={styles.radarSearch}><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar concorrente, anúncio ou ID..."/></label>
      <label><small>Status</small><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option><option value="down">Queda de preço</option><option value="up">Alta de preço</option><option value="accelerating">Vendas acelerando</option><option value="due">Rechecagem vencida</option><option value="nodata">Sem dados</option></select></label>
      <label><small>Ordenar por</small><select value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Maior prioridade</option><option value="price">Maior variação de preço</option><option value="sales">Mais vendas desde a coleta</option><option value="collected">Última coleta</option><option value="recheck">Próxima rechecagem</option></select></label>
      <label><small>Período</small><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="7">Últimos 7 dias</option><option value="14">Últimos 14 dias</option><option value="30">Últimos 30 dias</option><option value="all">Todo histórico</option></select></label>
      <button type="button" className={styles.radarRefresh} onClick={recheckAll} disabled={bulkPhase==='loading'}>↻ {bulkPhase==='loading'?'Solicitando…':bulkPhase==='success'?'Rechecagem solicitada':'Atualizar / Rechecar agora'}</button>
    </section>

    {monitor.phase==='error'&&<div className={styles.error}>{monitor.error}<button onClick={loadMonitor}>Tentar novamente</button></div>}

    <div className={styles.radarColumns}>
      <section className={styles.radarListArea}>
        <div className={styles.radarListHead}><b>{filtered.length} concorrente{filtered.length===1?'':'s'} encontrado{filtered.length===1?'':'s'}</b><div><span>Legenda rápida:</span><i data-tone="down"/> Queda de preço <i data-tone="up"/> Alta de preço <i data-tone="sales"/> Vendas acelerando <i data-tone="due"/> Rechecagem vencida</div></div>
        <div className={styles.radarList}>{filtered.map((r,index)=>{
          const priority=competitorPriority(r),due=dueInfo(r.watch?.next_check_at),pricePct=n(r.change?.price_change_pct),priceDelta=n(r.change?.price_change),soldDelta=n(r.change?.sold_delta),salesRate=n(r.change?.sold_per_day),velocity=n(r.change?.sold_velocity_change_pct);
          const previousPrice=n(r.change?.price_before);
          const cutoff=period==='all'?0:Date.now()-Number(period)*86400000;
          const hist=r.history.filter(h=>!cutoff||new Date(h.collected_at).getTime()>=cutoff).slice().reverse();
          const priceSeries=hist.map(h=>n(h.price)).filter(v=>v!=null);
          const salesSeries=hist.map(h=>n(h.sold)).filter(v=>v!=null);
          const primary=priority.rank<=1&&pricePct!=null&&pricePct<0;
          const ownerHref=`/extensao-shopee-intelligence?section=super-anuncio&item_id=${r.ownerItemId}`;
          const priceHref=`/super-analise?item_id=${r.ownerItemId}&tab=price`;
          return <article className={styles.radarCard} data-tone={priority.tone} key={r.key}>
            <div className={styles.radarIdentity}>
              <div className={styles.radarThumb}>{due.due&&<em>VENCIDA</em>}{r.image?<img src={r.image} alt=""/>:<div className={styles.noImage}>▧</div>}</div>
              <div><b className={styles.radarTitle}>{r.title}</b><span>Vinculado ao seu anúncio:</span><Link href={ownerHref}>{r.owner}</Link>{r.ownerCategory&&<small>{r.ownerCategory}</small>}</div>
            </div>
            <div className={styles.radarMetric}>
              <span>Preço atual</span><b>{dataText(r.price,money,r.raw)}</b>{previousPrice!=null&&<small>Era {money(previousPrice)}</small>}
              {pricePct!=null&&Math.abs(pricePct)>=.1&&<em data-tone={pricePct<0?'down':'up'}>{pricePct<0?'↓':'↑'} {priceDelta==null?Math.abs(pricePct).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':(priceDelta>0?'+':'-')+money(Math.abs(priceDelta))}<small>{pricePct>0?'+':''}{pricePct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</small></em>}
              <div className={styles.radarMini}><span>Tendência de preço</span><MiniTrend values={priceSeries} tone={pricePct<0?'green':pricePct>0?'red':'slate'}/></div>
            </div>
            <div className={styles.radarMetric}>
              <span>Vendas acumuladas</span><b>{dataText(r.sold,v=>Number(v).toLocaleString('pt-BR'),r.raw)}</b>{soldDelta!=null&&<em data-tone="sales">▲ {soldDelta>=0?'+':''}{soldDelta.toLocaleString('pt-BR')}<small>desde a última coleta</small></em>}
              <div className={styles.radarMini}><span>Tendência de vendas</span><MiniTrend values={salesSeries} bars tone="blue"/></div>
            </div>
            <div className={styles.radarVelocity}>
              <span>Ritmo de vendas</span><div className={styles.radarVelocityBars}>{[.35,.52,.7,.88,1].map((x,i)=><i key={i} style={{height:(velocity!=null&&velocity>=25?x:Math.max(.25,x-.28))*100+'%'}}/>)}</div><b>{velocity!=null&&velocity>=25?'Acelerando':'Estável'}</b>{salesRate!=null&&<small>{salesRate.toLocaleString('pt-BR',{maximumFractionDigits:1})}/dia</small>}
            </div>
            <div className={styles.radarActions}>
              <span className={styles.radarStatus} data-tone={priority.tone}>{priority.tone==='urgent'?'⚠ ':priority.tone==='opportunity'?'★ ':''}{priority.label}</span>
              <small>Última coleta: {when(r.collected)}</small><small className={due.due?styles.radarDue:''}>Rechecagem: {due.label}</small>
              {r.watch&&<label>Rechecar a cada <select value={r.watch.frequency_days||7} onChange={e=>updateWatch(r.watch,{frequency_days:Number(e.target.value),reset_next:true})}><option value="2">2 dias</option><option value="3">3 dias</option><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></label>}
              {primary?<Link className={styles.radarPrimary} href={priceHref}>✎ Editar preço do meu anúncio</Link>:<Link className={styles.radarOwn} href={ownerHref}>↗ Ir para meu anúncio</Link>}
              {primary&&<small className={styles.radarHelper}>Acessa seu anúncio vinculado para editar preço, imagens ou título.</small>}
              <div className={styles.radarButtonRow}>
                <button type="button" onClick={()=>setOpenHistory(openHistory===r.key?'':r.key)}>◷ Ver histórico</button>
                {r.link&&<a href={r.link} target="_blank" rel="noreferrer">↗ Abrir anúncio</a>}
                <div className={styles.radarMenuWrap}>
                  <button type="button" className={styles.radarDots} onClick={e=>{e.stopPropagation();setOpenMenu(openMenu===r.key?'':r.key)}}>⋮</button>
                  {openMenu===r.key&&<div className={styles.radarMenu} onClick={e=>e.stopPropagation()}>
                    <Link href={ownerHref}><b>↗ Ir para meu anúncio</b><small>Acessa o seu anúncio vinculado</small></Link>
                    <Link href={priceHref}><b>✎ Editar preço</b><small>Abre seu anúncio para editar o preço</small></Link>
                    <Link href={ownerHref}><b>ϟ Ver no Super Anúncio</b><small>Analisar com Super Anúncio</small></Link>
                    <button type="button" onClick={()=>removeWatch(r)}><b>♲ Remover da lista</b><small>Preserva o histórico já coletado</small></button>
                  </div>}
                </div>
              </div>
              {r.watch?.last_status==='error'&&r.watch.last_error&&<small className={styles.monitorError}>Falha anterior: {r.watch.last_error}</small>}
            </div>
            {openHistory===r.key&&<div className={styles.radarHistory}><div className={styles.radarHistoryHead}><b>Histórico de coletas</b><span>{r.history.length} registro{r.history.length===1?'':'s'}</span></div>{r.history.length?<div className={styles.radarHistoryGrid}>{r.history.map((h,idx)=>{const older=r.history[idx+1],sd=n(h.sold)!=null&&n(older?.sold)!=null?n(h.sold)-n(older.sold):null,pd=n(h.price)!=null&&n(older?.price)!=null?n(h.price)-n(older.price):null;return <div key={h.id||h.collected_at||idx}><span>{when(h.collected_at)}</span><b>{money(h.price)}</b><small>{n(h.sold)==null?'Vendas sem dados':n(h.sold).toLocaleString('pt-BR')+' vendidos'}{sd!=null?' · '+(sd>=0?'+':'')+sd.toLocaleString('pt-BR')+' vendas':''}{pd!=null&&Math.abs(pd)>=.01?' · preço '+(pd>0?'subiu':'caiu')+' '+money(Math.abs(pd)):''}</small></div>})}</div>:<span>Sem histórico anterior.</span>}</div>}
          </article>
        })}</div>
      </section>

      <aside className={styles.radarAside}>
        <section className={styles.radarSideCard}><div className={styles.radarSideTitle}><b>🔔 Alertas do radar competitivo</b><span>{alerts.length}</span></div><div className={styles.radarAlerts}>{alerts.length?alerts.map(a=><article key={a.key} data-tone={a.tone}>{a.image?<img src={a.image} alt=""/>:<i>{a.tone==='due'?'◷':a.tone==='image'?'▧':a.tone==='sales'?'▥':a.tone==='down'?'↓':'↑'}</i>}<b>{a.text}</b><small>{a.at?relativeTime(a.at):'agora'}</small></article>):<p>Nenhuma mudança importante detectada.</p>}</div></section>
        <section className={styles.radarSideCard}><div className={styles.radarSideTitle}><b>♧ Distribuição dos concorrentes</b></div><div className={styles.radarDistribution}><div className={styles.radarDonut} style={{background:donut}}><span><b>{rows.length}</b>Total</span></div><div>{[['down','Queda de preço',distribution.down],['up','Alta de preço',distribution.up],['sales','Vendas acelerando',distribution.accelerating],['due','Rechecagem vencida',distribution.due],['stable','Estáveis',distribution.stable]].map(([tone,label,value])=><p key={tone}><i data-tone={tone}/><span>{value} {label.toLowerCase()} {rows.length?'('+(value/rows.length*100).toFixed(1).replace('.',',')+'%)':''}</span></p>)}</div></div></section>
        <section className={styles.radarSideCard}><div className={styles.radarSideTitle}><b>💡 Dicas e insights</b></div><div className={styles.radarInsights}>
          {counts.down>0&&<p><i>1</i><span><b>{counts.down} concorrente{counts.down===1?' reduziu':'s reduziram'} o preço.</b> Avalie seu preço e sua margem antes de reagir.</span></p>}
          {counts.accelerating>0&&<p><i>2</i><span><b>{counts.accelerating} concorrente{counts.accelerating===1?' está':'s estão'} vendendo mais rápido.</b> Pode ser um bom momento para revisar anúncio, oferta e Ads.</span></p>}
          {counts.due>0&&<p><i>3</i><span><b>{counts.due} rechecagem{counts.due===1?' está':' estão'} vencida{counts.due===1?'':'s'}.</b> Atualize os dados para não perder mudanças importantes.</span></p>}
          {!counts.down&&!counts.accelerating&&!counts.due&&<p><i>✓</i><span><b>Nenhum sinal urgente agora.</b> Continue acompanhando as próximas coletas.</span></p>}
        </div></section>
      </aside>
    </div>
  </div>;
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
