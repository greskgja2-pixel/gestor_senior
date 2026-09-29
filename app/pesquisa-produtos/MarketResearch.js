'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
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
  const location=stateFrom(b?.shop_location??b?.location??row?.shopLocation??row?.shop_location??row?.seller_location??row?.seller_location_raw??row?.location);
  const ratingValue=n(rating?.rating_star??b?.rating_star??row?.rating);
  const reviews=n(rating?.rating_count?.[0]??rating?.rating_count??b?.rating_count??row?.reviewCount??row?.review_count??row?.reviews);
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
  if(!xs.length)return null;
  const m=Math.floor(xs.length/2);
  return xs.length%2?xs[m]:(xs[m-1]+xs[m])/2;
}
function coverage(rows,key){return rows.filter(r=>r[key]!==null&&r[key]!==undefined).length}
function confidence(r){
  const checks=[r.price,r.sold,r.monthlySold,r.rating,r.reviews,r.location];
  const count=checks.filter(v=>v!==null&&v!==undefined&&v!=='').length;
  return {value:Math.round(count/checks.length*100),label:count>=5?'Alta':count>=3?'Média':'Baixa'};
}
function keywordInsights(rows){
  const stop=new Set('de da do das dos e em para por com sem a o as os um uma kit produto produtos shopee'.split(' ')),map={};
  rows.forEach(r=>{[...new Set(String(r.title||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\\s]/g,' ').split(/\\s+/).filter(w=>w.length>=3&&!stop.has(w)&&!/^\\d+$/.test(w)))].forEach(word=>{const x=map[word]||(map[word]={word,count:0,prices:[],sales:[]});x.count++;if(r.price!=null)x.prices.push(r.price);if(r.sold!=null)x.sales.push(r.sold)})});
  return Object.values(map).filter(x=>x.count>=2).map(x=>({...x,price:median(x.prices),sales:median(x.sales)})).sort((a,b)=>b.count-a.count).slice(0,24);
}
function sellerConcentration(rows){
  const map={};rows.forEach(r=>{if(r.shopId)map[r.shopId]=(map[r.shopId]||0)+1});const list=Object.values(map).sort((a,b)=>b-a),top5=list.slice(0,5).reduce((s,v)=>s+v,0);
  return {shops:list.length,share:rows.length?Math.round(top5/rows.length*100):0};
}
function stats(rows){
  const priceMedian=median(rows.map(r=>r.price));
  const soldMedian=median(rows.map(r=>r.sold));
  const monthlyMedian=median(rows.map(r=>r.monthlySold));
  const reviewMedian=median(rows.map(r=>r.reviews));
  const locations={};
  rows.forEach(r=>{if(r.location)locations[r.location]=(locations[r.location]||0)+1});
  const mainLocation=Object.entries(locations).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';
  return {priceMedian,soldMedian,monthlyMedian,reviewMedian,mainLocation,coverage:{price:coverage(rows,'price'),sold:coverage(rows,'sold'),monthly:coverage(rows,'monthlySold'),location:coverage(rows,'location'),rating:coverage(rows,'rating'),reviews:coverage(rows,'reviews')}};
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
  const [mode,setMode]=useState('standard');
  const [page,setPage]=useState(1);
  const [saved,setSaved]=useState([]);
  const [diagnostics,setDiagnostics]=useState(null);
  const [diagnosticsOpen,setDiagnosticsOpen]=useState(false);
  const fileRef=useRef(null);
  const PAGE_SIZE=20;
  useEffect(()=>{try{setSaved(JSON.parse(localStorage.getItem('gs_market_saved')||'[]'))}catch{}},[]);

  const bench=useMemo(()=>stats(rows),[rows]);
  const prepared=useMemo(()=>rows.map(r=>({...r,score:opportunityScore(r,bench),confidence:confidence(r)})),[rows,bench]);
  const filtered=useMemo(()=>{
    let list=prepared.filter(r=>(!minSold||n(r.sold)>=Number(minSold))&&(!maxPrice||n(r.price)<=Number(maxPrice)));
    list=[...list].sort((a,b)=>{
      if(sort==='sales')return (n(b.sold)??-1)-(n(a.sold)??-1);
      if(sort==='monthly')return (n(b.monthlySold)??-1)-(n(a.monthlySold)??-1);
      if(sort==='price')return (n(a.price)??Infinity)-(n(b.price)??Infinity);
      return (b.score??-1)-(a.score??-1);
    });
    return list;
  },[prepared,sort,minSold,maxPrice]);

  function loadPayload(payload,source='arquivo'){
    const normalized=extractRows(payload).map(normalizeOne).filter(r=>r.itemId||r.title);
    setRows(normalized);
    setDiagnostics(payload?.diagnostics??payload?.data?.diagnostics??null);
    setMessage(normalized.length?`${normalized.length} anúncios carregados de ${source}.`:'Nenhum anúncio válido foi encontrado nessa coleta.');
  }

  async function search(){
    const term=query.trim();
    if(!term){setMessage('Digite uma palavra-chave para pesquisar.');return}
    setBusy(true);setMessage('Pedindo ao Motor Sênior para coletar a busca da Shopee…');
    try{
      const pagesByMode={quick:1,standard:3,deep:5};
      const data=await motorData('marketplaceSearch',{query:term,sort:'relevance',pages:pagesByMode[mode]},75000);
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

  const keywords=useMemo(()=>keywordInsights(rows),[rows]);
  const concentration=useMemo(()=>sellerConcentration(rows),[rows]);
  const coverageValues=Object.values(bench.coverage||{});
  const quality=rows.length?Math.round(coverageValues.reduce((s,v)=>s+v,0)/(rows.length*Math.max(1,coverageValues.length))*100):0;
  const qualityLabel=quality>=75?'Alta':quality>=45?'Média':'Baixa';
  const suspiciousSales=rows.length>=20&&bench.coverage?.sold===rows.length&&rows.every(r=>r.sold===0);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const paged=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const top=filtered.filter(r=>r.confidence.value>=50).slice(0,5);
  useEffect(()=>setPage(1),[sort,minSold,maxPrice,rows.length]);
  function saveResearch(){if(!rows.length)return;const entry={id:Date.now(),query:query.trim()||'Pesquisa importada',count:rows.length,quality,date:new Date().toISOString()};const next=[entry,...saved.filter(x=>x.query!==entry.query)].slice(0,10);setSaved(next);try{localStorage.setItem('gs_market_saved',JSON.stringify(next))}catch{}setMessage('Pesquisa salva neste navegador.');}
  const tabs=[['overview','Visão geral'],['results','Resultados'],['top','Oportunidades'],['keywords','Palavras-chave'],['competition','Concorrência'],['insights','Insights']];

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>INTELIGÊNCIA DE MERCADO</span><h1>Pesquisa de Produtos</h1><p>Pesquise na Shopee de forma automática pelo Motor Senior e compare demanda, preço, concorrência e oportunidades.</p></div>
      <div className={styles.headerActions}><button type="button" onClick={saveResearch} disabled={!rows.length}>☆ Salvar pesquisa</button><div className={styles.headerBadge}><b>{rows.length}</b><span>anúncios analisados</span></div></div>
    </header>

    <section className={styles.searchCard}>
      <div className={styles.modeRow}><span>Profundidade</span>{[['quick','Rápida · 1 pág.'],['standard','Padrão · 3 págs.'],['deep','Profunda · 5 págs.']].map(([id,label])=><button key={id} type="button" className={mode===id?styles.modeActive:''} onClick={()=>setMode(id)}>{label}</button>)}</div>
      <div className={styles.searchLine}>
        <div className={styles.searchBox}><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!busy&&search()} placeholder="Ex.: TAG saída maternidade"/></div>
        <button type="button" onClick={search} disabled={busy}>{busy?'Coletando automaticamente…':'Pesquisar automaticamente'}</button>
        <button type="button" className={styles.secondary} onClick={()=>fileRef.current?.click()}>Importar coleta</button>
        <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={e=>onFile(e.target.files?.[0])}/>
      </div>
      <div className={styles.message}>{message}</div>
    </section>

    {rows.length>0&&<section className={styles.qualityCard}><div className={styles.qualityHead}><div><span>COBERTURA DOS DADOS</span><b>{qualityLabel} · {quality}%</b></div><em data-level={quality>=75?'high':quality>=45?'mid':'low'}>{qualityLabel}</em></div><div className={styles.coverageGrid}>{[['Preço','price'],['Vendas','sold'],['Vendas 30d','monthly'],['Localização','location'],['Avaliação','rating'],['Reviews','reviews']].map(([label,key])=><div key={key}><b>{bench.coverage[key]}/{rows.length}</b><span>{label}</span><i><u style={{width:(bench.coverage[key]/rows.length*100)+'%'}}/></i></div>)}</div>{suspiciousSales&&<div className={styles.dataWarning}>⚠️ Todos os anúncios vieram com vendas = 0. O Gestor não assume que isso significa ausência de demanda; este campo está marcado como suspeito até uma nova coleta confirmar.</div>}<button type="button" className={styles.diagnosticToggle} onClick={()=>setDiagnosticsOpen(v=>!v)}>🔧 {diagnosticsOpen?'Ocultar diagnóstico':'Diagnóstico da coleta'}</button>{diagnosticsOpen&&<div className={styles.diagnosticPanel}><div className={styles.diagnosticIntro}><b>Motor Sênior × Gestor</b><span>{diagnostics?'O Motor informou a cobertura antes da normalização. Assim dá para saber exatamente onde um campo se perdeu.':'Esta coleta não trouxe diagnóstico do Motor. Instale a v0.17.9 e faça uma nova pesquisa para gerar essa comparação.'}</span></div>{diagnostics&&<><div className={styles.diagnosticGrid}>{[['Preço','price','price'],['Vendas','sold','sold'],['Vendas 30d','monthlySold','monthly'],['Localização','shopLocation','location'],['Avaliação','rating','rating'],['Reviews','reviewCount','reviews']].map(([label,motorKey,gestorKey])=>{const motor=Number(diagnostics?.coverage?.[motorKey]??0),gestor=Number(bench.coverage?.[gestorKey]??0);const status=motor===0?'source':gestor<motor?'normalizer':'ok';return <div key={label} data-status={status}><b>{label}</b><span>Motor: {motor}/{rows.length}</span><span>Gestor: {gestor}/{rows.length}</span><strong>{status==='ok'?'✓ aproveitado':status==='normalizer'?'⚠ normalização':'○ não veio da busca'}</strong></div>})}</div>{Array.isArray(diagnostics.detectedPaths)&&diagnostics.detectedPaths.length>0&&<details className={styles.detectedPaths}><summary>Campos estruturados detectados pelo Motor</summary><code>{diagnostics.detectedPaths.join(' · ')}</code></details>}</>}</div>}</section>}

    <nav className={styles.tabs} aria-label="Seções da Pesquisa de Produtos">
      {tabs.map(([id,label])=><button key={id} type="button" className={activeTab===id?styles.activeTab:''} onClick={()=>setActiveTab(id)}>{label}</button>)}
    </nav>

    {activeTab==='overview'&&<>
      <section className={styles.kpis}>
        <article><span>Preço mediano</span><strong>{bench.coverage.price?money(bench.priceMedian):'Não coletado'}</strong><small>{bench.coverage.price}/{rows.length||0} anúncios com preço</small></article>
        <article><span>Vendas medianas</span><strong>{bench.coverage.sold?compact(bench.soldMedian):'Não coletado'}</strong><small>{bench.coverage.sold}/{rows.length||0} anúncios com vendas</small></article>
        <article><span>Vendas 30 dias</span><strong>{bench.coverage.monthly?compact(bench.monthlyMedian):'Não coletado'}</strong><small>{bench.coverage.monthly}/{rows.length||0} anúncios com o campo</small></article>
        <article><span>Lojas únicas</span><strong>{concentration.shops||'—'}</strong><small>{concentration.shops?concentration.share+'% nas 5 lojas com mais resultados':'shop_id não coletado'}</small></article>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Resumo da pesquisa</h2><p>Use as abas para navegar sem deixar a tela longa.</p></div></div>
        <div className={styles.summaryGrid}>
          <div><span>Anúncios coletados</span><b>{rows.length}</b></div>
          <div><span>Cobertura dos dados</span><b>{quality}%</b></div>
          <div><span>Lojas identificadas</span><b>{concentration.shops||'—'}</b></div>
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
      <div className={styles.tableWrap}><table><thead><tr><th>Produto</th><th>Preço</th><th>Vendas</th><th>30 dias</th><th>Avaliações</th><th>Local</th><th>Oportunidade</th><th>Confiança</th><th></th></tr></thead><tbody>
        {paged.map(r=><tr key={r.key}>
          <td><div className={styles.product}>{r.image?<img src={r.image} alt=""/>:<div className={styles.noImg}>▧</div>}<div><b title={r.title}>{r.title}</b><small>{r.preferred?'Vendedor Indicado · ':''}{r.itemId?'ID '+r.itemId:'ID não coletado'}</small></div></div></td>
          <td><b>{money(r.price)}</b>{r.discount?<small className={styles.discount}>-{r.discount}%</small>:null}</td>
          <td><b>{compact(r.sold)}</b><small>{r.revenue!=null?money(r.revenue)+' estimado bruto':'—'}</small></td>
          <td><b>{compact(r.monthlySold)}</b><small>{r.monthlyRevenue!=null?money(r.monthlyRevenue)+' / 30d':'não coletado'}</small></td>
          <td><b>{r.rating!=null?'★ '+number(r.rating):'—'}</b><small>{r.reviews!=null?compact(r.reviews)+' avaliações':'—'}</small></td>
          <td>{r.location||'—'}</td>
          <td><span className={styles.score} data-level={r.score>=70?'high':r.score>=50?'mid':'low'}>{r.score}</span></td>
          <td><span className={styles.confidence} data-level={r.confidence.label==='Alta'?'high':r.confidence.label==='Média'?'mid':'low'}>{r.confidence.label}<small>{r.confidence.value}%</small></span></td>
          <td>{r.url?<a href={r.url} target="_blank" rel="noreferrer">Abrir ↗</a>:'—'}</td>
        </tr>)}
      </tbody></table></div>}
      {filtered.length>0&&<div className={styles.pagination}><span>Mostrando {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} de {filtered.length}</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>←</button><b>{page} / {pages}</b><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>→</button></div></div>}
    </section>}

    {activeTab==='top'&&<section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Oportunidades com evidência</h2><p>O score é acompanhado pela confiança, baseada na quantidade de campos realmente disponíveis.</p></div></div>
      <div className={styles.topList}>{top.length?top.map((r,i)=><div key={r.key}><span>{i+1}</span><div><b>{r.title}</b><small>{money(r.price)} · {compact(r.sold)} vendidos</small></div><strong>{r.score}</strong></div>):<div className={styles.emptySmall}>Sem dados ainda.</div>}</div>
    </section>}

    {activeTab==='keywords'&&<section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Palavras-chave dos concorrentes</h2><p>Extraídas dos títulos sem IA. Frequência, preço e vendas aparecem somente quando existem na coleta.</p></div></div>
      <div className={styles.keywordTable}>{keywords.length?keywords.map(k=><div key={k.word}><b>{k.word}</b><span>{k.count} anúncios</span><span>{k.price!=null?money(k.price):'preço —'}</span><span>{k.sales!=null?compact(k.sales)+' vendas medianas':'vendas —'}</span></div>):<div className={styles.empty}>Sem termos recorrentes suficientes.</div>}</div>
    </section>}

    {activeTab==='competition'&&<section className={styles.competitionGrid}>
      <div className={styles.panel}><div className={styles.panelHead}><div><h2>Concentração de vendedores</h2><p>Muitos anúncios podem pertencer à mesma loja.</p></div></div><div className={styles.bigMetric}><strong>{concentration.shops||'—'}</strong><span>lojas únicas identificadas</span></div><div className={styles.bigMetric}><strong>{concentration.shops?concentration.share+'%':'—'}</strong><span>dos anúncios nas 5 lojas com mais resultados</span></div></div>
      <div className={styles.panel}><div className={styles.panelHead}><div><h2>Origem dos anúncios</h2><p>Somente localizações realmente coletadas.</p></div></div><div className={styles.bigMetric}><strong>{bench.mainLocation==='—'?'Não coletado':bench.mainLocation}</strong><span>origem mais comum</span></div><div className={styles.bigMetric}><strong>{bench.coverage.location}/{rows.length||0}</strong><span>anúncios com localização</span></div></div>
    </section>}

    {activeTab==='insights'&&<section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Insights da coleta</h2><p>Conclusões descritivas baseadas apenas nos campos disponíveis.</p></div></div>
      <div className={styles.insightGrid}>
        <article><span>💰</span><div><b>Preço</b><p>{bench.coverage.price?'Mediana observada: '+money(bench.priceMedian)+' em '+bench.coverage.price+' anúncios.':'Preço insuficiente para análise.'}</p></div></article>
        <article><span>📈</span><div><b>Demanda</b><p>{bench.coverage.sold?'Vendas disponíveis em '+bench.coverage.sold+' de '+rows.length+' anúncios.'+(suspiciousSales?' O padrão de zeros foi marcado como suspeito.':''):'A coleta atual não permite avaliar demanda por vendas.'}</p></div></article>
        <article><span>🏪</span><div><b>Concorrência</b><p>{concentration.shops?concentration.shops+' lojas únicas; as 5 com mais resultados concentram '+concentration.share+'% dos anúncios.':'Sem shop_id suficiente para medir concentração.'}</p></div></article>
        <article><span>🔎</span><div><b>Termos recorrentes</b><p>{keywords.length?'Mais usados: '+keywords.slice(0,5).map(k=>k.word).join(', ')+'.':'Sem títulos suficientes.'}</p></div></article>
        <article><span>🧪</span><div><b>Confiabilidade</b><p>Qualidade geral: {qualityLabel.toLowerCase()} ({quality}%). Dados ausentes continuam ausentes e não viram zero.</p></div></article>
      </div>
    </section>}
  </div>;
}
 