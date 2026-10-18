'use client';

// Funil da Loja redesenhado como "consultor de conversão".
// Hierarquia: Diagnóstico → Funil interativo → Plano de Destrave → Indicadores → Evolução/Pós-venda/Fonte.
// Toda a lógica de decisão vive em app/lib/funnel-store-diagnosis.js (testada). Aqui só há apresentação.

import Link from 'next/link';
import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {
  FUNNEL_STAGES,FUNNEL_TRANSITIONS,THRESHOLDS,transitionById,stageByKey,
  diagnoseStore,rankProductsForStage,previousPeriodLabel
} from '../lib/funnel-store-diagnosis';
import styles from './overview.module.css';

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');
const pct=v=>num(v)==null?'—':(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const signedPct=v=>num(v)==null?'—':(Number(v)>=0?'+':'')+(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const arr=v=>Array.isArray(v)?v:[];
const val=x=>num(x?.value??x);
// Imagem neutra embutida: /favicon.ico não existe em public/ e, como src de fallback, gerava um laço de 404.
export const IMAGE_PLACEHOLDER="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#eaf0f6"/><path d="M12 33l8-9 6 6 4-4 6 7z" fill="#b9c8d8"/><circle cx="31" cy="18" r="3.5" fill="#b9c8d8"/></svg>');
export const imageFallback=e=>{const img=e.currentTarget;if(img.dataset.fallback)return;img.dataset.fallback='1';img.src=IMAGE_PLACEHOLDER};
const scrollToId=id=>{try{document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}catch{}};

/* ───────── Ícones (SVG inline, sem dependência externa) ───────── */
const ICONS={
  eye:<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  cursor:<path d="M5 3l14 7-6 2-2 6z"/>,
  users:<><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 010 5.6M21 20c0-2.6-1.6-4.8-4-5.7"/></>,
  cart:<><path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></>,
  package:<><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/></>,
  card:<><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/></>,
  check:<path d="M4 12.5l5 5L20 6.5"/>,
  alert:<><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></>,
  chart:<path d="M3 20h18M6 16V9m6 7V5m6 11v-6"/>,
  help:<><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.5a2.8 2.8 0 015.4 1c0 1.8-2.6 2.2-2.6 4M12 17.8v.01"/></>,
  list:<><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></>,
  refresh:<><path d="M20 11a8 8 0 00-14-4l-2 2"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0014 4l2-2"/><path d="M20 20v-5h-5"/></>,
  clock:<><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/></>,
  info:<><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.01"/></>,
  chevron:<path d="M6 9l6 6 6-6"/>,
  funnel:<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>,
  store:<><path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/><path d="M5 12v8h14v-8"/></>,
  traffic:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  ads:<><path d="M3 11v3a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1z"/><path d="M17 9a4 4 0 010 6"/></>,
  target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></>,
  cancel:<><circle cx="12" cy="12" r="9.5"/><path d="M8 8l8 8M16 8l-8 8"/></>,
  returned:<><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></>,
  shield:<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/>,
  external:<><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></>,
  arrow:<path d="M5 12h14M13 6l6 6-6 6"/>,
  search:<><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></>,
  live:<><circle cx="12" cy="12" r="2.2"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.5 4.5a10.5 10.5 0 000 15M19.5 4.5a10.5 10.5 0 010 15"/></>,
  play:<><circle cx="12" cy="12" r="9.5"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/></>
};
export function Icon({name,size=18,className}){
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICONS[name]||ICONS.info}</svg>;
}

/* ───────── Tooltip acessível (hover, foco, toque e Esc) ───────── */
export function InfoTip({label,children,align:preferred='center'}){
  const id=useId();
  const [hover,setHover]=useState(false);
  const [pinned,setPinned]=useState(false);
  const [align,setAlign]=useState(preferred);
  const ref=useRef(null);
  const open=hover||pinned;
  useEffect(()=>{
    if(!pinned)return;
    const onDown=e=>{if(ref.current&&!ref.current.contains(e.target))setPinned(false)};
    const onKey=e=>{if(e.key==='Escape')setPinned(false)};
    document.addEventListener('pointerdown',onDown);document.addEventListener('keydown',onKey);
    return()=>{document.removeEventListener('pointerdown',onDown);document.removeEventListener('keydown',onKey)};
  },[pinned]);
  // Mantém o balão dentro da tela (principalmente no celular).
  useLayoutEffect(()=>{
    if(!open||!ref.current)return;
    const r=ref.current.getBoundingClientRect(),half=150,w=window.innerWidth;
    setAlign(r.left+r.width/2+half>w-8?'right':r.left+r.width/2-half<8?'left':preferred);
  },[open,preferred]);
  return <span className={styles.tip} ref={ref}
    onPointerEnter={e=>{if(e.pointerType==='mouse')setHover(true)}}
    onPointerLeave={e=>{if(e.pointerType==='mouse')setHover(false)}}>
    <button type="button" className={styles.tipBtn} aria-label={'Ajuda: '+label} aria-expanded={open} aria-describedby={open?id:undefined}
      onClick={e=>{e.stopPropagation();setPinned(v=>!v)}}
      onFocus={e=>{if(e.currentTarget.matches(':focus-visible'))setHover(true)}} onBlur={()=>setHover(false)}
      onKeyDown={e=>{if(e.key==='Escape'){setPinned(false);setHover(false)}}}>
      <Icon name="help" size={15}/>
    </button>
    {open&&<span role="tooltip" id={id} className={styles.tipBox} data-align={align}><b>{label}</b>{children}</span>}
  </span>;
}

/* ───────── Selos de status: ícone + rótulo + critério (cor nunca é o único sinal) ───────── */
const LEVELS={
  bad:{label:'Prioridade alta',icon:'alert'},
  warn:{label:'Atenção',icon:'alert'},
  good:{label:'Dentro da referência',icon:'check'},
  data:{label:'Dados insuficientes',icon:'help'},
  info:{label:'Apenas informativo',icon:'info'}
};
export function StatusPill({level='data',label}){
  const meta=LEVELS[level]||LEVELS.data;
  return <span className={styles.pill} data-level={level}><Icon name={meta.icon} size={14}/>{label||meta.label}</span>;
}
function criteriaText(e){
  const lag=Math.round(THRESHOLDS.laggardRatio*100);
  if(e.kind!=='conversion')return 'Cliques e visitantes vêm de fontes diferentes; não há critério de gargalo para esta relação.';
  if(e.level==='data')return e.reason||'Sem dados suficientes para comparar.';
  const loss=Math.round((e.shortfall||0)*100);
  return `Cálculo: em ${e.productCount} anúncios com volume suficiente, a mediana é ${pct(e.reference)}. Ponderando pelo volume, os anúncios ficam em média ${loss}% abaixo dessa mediana (alta ≥ ${Math.round(THRESHOLDS.badShortfall*100)}%, atenção ≥ ${Math.round(THRESHOLDS.warnShortfall*100)}%). ${e.laggards.length} anúncio(s) ficam abaixo de ${lag}% da mediana. Referência = seus próprios anúncios, não um benchmark da Shopee.`;
}

/* ───────── 1. Diagnóstico principal ───────── */
function heroFact(e,t,totals){
  const parts=[];
  const from=stageByKey(t.from)?.label,to=stageByKey(t.to)?.label;
  if(e.rate!=null&&e.rate>=0&&e.rate<=1)parts.push(`${from} → ${to}: ${pct(e.rate)} de passagem (${int(totals[t.to])} de ${int(totals[t.from])}).`);
  parts.push(`Entre ${e.productCount} anúncios com volume suficiente, a mediana é ${pct(e.reference)}. ${e.laggards.length} deles ficam abaixo de ${Math.round(THRESHOLDS.laggardRatio*100)}% dessa mediana e concentram ${pct(e.laggardShare)} do volume desta etapa.`);
  return parts.join(' ');
}

function ReliabilityNote({diag}){
  const r=diag.reliability;
  if(!r.partialBase)return null;
  return <p className={styles.reliability} role="note"><Icon name="info" size={15}/>Base parcial: {r.productsReceived!=null?`${int(r.productsReceived)} anúncios chegaram`:'alguns anúncios não chegaram'}{r.productsExpected!=null?` de ${int(r.productsExpected)} informados pela Shopee`:''}{r.failedPages>0?` (${r.failedPages} página(s) do ranking falharam)`:''}. A comparação pode mudar quando a coleta for completada.</p>;
}

function DiagnosisHero({diag,model,periodMeta,onViewProducts,onViewPlan}){
  const {state,primary}=diag;
  const t=primary?transitionById(primary.id):null;
  const watch=diag.watch;
  const worsened=diag.trends.filter(x=>x.verdict==='worse');
  const level=state==='bottleneck'?primary.level:state==='healthy'?'good':'data';
  const heading=state==='bottleneck'
    ?`Maior gargalo: ${stageByKey(t.from).label} → ${stageByKey(t.to).label}`
    :state==='healthy'?'Nenhuma etapa está claramente abaixo da referência'
    :'Ainda não dá para apontar o gargalo da loja';
  return <section className={styles.hero} data-level={level} aria-labelledby="funil-hero-title">
    <header className={styles.heroHead}>
      <span className={styles.heroIcon}><Icon name={state==='bottleneck'?'target':state==='healthy'?'shield':'help'} size={26}/></span>
      <div>
        <span className={styles.eyebrow}>Principal ponto de atenção · {periodMeta.label}</span>
        <h2 id="funil-hero-title">{heading}</h2>
        {state==='bottleneck'&&<p className={styles.heroLead}>{t.per100(primary.rate!=null&&primary.rate<=1?primary.rate:null)}</p>}
        {state==='healthy'&&<p className={styles.heroLead}>Os anúncios com volume suficiente estão próximos da mediana da própria loja em todas as etapas comparáveis.{watch?` Para acompanhar: ${stageByKey(watch.from).label} → ${stageByKey(watch.to).label}.`:''}</p>}
        {state==='insufficient'&&<p className={styles.heroLead}>Faltam anúncios com volume suficiente, ou etapas coletadas, para comparar com segurança. O Gestor não vai apontar um gargalo sem evidência.</p>}
      </div>
      <div className={styles.heroBadge}>
        <StatusPill level={level}/>
        {state==='bottleneck'&&<InfoTip label="Como a prioridade foi calculada" align="right">{criteriaText(primary)}</InfoTip>}
      </div>
    </header>

    {state==='bottleneck'&&<div className={styles.triad}>
      <article data-kind="fact"><span className={styles.kindTag}><Icon name="check" size={13}/>Fato identificado</span><p>{heroFact(primary,t,model.totals)}</p></article>
      <article data-kind="cause"><span className={styles.kindTag}><Icon name="help" size={13}/>Possível causa · hipótese</span><ul>{t.causes.slice(0,3).map((c,i)=><li key={i}>{c}</li>)}</ul><small>Hipóteses para investigar; o Gestor ainda não comprovou nenhuma delas.</small></article>
      <article data-kind="action"><span className={styles.kindTag}><Icon name="list" size={13}/>Ação sugerida</span><p>{t.steps[0]}</p><small>Faça um teste por vez e acompanhe a mesma métrica no mesmo período.</small></article>
    </div>}

    {state==='bottleneck'&&<div className={styles.heroFoot}>
      <details className={styles.origin}>
        <summary>De onde veio esta recomendação <Icon name="chevron" size={14}/></summary>
        <ul>
          <li><b>Métrica:</b> {stageByKey(t.from).label} → {stageByKey(t.to).label} por anúncio, a partir do ranking de produtos das Informações Gerenciais da Shopee ({periodMeta.label}).</li>
          <li><b>Referência:</b> mediana dos seus {primary.productCount} anúncios com volume suficiente ({pct(primary.reference)}). É um cálculo do Gestor, não um benchmark oficial.</li>
          <li><b>Priorização:</b> o gargalo não é a menor porcentagem; é a etapa em que os anúncios mais ficam abaixo da referência, ponderando pelo volume.</li>
          <li><b>Hipóteses:</b> causas e ações são conhecimento geral de conversão, não foram verificadas na sua loja.</li>
        </ul>
      </details>
      <div className={styles.heroActions}>
        <button type="button" className={styles.primaryBtn} onClick={onViewPlan}><Icon name="list" size={16}/>Ver o que fazer primeiro</button>
        <button type="button" className={styles.ghostBtn} onClick={()=>onViewProducts('',{stage:primary.id})}>Ver anúncios desta etapa <Icon name="arrow" size={15}/></button>
      </div>
    </div>}

    {worsened.length>0&&<p className={styles.alsoWatch}><Icon name="alert" size={15}/><b>Também observe:</b> {worsened.map(x=>`${x.label} ${signedPct(x.value)}`).join(' · ')} em relação ao período anterior.</p>}
    <ReliabilityNote diag={diag}/>
  </section>;
}

/* ───────── 2. Funil visual interativo + detalhe ───────── */
function stageLevelOf(diag,stageKey){
  // Nível da passagem que ENTRA na etapa (a primeira etapa não tem entrada).
  const ev=diag.evaluated.find(e=>e.to===stageKey&&e.kind==='conversion');
  return ev?ev.level:null;
}

function FunnelVisual({model,diag,selected,onSelect:setSelection}){
  const {totals,sources}=model;
  // Em telas estreitas o detalhe fica abaixo do funil; leva o usuário até ele depois do toque.
  const onSelect=s=>{setSelection(s);try{if(window.matchMedia('(max-width:1180px)').matches)setTimeout(()=>scrollToId('funil-detalhe'),60)}catch{}};
  return <section className={styles.explorer} aria-label="Funil da loja">
    <div className={styles.explorerFunnel}>
      <div className={styles.sectionTitle}><span><Icon name="funnel" size={18}/></span><div><h2>Funil da Loja</h2><p>Toque ou clique numa etapa ou numa passagem para ver o significado, a origem do número e o que verificar.</p></div></div>
      <ol className={styles.stageList}>
        {FUNNEL_STAGES.map((stage,index)=>{
          const value=totals[stage.key];
          const prev=index>0?FUNNEL_TRANSITIONS.find(t=>t.to===stage.key):null;
          const ev=prev?diag.evaluated.find(e=>e.id===prev.id):null;
          const isRatio=prev?.kind==='ratio';
          const validRate=ev&&ev.rate!=null&&ev.rate>=0&&ev.rate<=1;
          const isSel=selected.type==='stage'&&selected.id===stage.key;
          return <li key={stage.key}>
            {prev&&<div className={styles.hop} data-ratio={isRatio?'true':'false'}>
              <button type="button" className={styles.hopBtn} aria-pressed={selected.type==='transition'&&selected.id===prev.id}
                data-primary={diag.primary?.id===prev.id?'true':'false'} onClick={()=>onSelect({type:'transition',id:prev.id})}
                aria-label={`${stageByKey(prev.from).label} para ${stageByKey(prev.to).label}`}>
                <Icon name="arrow" size={13}/>
                {isRatio
                  ?<span className={styles.hopText}>{ev.rate!=null?pct(ev.rate)+' ':''}<em>relação entre fontes · não é conversão</em></span>
                  :<span className={styles.hopText}>{validRate?pct(ev.rate):'—'} <em>passam</em></span>}
                {!isRatio&&<StatusPill level={ev?.level||'data'} label={ev?.level==='bad'?'Prioridade alta':ev?.level==='warn'?'Atenção':ev?.level==='good'?'Na referência':'Sem referência'}/>}
                {diag.primary?.id===prev.id&&<span className={styles.primaryTag}>Maior gargalo</span>}
              </button>
            </div>}
            <div className={styles.stage} data-index={index} data-missing={value==null?'true':'false'} data-selected={isSel?'true':'false'}>
              <button type="button" className={styles.stageBtn} aria-pressed={isSel} onClick={()=>onSelect({type:'stage',id:stage.key})}>
                <span className={styles.stageBar}><Icon name={stage.icon} size={17}/><span>{stage.label}</span></span>
                <strong>{int(value)}</strong>
              </button>
              <InfoTip label={stage.label} align="left">{stage.definition} <i>{stage.note}</i>{sources?.[stage.key]?<> <i>Origem: {sources[stage.key]}.</i></>:null}</InfoTip>
            </div>
          </li>;
        })}
      </ol>
      <p className={styles.legend}><Icon name="info" size={14}/>O formato do funil é ilustrativo: as larguras não são proporcionais aos volumes, porque algumas etapas vêm de fontes e unidades diferentes (eventos, pessoas e pedidos).</p>
    </div>
    <StageDetail model={model} diag={diag} selected={selected}/>
  </section>;
}

function StageDetail({model,diag,selected}){
  const {totals,sources}=model;
  if(selected.type==='stage'){
    const stage=stageByKey(selected.id);
    const incoming=FUNNEL_TRANSITIONS.find(t=>t.to===stage.key);
    const outgoing=FUNNEL_TRANSITIONS.find(t=>t.from===stage.key&&t.kind==='conversion');
    const inEv=incoming&&diag.evaluated.find(e=>e.id===incoming.id);
    const outEv=outgoing&&diag.evaluated.find(e=>e.id===outgoing.id);
    return <aside className={styles.detail} id="funil-detalhe" aria-live="polite">
      <span className={styles.detailKicker}><Icon name={stage.icon} size={15}/>Etapa</span>
      <h3>{stage.label}</h3>
      <div className={styles.bigNumber}>{int(totals[stage.key])}<small>{stage.unit}</small></div>
      <p>{stage.definition}</p>
      <dl className={styles.facts}>
        <div><dt>Origem do número</dt><dd>{sources?.[stage.key]||'Não coletado neste período'}</dd></div>
        <div><dt>Unidade</dt><dd>{stage.note}</dd></div>
        {inEv&&<div><dt>Passagem que chega aqui</dt><dd>{inEv.kind==='ratio'?'Relação entre fontes diferentes (não é conversão)':inEv.rate!=null&&inEv.rate<=1?pct(inEv.rate)+' da etapa anterior':'Não calculável'}</dd></div>}
        {outEv&&<div><dt>Passagem para a próxima</dt><dd>{outEv.rate!=null&&outEv.rate<=1?pct(outEv.rate):'Não calculável'}</dd></div>}
      </dl>
      {totals[stage.key]==null&&<p className={styles.missing}>Este número não foi coletado no período. Ele aparece como “—” e não é tratado como zero.</p>}
    </aside>;
  }
  const t=transitionById(selected.id);
  const ev=diag.evaluated.find(e=>e.id===t.id);
  const from=stageByKey(t.from),to=stageByKey(t.to);
  const valid=ev.rate!=null&&ev.rate>=0&&ev.rate<=1;
  return <aside className={styles.detail} id="funil-detalhe" aria-live="polite" data-level={ev.level}>
    <span className={styles.detailKicker}><Icon name={t.icon} size={15}/>{t.kind==='ratio'?'Relação entre métricas':'Passagem entre etapas'}</span>
    <h3>{from.label} → {to.label}</h3>
    {t.kind==='conversion'
      ?<><div className={styles.bigNumber}>{valid?pct(ev.rate):'—'}<small>{t.kpiLabel}</small></div><StatusPill level={ev.level}/></>
      :<div className={styles.bigNumber}>{ev.rate!=null?pct(ev.rate):'—'}<small>visitantes ÷ cliques</small></div>}
    <p>{t.per100(valid?ev.rate:null)}</p>
    <p className={styles.small}>{t.detail}</p>
    {t.kind==='ratio'&&ev.exceeds&&<p className={styles.noteBox} role="note"><Icon name="info" size={15}/>Os visitantes ({int(totals.visitors)}) superam os cliques ({int(totals.clicks)}). Isso é esperado: são populações diferentes, e o Gestor não corrige nem trata isso como taxa de conversão.</p>}
    {t.kind==='conversion'&&<dl className={styles.facts}>
      <div><dt>Volume de entrada</dt><dd>{int(totals[t.from])} {from.label.toLowerCase()}</dd></div>
      <div><dt>Referência dos seus anúncios</dt><dd>{ev.reference!=null?`${pct(ev.reference)} (mediana de ${ev.productCount} anúncios)`:'Sem referência suficiente'}</dd></div>
      <div><dt>Leitura da cor</dt><dd>{criteriaText(ev)}</dd></div>
      {t.comparable==='cross'&&<div><dt>Atenção</dt><dd>Numerador e denominador vêm de fontes ou unidades diferentes; leitura aproximada.</dd></div>}
    </dl>}
    {t.kind==='conversion'&&t.causes.length>0&&<div className={styles.hypo}><b>Hipóteses a investigar</b><ul>{t.causes.map((c,i)=><li key={i}>{c}</li>)}</ul></div>}
  </aside>;
}

/* ───────── 3. Plano de Destrave ───────── */
export function GuidanceSwitch({mode,onChange,compact=false}){
  return <div className={styles.guidance} data-compact={compact} role="group" aria-label="Modo de orientação">
    <span className={styles.guidanceLabel}>Como você quer ler as sugestões?</span>
    <div className={styles.segmented}>
      <button type="button" data-active={mode==='standard'} aria-pressed={mode==='standard'} onClick={()=>onChange('standard')}><Icon name="chart" size={15}/><b>Visão resumida</b><small>Padrão · oportunidades e recomendações</small></button>
      <button type="button" data-active={mode==='specific'} aria-pressed={mode==='specific'} onClick={()=>onChange('specific')}><Icon name="list" size={15}/><b>Passo a passo</b><small>Específico · me diga o que fazer</small></button>
    </div>
  </div>;
}

function StartProductCard({item,index,t,ref_,ctx,plan,onOpen,detailed}){
  const {p,rate,base}=item;
  const title=p.name||ctx?.title||('Anúncio '+p.id);
  const gapPoints=ref_!=null?Math.max(0,ref_-rate):null;
  const relBelow=ref_>0?Math.max(0,1-rate/ref_):null;
  return <article className={styles.startCard}>
    <header>
      <em>{index+1}</em>
      <img src={p.image||ctx?.image||IMAGE_PLACEHOLDER} alt="" onError={imageFallback}/>
      <div><b title={title}>{title}</b><small>ID {p.id}</small></div>
    </header>
    <div className={styles.meter} role="img" aria-label={`Taxa do anúncio ${pct(rate)}; referência ${pct(ref_)}`}>
      <div className={styles.meterTrack}><span style={{width:Math.min(100,(ref_>0?rate/ref_:0)*100)+'%'}}/></div>
      <div className={styles.meterText}><span>Este anúncio <b>{pct(rate)}</b></span><span>Referência <b>{pct(ref_)}</b></span></div>
    </div>
    <p className={styles.reason}><span className={styles.kindTag} data-kind="fact"><Icon name="check" size={12}/>Fato</span>{relBelow!=null&&relBelow>0?`${Math.round(relBelow*100)}% abaixo da mediana dos seus anúncios`:'Sem folga relevante contra a mediana'} · {int(base)} na entrada da etapa.</p>
    <p className={styles.reason}><span className={styles.kindTag} data-kind="action"><Icon name="list" size={12}/>Ação sugerida</span>{plan?.actions?.[0]||t.steps[0]}</p>
    {detailed&&plan&&<p className={styles.reason}><span className={styles.kindTag} data-kind="cause"><Icon name="help" size={12}/>Leitura do anúncio · hipótese</span>{plan.title}. {plan.evidence}</p>}
    {!ctx&&<small className={styles.warnText}>Sem Super Análise: o Gestor não cruza concorrentes, preço e margem para este anúncio.</small>}
    <footer>
      <button type="button" className={styles.primaryBtn} onClick={()=>onOpen(String(p.id),{stage:t.id})}>Abrir produto no Funil <Icon name="arrow" size={14}/></button>
      {ctx&&<button type="button" className={styles.ghostBtn} onClick={()=>onOpen(String(p.id),{stage:t.id,mode:'specific'})}>Abrir plano específico</button>}
      {ctx?<Link className={styles.linkBtn} href={`/super-analise?item_id=${encodeURIComponent(p.id)}${ctx.reportId?`&report_id=${encodeURIComponent(ctx.reportId)}`:''}`}>Super Análise <Icon name="external" size={13}/></Link>
        :<Link className={styles.linkBtn} href="/super-analise">Fazer Super Análise <Icon name="external" size={13}/></Link>}
    </footer>
  </article>;
}

function UnlockPlan({model,diag,context,guidanceMode,onChooseGuidance,onOpenProduct,resolvePlan,topProductCard}){
  const t=diag.primary?transitionById(diag.primary.id):null;
  const [done,setDone]=useState({});
  const [showAll,setShowAll]=useState(false);
  const detailed=guidanceMode==='specific';
  const ranking=useMemo(()=>t?rankProductsForStage(model.products,t.id,6):{ranked:[],reference:null},[t?.id,model.products]);
  const visible=showAll?ranking.ranked:ranking.ranked.slice(0,3);
  useEffect(()=>{setDone({});setShowAll(false)},[t?.id]);
  return <section className={styles.plan} id="funil-plano" aria-labelledby="funil-plano-title">
    <header className={styles.planHead}>
      <div className={styles.sectionTitle}><span><Icon name="list" size={18}/></span><div><h2 id="funil-plano-title">Plano de Destrave</h2><p>O que fazer agora para melhorar suas vendas, em ordem de prioridade.</p></div></div>
      <GuidanceSwitch mode={guidanceMode} onChange={onChooseGuidance} compact/>
    </header>

    {t?<>
      <div className={styles.priorityCard}>
        <span className={styles.priorityNum}>1</span>
        <div>
          <small>PRIORIDADE Nº 1 · {stageByKey(t.from).label} → {stageByKey(t.to).label}</small>
          <h3>{t.title}</h3>
          <p>{detailed&&<b>Por que isso é importante? </b>}{t.why}</p>
        </div>
      </div>
      {detailed
        ?<div className={styles.stepsBox}>
          <strong>Faça nesta ordem <small>(marcação local, só para você acompanhar — não é salva)</small></strong>
          <ol>{t.steps.map((step,i)=><li key={i} data-done={!!done[i]}><label><input type="checkbox" checked={!!done[i]} onChange={e=>setDone(d=>({...d,[i]:e.target.checked}))}/><span className={styles.stepNo}>{i+1}</span><p>{step}</p></label></li>)}</ol>
          <p className={styles.noteBox} role="note"><Icon name="info" size={15}/>Depois de mexer, volte aqui e compare a mesma passagem no mesmo período. Mudanças podem levar dias para aparecer.</p>
        </div>
        :<div className={styles.stepsCompact}><span className={styles.kindTag} data-kind="action"><Icon name="list" size={12}/>Primeira ação</span><p>{t.steps[0]}</p></div>}

      <div className={styles.startHead}>
        <div><strong>Produtos para começar</strong><small>Ordenados pela maior distância para a mediana dos seus anúncios, ponderada pelo volume da etapa. Não é previsão de vendas.</small></div>
        <button type="button" className={styles.linkText} onClick={()=>onOpenProduct('',{stage:t.id})}>Ver todos no Funil por Produto <Icon name="arrow" size={14}/></button>
      </div>
      {visible.length
        ?<div className={styles.startGrid} data-detailed={detailed?"true":"false"}>{visible.map((item,i)=>{
          const ctx=context?.[String(item.p.id)]||null;
          return <StartProductCard key={item.p.id} item={item} index={i} t={t} ref_={ranking.reference} ctx={ctx} plan={ctx?resolvePlan(item.p):null} onOpen={onOpenProduct} detailed={detailed}/>;
        })}</div>
        :<p className={styles.empty}>Nenhum anúncio tem dados suficientes nesta etapa para ser sugerido.</p>}
      {ranking.ranked.length>3&&<button type="button" className={styles.expandBtn} onClick={()=>setShowAll(v=>!v)} aria-expanded={showAll}>{showAll?'Mostrar menos':`Mostrar mais ${ranking.ranked.length-3} anúncio(s)`}<Icon name="chevron" size={14}/></button>}
    </>:<div className={styles.priorityCard} data-quiet="true">
      <span className={styles.priorityNum}><Icon name={diag.state==='healthy'?'shield':'help'} size={18}/></span>
      <div>
        <small>{diag.state==='healthy'?'SEM PRIORIDADE URGENTE':'AGUARDANDO DADOS'}</small>
        <h3>{diag.state==='healthy'?'Mantenha o que funciona e acompanhe a evolução':'Atualize a coleta antes de agir'}</h3>
        <p>{diag.state==='healthy'?'Nenhuma etapa ficou claramente abaixo da referência dos seus anúncios. Evite mudanças grandes sem motivo e use os anúncios mais fortes como modelo.':'Sem evidências suficientes, o Gestor não recomenda mexer em anúncios. Use “Atualizar agora” ou consulte Configurações → Saúde do Sistema.'}</p>
      </div>
    </div>}

    {topProductCard&&<details className={styles.topProduct}>
      <summary><span>Diagnóstico completo do anúncio de maior prioridade</span><Icon name="chevron" size={15}/></summary>
      {topProductCard}
    </details>}
    <p className={styles.planFoot}><Icon name="shield" size={14}/>Nenhuma alteração de preço, anúncio ou campanha é aplicada automaticamente. Ações sugeridas são testes para você decidir e executar.</p>
  </section>;
}

/* ───────── 4. Indicadores e comparação ───────── */
function KpiStrip({model,diag,onSelect}){
  const cards=FUNNEL_TRANSITIONS.filter(t=>t.kind==='conversion');
  return <section className={styles.block} aria-labelledby="funil-kpis">
    <div className={styles.sectionTitle}><span><Icon name="chart" size={18}/></span><div><h2 id="funil-kpis">Indicadores de conversão</h2><p>Cada taxa em linguagem simples. A referência é a mediana dos seus próprios anúncios.</p></div></div>
    <div className={styles.kpiGrid}>{cards.map(t=>{
      const ev=diag.evaluated.find(e=>e.id===t.id);
      const valid=ev.rate!=null&&ev.rate>=0&&ev.rate<=1;
      return <article key={t.id} className={styles.kpi} data-level={ev.level} data-primary={diag.primary?.id===t.id?'true':'false'}>
        <header><span className={styles.kpiIcon}><Icon name={t.icon} size={17}/></span><b>{t.kpiLabel}</b><InfoTip label={t.kpiLabel} align="right">{t.detail}</InfoTip></header>
        <strong>{valid?pct(ev.rate):'—'}</strong>
        <p>{t.per100(valid?ev.rate:null)}</p>
        <footer><StatusPill level={ev.level}/>{ev.reference!=null&&<small>Referência {pct(ev.reference)}</small>}</footer>
        <button type="button" className={styles.kpiLink} onClick={()=>onSelect({type:'transition',id:t.id})}>Ver no funil</button>
      </article>;
    })}</div>
    {model.totals.visitors!=null&&model.totals.clicks!=null&&<p className={styles.noteBox} role="note"><Icon name="info" size={15}/>Cliques ({int(model.totals.clicks)}) e visitantes ({int(model.totals.visitors)}) são métricas de fontes diferentes: não formam uma etapa contínua e por isso não aparecem como taxa de conversão.</p>}
  </section>;
}

function ComparisonStrip({diag,model,periodId}){
  const fmt=(m,v)=>m.format==='money'?money(v):int(v);
  return <section className={styles.block} aria-labelledby="funil-comp">
    <div className={styles.sectionTitle}><span><Icon name="clock" size={18}/></span><div><h2 id="funil-comp">Comparação com o período anterior</h2><p>Referência: {previousPeriodLabel(periodId)}.</p></div></div>
    <div className={styles.compGrid}>{diag.trends.map(m=><article key={m.key} data-verdict={m.verdict}>
      <span>{m.label}</span>
      <b>{fmt(m,model.totals[m.totalKey])}</b>
      <div><em>{signedPct(m.value)}</em><StatusPill level={m.verdict==='better'?'good':m.verdict==='worse'?'bad':m.verdict==='stable'?'info':'data'} label={m.verdictLabel}/></div>
    </article>)}</div>
    {diag.trends.every(m=>m.value==null)&&<p className={styles.empty}>A Shopee não enviou variação do período anterior para esta coleta. Nenhuma comparação foi estimada.</p>}
    <small className={styles.hint}>“Melhora” e “piora” consideram que, para estes quatro indicadores, aumentar é melhor. Variações abaixo de {Math.round(THRESHOLDS.changeNoticeable*100)}% aparecem como estáveis.</small>
  </section>;
}

/* ───────── 5. Evolução do Funil ───────── */
const SERIES=[
  {key:'uv',label:'Visitantes',agg:'avg'},
  {key:'atc_uv',label:'Carrinho',agg:'avg'},
  {key:'placed_order',label:'Pedidos',agg:'sum'},
  {key:'paid_order',label:'Pagos',agg:'sum'},
  {key:'confirmed_order',label:'Confirmados',agg:'sum'}
];
function pointDate(point,index,total){
  const raw=point?.date??point?.day??point?.time??point?.timestamp??point?.ts??point?.label??null;
  if(raw==null)return `Dia ${index+1} de ${total}`;
  const n=Number(raw);
  const d=Number.isFinite(n)&&n>1e8?new Date(n<1e12?n*1000:n):new Date(raw);
  return Number.isNaN(d.getTime())?String(raw):d.toLocaleDateString('pt-BR');
}
function seriesOf(points){
  const list=arr(points).map(x=>({raw:x,value:num(x?.value)}));
  const known=list.filter(x=>x.value!=null);
  return{list,known,missing:list.length-known.length};
}
function Spark({points,height=44,big=false,active,onActive}){
  const {list,known}=seriesOf(points);
  if(known.length<2)return <span className={styles.sparkEmpty}>Sem série</span>;
  const vals=known.map(x=>x.value),min=Math.min(0,...vals),max=Math.max(...vals),span=max-min||1;
  const W=100,H=40,pad=4;
  const x=i=>list.length>1?(i/(list.length-1))*W:W/2;
  const y=v=>H-pad-((v-min)/span)*(H-pad*2);
  // Dias sem dado quebram a linha (≠ zero, que desenha a linha em 0).
  const segs=[];let cur=[];
  list.forEach((p,i)=>{if(p.value==null){if(cur.length)segs.push(cur);cur=[]}else cur.push(`${x(i)},${y(p.value)}`)});
  if(cur.length)segs.push(cur);
  return <svg className={styles.spark} data-big={big} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
    {big&&<line x1="0" x2={W} y1={y(0)} y2={y(0)} className={styles.sparkBase}/>}
    {segs.map((s,i)=>s.length>1?<polyline key={i} points={s.join(' ')}/>:<circle key={i} cx={s[0].split(',')[0]} cy={s[0].split(',')[1]} r="1.2"/>)}
    {big&&active!=null&&list[active]?.value!=null&&<circle className={styles.sparkDot} cx={x(active)} cy={y(list[active].value)} r="1.8"/>}
  </svg>;
}
function TrendPanel({trends,periodLabel}){
  const [expanded,setExpanded]=useState(false);
  const [metric,setMetric]=useState('paid_order');
  const [active,setActive]=useState(null);
  const available=SERIES.filter(s=>seriesOf(trends?.[s.key]).known.length>1);
  if(!available.length)return null;
  const current=available.find(s=>s.key===metric)||available[0];
  const ser=seriesOf(trends?.[current.key]);
  const summary=s=>{const {known}=seriesOf(trends?.[s.key]);const total=known.reduce((a,x)=>a+x.value,0);return s.agg==='sum'?{label:'Total dos dias',value:total}:{label:'Média por dia',value:known.length?total/known.length:null}};
  const activePoint=active!=null?ser.list[active]:null;
  const onKey=e=>{
    if(e.key==='ArrowRight')setActive(a=>Math.min(ser.list.length-1,(a??-1)+1));
    else if(e.key==='ArrowLeft')setActive(a=>Math.max(0,(a??ser.list.length)-1));
    else if(e.key==='Escape')setActive(null);
    else return;
    e.preventDefault();
  };
  const onMove=e=>{
    const r=e.currentTarget.getBoundingClientRect();
    if(!r.width)return;
    setActive(Math.max(0,Math.min(ser.list.length-1,Math.round(((e.clientX-r.left)/r.width)*(ser.list.length-1)))));
  };
  return <section className={styles.block} aria-labelledby="funil-evo">
    <div className={styles.sectionTitle}>
      <span><Icon name="chart" size={18}/></span>
      <div><h2 id="funil-evo">Evolução do Funil</h2><p>Série diária enviada pela Shopee · {periodLabel}. Dias sem informação aparecem como lacuna, nunca como zero.</p></div>
      <button type="button" className={styles.ghostBtn} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Mostrar resumo':'Ver gráficos completos'}<Icon name="chevron" size={14}/></button>
    </div>
    {!expanded?<div className={styles.sparkGrid}>{available.map(s=>{const sm=summary(s);const {missing}=seriesOf(trends?.[s.key]);return <article key={s.key}>
      <div><span>{s.label}</span><b>{int(sm.value)}</b></div>
      <Spark points={trends?.[s.key]}/>
      <small>{sm.label}{missing>0?` · ${missing} dia(s) sem dado`:''}</small>
    </article>})}</div>
    :<div className={styles.bigChart}>
      <div className={styles.metricTabs} role="tablist" aria-label="Métrica">{available.map(s=><button key={s.key} role="tab" type="button" aria-selected={current.key===s.key} data-active={current.key===s.key} onClick={()=>{setMetric(s.key);setActive(null)}}>{s.label}</button>)}</div>
      <div className={styles.chartArea} tabIndex={0} role="group" aria-label={`Gráfico diário de ${current.label}. Use as setas para percorrer os dias.`}
        onPointerMove={onMove} onPointerLeave={()=>setActive(null)} onKeyDown={onKey} onBlur={()=>setActive(null)}>
        <Spark points={trends?.[current.key]} big active={active}/>
      </div>
      <div className={styles.readout} aria-live="polite">
        {activePoint
          ?<><b>{current.label}</b> · {pointDate(activePoint.raw,active,ser.list.length)} · <strong>{activePoint.value==null?'sem dado coletado':int(activePoint.value)}</strong></>
          :<span>Passe o mouse, toque ou use as setas sobre o gráfico para ver data e valor de cada dia.</span>}
      </div>
      <p className={styles.hint}>{summary(current).label}: <b>{int(summary(current).value)}</b> · {ser.list.length} dias na série{ser.missing>0?` · ${ser.missing} sem dado`:''} · Período: {periodLabel}.{current.agg==='avg'?' Visitantes e carrinhos contam pessoas; somar os dias contaria a mesma pessoa mais de uma vez, por isso mostramos a média diária.':''}</p>
    </div>}
  </section>;
}

/* ───────── 6. Pós-venda e ocorrências (recolhível) ───────── */
function PostOrderPanel({orderPerformance}){
  const cancelledOrders=val(orderPerformance?.cancelled_orders),refundOrders=val(orderPerformance?.return_refund_orders);
  const cancelledSales=val(orderPerformance?.cancelled_sales),refundSales=val(orderPerformance?.return_refund_sales);
  if([cancelledOrders,refundOrders,cancelledSales,refundSales].every(x=>x==null))return null;
  return <details className={styles.collapse}>
    <summary><span className={styles.collapseTitle}><Icon name="returned" size={17}/>Pós-venda e ocorrências</span><span className={styles.collapseHint}>Cancelamentos e devoluções do período</span><Icon name="chevron" size={16}/></summary>
    <div className={styles.collapseBody}>
      <p className={styles.hint}>Ajuda a separar problema de anúncio de problema operacional depois do pedido.</p>
      <div className={styles.postGrid}>
        <article><span><Icon name="cancel" size={16}/>Pedidos cancelados</span><b>{int(cancelledOrders)}</b><small>{money(cancelledSales)}</small></article>
        <article><span><Icon name="returned" size={16}/>Devolução/Reembolso</span><b>{int(refundOrders)}</b><small>{money(refundSales)}</small></article>
      </div>
    </div>
  </details>;
}

/* ───────── 7. Fonte e confiabilidade (discreta e expansível) ───────── */
function SourcePanel({model,diag,periodMeta,lastUpdated}){
  const coverage=model.coverage;
  const stamp=lastUpdated?new Date(lastUpdated).toLocaleString('pt-BR'):'—';
  return <details className={styles.collapse} id="funil-fonte">
    <summary><span className={styles.collapseTitle}><Icon name="shield" size={17}/>Fonte e confiabilidade</span><span className={styles.collapseHint}>{coverage?.stageCount!=null?`${coverage.stageCount} de 7 etapas coletadas`:'Origem dos números'}</span><Icon name="chevron" size={16}/></summary>
    <div className={styles.collapseBody}>
      <dl className={styles.facts}>
        <div><dt>Origem</dt><dd>Informações Gerenciais da Shopee, coletadas pelo Motor Sênior com a sessão do Seller Center.</dd></div>
        <div><dt>Período dos dados</dt><dd>{periodMeta.label}{model.period?.type?` (informado pelo Motor: ${model.period.type})`:''}</dd></div>
        <div><dt>Última coleta concluída</dt><dd>{stamp}</dd></div>
        <div><dt>Etapas ausentes</dt><dd>{coverage?.missingStages?.length?coverage.missingStages.join(', '):'Nenhuma'}</dd></div>
      </dl>
      <div className={styles.sourceTable} role="table" aria-label="Origem de cada número">
        <div role="row" className={styles.sourceHead}><span role="columnheader">Etapa</span><span role="columnheader">Tipo</span><span role="columnheader">Origem do número</span></div>
        {FUNNEL_STAGES.map(s=><div role="row" key={s.key}><span role="cell">{s.label}</span><span role="cell">{model.sources?.[s.key]?'Oficial Shopee':'—'}</span><span role="cell">{model.sources?.[s.key]||'Não coletado'}</span></div>)}
      </div>
      <ul className={styles.limits}>
        <li><b>Oficial:</b> os volumes das etapas vêm da Shopee. <b>Cálculo do Gestor:</b> taxas, medianas, níveis de prioridade e a escolha do gargalo.</li>
        <li><b>Heurística:</b> limiares (60% da mediana; perda média de 25% e 10%) são critérios internos ajustáveis, não regras da Shopee.</li>
        <li><b>Fontes diferentes:</b> cliques (eventos), visitantes (pessoas) e pedidos (pedidos) não representam um único percurso contínuo de compradores.</li>
        <li><b>Estimativas:</b> o Gestor não preenche ausências com zero nem projeta vendas.</li>
        {diag.reliability.partialBase&&<li><b>Limitação desta coleta:</b> a base de anúncios está parcial; comparações podem mudar.</li>}
      </ul>
      {model.errors.length>0&&<details className={styles.errors}><summary>Detalhes técnicos da coleta ({model.errors.length})</summary><small>{model.errors.map(x=>(x.source||'')+': '+(x.error||x.message||'')).join(' · ').slice(0,2500)}</small></details>}
    </div>
  </details>;
}

/* ───────── Composição ───────── */
export default function StoreOverview({model,context,guidanceMode,onChooseGuidance,onOpenProduct,resolvePlan,topProductCard,periodMeta,periodId,lastUpdated}){
  const diag=useMemo(()=>diagnoseStore({totals:model.totals,rates:model.rates,products:model.products,comparison:model.comparison,evidence:model.evidence}),[model]);
  const [selected,setSelected]=useState({type:'transition',id:'ctr'});
  useEffect(()=>{setSelected(diag.primary?{type:'transition',id:diag.primary.id}:{type:'stage',id:'impressions'})},[diag.primary?.id,periodId]);
  const select=s=>{setSelected(s);scrollToId('funil-explorer')};
  return <div className={styles.root}>
    <DiagnosisHero diag={diag} model={model} periodMeta={periodMeta} onViewProducts={onOpenProduct} onViewPlan={()=>scrollToId('funil-plano')}/>
    <div id="funil-explorer"><FunnelVisual model={model} diag={diag} selected={selected} onSelect={setSelected}/></div>
    <UnlockPlan model={model} diag={diag} context={context} guidanceMode={guidanceMode} onChooseGuidance={onChooseGuidance} onOpenProduct={onOpenProduct} resolvePlan={resolvePlan} topProductCard={topProductCard}/>
    <KpiStrip model={model} diag={diag} onSelect={select}/>
    <ComparisonStrip diag={diag} model={model} periodId={periodId}/>
    <TrendPanel trends={model.trends} periodLabel={periodMeta.label}/>
    <PostOrderPanel orderPerformance={model.orderPerformance}/>
    <SourcePanel model={model} diag={diag} periodMeta={periodMeta} lastUpdated={lastUpdated}/>
  </div>;
}
