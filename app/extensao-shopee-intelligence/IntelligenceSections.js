'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import styles from './intelligence-sections.module.css';
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

function Competitors({items}){
  const rows=useMemo(()=>items.flatMap(item=>arr(item.latest?.competitors).slice(0,3).map((c,i)=>({
    owner:item.latest?.product_snapshot?.title||item.latest?.product_snapshot?.item_name||`Produto ${item.itemId}`,
    title:c.title||`Concorrente ${i+1}`,price:n(c.price),sold:n(c.sold),rating:n(c.rating),raw:c,
    image:c.imageUrl||arr(c.imageUrls)[0]||null,link:c.link||c.url||null,collected:item.latest?.analyzed_at
  }))),[items]);
  if(!rows.length)return <Empty text="Nenhum concorrente foi coletado/vinculado ainda. Faça uma Super Análise e selecione de 1 a 3 concorrentes."/>;
  return <div className={styles.gridCards}>{rows.map((r,i)=><article className={styles.competitor} key={i}>{r.image?<img src={r.image} alt=""/>:<div className={styles.noImage}/>}<div><small>Vinculado a: {r.owner}</small><b>{r.title}</b><p>{dataText(r.price,money,r.raw)} · {dataText(r.sold,v=>Number(v).toLocaleString('pt-BR'),r.raw)} vendidos · {dataText(r.rating,v=>Number(v).toFixed(1)+'★',r.raw)}</p><span>Coleta: {when(r.collected)}</span>{r.link&&<a href={r.link} target="_blank" rel="noreferrer">Abrir anúncio ↗</a>}</div></article>)}</div>
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
  return <section className={styles.panel}><div className={styles.tableWrap}><table><thead><tr><th>Anúncio</th><th>Última análise</th><th>Próxima reanálise</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={r.itemId}><td><b>{r.title}</b><small>Produto {r.itemId}</small></td><td>{when(r.latest?.analyzed_at)}</td><td>{when(r.next)}</td><td><span className={r.due?styles.due:styles.live}>{r.due?'Vencida':'Agendada'}</span></td><td><Link className={styles.linkButton} href={`/super-analise?item_id=${r.itemId}`}>{r.due?'Reanalisar agora':'Abrir análise'}</Link></td></tr>)}</tbody></table></div></section>
}

function Prioridades({items}){
  const rows=items.map(item=>{const r=item.latest||{},ai=r.report?.ai_analysis||{},priorities=arr(ai.priorities);return{itemId:item.itemId,title:r.product_snapshot?.title||r.product_snapshot?.item_name||`Produto ${item.itemId}`,score:n(r.score),priority:priorities[0],analyzed:r.analyzed_at}}).sort((a,b)=>(a.score??999)-(b.score??999));
  if(!rows.length)return <Empty text="Ainda não há análises suficientes para montar prioridades."/>;
  return <div className={styles.priorityList}>{rows.map(r=><article key={r.itemId}><div className={styles.score}>{r.score==null?'—':Math.round(r.score)}</div><div><b>{r.title}</b><small>Última análise: {when(r.analyzed)}</small><p>{r.priority?.why||r.priority?.reason||r.priority?.area||'Revisar os pontos com menor nota na Super Análise.'}</p></div><Link href={`/extensao-shopee-intelligence?section=super-anuncio&item_id=${r.itemId}&tab=analysis`}>Ver anúncio</Link></article>)}</div>
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
