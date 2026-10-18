'use client';

// Aba "Histórico Ads": ranking e diagnóstico de campanhas de publicidade PAGA (não é o funil geral da loja).
// Cálculo e regras em app/lib/ads-history-diagnosis.js.

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {buildAds,adMatches,sortAds,AD_FILTERS,AD_SORTS,ADS_THRESHOLDS} from '../lib/ads-history-diagnosis';
import {Icon,InfoTip,StatusPill,imageFallback,IMAGE_PLACEHOLDER} from './StoreOverview';
import styles from './ads.module.css';

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');
const pct=v=>num(v)==null?'—':(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dec=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const pedidos=v=>int(v)+(Number(v)===1?' pedido':' pedidos');

function Summary({s,periodLabel}){
  const T=ADS_THRESHOLDS;
  const cards=[
    {tone:'blue',icon:'ads',t:'Anúncios no histórico',main:String(s.total),sub:'campanhas de Ads com dados no período'},
    {tone:'green',icon:'package',t:'Mais pedidos',main:s.topOrders?.ad.title,sub:s.topOrders?pedidos(s.topOrders.ad.orders):'Nenhum pedido atribuído'},
    {tone:'teal',icon:'cursor',t:'Mais cliques',main:s.topClicks?.ad.title,sub:s.topClicks?int(s.topClicks.ad.clicks)+' cliques':'—'},
    {tone:'purple',icon:'target',t:'Melhor CTR (amostra mínima)',main:s.bestCtr?.ad.title,sub:s.bestCtr?pct(s.bestCtr.ad.ctr)+' · '+int(s.bestCtr.ad.impressions)+' impressões':`Nenhum com ${T.minImpressions.toLocaleString('pt-BR')}+ impressões`},
    {tone:'orange',icon:'funnel',t:'Melhor clique → pedido',main:s.bestCvr?.ad.title,sub:s.bestCvr?pct(s.bestCvr.ad.cvr)+' · '+int(s.bestCvr.ad.clicks)+' cliques':`Nenhum com ${T.minClicks}+ cliques e pedidos`},
    {tone:'red',icon:'alert',t:'Precisam de atenção',main:String(s.waste),sub:`${s.zeroOrders} com 0 pedidos · ${s.limited} com amostra limitada`}
  ];
  return <div className={styles.summary}>{cards.map(c=><article key={c.t} data-tone={c.tone}>
    <span className={styles.sumIcon}><Icon name={c.icon} size={17}/></span><small>{c.t}</small>
    <b title={c.main}>{c.main||'—'}</b><em>{c.sub}</em><i>{periodLabel}</i>
  </article>)}</div>;
}

function Row({row,expanded,onToggle,context,images,onOpenProduct}){
  const {ad,state,interpretation:it}=row;
  const ctx=ad.itemId?context?.[ad.itemId]:null;
  const img=ctx?.image||(ad.itemId?images?.[ad.itemId]:null)||IMAGE_PLACEHOLDER;
  return <li className={styles.item} data-state={state.id} data-expanded={expanded}>
    <div className={styles.row}>
      <div className={styles.ident}><img src={img} alt="" onError={imageFallback}/><div><b title={ad.title}>{ad.title}</b><small>{ad.stateLabel?ad.stateLabel+' · ':''}{ad.itemId?'ID '+ad.itemId:'Campanha '+(ad.campaignId??'—')}</small></div></div>
      <div className={styles.status}><StatusPill level={state.level} label={state.label}/><InfoTip label={state.label} align="left">{state.tip}</InfoTip></div>
      <dl className={styles.metrics}>
        <div><dt><Icon name="eye" size={13}/>Impressões</dt><dd>{int(ad.impressions)}</dd></div>
        <div><dt><Icon name="cursor" size={13}/>Cliques</dt><dd>{int(ad.clicks)}</dd></div>
        <div><dt><Icon name="package" size={13}/>Pedidos</dt><dd>{int(ad.orders)}</dd></div>
        <div><dt><Icon name="target" size={13}/>CTR</dt><dd>{pct(ad.ctr)}</dd></div>
        <div><dt><Icon name="funnel" size={13}/>Clique → pedido</dt><dd>{pct(ad.cvr)}</dd></div>
      </dl>
      <button type="button" className={styles.expand} aria-expanded={expanded} aria-controls={'ad-'+ad.id} onClick={()=>onToggle(ad.id)}>{expanded?'Fechar':'Ver análise'}<Icon name="chevron" size={14}/></button>
    </div>
    {expanded&&<div className={styles.detail} id={'ad-'+ad.id}>
      <div className={styles.reads}>
        <p><Icon name="eye" size={14}/>{it.per100ctr}</p>
        <p><Icon name="funnel" size={14}/>{it.per100cvr}</p>
      </div>
      <div className={styles.triad}>
        <article><span className={styles.tag} data-kind="fact">Fato</span><p>{it.fact}</p></article>
        {it.hypothesis&&<article data-kind="cause"><span className={styles.tag} data-kind="cause">Hipótese</span><p>{it.hypothesis}</p></article>}
        <article><span className={styles.tag} data-kind="action">Ação sugerida</span><p>{it.action}</p></article>
      </div>
      {(ad.spend!=null||ad.gmv!=null)&&<dl className={styles.extra} aria-label="Dados financeiros do anúncio">
        {ad.spend!=null&&<div><dt>Gasto</dt><dd>{money(ad.spend)}</dd></div>}
        {ad.gmv!=null&&<div><dt>GMV atribuído</dt><dd>{money(ad.gmv)}</dd></div>}
        {ad.roas!=null&&<div><dt>ROAS</dt><dd>{dec(ad.roas)}</dd></div>}
        {ad.costPerOrder!=null&&<div><dt>Custo por pedido</dt><dd>{money(ad.costPerOrder)}</dd></div>}
        {ad.cpc!=null&&<div><dt>CPC</dt><dd>{money(ad.cpc)}</dd></div>}
      </dl>}
      <div className={styles.links}>
        {ctx?<button type="button" className={styles.primaryBtn} onClick={()=>onOpenProduct(String(ad.itemId))}>Abrir Funil por Produto <Icon name="arrow" size={14}/></button>
          :<span className={styles.note}>{ad.itemId?'Este anúncio ainda não tem Super Análise recente; faça uma para abri-lo no Funil por Produto.':'A campanha não informa o anúncio vinculado.'}</span>}
        {ctx&&<Link className={styles.ghostBtn} href={`/super-analise?item_id=${encodeURIComponent(ad.itemId)}${ctx.reportId?`&report_id=${encodeURIComponent(ctx.reportId)}`:''}`}>Abrir Super Análise</Link>}
        {!ctx&&ad.itemId&&<Link className={styles.ghostBtn} href="/super-analise">Fazer Super Análise</Link>}
        <Link className={styles.ghostBtn} href="/extensao-shopee-intelligence?section=shopee-ads" title="Abre a visão geral de Shopee Ads; o atalho direto para esta campanha não existe no Gestor.">Ver Shopee Ads</Link>
      </div>
    </div>}
  </li>;
}

export default function AdsHistory({images,ads,adsError,context,periodMeta,periodId,lastUpdated,onRefresh,onOpenProduct}){
  const built=useMemo(()=>buildAds(ads?.campaigns),[ads]);
  const [filter,setFilter]=useState('all');
  const [sort,setSort]=useState('orders');
  const [openId,setOpenId]=useState('');
  useEffect(()=>{setOpenId('');setFilter('all')},[periodId]);
  const shown=useMemo(()=>sortAds(built.rows.filter(r=>adMatches(r,filter,built.ref)),sort),[built,filter,sort]);
  const stamp=lastUpdated?new Date(lastUpdated).toLocaleString('pt-BR'):'—';
  const avail=ads?.availability;
  const msgs=Object.values(avail?.messages||{}).filter(Boolean);
  return <div className={styles.root}>
    <section className={styles.block} aria-labelledby="ads-title">
      <div className={styles.title}><span><Icon name="ads" size={18}/></span><div><h2 id="ads-title">Histórico Shopee Ads · {periodMeta.label}</h2><p>Camada complementar para enxergar o desempenho de cada campanha de anúncios pagos.</p></div></div>
      <p className={styles.noteBox} role="note"><Icon name="info" size={15}/>São métricas de publicidade paga (campanhas). Elas não representam o funil geral da loja, que inclui também o tráfego orgânico.</p>
      {built.summary.total>0&&<Summary s={built.summary} periodLabel={periodMeta.label}/>}
      {built.summary.spend&&<p className={styles.finance}><b>Gasto:</b> {money(built.summary.spend.value)}{built.summary.gmv&&<> · <b>GMV atribuído:</b> {money(built.summary.gmv.value)}</>}{built.summary.roas!=null&&<> · <b>ROAS (anúncios com gasto):</b> {dec(built.summary.roas)}</>}<small>Aparecem porque a própria API de Ads os enviou; nada foi estimado.</small></p>}
    </section>

    {built.summary.total===0
      ?<section className={styles.block}><p className={styles.empty}>{adsError?`Não foi possível carregar os dados de Ads: ${adsError}`:'Sem campanhas de Ads com dados neste período.'} Nada foi estimado.</p>
        <div className={styles.links}><button type="button" className={styles.primaryBtn} onClick={onRefresh}><Icon name="refresh" size={15}/>Atualizar agora</button></div></section>
      :<section className={styles.block} aria-labelledby="ads-rank">
        <div className={styles.head}>
          <div className={styles.title}><span><Icon name="chart" size={18}/></span><div><h2 id="ads-rank">Ranking dos anúncios</h2><p>Clique em “Ver análise” para ler o diagnóstico. Taxas só entram em destaque com amostra mínima ({ADS_THRESHOLDS.minImpressions.toLocaleString('pt-BR')} impressões / {ADS_THRESHOLDS.minClicks} cliques).</p></div></div>
          <label className={styles.sort}><span>Ordenar por</span><select value={sort} onChange={e=>setSort(e.target.value)}>{AD_SORTS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <InfoTip label="Como ordenamos" align="right">Valores ausentes e taxas de amostra pequena ficam no fim da lista. Oportunidade = quantos pedidos a mais o anúncio teria se convertesse como a mediana dos seus outros anúncios (cliques × distância); serve para ordenar a investigação, não é previsão de vendas.</InfoTip></label>
        </div>
        <div className={styles.filters} role="group" aria-label="Filtrar anúncios">{AD_FILTERS.map(f=><button key={f.id} type="button" aria-pressed={filter===f.id} data-active={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}</button>)}</div>
        {shown.length?<ul className={styles.list}>{shown.map(r=><Row key={r.ad.id} row={r} expanded={openId===r.ad.id} onToggle={id=>setOpenId(c=>c===id?'':id)} context={context} images={images} onOpenProduct={onOpenProduct}/>)}</ul>
          :<p className={styles.empty}>Nenhum anúncio neste filtro. <button type="button" onClick={()=>setFilter('all')}>Mostrar todos</button></p>}
        <small className={styles.hint}>Comparações são relativas à mediana dos seus próprios anúncios neste período (CTR {built.ref.ctr!=null?pct(built.ref.ctr):'sem referência'} · clique → pedido {built.ref.cvr!=null?pct(built.ref.cvr):'sem referência'}), não a um padrão da Shopee.</small>
      </section>}

    <details className={styles.collapse}>
      <summary><span><Icon name="shield" size={17}/>Fonte e confiabilidade</span><em>{ads?.scope==='all_cpc_fallback'?'resumo geral de CPC':'campanhas de anúncios de produto'}</em><Icon name="chevron" size={16}/></summary>
      <div className={styles.collapseBody}><ul>
        <li><b>Origem:</b> API de Shopee Ads (Open Platform) da loja conectada: campanhas, configurações e desempenho diário. É outra fonte que o funil do Seller Center.</li>
        <li><b>Período:</b> {periodMeta.label}. <b>Última coleta concluída:</b> {stamp}.</li>
        <li><b>Escopo:</b> {ads?.scope==='all_cpc_fallback'?'a API não devolveu desempenho por campanha; os números por anúncio podem estar ausentes.':'desempenho por campanha de anúncios de produto.'}</li>
        <li><b>Fórmulas:</b> CTR = cliques ÷ impressões; clique → pedido = pedidos ÷ cliques; ROAS = GMV atribuído ÷ gasto. Pedidos e GMV seguem a atribuição ampla da Shopee.</li>
        <li><b>Ads ≠ funil da loja:</b> aqui só há tráfego pago. Vendas orgânicas e de outras fontes não aparecem.</li>
        <li><b>Limites heurísticos:</b> amostra mínima de {ADS_THRESHOLDS.minImpressions.toLocaleString('pt-BR')} impressões (CTR) e {ADS_THRESHOLDS.minClicks} cliques (conversão); “abaixo da referência” = menos de {Math.round(ADS_THRESHOLDS.lowRatio*100)}% da mediana. São critérios internos, não da Shopee.</li>
        {msgs.length>0&&<li><b>Avisos da coleta:</b> {msgs.join(' · ').slice(0,500)}</li>}
      </ul></div>
    </details>
  </div>;
}
