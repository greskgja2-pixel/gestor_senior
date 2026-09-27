'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {motorData} from '../lib/client-async';
import styles from './funil.module.css';

const num=v=>Number.isFinite(Number(v))?Number(v):null;
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');
const pct=v=>num(v)==null?'—':(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const val=x=>num(x?.value??x);
const arr=v=>Array.isArray(v)?v:[];
const median=values=>{const a=values.filter(v=>Number.isFinite(v)).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};

async function getJson(url){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j?.error)throw new Error(j?.error||('HTTP '+r.status));
    return j;
  }finally{clearTimeout(timer)}
}

function Step({label,value,sub,rate,tone='blue'}){
  return <div className={styles.step} data-tone={tone} data-missing={value==null?'true':'false'}>
    <div className={styles.stepTop}><span>{label}</span><strong>{int(value)}</strong></div>
    <div className={styles.stepMeta}><small>{sub}</small>{rate!=null&&<b>{pct(rate)}</b>}</div>
  </div>
}

function ProductRow({p,med}){
  const ctr=num(p.ctr),cartRate=num(p.uv_to_add_to_cart_rate),paidRate=num(p.uv_to_paid_buyers_rate);
  const flags=[];
  if(num(p.product_card_impressions)>=100&&ctr!=null&&med.ctr!=null&&ctr<med.ctr*.6)flags.push('CTR baixo');
  if(num(p.uv)>=10&&cartRate!=null&&med.cart!=null&&cartRate<med.cart*.6)flags.push('Pouco carrinho');
  if(num(p.uv)>=10&&paidRate!=null&&med.paid!=null&&paidRate<med.paid*.6)flags.push('Conversão baixa');
  return <tr>
    <td><div className={styles.product}><img src={p.image||'/favicon.ico'} alt=""/><div><b>{p.name||'Produto'}</b><small>ID {p.id||'—'}</small></div></div></td>
    <td>{int(p.product_card_impressions)}</td><td>{int(p.product_card_clicks)}</td><td>{pct(ctr)}</td>
    <td>{int(p.uv)}</td><td>{int(p.add_to_cart_buyers)}</td><td>{int(p.placed_buyers)}</td><td>{int(p.paid_buyers)}</td><td>{int(p.confirmed_buyers)}</td>
    <td><span className={styles.flag} data-ok={flags.length?'false':'true'}>{flags.length?flags.join(' · '):'Sem alerta forte'}</span></td>
  </tr>
}

function normalizeAdsCampaign(c){
  const impressions=num(c?.impressions??c?.impression),clicks=num(c?.clicks??c?.click),orders=num(c?.orders??c?.order);
  return{name:c?.productName||c?.title||c?.campaignName||'Campanha',impressions,clicks,orders,ctr:impressions>0&&clicks!=null?clicks/impressions:null,cvr:clicks>0&&orders!=null?orders/clicks:null};
}

export default function FunilPage(){
  const [tab,setTab]=useState('loja');
  const [state,setState]=useState({loading:true,error:'',seller:null,ads:null});
  const load=async()=>{
    setState(s=>({...s,loading:true,error:''}));
    const [sellerR,adsR]=await Promise.allSettled([
      motorData('sellerFunnel',{},45000),
      getJson('/api/shopee/ads?days=7')
    ]);
    const seller=sellerR.status==='fulfilled'?sellerR.value:null;
    const ads=adsR.status==='fulfilled'?(adsR.value?.v7||adsR.value?.v5||adsR.value):null;
    const errors=[];
    if(sellerR.status==='rejected')errors.push('Funil completo: '+String(sellerR.reason?.message||sellerR.reason));
    if(adsR.status==='rejected')errors.push('Shopee Ads: '+String(adsR.reason?.message||adsR.reason));
    setState({loading:false,error:errors.join(' · '),seller,ads});
  };
  useEffect(()=>{load()},[]);

  const model=useMemo(()=>{
    const s=state.seller||{},k=s.keyMetrics||{},rt=s.realtime?.key_metrics||{};
    const products=arr(s.products);
    const totals={
      impressions:products.length?products.reduce((a,p)=>a+(num(p.product_card_impressions)||0),0):null,
      clicks:products.length?products.reduce((a,p)=>a+(num(p.product_card_clicks)||0),0):null,
      visitors:products.length?products.reduce((a,p)=>a+(num(p.uv)||0),0):val(k.shop_uv)??num(rt.uv),
      carts:products.length?products.reduce((a,p)=>a+(num(p.add_to_cart_buyers)||0),0):null,
      placed:val(k.place_orders)??num(rt.orders),
      paid:val(k.paid_orders),
      confirmed:val(k.confirmed_orders),
      paidGmv:val(k.paid_gmv)??num(rt.sales)
    };
    const rates={
      ctr:totals.impressions>0&&totals.clicks!=null?totals.clicks/totals.impressions:null,
      clickVisit:totals.clicks>0&&totals.visitors!=null?totals.visitors/totals.clicks:null,
      visitCart:totals.visitors>0&&totals.carts!=null?totals.carts/totals.visitors:null,
      cartPlaced:totals.carts>0&&totals.placed!=null?totals.placed/totals.carts:null,
      placedPaid:totals.placed>0&&totals.paid!=null?totals.paid/totals.placed:null,
      paidConfirmed:totals.paid>0&&totals.confirmed!=null?totals.confirmed/totals.paid:null
    };
    const med={ctr:median(products.map(p=>num(p.ctr))),cart:median(products.map(p=>num(p.uv_to_add_to_cart_rate))),paid:median(products.map(p=>num(p.uv_to_paid_buyers_rate)))};
    const sources=[];
    const tr=s.traffic||{};
    for(const [key,label] of [['product_card','Card de produto / Busca'],['live','Live'],['video','Vídeo'],['affiliate','Afiliados'],['paid_ads','Shopee Ads']]){
      const t=tr?.[key]?.total;
      if(t)sources.push({key,label,sales:num(t.sales),orders:num(t.orders),clicks:num(t.product_clicks),impressions:num(t.product_impressions),ctr:num(t.ctr),conversion:num(t.product_clicks_to_orders_rate??t.conversion)});
    }
    const campaigns=arr(state.ads?.campaigns).map(normalizeAdsCampaign);
    return{totals,rates,products,med,sources,campaigns,key:k,realtime:rt,errors:arr(s.errors)};
  },[state]);

  if(state.loading)return <div className={styles.page}><div className={styles.loading}>Lendo Informações Gerenciais da Shopee e montando o funil…</div></div>;

  const full=!!state.seller;
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>GESTOR SÊNIOR · CONVERSÃO</span><h1>Análise de Funil</h1><p>Da impressão até o pedido confirmado, com dados do Seller Center e diagnóstico por produto.</p></div>
      <button type="button" onClick={load}>↻ Atualizar agora</button>
    </header>

    {state.error&&<div className={styles.warning}>{state.error}</div>}
    {!full&&<div className={styles.warning}><b>Funil completo indisponível.</b> Atualize o Motor Sênior para a versão 0.17.1 ou superior e mantenha uma sessão ativa no Seller Center. Enquanto isso, a aba “Histórico Ads” continua usando os dados já disponíveis.</div>}

    <nav className={styles.tabs}>
      <button data-active={tab==='loja'} onClick={()=>setTab('loja')}>Funil da Loja</button>
      <button data-active={tab==='produto'} onClick={()=>setTab('produto')}>Por Produto</button>
      <button data-active={tab==='trafego'} onClick={()=>setTab('trafego')}>Fontes de Tráfego</button>
      <button data-active={tab==='ads'} onClick={()=>setTab('ads')}>Histórico Ads</button>
    </nav>

    {tab==='loja'&&<>
      <section className={styles.hero}>
        <div><span>TEMPO REAL · HOJE</span><h2>{full?'Jornada completa do comprador':'Aguardando dados completos do Seller Center'}</h2><p>Impressões → Cliques → Visitantes → Carrinho → Pedido criado → Pago → Confirmado.</p></div>
        <div className={styles.heroMetric}><strong>{money(model.totals.paidGmv)}</strong><span>vendas pagas no período</span></div>
      </section>
      <section className={styles.funnelCard}>
        <div className={styles.funnel}>
          <Step label="Impressões" value={model.totals.impressions} sub="Cards exibidos" tone="violet"/>
          <i>→</i><Step label="Cliques" value={model.totals.clicks} sub="Entradas no produto" rate={model.rates.ctr} tone="blue"/>
          <i>→</i><Step label="Visitantes" value={model.totals.visitors} sub="UV da loja/produtos" rate={model.rates.clickVisit} tone="cyan"/>
          <i>→</i><Step label="Carrinho" value={model.totals.carts} sub="Compradores que adicionaram" rate={model.rates.visitCart} tone="amber"/>
          <i>→</i><Step label="Pedido criado" value={model.totals.placed} sub="Placed orders" rate={model.rates.cartPlaced} tone="orange"/>
          <i>→</i><Step label="Pago" value={model.totals.paid} sub="Paid orders" rate={model.rates.placedPaid} tone="green"/>
          <i>→</i><Step label="Confirmado" value={model.totals.confirmed} sub="Confirmed orders" rate={model.rates.paidConfirmed} tone="teal"/>
        </div>
      </section>
      <section className={styles.rateGrid}>
        <div><span>CTR</span><strong>{pct(model.rates.ctr)}</strong><small>impressão → clique</small></div>
        <div><span>Visita → carrinho</span><strong>{pct(model.rates.visitCart)}</strong><small>intenção de compra</small></div>
        <div><span>Pedido → pago</span><strong>{pct(model.rates.placedPaid)}</strong><small>fechamento do pagamento</small></div>
        <div><span>Pago → confirmado</span><strong>{pct(model.rates.paidConfirmed)}</strong><small>qualidade final da conversão</small></div>
      </section>
      <section className={styles.education}>
        <div><b>1</b><h3>Impressão → clique</h3><p>Queda forte aqui aponta para capa, título, preço percebido ou competitividade na busca.</p></div>
        <div><b>2</b><h3>Visita → carrinho</h3><p>Se a pessoa entra e não adiciona, revise oferta, prova social, imagens, variações, frete e descrição.</p></div>
        <div><b>3</b><h3>Carrinho → pedido/pago</h3><p>O desejo existe, mas algo trava o fechamento: preço final, cupom, frete, prazo ou confiança.</p></div>
      </section>
    </>}

    {tab==='produto'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>Funil por Produto</h2><p>Compara cada anúncio com a mediana da sua própria loja, sem benchmark inventado.</p></div><span>{model.products.length} produtos</span></div>
      {!model.products.length?<div className={styles.empty}>Sem dados de produto no momento.</div>:<div className={styles.tableWrap}><table><thead><tr><th>Produto</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Visitantes</th><th>Carrinho</th><th>Pedido</th><th>Pago</th><th>Confirmado</th><th>Diagnóstico</th></tr></thead><tbody>{model.products.map(p=><ProductRow key={p.id} p={p} med={model.med}/>)}</tbody></table></div>}
    </section>}

    {tab==='trafego'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>De onde vêm suas vendas?</h2><p>Contribuição das fontes de tráfego carregadas pela própria Shopee.</p></div></div>
      <div className={styles.sourceGrid}>{model.sources.length?model.sources.map(s=><article key={s.key}><h3>{s.label}</h3><strong>{money(s.sales)}</strong><span>{int(s.orders)} pedidos</span><div><small>{int(s.impressions)} impressões</small><small>{int(s.clicks)} cliques</small><small>CTR {pct(s.ctr)}</small><small>Conv. {pct(s.conversion)}</small></div></article>):<div className={styles.empty}>Sem fontes de tráfego disponíveis.</div>}</div>
    </section>}

    {tab==='ads'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>Histórico Shopee Ads · 7 dias</h2><p>Camada complementar para enxergar campanhas fora do recorte em tempo real.</p></div></div>
      {!model.campaigns.length?<div className={styles.empty}>Sem campanhas disponíveis.</div>:<div className={styles.adsList}>{model.campaigns.slice(0,12).map((c,i)=><div key={i}><b>{c.name}</b><span>{int(c.impressions)} impressões · {int(c.clicks)} cliques · {int(c.orders)} pedidos</span><small>CTR {pct(c.ctr)} · clique→pedido {pct(c.cvr)}</small></div>)}</div>}
    </section>}

    <section className={styles.sourceNote}><strong>Fonte e confiabilidade</strong><p>O funil completo usa os endpoints estruturados de “Informações Gerenciais” lidos pela extensão dentro da sessão normal do Seller Center. Nenhum cookie ou token é enviado ao Gestor. Quando uma métrica não existe na resposta, ela aparece como “—”. Não encontramos uma etapa explícita de “início de checkout”; por isso o fluxo usa Carrinho → Pedido criado → Pago → Confirmado.</p>{model.errors.length>0&&<small>{model.errors.map(x=>x.source+': '+x.error).join(' · ')}</small>}</section>
  </div>
}
