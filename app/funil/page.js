'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import styles from './funil.module.css';

const num=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=v=>num(v)==null?'—':(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const first=(obj,keys)=>{for(const k of keys){const v=obj?.[k];if(v!=null&&Number.isFinite(Number(v)))return Number(v)}return null};

async function getJson(url){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),30000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j?.error)throw new Error(j?.error||('HTTP '+r.status));
    return j;
  }finally{clearTimeout(timer)}
}

function median(values){
  const a=values.filter(v=>Number.isFinite(v)).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

function normalizeCampaign(c){
  const impressions=first(c,['impressions','impression','views','view_count']);
  const clicks=first(c,['clicks','click','click_count']);
  const carts=first(c,['addToCart','add_to_cart','addToCartCount','atc','cart','cart_count']);
  const orders=first(c,['orders','order','order_count','conversions','conversion','purchase_count']);
  const units=first(c,['itemsSold','items_sold','sold','units','sold_count']);
  const spend=first(c,['spend','cost','expense','ads_cost']);
  const gmv=first(c,['gmv','revenue','sales','sales_amount']);
  return{
    raw:c,
    name:c?.productName||c?.title||c?.campaignName||c?.name||'Campanha',
    impressions,clicks,carts,orders,units,spend,gmv,
    ctr:impressions>0&&clicks!=null?clicks/impressions:null,
    clickToOrder:clicks>0&&orders!=null?orders/clicks:null,
    cartToOrder:carts>0&&orders!=null?orders/carts:null,
    impToOrder:impressions>0&&orders!=null?orders/impressions:null
  };
}

function FunnelStep({label,value,sub,rate,tone='blue',missing=false}){
  return <div className={styles.step} data-tone={tone} data-missing={missing?'true':'false'}>
    <div className={styles.stepTop}><span>{label}</span><strong>{missing?'—':int(value)}</strong></div>
    <div className={styles.stepMeta}><small>{sub}</small>{rate!=null&&<b>{pct(rate)}</b>}</div>
  </div>
}

function Diagnostic({tone='neutral',title,body,action,href}){
  return <article className={styles.diagnostic} data-tone={tone}>
    <div className={styles.diagIcon}>{tone==='bad'?'!':tone==='good'?'✓':'→'}</div>
    <div><h3>{title}</h3><p>{body}</p>{href&&<Link href={href}>{action||'Abrir'}</Link>}</div>
  </article>
}

export default function FunilPage(){
  const [days,setDays]=useState(7);
  const [state,setState]=useState({loading:true,error:'',ads:null,orders:null});
  const load=async()=>{
    setState(s=>({...s,loading:true,error:''}));
    const [adsR,ordersR]=await Promise.allSettled([
      getJson('/api/shopee/ads?days='+days),
      getJson('/api/shopee/orders?days='+days)
    ]);
    const ads=adsR.status==='fulfilled'?(adsR.value?.v7||adsR.value?.v5||adsR.value):null;
    const orders=ordersR.status==='fulfilled'?(ordersR.value?.orders||[]):null;
    const errors=[adsR,ordersR].filter(x=>x.status==='rejected').map(x=>x.reason?.message||String(x.reason));
    setState({loading:false,error:errors.join(' · '),ads,orders});
  };
  useEffect(()=>{load()},[days]);

  const model=useMemo(()=>{
    const campaigns=Array.isArray(state.ads?.campaigns)?state.ads.campaigns.map(normalizeCampaign):[];
    const sum=key=>{const vals=campaigns.map(c=>c[key]).filter(v=>v!=null);return vals.length?vals.reduce((a,b)=>a+b,0):null};
    const totals={
      impressions:sum('impressions'),clicks:sum('clicks'),carts:sum('carts'),
      orders:sum('orders'),units:sum('units'),spend:sum('spend'),gmv:sum('gmv')
    };
    const validOrders=Array.isArray(state.orders)?state.orders.length:null;
    const ctr=totals.impressions>0&&totals.clicks!=null?totals.clicks/totals.impressions:null;
    const clickToOrder=totals.clicks>0&&totals.orders!=null?totals.orders/totals.clicks:null;
    const cartToOrder=totals.carts>0&&totals.orders!=null?totals.orders/totals.carts:null;
    const impToOrder=totals.impressions>0&&totals.orders!=null?totals.orders/totals.impressions:null;
    const medCtr=median(campaigns.map(c=>c.ctr));
    const medCvr=median(campaigns.map(c=>c.clickToOrder));
    const clickLeak=campaigns.filter(c=>c.clicks>=10&&c.orders===0).sort((a,b)=>(b.clicks||0)-(a.clicks||0));
    const weakCtr=medCtr==null?[]:campaigns.filter(c=>c.impressions>=100&&c.ctr!=null&&c.ctr<medCtr*.6).sort((a,b)=>(a.ctr??1)-(b.ctr??1));
    const weakCvr=medCvr==null?[]:campaigns.filter(c=>c.clicks>=10&&c.clickToOrder!=null&&c.clickToOrder<medCvr*.6).sort((a,b)=>(a.clickToOrder??1)-(b.clickToOrder??1));
    const healthy=campaigns.filter(c=>c.clicks>=10&&c.orders>0&&c.ctr!=null&&c.clickToOrder!=null&&(medCtr==null||c.ctr>=medCtr)&&(medCvr==null||c.clickToOrder>=medCvr)).sort((a,b)=>(b.orders||0)-(a.orders||0));
    return{campaigns,totals,validOrders,ctr,clickToOrder,cartToOrder,impToOrder,medCtr,medCvr,clickLeak,weakCtr,weakCvr,healthy};
  },[state]);

  if(state.loading)return <div className={styles.page}><div className={styles.loading}>Montando o funil com os dados disponíveis…</div></div>;

  const hasAds=model.campaigns.length>0;
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>GESTOR SÊNIOR · CONVERSÃO</span><h1>Análise de Funil</h1><p>Veja em qual etapa os clientes estão desistindo e qual parte do anúncio merece atenção primeiro.</p></div>
      <div className={styles.headerActions}>
        <select value={days} onChange={e=>setDays(Number(e.target.value))} aria-label="Período">
          <option value={7}>Últimos 7 dias</option><option value={14}>Últimos 14 dias</option><option value={30}>Últimos 30 dias</option>
        </select>
        <button type="button" onClick={load}>↻ Atualizar</button>
      </div>
    </header>

    {state.error&&<div className={styles.warning}>Algumas fontes não responderam: {state.error}. O Gestor não preenche métricas ausentes com estimativas.</div>}

    <section className={styles.hero}>
      <div><span>Leitura rápida</span><h2>{hasAds?'Seu funil de Shopee Ads':'Ainda não há dados suficientes de Ads'}</h2>
        <p>{hasAds?'O funil abaixo usa somente as etapas realmente retornadas pela Shopee no período selecionado.':'Conecte/carregue Shopee Ads para enxergar impressões, cliques e pedidos nesta tela.'}</p>
      </div>
      {model.totals.impressions>0&&model.totals.orders!=null&&<div className={styles.heroMetric}><strong>{(model.totals.orders/model.totals.impressions*1000).toLocaleString('pt-BR',{maximumFractionDigits:1})}</strong><span>pedidos a cada 1.000 impressões</span></div>}
    </section>

    <section className={styles.funnelCard}>
      <div className={styles.sectionHead}><div><h2>Funil principal</h2><p>Da exposição do anúncio até a venda atribuída.</p></div><span>{days} dias</span></div>
      <div className={styles.funnel}>
        <FunnelStep label="Impressões" value={model.totals.impressions} sub="O anúncio apareceu" tone="violet" missing={model.totals.impressions==null}/>
        <div className={styles.arrow}>→</div>
        <FunnelStep label="Cliques" value={model.totals.clicks} sub="Entraram no anúncio" rate={model.ctr} tone="blue" missing={model.totals.clicks==null}/>
        <div className={styles.arrow}>→</div>
        <FunnelStep label="Carrinho" value={model.totals.carts} sub={model.totals.carts==null?'Fonte não disponível':'Demonstraram intenção'} rate={model.totals.carts!=null&&model.totals.clicks>0?model.totals.carts/model.totals.clicks:null} tone="amber" missing={model.totals.carts==null}/>
        <div className={styles.arrow}>→</div>
        <FunnelStep label="Pedidos Ads" value={model.totals.orders} sub="Conversões atribuídas" rate={model.clickToOrder} tone="green" missing={model.totals.orders==null}/>
      </div>
      <div className={styles.rateGrid}>
        <div><span>CTR · impressão → clique</span><strong>{pct(model.ctr)}</strong><small>mede se a vitrine do anúncio consegue gerar entrada</small></div>
        <div><span>Clique → pedido</span><strong>{pct(model.clickToOrder)}</strong><small>mede se quem entra termina comprando</small></div>
        <div><span>Carrinho → pedido</span><strong>{pct(model.cartToOrder)}</strong><small>{model.cartToOrder==null?'sem dado de carrinho nesta fonte':'mede abandono depois da intenção'}</small></div>
        <div><span>Conversão total Ads</span><strong>{pct(model.impToOrder)}</strong><small>pedido atribuído em relação às impressões</small></div>
      </div>
    </section>

    <section className={styles.guide}>
      <div className={styles.sectionHead}><div><h2>Onde está vazando?</h2><p>O Gestor compara cada campanha com a mediana da sua própria conta, em vez de impor uma taxa universal.</p></div></div>
      <div className={styles.diagGrid}>
        {model.clickLeak.length>0&&<Diagnostic tone="bad" title={model.clickLeak.length+' campanha(s) recebem cliques e não geram pedido'} body={'Ex.: '+model.clickLeak.slice(0,3).map(c=>c.name+' · '+int(c.clicks)+' cliques').join(' | ')+'. Aqui vale revisar preço, frete, cupom, prova social, descrição e variações.'} action="Abrir Shopee Ads" href="/extensao-shopee-intelligence?section=shopee-ads"/>}
        {model.weakCtr.length>0&&<Diagnostic tone="warn" title={model.weakCtr.length+' campanha(s) têm CTR bem abaixo da mediana da conta'} body={'Mediana atual: '+pct(model.medCtr)+'. Sinal para revisar principalmente capa, título, preço percebido e competitividade na busca.'} action="Abrir Super Anúncio" href="/extensao-shopee-intelligence?section=super-anuncio"/>}
        {model.weakCvr.length>0&&<Diagnostic tone="warn" title={model.weakCvr.length+' campanha(s) convertem clique em pedido bem abaixo da mediana'} body={'Mediana atual: '+pct(model.medCvr)+'. O cliente entra, mas compra menos que o padrão da sua conta; investigue oferta, conteúdo, reviews, frete e variações.'} action="Ver produtos" href="/produtos"/>}
        {model.healthy.length>0&&<Diagnostic tone="good" title={model.healthy.length+' campanha(s) estão acima da mediana em clique e conversão'} body={'Use essas campanhas como referência interna. Ex.: '+model.healthy.slice(0,3).map(c=>c.name).join(' | ')+'.'} action="Comparar no mercado" href="/pesquisa-produtos"/>}
        {!model.clickLeak.length&&!model.weakCtr.length&&!model.weakCvr.length&&!model.healthy.length&&<Diagnostic title="Ainda não há volume suficiente para comparar campanhas" body="Quando a Shopee retornar impressões, cliques e pedidos por campanha, esta área apontará os maiores vazamentos automaticamente."/>}
      </div>
    </section>

    <section className={styles.education}>
      <div><span>1</span><h3>Muita impressão e pouco clique</h3><p>Primeiro investigue o que o comprador vê antes de entrar: capa, título, preço, selo, oferta e concorrência.</p></div>
      <div><span>2</span><h3>Muito clique e pouco carrinho/pedido</h3><p>O interesse existe, mas a oferta perde força dentro do anúncio. Revise conteúdo, preço final, frete, avaliações, descrição e variações.</p></div>
      <div><span>3</span><h3>Muito carrinho e pouco pedido</h3><p>Quando esse dado estiver disponível, o gargalo está mais perto da decisão final: cupom, frete, prazo, confiança e preço final merecem atenção.</p></div>
    </section>

    <section className={styles.sourceNote}>
      <strong>Como esta página decide</strong>
      <p>Ela usa dados reais de Shopee Ads e pedidos disponíveis no Gestor. Quando uma etapa não existe na fonte, mostra “—” em vez de inventar valor. Os alertas comparam campanhas com a mediana da própria conta no período selecionado.</p>
    </section>
  </div>
}
