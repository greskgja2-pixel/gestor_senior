'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import styles from './super-anuncio-mockup.module.css';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>n(v)==null?'—':`${n(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const num=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const when=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');};
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;
const imageOf=p=>p?.imageUrl||p?.image_url||p?.imageUrls?.[0]||p?.image?.image_url_list?.[0]||null;
const TABS=[['overview','Visão geral','▦'],['ads','Shopee Ads','◎'],['analysis','Super Análise','✦'],['competitors','Concorrentes','◉'],['history','Histórico','◷'],['variations','Atributos & Variações','⌘']];
function missingKind(obj){
  const status=String(obj?.collectionStatus||obj?.collection_status||obj?.status||'').toLowerCase();
  if(obj?.collectionError||obj?.collection_error||obj?.error||status==='error')return'Erro de coleta';
  if(status==='not_integrated'||status==='unsupported')return'Não integrado';
  if(obj&&typeof obj==='object'&&Object.keys(obj).length)return'Sem dados';
  return'Não coletado';
}
function dataText(value,formatter,context){return n(value)!=null?formatter(value):missingKind(context)}
function countText(explicit,rows,context){
  if(n(explicit)!=null)return Number(explicit).toLocaleString('pt-BR');
  if(Array.isArray(rows)&&rows.length)return rows.length.toLocaleString('pt-BR');
  return missingKind(context);
}
function boolText(value,context){return value===true?'✓ Sim':value===false?'Não':missingKind(context)}


function Gauge({score,label}){const s=n(score);const p=Math.max(0,Math.min(100,s??0));return <div className={styles.gaugeWrap}><div className={styles.gauge} style={{'--score':`${p*1.8}deg`}}><div><b>{s==null?'—':Math.round(s)}</b><small>/100</small></div></div><span>{label}</span></div>}
function Metric({label,value,good,title}){return <div className={styles.metric} title={title||''}><small>{label}</small><b className={good?styles.good:''}>{value}</b></div>}
export default function SuperAnuncioMockup({items=[],initialItemId='',initialTab='overview'}){
  const initialSelected=items.find(x=>String(x.itemId)===String(initialItemId))||items[0]||null;
  const allowedTabs=useMemo(()=>new Set(TABS.map(([key])=>key)),[]);
  const [selectedId,setSelectedId]=useState(initialSelected?.itemId||'');
  const [tab,setTab]=useState(allowedTabs.has(initialTab)?initialTab:'overview');
  const [liveAds,setLiveAds]=useState({phase:'idle',campaign:null,error:''});
  const item=useMemo(()=>items.find(x=>String(x.itemId)===String(selectedId))||items[0]||null,[items,selectedId]);

  useEffect(()=>{
    const selected=items.find(x=>String(x.itemId)===String(initialItemId));
    if(selected)setSelectedId(selected.itemId);
    if(allowedTabs.has(initialTab))setTab(initialTab);
  },[items,initialItemId,initialTab,allowedTabs]);

  async function loadLiveAds(targetItemId){
    if(!targetItemId)return;
    setLiveAds({phase:'loading',campaign:null,error:''});
    try{
      const data=await fetchJsonWithTimeout('/api/shopee/ads?days=30',{cache:'no-store'},18000);
      const root=data?.v7||data?.v5||{};
      const campaigns=arr(root.campaigns);
      const campaign=campaigns.find(x=>String(x.itemId||'')===String(targetItemId)||arr(x.itemIds).some(id=>String(id)===String(targetItemId)))||null;
      setLiveAds({phase:campaign?'success':'empty',campaign,error:''});
    }catch(error){
      console.error('[Super Anúncio] complemento Shopee Ads falhou',error);
      const kind=classifyAsyncError(error);
      setLiveAds({phase:kind,campaign:null,error:kind==='timeout'?'A consulta atual do Shopee Ads expirou.':String(error?.message||error)});
    }
  }

  useEffect(()=>{if(item?.itemId)loadLiveAds(item.itemId)},[item?.itemId]);

  if(!item)return <div className={styles.screen}><main className={styles.empty}><h1>Super Anúncio</h1><p>Nenhum anúncio analisado ainda. Comece em Produtos → Enviar para Super Análise.</p></main></div>;

  const r=item.latest||{},prev=item.previous||{},p=r.product_snapshot||{},f=r.finance_snapshot||{},ai=r.report?.ai_analysis||{};
  const price=n(metric(r,'price')??p.price??p.currentPrice);
  const cost=n(f.productCost??p.referenceCost);
  const margin=n(f.marginPct);
  const sold=n(metric(r,'sold')??p.sold);
  const rating=n(p.rating??metric(r,'rating'));
  const reviews=n(p.reviewCount??p.ratingCount??metric(r,'reviewCount'));
  const images=arr(p.imageUrls||p.image?.image_url_list);
  const variations=arr(p.models||p.variations);
  const competitors=arr(r.competitors).slice(0,3);
  const score=n(r.score);
  const afterScore=n(ai.afterScore);
  const gain=score!=null&&afterScore!=null?Math.round(afterScore-score):null;
  const prevPrice=n(metric(prev,'price')??prev?.product_snapshot?.price);
  const prevSold=n(metric(prev,'sold')??prev?.product_snapshot?.sold);
  const historicalAds=r.ads_snapshot&&Object.keys(r.ads_snapshot).length?r.ads_snapshot:null;
  const liveCampaign=liveAds.campaign;
  const adsContext=historicalAds||liveCampaign||(liveAds.phase==='error'||liveAds.phase==='timeout'?{collectionError:liveAds.error}:liveAds.phase==='empty'?{collectionStatus:'success'}:null);
  const pickAds=(historyKey,liveKey=historyKey)=>metric(r,historyKey)??liveCampaign?.[liveKey]??null;
  const ads=[['ROAS atual',dataText(pickAds('roas'),num,adsContext)],['ROAS alvo',dataText(pickAds('targetRoas'),num,adsContext)],['Gasto Ads',dataText(pickAds('spend'),money,adsContext)],['GMV',dataText(pickAds('gmv'),money,adsContext)],['Custo por venda',dataText(metric(r,'cpa')??liveCampaign?.costPerOrder??(n(metric(r,'sales'))?n(metric(r,'spend'))/n(metric(r,'sales')):null),money,adsContext)],['CTR',dataText(pickAds('ctr'),pct,adsContext)]];

  return <div className={styles.screen}>
    <main className={styles.main}>
      <header className={styles.header}><div className={styles.headerTitle}><span className={styles.spark}>✦</span><div><h1>Super Anúncio</h1><p>Acompanhe o anúncio, histórico, concorrentes, Ads e resultados das Super Análises em um único painel.</p></div></div><div className={styles.headerActions}><Link href={`/super-analise?item_id=${item.itemId}`}>✦ Abrir Super Análise</Link></div></header>

      <section className={styles.productBar}>{imageOf(p)?<img src={imageOf(p)} alt=""/>:<div className={styles.noImage}/>}<div className={styles.productInfo}><span className={styles.sourceBadge}>🛍 Anúncio acompanhado</span><b>{p.title||p.item_name||`Produto ${item.itemId}`}</b><small>Categoria: {p.category||missingKind(p)}</small><div className={styles.badges}><span>{p.status||p.item_status?`● ${p.status||p.item_status}`:'Status não coletado'}</span><span>Última análise: {when(r.analyzed_at)}</span></div></div><div className={styles.metrics}><Metric label="Preço" value={dataText(price,money,p)}/><Metric label="Custo" value={dataText(cost,money,f)}/><Metric label="Margem estimada" value={dataText(margin,pct,f)} good={margin!=null&&margin>=0}/><Metric label="Vendas" value={dataText(sold,v=>Number(v).toLocaleString('pt-BR'),p)}/><Metric label="Avaliação" value={dataText(rating,v=>`${Number(v).toFixed(1)} ★`,p)} title={reviews!=null?`${reviews.toLocaleString('pt-BR')} avaliações`:missingKind(p)}/><Metric label="Fotos" value={countText(p.imageCount,images,p)}/><Metric label="Vídeo" value={boolText(p.hasVideo,p)}/><Metric label="Variações" value={countText(p.variationCount,variations,p)}/></div></section>

      <section className={styles.selector}><div><small>Anúncio exibido</small><select value={selectedId} onChange={e=>{setSelectedId(e.target.value);setTab('overview')}}>{items.map(x=><option key={x.itemId} value={x.itemId}>{x.latest?.product_snapshot?.title||x.latest?.product_snapshot?.item_name||`Produto ${x.itemId}`}</option>)}</select></div><span>{items.length} anúncio{items.length===1?'':'s'} com histórico</span></section>

      <div className={styles.tabs}>{TABS.map(([k,label,icon])=><button key={k} className={tab===k?styles.tabActive:''} onClick={()=>setTab(k)}><span>{icon}</span>{label}</button>)}</div>

      <div className={styles.workspace}><section className={styles.content}>
        {tab==='overview'&&<Overview item={item} price={price} prevPrice={prevPrice} sold={sold} prevSold={prevSold} margin={margin} ai={ai}/>} 
        {tab==='ads'&&<AdsPanel ads={ads} liveAds={liveAds} onRetry={()=>loadLiveAds(item.itemId)} hasHistorical={!!historicalAds}/>} 
        {tab==='analysis'&&<AnalysisPanel report={r} ai={ai}/>} 
        {tab==='competitors'&&<CompetitorsPanel competitors={competitors}/>} 
        {tab==='history'&&<HistoryPanel history={item.history}/>} 
        {tab==='variations'&&<VariationsPanel variations={variations} costs={arr(p.variationCosts)} product={p}/>} 
        <BottomCards item={item} competitors={competitors} score={score} afterScore={afterScore}/>
      </section>

      <aside className={styles.rightbar}><h3>Nota geral do anúncio</h3><div className={styles.gaugePair}><Gauge score={score} label="Atual"/><span>→</span><Gauge score={afterScore} label="Potencial após sugestões"/></div><div className={styles.impact}><b>{gain==null?'Sem projeção nova':`${gain>=0?'+':''}${gain} pontos estimados`}</b><small>Baseado na última Super Análise registrada.</small></div><Link className={styles.primary} href={`/super-analise?item_id=${item.itemId}`}>✦ Ver / refazer Super Análise</Link><button type="button" onClick={()=>setTab('competitors')}>◉ Ver concorrentes</button><button type="button" onClick={()=>setTab('ads')}>◎ Ver Shopee Ads</button><button type="button" onClick={()=>setTab('history')}>◷ Ver histórico completo</button><div className={styles.tip}><b>💡 Visão rápida</b><p>Use esta página para acompanhar a evolução. As mudanças de conteúdo são feitas pela Super Análise.</p></div></aside></div>
    </main>
  </div>;
}

function Overview({item,price,prevPrice,sold,prevSold,margin,ai}){const r=item.latest||{};return <><section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>Retrato atual do anúncio</h2><span>Atual</span></div><div className={styles.bigFacts}><div><small>Preço atual</small><b>{money(price)}</b></div><div><small>Vendas acumuladas</small><b>{sold?.toLocaleString('pt-BR')||'—'}</b></div><div><small>Margem</small><b>{pct(margin)}</b></div><div><small>Última coleta</small><b>{when(r.analyzed_at)}</b></div></div></article><div className={styles.arrow}>→<small>evolução</small></div><article className={styles.panel}><div className={styles.panelHead}><h2>Comparação com a análise anterior</h2><span>Histórico</span></div><div className={styles.changeList}><div><span>Preço</span><b>{prevPrice==null?'Primeira coleta':`${money(prevPrice)} → ${money(price)}`}</b></div><div><span>Vendas</span><b>{prevSold==null?'Primeira coleta':`${prevSold.toLocaleString('pt-BR')} → ${sold?.toLocaleString('pt-BR')||'—'}`}</b></div><div><span>Próxima rechecagem</span><b>{when(item.schedule?.next_run_at||r.next_reanalysis_at)}</b></div><div><span>IA</span><b>{ai?.afterScore!=null?'Sugestões disponíveis':'Sem nova projeção'}</b></div></div></article></section><section className={styles.explain}><h2>Resumo do acompanhamento</h2><div className={styles.reasonGrid}><article><b>Preço</b><p>Acompanhe mudanças do seu preço entre as coletas e compare com os concorrentes.</p></article><article><b>Ads</b><p>ROAS, meta, gasto, GMV e custo por venda ficam reunidos na aba Shopee Ads.</p></article><article><b>Concorrentes</b><p>Os concorrentes vinculados preservam snapshots para comparação ao longo do tempo.</p></article><article><b>Super Análise</b><p>As notas e sugestões da IA continuam acessíveis sem apagar análises anteriores.</p></article><article><b>Margem</b><p>Preço e custo registrados são usados para acompanhar a margem do anúncio.</p></article></div></section></>}
function AdsPanel({ads,liveAds,onRetry,hasHistorical}){const liveState=liveAds?.phase;return <section className={styles.panel}><div className={styles.panelHead}><h2>Shopee Ads</h2><span>{hasHistorical&&liveState==='success'?'Análise salva + complemento atual da Shopee':hasHistorical?'Dados salvos na última análise':liveState==='success'?'Dados atuais da Shopee':'Fonte de Ads'}</span></div><p className={styles.dataLegend}>“Não coletado” = a rodada não trouxe essa fonte. “Não integrado” = fonte sem suporte. “Sem dados” = a fonte respondeu, mas não trouxe o campo. “Erro de coleta” = houve falha registrada.</p>{liveState==='loading'&&<p className={styles.dataLegend}>Consultando a fonte atual do Shopee Ads para complementar campos ausentes…</p>}{(liveState==='error'||liveState==='timeout')&&<div className={styles.dataError}>{liveAds.error}<button type="button" onClick={onRetry}>Tentar novamente</button></div>}<div className={styles.adsGrid}>{ads.map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div></section>}
function AnalysisPanel({report,ai}){const dims=arr(report?.report?.dimensions);return <section className={styles.panel}><div className={styles.panelHead}><h2>Última Super Análise</h2><span>{when(report?.analyzed_at)}</span></div><div className={styles.analysisGrid}>{dims.length?dims.map((d,i)=><div key={i}><span>{d.name||`Critério ${i+1}`}</span><b>{n(d.score)==null?'—':`${d.score}/${d.maxScore||100}`}</b></div>):<p className={styles.muted}>Sem notas detalhadas registradas nesta rodada.</p>}</div>{ai?.priorities?.length?<div className={styles.priorityBox}><b>Prioridades detectadas pela IA</b>{ai.priorities.slice(0,5).map((x,i)=><p key={i}>• {x.area||'Melhoria'}: {x.why||x.reason||''}</p>)}</div>:null}</section>}
function CompetitorsPanel({competitors}){return <section className={styles.panel}><div className={styles.panelHead}><h2>Concorrentes vinculados</h2><span>{competitors.length} de até 3</span></div><div className={styles.competitors}>{competitors.length?competitors.map((c,i)=><article key={i}>{c.imageUrl||arr(c.imageUrls)[0]?<img src={c.imageUrl||arr(c.imageUrls)[0]} alt=""/>:<div className={styles.noComp}/>}<div><b>{c.title||`Concorrente ${i+1}`}</b><small>{dataText(c.price,money,c)} · {dataText(c.sold,v=>Number(v).toLocaleString('pt-BR'),c)} vendidos · {dataText(c.rating,v=>Number(v).toFixed(1)+'★',c)}</small><p>{c.description?String(c.description).slice(0,170):missingKind(c)}</p></div></article>):<p className={styles.muted}>Nenhum concorrente foi coletado/vinculado nesta análise.</p>}</div></section>}
function HistoryPanel({history=[]}){return <section className={styles.panel}><div className={styles.panelHead}><h2>Histórico completo de análises</h2><span>{history.length} rodada{history.length===1?'':'s'}</span></div><div className={styles.history}>{history.map((r,i)=><article key={r.id||i}><div><b>{when(r.analyzed_at)}</b><small>Relatório {r.id||'—'}</small></div><Gauge score={r.score} label={i===0?'Atual':`Rodada ${history.length-i}`}/><span>{money(metric(r,'price')??r.product_snapshot?.price)}</span></article>)}</div></section>}
function VariationsPanel({variations=[],costs=[],product={}}){const cm=new Map(costs.map(x=>[String(x.modelId??x.model_id),n(x.cost)]));const explicit=n(product?.variationCount);const emptyText=explicit===0?'0 variações — a coleta registrou explicitamente que o anúncio não possui variações.':`${missingKind(product)}: nenhuma estrutura de variações foi salva nesta rodada.`;return <section className={styles.panel}><div className={styles.panelHead}><h2>Atributos & Variações</h2><span>{variations.length?variations.length:explicit===0?'0':'—'} variações</span></div>{variations.length?<div className={styles.variationTable}><div><b>Variação</b><b>Preço</b><b>Custo</b><b>Estoque</b></div>{variations.map((v,i)=>{const id=String(v.modelId??v.model_id??v.id??i);return <div key={id}><span>{v.name||v.model_name||`Variação ${i+1}`}</span><span>{dataText(v.price??v.currentPrice,money,v)}</span><span>{dataText(v.cost??cm.get(id),money,v)}</span><span>{dataText(v.stock??v.normal_stock,x=>Number(x).toLocaleString('pt-BR'),v)}</span></div>})}</div>:<p className={styles.muted}>{emptyText}</p>}</section>}
function BottomCards({item,competitors,score,afterScore}){const latest=item.latest||{};const prev=item.previous||{};const price=n(metric(latest,'price')??latest.product_snapshot?.price),old=n(metric(prev,'price')??prev.product_snapshot?.price);return <div className={styles.bottom}><section><h3>◉ Nota e potencial</h3><div className={styles.gaugePair}><Gauge score={score} label="Atual"/><span>→</span><Gauge score={afterScore} label="Com sugestões"/></div></section><section><h3>↻ Mudanças recentes</h3><p>Preço: {old==null?'sem comparação':`${money(old)} → ${money(price)}`}</p><p>Última análise: {when(latest.analyzed_at)}</p><p>Próxima rechecagem: {when(item.schedule?.next_run_at||latest.next_reanalysis_at)}</p></section><section><h3>◉ Monitoramento competitivo</h3><p>{competitors.length} concorrente{competitors.length===1?'':'s'} vinculado{competitors.length===1?'':'s'}.</p><p>Os snapshots preservam preço, vendas e demais dados capturados em cada rodada.</p></section></div>}
