'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import styles from './insights.module.css';

const num=v=>Number.isFinite(Number(v))?Number(v):null;
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const nfmt=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1});

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
function productStock(p){return num(p?.stock_info_v2?.summary_info?.total_available_stock??p?.stock)??0}
function hasVideo(p){
  if(Array.isArray(p?.video_info))return p.video_info.length>0;
  if(Array.isArray(p?.videos))return p.videos.length>0;
  if(typeof p?.has_video==='boolean')return p.has_video;
  if(typeof p?.hasVideo==='boolean')return p.hasVideo;
  return null;
}
function orderItems(orders){
  const out=[];
  for(const o of orders||[])for(const it of o?.item_list||[])out.push({order:o,item:it});
  return out;
}
function itemStats(orders){
  const map=new Map();
  for(const row of orderItems(orders)){
    const id=String(row.item?.item_id??'');if(!id)continue;
    const qty=num(row.item?.model_quantity_purchased??row.item?.quantity)??1;
    const unit=num(row.item?.model_discounted_price??row.item?.model_original_price)??0;
    const cur=map.get(id)||{qty:0,gmv:0};
    cur.qty+=qty;cur.gmv+=unit*qty;map.set(id,cur);
  }
  return map;
}
function titleOf(p){return p?.item_name||p?.title||('Produto '+(p?.item_id||''))}
function Insight({tone='neutral',icon,title,badge,description,detail,actions=[]}){
  return <article className={styles.insight} data-tone={tone}>
    <div className={styles.icon}>{icon}</div>
    <div className={styles.body}>
      <div className={styles.top}><span>{badge}</span></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {detail&&<div className={styles.detail}>{detail}</div>}
      <div className={styles.actions}>{actions.map(a=><Link key={a.href+a.label} href={a.href} className={a.primary?styles.primary:styles.secondary}>{a.label}</Link>)}</div>
    </div>
  </article>
}
export default function InsightsPage(){
  const [state,setState]=useState({loading:true,error:'',products:null,orders:null,ads:null});
  const load=async()=>{
    setState(s=>({...s,loading:true,error:''}));
    const results=await Promise.allSettled([
      getJson('/api/shopee/products'),
      getJson('/api/shopee/orders?days=14'),
      getJson('/api/shopee/ads?days=7')
    ]);
    const products=results[0].status==='fulfilled'?(results[0].value?.items||[]):null;
    const orders=results[1].status==='fulfilled'?(results[1].value?.orders||[]):null;
    const ads=results[2].status==='fulfilled'?(results[2].value?.v7||results[2].value?.v5||null):null;
    const errors=results.filter(x=>x.status==='rejected').map(x=>x.reason?.message||String(x.reason));
    setState({loading:false,error:errors.join(' · '),products,orders,ads});
  };
  useEffect(()=>{load()},[]);

  const model=useMemo(()=>{
    const products=state.products,orders=state.orders,ads=state.ads;
    if(!products&&!orders&&!ads)return null;
    const stats=orders?itemStats(orders):null;
    const campaigns=Array.isArray(ads?.campaigns)?ads.campaigns:[];
    const active=campaigns.filter(c=>String(c?.state||'').toLowerCase()==='ongoing');
    const advertised=new Set();
    for(const c of active){
      for(const id of [...(Array.isArray(c?.itemIds)?c.itemIds:[]),c?.itemId].filter(Boolean))advertised.add(String(id));
    }
    const clickNoSale=campaigns.filter(c=>(num(c?.clicks)??0)>=10&&num(c?.orders)===0).sort((a,b)=>(num(b.clicks)??0)-(num(a.clicks)??0));
    const waste=campaigns.filter(c=>(num(c?.spend)??0)>0&&num(c?.gmv)===0).sort((a,b)=>(num(b.spend)??0)-(num(a.spend)??0));
    const organic=products&&stats?products.map(p=>({p,s:stats.get(String(p.item_id))})).filter(x=>(x.s?.qty||0)>0&&!advertised.has(String(x.p.item_id))).sort((a,b)=>(b.s?.qty||0)-(a.s?.qty||0)):[];
    const noVideo=products?products.filter(p=>hasVideo(p)===false):null;
    const lowStock=products&&stats?products.map(p=>({p,s:stats.get(String(p.item_id))})).filter(x=>(x.s?.qty||0)>0&&productStock(x.p)>0).map(x=>({...x,days:productStock(x.p)/(x.s.qty/14)})).filter(x=>x.days<7).sort((a,b)=>a.days-b.days):[];
    const salesRows=products&&stats?products.map(p=>({p,s:stats.get(String(p.item_id))||{qty:0,gmv:0}})).sort((a,b)=>b.s.gmv-a.s.gmv):[];
    const totalGmv=salesRows.reduce((s,x)=>s+(x.s.gmv||0),0),top=salesRows[0]||null,share=top&&totalGmv?top.s.gmv/totalGmv*100:null;
    return{campaigns,active,clickNoSale,waste,organic,noVideo,lowStock,top,share};
  },[state]);

  if(state.loading)return <div className={styles.page}><div className={styles.loading}>Analisando os dados reais da sua loja…</div></div>;
  const unavailable=!model;
  const bad=(model?.clickNoSale?.length||0)+(model?.waste?.length||0)+(model?.lowStock?.length||0);
  const warn=(model?.noVideo?.length||0)+(model?.share>=35?1:0);
  const good=model?.organic?.length||0;

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>GESTOR SÊNIOR · DIAGNÓSTICO</span><h1>Insights da Loja</h1><p>O Gestor cruza Produtos, Pedidos e Shopee Ads e traduz os números em ações fáceis de entender.</p></div>
      <button type="button" onClick={load}>↻ Recalcular</button>
    </header>
    {state.error&&<div className={styles.warning}>Algumas fontes não responderam: {state.error}. Os cards abaixo não inventam os dados ausentes.</div>}
    {unavailable?<div className={styles.empty}>Nenhuma fonte confiável respondeu agora.</div>:<>
      <section className={styles.summary}>
        <div data-tone="bad"><span>Prioridade alta</span><strong>{bad}</strong><small>itens que merecem revisão</small></div>
        <div data-tone="warn"><span>Acompanhar</span><strong>{warn}</strong><small>oportunidades e riscos</small></div>
        <div data-tone="good"><span>Oportunidades</span><strong>{good}</strong><small>produtos vendendo sem Ads</small></div>
        <div><span>Campanhas ativas</span><strong>{model.active.length}</strong><small>Shopee Ads</small></div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>O que merece sua atenção agora</h2><p>Abra a ferramenta correspondente para investigar e agir.</p></div></div>
        <div className={styles.list}>
          {model.clickNoSale.length?
            <Insight tone="bad" icon="🖱️" badge="CONVERSÃO · ALTA PRIORIDADE" title={model.clickNoSale.length+' campanha(s) recebem cliques e não geram pedidos'} description="Há tráfego pago chegando, mas nenhum pedido atribuído nessas campanhas nos últimos 7 dias." detail={model.clickNoSale.slice(0,3).map(c=>(c.productName||c.title)+': '+nfmt(c.clicks)+' cliques · '+money(c.spend)+' gastos').join(' | ')} actions={[{label:'Ver Shopee Ads',href:'/extensao-shopee-intelligence?section=shopee-ads',primary:true},{label:'Ver Produtos',href:'/produtos'}]}/>:
            <Insight tone="good" icon="✓" badge="CONVERSÃO · OK" title="Nenhum caso forte de clique sem venda detectado" description="Não encontramos campanha com 10 ou mais cliques e zero pedido atribuído entre os dados disponíveis." actions={[{label:'Ver Shopee Ads',href:'/extensao-shopee-intelligence?section=shopee-ads'}]}/>}
          {model.waste.length>0&&<Insight tone="bad" icon="💸" badge="ADS · REVISAR" title={model.waste.length+' campanha(s) gastaram sem GMV atribuído'} description="O Gestor não muda campanha automaticamente; ele destaca onde vale revisar oferta, criativo, orçamento ou ROAS." detail={model.waste.slice(0,3).map(c=>(c.productName||c.title)+': '+money(c.spend)).join(' | ')} actions={[{label:'Revisar Ads',href:'/extensao-shopee-intelligence?section=shopee-ads',primary:true},{label:'Proteção ROAS',href:'/protecao-roas'}]}/>}
          {model.organic.length>0&&<Insight tone="good" icon="🌱" badge="OPORTUNIDADE" title={model.organic.length+' produto(s) venderam sem campanha ativa vinculada'} description="Esses produtos já demonstraram venda nos pedidos carregados sem uma campanha ativa encontrada. Podem merecer um teste controlado de Ads." detail={model.organic.slice(0,3).map(x=>titleOf(x.p)+': '+x.s.qty+' un.').join(' | ')} actions={[{label:'Ver Produtos',href:'/produtos',primary:true},{label:'Pesquisar mercado',href:'/pesquisa-produtos'}]}/>}
          {Array.isArray(model.noVideo)&&model.noVideo.length>0&&<Insight tone="warn" icon="🎬" badge="CONTEÚDO · MELHORAR" title={model.noVideo.length+' anúncio(s) sem vídeo confirmado'} description="A Shopee retornou ausência de vídeo nesses anúncios. É uma oportunidade clara de enriquecer o conteúdo." detail={model.noVideo.slice(0,3).map(titleOf).join(' | ')} actions={[{label:'Abrir Super Anúncio',href:'/extensao-shopee-intelligence?section=super-anuncio',primary:true}]}/>}
          {model.lowStock.length>0&&<Insight tone="bad" icon="📦" badge="ESTOQUE · URGENTE" title={model.lowStock.length+' produto(s) com menos de 7 dias de cobertura estimada'} description="Estimativa baseada no estoque atual e nas vendas dos pedidos carregados nos últimos 14 dias." detail={model.lowStock.slice(0,3).map(x=>titleOf(x.p)+': ~'+nfmt(x.days)+' dias').join(' | ')} actions={[{label:'Ver Produtos',href:'/produtos',primary:true}]}/>}
          {model.share!=null&&model.share>=35&&<Insight tone="warn" icon="⚠️" badge="RISCO · CONCENTRAÇÃO" title={nfmt(model.share)+'% do GMV carregado está concentrado em um produto'} description="Uma dependência alta de um único produto aumenta o impacto de ruptura, perda de ranking ou mudança de concorrência." detail={titleOf(model.top.p)} actions={[{label:'Comparar mercado',href:'/pesquisa-produtos',primary:true},{label:'Ver Concorrentes',href:'/extensao-shopee-intelligence?section=concorrentes'}]}/>}
        </div>
      </section>
      <div className={styles.note}>Este diagnóstico usa apenas informações realmente disponíveis no Gestor. Métricas ausentes não são estimadas nem preenchidas artificialmente.</div>
    </>}
  </div>
}
