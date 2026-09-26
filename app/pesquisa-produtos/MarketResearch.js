'use client';

import {useMemo,useRef,useState} from 'react';
import {motorData} from '../lib/client-async';
import styles from './pesquisa-produtos.module.css';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{maximumFractionDigits:1});
const compact=v=>n(v)==null?'—':Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(n(v));
const arr=v=>Array.isArray(v)?v:[];

function priceFromShopee(v){
  const x=n(v); if(x==null)return null;
  return x>10000?x/100000:x;
}
function imageUrl(v){
  if(!v)return null;
  const raw=String(v).trim();
  if(/^https?:\/\//i.test(raw))return raw;
  if(/^[a-z0-9_-]{20,}$/i.test(raw))return 'https://down-br.img.susercontent.com/file/'+raw;
  return null;
}
function stateFrom(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  const states=['Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins'];
  const loose=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const found=states.find(s=>loose(raw).includes(loose(s)));
  return found||raw;
}
function normalizeOne(row,index){
  const b=row?.item_basic||row?.item||row?.product||row||{};
  const rating=b?.item_rating||row?.item_rating||{};
  const price=priceFromShopee(b?.price??b?.price_min??b?.price_min_before_discount??row?.price);
  const original=priceFromShopee(b?.price_before_discount??b?.original_price??row?.original_price);
  const sold=n(b?.historical_sold??b?.sold??row?.sold??row?.historicalSold);
  const monthlySold=n(b?.monthly_sold??b?.sold_30d??row?.monthlySold??row?.monthly_sold);
  const title=String(b?.name??b?.item_name??row?.title??row?.name??'Produto sem título').trim();
  const itemId=String(b?.itemid??b?.item_id??row?.itemid??row?.itemId??row?.item_id??'').trim();
  const shopId=String(b?.shopid??b?.shop_id??row?.shopid??row?.shopId??row?.shop_id??'').trim();
  const image=imageUrl(b?.image??b?.image_url??row?.image??row?.imageUrl??arr(b?.images)[0]??arr(row?.images)[0]);
  const location=stateFrom(b?.shop_location??b?.location??row?.shop_location??row?.seller_location??row?.location);
  const ratingValue=n(rating?.rating_star??b?.rating_star??row?.rating);
  const reviews=n(rating?.rating_count?.[0]??rating?.rating_count??b?.rating_count??row?.reviews);
  const discount=price!=null&&original!=null&&original>price?Math.round((1-price/original)*100):null;
  const revenue=price!=null&&sold!=null?price*sold:null;
  const monthlyRevenue=price!=null&&monthlySold!=null?price*monthlySold:null;
  const preferred=Boolean(b?.is_preferred_shop||b?.is_preferred_seller||row?.preferred||/vendedor\s+indicado|\bindicado\b/i.test(String(row?.searchText||'')));
  const url=itemId&&shopId?`https://shopee.com.br/product/${shopId}/${itemId}`:null;
  return {key:itemId||shopId||String(index),index,title,itemId,shopId,image,price,original,discount,sold,monthlySold,rating:ratingValue,reviews,location,revenue,monthlyRevenue,preferred,url,raw:row};
}
function extractRows(payload){
  const root=payload?.data??payload;
  const candidates=[
    root?.items,root?.results,root?.products,root?.search_items,root?.searchItems,
    root?.data?.items,root?.data?.results,root?.data?.products,
    root?.discovery?.items,root?.discovery?.results
  ];
  for(const rows of candidates)if(Array.isArray(rows)&&rows.length)return rows;
  if(Array.isArray(root))return root;
  const discovered=root?.discovery?.candidates;
  if(discovered&&typeof discovered==='object')return Object.values(discovered);
  return [];
}
function opportunityScore(r,bench){
  let s=50;
  if(r.monthlySold!=null&&bench.monthlyMedian>0)s+=Math.min(22,(r.monthlySold/bench.monthlyMedian-1)*14);
  else if(r.sold!=null&&bench.soldMedian>0)s+=Math.min(15,(r.sold/bench.soldMedian-1)*8);
  if(r.rating!=null)s+=(r.rating-4.5)*14;
  if(r.reviews!=null&&bench.reviewMedian>0)s+=Math.min(8,(r.reviews/bench.reviewMedian-1)*3);
  if(r.price!=null&&bench.priceMedian>0&&r.price<bench.priceMedian)s+=Math.min(7,(1-r.price/bench.priceMedian)*12);
  return Math.max(0,Math.min(100,Math.round(s)));
}
function median(values){
  const xs=values.filter(v=>v!=null&&Number.isFinite(v)).sort((a,b)=>a-b);
  if(!xs.length)return 0;
  const m=Math.floor(xs.length/2);
  return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}
function stats(rows){
  const priceMedian=median(rows.map(r=>r.price));
  const soldMedian=median(rows.map(r=>r.sold));
  const monthlyMedian=median(rows.map(r=>r.monthlySold));
  const reviewMedian=median(rows.map(r=>r.reviews));
  const locations={};
  rows.forEach(r=>{if(r.location)locations[r.location]=(locations[r.location]||0)+1});
  const mainLocation=Object.entries(locations).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
  return {priceMedian,soldMedian,monthlyMedian,reviewMedian,mainLocation};
}

export default function MarketResearch(){
  const [query,setQuery]=useState('');
  const [rows,setRows]=useState([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Pesquise pela extensão ou importe um JSON do Coletor Shopee.');
  const [sort,setSort]=useState('score');
  const [minSold,setMinSold]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [activeTab,setActiveTab]=useState('overview');
  const fileRef=useRef(null);

  const bench=useMemo(()=>stats(rows),[rows]);
  const prepared=useMemo(()=>rows.map(r=>({...r,score:opportunityScore(r,bench)})),[rows,bench]);
  const filtered=useMemo(()=>{
    let list=prepared.filter(r=>(!minSold||n(r.sold)>=Number(minSold))&&(!maxPrice||n(r.price)<=Number(maxPrice)));
    list=[...list].sort((a,b)=>{
      if(sort==='sales')return (n(b.sold)??-1)-(n(a.sold)??-1);
      if(sort==='monthly')return (n(b.monthlySold)??-1)-(n(a.monthlySold)??-1);
      if(sort==='price')return (n(a.price)??Infinity)-(n(b.price)??Infinity);
      return b.score-a.score;
    });
    return list;
  },[prepared,sort,minSold,maxPrice]);

  function loadPayload(payload,source='arquivo'){
    const normalized=extractRows(payload).map(normalizeOne).filter(r=>r.itemId||r.title);
    setRows(normalized);
    setMessage(normalized.length?`${normalized.length} anúncios carregados de ${source}.`:'Nenhum anúncio válido foi encontrado nessa coleta.');
  }

  async function search(){
    const term=query.trim();
    if(!term){setMessage('Digite uma palavra-chave para pesquisar.');return}
    setBusy(true);setMessage('Pedindo ao Motor Sênior para coletar a busca da Shopee…');
    try{
      const data=await motorData('marketplaceSearch',{query:term,sort:'relevance',pages:3},55000);
      loadPayload(data,'busca ao vivo');
    }catch(error){
      setMessage('Não consegui concluir a pesquisa automática: '+String(error?.message||error)+'. Verifique se o Motor Senior está conectado e tente novamente.');
    }finally{setBusy(false)}
  }

  async function onFile(file){
    if(!file)return;
    try{
      const text=await file.text();
      loadPayload(JSON.parse(text),file.name);
    }catch{setMessage('Não consegui ler esse JSON. Use um arquivo exportado pelo Coletor Shopee.')}
  }

  const top=filtered.slice(0,5);
  const tabs=[
    ['overview','Visão geral'],
    ['results','Resultados'],
    ['top','Top oportunidades'],
    ['next','Próximas camadas']
  ];

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>INTELIGÊNCIA DE MERCADO</span><h1>Pesquisa de Produtos</h1><p>Pesquise na Shopee de forma automática pelo Motor Senior e compare demanda, preço, concorrência e oportunidades.</p></div>
      <div className={styles.headerBadge}><b>{rows.length}</b><span>anúncios analisados</span></div>
    </header>

    <section className={styles.searchCard}>
      <div className={styles.searchLine}>
        <div className={styles.searchBox}><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!busy&&search()} placeholder="Ex.: TAG saída maternidade"/></div>
        <button type="button" onClick={search} disabled={busy}>{busy?'Coletando automaticamente…':'Pesquisar automaticamente'}</button>
        <button type="button" className={styles.secondary} onClick={()=>fileRef.current?.click()}>Importar coleta</button>
        <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={e=>onFile(e.target.files?.[0])}/>
      </div>
      <div className={styles.message}>{message}</div>
    </section>

    <nav className={styles.tabs} aria-label="Seções da Pesquisa de Produtos">
      {tabs.map(([id,label])=><button key={id} type="button" className={activeTab===id?styles.activeTab:''} onClick={()=>setActiveTab(id)}>{label}</button>)}
    </nav>

    {activeTab==='overview'&&<>
      <section className={styles.kpis}>
        <article><span>Preço mediano</span><strong>{rows.length?money(bench.priceMedian):'—'}</strong><small>Faixa dominante da pesquisa</small></article>
        <article><span>Vendas medianas</span><strong>{rows.length?compact(bench.soldMedian):'—'}</strong><small>Vendas acumuladas por anúncio</small></article>
        <article><span>Vendas 30 dias</span><strong>{bench.monthlyMedian?compact(bench.monthlyMedian):'—'}</strong><small>Quando a coleta fornece o campo</small></article>
        <article><span>Origem mais comum</span><strong>{bench.mainLocation}</strong><small>Localização observada nos cards</small></article>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Resumo da pesquisa</h2><p>Use as abas para navegar sem deixar a tela longa.</p></div></div>
        <div className={styles.summaryGrid}>
          <div><span>Anúncios coletados</span><b>{rows.length}</b></div>
          <div><span>Com vendas 30 dias</span><b>{rows.filter(r=>r.monthlySold!=null).length}</b></div>
          <div><span>Com localização</span><b>{rows.filter(r=>r.location).length}</b></div>
          <div><span>Vendedor Indicado</span><b>{rows.filter(r=>r.preferred).length}</b></div>
        </div>
      </section>
    </>}

    {activeTab==='results'&&<section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><h2>Radar de oportunidades</h2><p>O score é determinístico e usa somente os dados carregados; não é uma nota gerada por IA.</p></div>
        <div className={styles.filters}>
          <input inputMode="numeric" value={minSold} onChange={e=>setMinSold(e.target.value)} placeholder="Vendas mín."/>
          <input inputMode="decimal" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Preço máx."/>
          <select value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Melhor oportunidade</option><option value="sales">Mais vendidos</option><option value="monthly">Mais vendas 30d</option><option value="price">Menor preço</option></select>
        </div>
      </div>
      {!filtered.length?<div className={styles.empty}>Faça uma pesquisa automática ou importe uma coleta para começar.</div>:
      <div className={styles.tableWrap}><table><thead><tr><th>Produto</th><th>Preço</th><th>Vendas</th><th>30 dias</th><th>Avaliações</th><th>Local</th><th>Oportunidade</th><th></th></tr></thead><tbody>
        {filtered.map(r=><tr key={r.key}>
          <td><div className={styles.product}>{r.image?<img src={r.image} alt=""/>:<div className={styles.noImg}>▧</div>}<div><b title={r.title}>{r.title}</b><small>{r.preferred?'Vendedor Indicado · ':''}{r.itemId?'ID '+r.itemId:'ID não coletado'}</small></div></div></td>
          <td><b>{money(r.price)}</b>{r.discount?<small className={styles.discount}>-{r.discount}%</small>:null}</td>
          <td><b>{compact(r.sold)}</b><small>{r.revenue!=null?money(r.revenue)+' estimado bruto':'—'}</small></td>
          <td><b>{compact(r.monthlySold)}</b><small>{r.monthlyRevenue!=null?money(r.monthlyRevenue)+' / 30d':'não coletado'}</small></td>
          <td><b>{r.rating!=null?'★ '+number(r.rating):'—'}</b><small>{r.reviews!=null?compact(r.reviews)+' avaliações':'—'}</small></td>
          <td>{r.location||'—'}</td>
          <td><span className={styles.score} data-level={r.score>=70?'high':r.score>=50?'mid':'low'}>{r.score}</span></td>
          <td>{r.url?<a href={r.url} target="_blank" rel="noreferrer">Abrir ↗</a>:'—'}</td>
        </tr>)}
      </tbody></table></div>}
    </section>}

    {activeTab==='top'&&<section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Top oportunidades</h2><p>Os cinco anúncios que mais se destacam dentro da coleta atual.</p></div></div>
      <div className={styles.topList}>{top.length?top.map((r,i)=><div key={r.key}><span>{i+1}</span><div><b>{r.title}</b><small>{money(r.price)} · {compact(r.sold)} vendidos</small></div><strong>{r.score}</strong></div>):<div className={styles.emptySmall}>Sem dados ainda.</div>}</div>
    </section>}

    {activeTab==='next'&&<section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Próximas camadas</h2><p>Recursos planejados para aprofundar a pesquisa.</p></div></div>
      <div className={styles.nextGrid}><div><b>1</b><span>Histórico de pesquisas</span></div><div><b>2</b><span>Salvar produto e monitorar</span></div><div><b>3</b><span>Mineração de avaliações</span></div><div><b>4</b><span>Pacote resumido para IA</span></div></div>
    </section>}
  </div>;
}
