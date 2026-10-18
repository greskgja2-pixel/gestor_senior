'use client';

// Aba "Fontes de Tráfego": de onde vêm as vendas, quem converte e o que investigar.
// Toda validação/cálculo está em app/lib/traffic-sources-diagnosis.js. Nada aqui soma fontes ou inventa números.

import {useEffect,useMemo,useState} from 'react';
import {normalizeTraffic,diagnoseTraffic,rankBy,storeTotals,SHARE_NOTE,RANK_METRICS,MIN_CLICKS_FOR_CONVERSION,MIN_IMPRESSIONS_FOR_CTR} from '../lib/traffic-sources-diagnosis';
import {Icon,InfoTip,StatusPill} from './StoreOverview';
import styles from './traffic.module.css';

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');
const pct=v=>num(v)==null?'—':(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const diffText=v=>v==null?null:(v>=0?'▲ +':'▼ ')+(v*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'% vs período anterior';
const pedidos=v=>int(v)+(Number(v)===1?' pedido':' pedidos');
const fmt=(metric,v)=>metric==='sales'?money(v):metric==='orders'?int(v):pct(v);
const STATUS={
  ok:{level:'good',label:'Dados válidos'},
  partial:{level:'warn',label:'Dados parciais'},
  unavailable:{level:'data',label:'Dados indisponíveis'},
  missing:{level:'data',label:'Não enviada'}
};
const TONE_ICON={good:'check',warn:'alert',data:'help'};

function Metric({label,value,note,tip}){
  return <div className={styles.metric}><span>{label}{tip&&<InfoTip label={label} align="left">{tip}</InfoTip>}</span><b>{value}</b>{note&&<small>{note}</small>}</div>;
}

function SummaryCards({diag,periodLabel,sources}){
  const {summary}=diag;
  const incomplete=sources.filter(x=>x.status!=='ok');
  const cards=[
    {tone:'blue',icon:'chart',title:'Maior GMV',main:summary.topSales?.source.label,sub:summary.topSales?money(summary.topSales.value):null,empty:'Sem fonte com GMV válido'},
    {tone:'green',icon:'package',title:'Mais pedidos',main:summary.topOrders?.source.label,sub:summary.topOrders?pedidos(summary.topOrders.value):null,empty:'Sem fonte com pedidos válidos'},
    {tone:'purple',icon:'target',title:'Melhor conversão comparável',main:summary.bestConversion?.source.label,sub:summary.bestConversion?pct(summary.bestConversion.value)+' pedidos ÷ cliques'+(rankBy(sources,'conversion').ranked.length===1?' · única fonte com amostra suficiente':''):null,empty:`Nenhuma fonte com ${MIN_CLICKS_FOR_CONVERSION}+ cliques`},
    {tone:'orange',icon:'help',title:'Fontes com dados incompletos',main:incomplete.length?incomplete.map(s=>s.short).join(', '):'Nenhuma',sub:incomplete.length?'Só o que a Shopee enviou; sem estimativa':'Todas enviaram dados completos',empty:null}
  ];
  return <div className={styles.summary}>{cards.map(c=><article key={c.title} data-tone={c.tone}>
    <span className={styles.sumIcon}><Icon name={c.icon} size={17}/></span>
    <small>{c.title}</small>
    <b>{c.main||c.empty}</b>
    {c.sub&&<em>{c.sub}</em>}
    <i>{periodLabel}</i>
  </article>)}</div>;
}

function Comparison({sources,metric,setMetric}){
  const {ranked,excluded}=rankBy(sources,metric);
  const max=Math.max(...ranked.map(r=>r.value),0)||1;
  const meta=RANK_METRICS.find(m=>m.id===metric);
  return <section className={styles.block} aria-labelledby="fontes-comp">
    <div className={styles.head}>
      <div className={styles.title}><span><Icon name="chart" size={18}/></span><div><h2 id="fontes-comp">Comparação das fontes</h2><p>Só valores válidos. Barras comparam fontes, não formam um total (podem se sobrepor).</p></div></div>
      <div className={styles.segmented} role="group" aria-label="Ordenar por">{RANK_METRICS.map(m=><button key={m.id} type="button" aria-pressed={metric===m.id} data-active={metric===m.id} onClick={()=>setMetric(m.id)}>{m.label}</button>)}</div>
    </div>
    {ranked.length?<ol className={styles.bars}>{ranked.map((r,i)=><li key={r.source.key} data-source={r.source.key}>
      <span className={styles.rank}>{i+1}</span>
      <span className={styles.barName}><Icon name={r.source.icon} size={15}/>{r.source.label}</span>
      <span className={styles.barTrack} role="img" aria-label={`${r.source.label}: ${fmt(metric,r.value)}`}><span style={{width:Math.max(3,(r.value/max)*100)+'%'}}/></span>
      <b>{fmt(metric,r.value)}</b>
    </li>)}</ol>:<p className={styles.empty}>Nenhuma fonte tem dados válidos e amostra suficiente para ordenar por {meta.label}.</p>}
    {excluded.length>0&&<ul className={styles.excluded} aria-label="Fontes fora do ranking">{excluded.map(e=><li key={e.source.key}><Icon name="help" size={14}/><b>{e.source.label}:</b> {e.why}</li>)}</ul>}
    {(metric==='ctr'||metric==='conversion')&&<small className={styles.hint}>Taxas só entram no ranking com amostra mínima ({metric==='ctr'?MIN_IMPRESSIONS_FOR_CTR.toLocaleString('pt-BR')+' impressões':MIN_CLICKS_FOR_CONVERSION+' cliques'}) para uma taxa pequena não parecer melhor do que é.</small>}
  </section>;
}

function SourceCard({s,selected,onSelect}){
  const st=STATUS[s.status];
  const invalid=s.status==='unavailable'||s.status==='missing';
  return <article className={styles.card} data-selected={selected} data-status={s.status} data-source={s.key}>
    <button type="button" className={styles.cardMain} aria-pressed={selected} onClick={()=>onSelect(s.key)}>
      <header><span className={styles.cardIcon}><Icon name={s.icon} size={18}/></span><b>{s.label}</b></header>
      {invalid
        ?<div className={styles.na}><strong>Dados indisponíveis</strong><small>{s.status==='missing'?'A Shopee não enviou esta fonte.':'A Shopee devolveu um valor reservado, não um resultado.'}</small></div>
        :<><strong className={styles.gmv}>{money(s.sales)}</strong><span className={styles.orders}>{s.orders==null?'Pedidos indisponíveis':pedidos(s.orders)}</span>{s.share!=null&&<span className={styles.share}>{pct(s.share)} do GMV da loja</span>}{s.pctDiff!=null&&<span className={styles.diff} data-dir={s.pctDiff>=0?'up':'down'}>{diffText(s.pctDiff)}</span>}</>}
      <footer><StatusPill level={st.level} label={st.label}/>{s.status==='ok'&&s.sales===0&&s.orders===0&&<small>Sem vendas nesta fonte (zero real)</small>}</footer>
    </button>
    {!invalid&&<details className={styles.more}>
      <summary>Mais métricas<Icon name="chevron" size={14}/></summary>
      <dl>
        <div><dt>Impressões</dt><dd>{int(s.impressions)}</dd></div>
        <div><dt>Cliques</dt><dd>{int(s.clicks)}</dd></div>
        <div><dt>CTR</dt><dd>{pct(s.ctr)}</dd></div>
        <div><dt>Conversão</dt><dd>{pct(s.conversion)}</dd></div>
      </dl>
    </details>}
  </article>;
}

function Detail({s,onGoTab}){
  if(!s)return null;
  const st=STATUS[s.status];
  return <aside className={styles.detail} aria-live="polite" aria-label={'Detalhes de '+s.label}>
    <header><span className={styles.cardIcon}><Icon name={s.icon} size={20}/></span><div><h3>{s.label}</h3><p>{s.what}</p></div><StatusPill level={st.level} label={st.label}/></header>
    {(s.status==='unavailable'||s.status==='missing')?<>
      <p className={styles.alert}><Icon name="alert" size={16}/>{s.reason}</p>
      {s.hypothesis&&<p className={styles.hypo}><span className={styles.tag} data-kind="cause">Hipótese</span>{s.hypothesis}</p>}
      <p className={styles.small}>O Gestor não exibe esses valores como faturamento e não os troca por zero. Cálculos de CTR e conversão foram desativados para esta fonte.</p>
      {s.key==='paid_ads'&&<button type="button" className={styles.ghostBtn} onClick={()=>onGoTab('ads')}>Ver Histórico Ads <Icon name="arrow" size={14}/></button>}
    </>:<>
      <div className={styles.metrics}>
        <Metric label="GMV" value={money(s.sales)} note={s.salesOrigin==='resumo'?'do resumo da Shopee':null} tip="Valor bruto de mercadorias atribuído a esta fonte segundo a Shopee. Não é lucro nem receita líquida."/>
        <Metric label="Pedidos" value={int(s.orders)} note={s.orders==null?'indisponível nesta API':null}/>
        <Metric label="Participação no GMV" value={pct(s.share)} note="parte do GMV total da loja" tip={SHARE_NOTE}/>
        <Metric label="Variação" value={s.pctDiff==null?'—':(s.pctDiff>=0?'+':'')+pct(s.pctDiff)} note="GMV vs período anterior (Shopee)" tip="Variação do GMV desta fonte em relação ao período anterior, calculada pela Shopee. Quando a Shopee não envia, aparece —."/>
        <Metric label="Ticket médio" value={money(s.salesPerOrder)} note="GMV ÷ pedidos" tip="Calculado pelo Gestor: GMV dividido por pedidos da mesma fonte."/>
        <Metric label="Impressões" value={int(s.impressions)}/>
        <Metric label="Cliques" value={int(s.clicks)}/>
        <Metric label="CTR" value={pct(s.ctr)} note={s.ctrNote||'cliques ÷ impressões'} tip="CTR = cliques ÷ impressões da mesma fonte. Não é calculado sem as duas bases."/>
        <Metric label="Conversão" value={pct(s.conversion)} note={s.conversionNote||`pedidos ÷ cliques${s.conversionOrigin?' · '+s.conversionOrigin:''}`} tip="Conversão = pedidos ÷ cliques da própria fonte. Pedidos de uma fonte nunca são divididos por cliques de outra."/>
      </div>
      {s.reason&&<p className={styles.alert}><Icon name="info" size={16}/>{s.reason}</p>}
    </>}
  </aside>;
}

function Insights({diag}){
  return <section className={styles.block} aria-labelledby="fontes-insights">
    <div className={styles.title}><span><Icon name="target" size={18}/></span><div><h2 id="fontes-insights">O que esses dados significam para minha loja?</h2><p>Fatos vêm dos números; hipóteses são possíveis causas ainda não comprovadas; ações são o que vale investigar.</p></div></div>
    {diag.insights.length?<div className={styles.insights}>{diag.insights.map(i=><article key={i.id} data-tone={i.tone}>
      <h3><Icon name={TONE_ICON[i.tone]||'info'} size={16}/>{i.title}</h3>
      <p><span className={styles.tag} data-kind="fact">Fato</span>{i.fact}</p>
      {i.hypothesis&&<p><span className={styles.tag} data-kind="cause">Hipótese</span>{i.hypothesis}</p>}
      <p><span className={styles.tag} data-kind="action">Ação</span>{i.action}</p>
    </article>)}</div>:<p className={styles.empty}>Sem dados válidos para gerar recomendações neste período.</p>}
    <small className={styles.hint}>Comparações são relativas às outras fontes da sua própria loja neste período, não a um padrão da Shopee.</small>
  </section>;
}

export default function TrafficSources({traffic,errors,periodMeta,periodId,lastUpdated,onGoTab,onRefresh,onChangePeriod}){
  const sources=useMemo(()=>normalizeTraffic(traffic),[traffic]);
  const diag=useMemo(()=>diagnoseTraffic(sources),[sources]);
  const total=useMemo(()=>storeTotals(traffic),[traffic]);
  const [metric,setMetric]=useState('sales');
  const [selected,setSelected]=useState(null);
  useEffect(()=>{setSelected(diag.summary.topSales?.source.key||sources.find(s=>s.status==='ok'||s.status==='partial')?.key||sources[0]?.key)},[diag,sources,periodId]);
  const trafficErrors=(errors||[]).filter(e=>/traffic/i.test(String(e?.source||'')));
  const notReady=trafficErrors.some(e=>/data isn.t ready|not ready|60001/i.test(String(e?.error||e?.message||'')));

  if(!traffic){
    return <section className={styles.block}>
      <div className={styles.title}><span><Icon name="traffic" size={18}/></span><div><h2>De onde vêm suas vendas?</h2><p>Contribuição das fontes de tráfego carregadas pela própria Shopee.</p></div></div>
      <p className={styles.alert}><Icon name="alert" size={16}/>{notReady?`A Shopee ainda não liberou as fontes de tráfego de ${periodMeta.label.toLowerCase()} (relatório não pronto; costuma acontecer de madrugada ou em períodos longos).`:'O Motor não trouxe as fontes de tráfego neste período.'} Nada foi estimado.</p>
      <div className={styles.actions}><button type="button" className={styles.primaryBtn} onClick={onRefresh}><Icon name="refresh" size={15}/>Atualizar agora</button>{periodId!=='past7days'&&<button type="button" className={styles.ghostBtn} onClick={()=>onChangePeriod('past7days')}>Testar 7 dias</button>}{periodId!=='real_time'&&<button type="button" className={styles.ghostBtn} onClick={()=>onChangePeriod('real_time')}>Testar Hoje</button>}</div>
    </section>;
  }
  const current=sources.find(s=>s.key===selected)||null;
  const stamp=lastUpdated?new Date(lastUpdated).toLocaleString('pt-BR'):'—';
  return <div className={styles.root}>
    <section className={styles.block} aria-labelledby="fontes-title">
      <div className={styles.title}><span><Icon name="traffic" size={18}/></span><div><h2 id="fontes-title">De onde vêm suas vendas?</h2><p>Dados de {periodMeta.label}. Cada fonte tem sua própria contagem: elas não somam o funil da loja nem formam um único percurso de compradores.</p></div></div>
      {total.sales!=null&&<p className={styles.total}><b>GMV total da loja (Shopee): {money(total.sales)}</b>{total.pctDiff!=null&&<span> · {diffText(total.pctDiff)}</span>}<small>É a soma de Card/Busca, Live, Vídeo e Afiliados. Shopee Ads é uma parte desse total (se sobrepõe a Card/Busca) e nunca é somada.</small></p>}
      <SummaryCards diag={diag} periodLabel={periodMeta.label} sources={sources}/>
    </section>
    <Comparison sources={sources} metric={metric} setMetric={setMetric}/>
    <section className={styles.block} aria-labelledby="fontes-cards">
      <div className={styles.title}><span><Icon name="package" size={18}/></span><div><h2 id="fontes-cards">Fontes em detalhe</h2><p>Escolha uma fonte para ver as métricas e como cada taxa foi calculada.</p></div></div>
      <div className={styles.cards}>{sources.map(s=><SourceCard key={s.key} s={s} selected={selected===s.key} onSelect={setSelected}/>)}</div>
      <Detail s={current} onGoTab={onGoTab}/>
    </section>
    <Insights diag={diag}/>
    <details className={styles.collapse}>
      <summary><span><Icon name="shield" size={17}/>Fonte e confiabilidade</span><em>{diag.usableCount} de {sources.length} fontes com dados</em><Icon name="chevron" size={16}/></summary>
      <div className={styles.collapseBody}>
        <ul>
          <li><b>Origem:</b> Informações Gerenciais da Shopee (fontes de tráfego), coletadas pelo Motor Sênior com a sessão do Seller Center.</li>
          <li><b>Período:</b> {periodMeta.label} · <b>última coleta concluída:</b> {stamp}.</li>
          <li><b>Calculado pelo Gestor:</b> CTR (cliques ÷ impressões), conversão (pedidos ÷ cliques, usando a taxa da Shopee quando válida), ticket médio e rankings.</li>
          <li><b>Valores reservados:</b> a Shopee usa -1.000.000 para "sem dado" (inclusive em variações). Esses valores são descartados, nunca viram zero. Em Shopee Ads só o GMV do resumo é válido; pedidos, cliques e ROAS não vêm desta API (veja Histórico Ads).</li>
          <li><b>Zero real:</b> uma fonte com GMV 0 e 0 pedidos é exibida como zero; fonte sem dados é exibida como indisponível.</li>
          <li><b>Limitações:</b> fontes podem se sobrepor (ex.: Ads dentro de Card/Busca), então não há total geral; taxas pequenas só entram em rankings com amostra mínima.</li>
          {trafficErrors.length>0&&<li><b>Erros da coleta:</b> {trafficErrors.map(e=>(e.source||'')+': '+(e.error||e.message||'')).join(' · ').slice(0,600)}</li>}
        </ul>
      </div>
    </details>
  </div>;
}
