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


function titleCase(text){
  return String(text||'').trim().split(/\s+/).filter(Boolean).map(w=>w.length<=2?w.toLowerCase():w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');
}
function variationInsights(rows){
  const defs=[
    ['Menina',/\bmenina\b/i],['Menino',/\bmenino\b/i],['Ursinha',/\bursinha\b/i],['Ursinho',/\bursinho\b/i],
    ['Homem-Aranha',/homem[-\s]?aranha|spider[-\s]?man/i],['Princesa',/\bprincesa\b/i],['Floral',/\bfloral\b|\bflores?\b/i],
    ['Rosa',/\brosa\b/i],['Azul',/\bazul\b/i],['Safari',/\bsafari\b/i],['Dinossauro',/dinossaur/i],['Unicórnio',/unic[oó]rn/i]
  ];
  return defs.map(([name,re])=>{
    const hits=rows.filter(r=>re.test(String(r.title||'')));
    const strength=hits.reduce((sum,r)=>sum+(n(r.monthlySold)??n(r.sold)??0),0);
    return {name,count:hits.length,strength};
  }).filter(x=>x.count>0).sort((a,b)=>b.strength-a.strength||b.count-a.count);
}
function copyText(text){
  if(typeof navigator==='undefined'||!navigator.clipboard||!text)return;
  navigator.clipboard.writeText(String(text)).catch(()=>{});
}
function modeLabel(value){
  if(value==='quick')return 'Rápida · 1 pág.';
  if(value==='standard')return 'Padrão · 3 págs.';
  if(value==='deep')return 'Profunda · 5 págs.';
  return 'Não registrada';
}
function researchMetrics(entry){
  const list=Array.isArray(entry?.rows)?entry.rows:[];
  const snapshot=entry?.summary||stats(list);
  const concentration=sellerConcentration(list);
  const demand=snapshot?.monthlyMedian??snapshot?.soldMedian??null;
  const price=snapshot?.priceMedian??null;
  const reviewMedian=snapshot?.reviewMedian??median(list.map(r=>n(r?.reviews)));
  const sellerShare=n(snapshot?.sellerTop5Share)??(concentration.shops?concentration.share:null);
  return{
    demand,
    price,
    revenueProxy:demand!=null&&price!=null?demand*price:null,
    reviewMedian,
    sellerShare,
    shops:n(snapshot?.shops)??(concentration.shops||null),
    quality:n(entry?.quality)??0
  };
}
function relativeMetricScore(values,value,higherIsBetter=true){
  if(value==null||!Number.isFinite(Number(value)))return 35;
  const clean=values.filter(v=>v!=null&&Number.isFinite(Number(v))).map(v=>Math.log1p(Math.max(0,Number(v))));
  if(clean.length<2)return 50;
  const x=Math.log1p(Math.max(0,Number(value))),min=Math.min(...clean),max=Math.max(...clean);
  if(max===min)return 50;
  const pct=(x-min)/(max-min);
  return Math.round((higherIsBetter?pct:1-pct)*100);
}
function resaleScoreLabel(score){
  if(score>=80)return 'Sinal muito forte';
  if(score>=65)return 'Boa oportunidade';
  if(score>=50)return 'Vale estudar';
  return 'Cautela';
}
function financeAnalysis(price,cost,config){
  const sale=n(price),productCost=n(cost);
  if(!(sale>0)||productCost==null||productCost<0)return null;
  const commissionRate=Math.max(0,n(config?.commissionRate)??20)/100;
  const fixedFee=Math.max(0,n(config?.fixedFee)??4.5);
  const packagingCost=Math.max(0,n(config?.packagingCost)??0);
  const taxRate=Math.max(0,n(config?.taxRate)??0)/100;
  const otherCost=Math.max(0,n(config?.otherCost)??0);
  const commission=sale*commissionRate,tax=sale*taxRate;
  const profit=sale-productCost-commission-fixedFee-packagingCost-tax-otherCost;
  return{sale,productCost,commissionRate,commission,fixedFee,packagingCost,taxRate,tax,otherCost,profit,marginPct:profit/sale*100};
}
function absoluteMarginScore(margin){
  if(margin==null||!Number.isFinite(Number(margin)))return 50;
  return Math.max(0,Math.min(100,Math.round((Number(margin)+10)/50*100)));
}

/* ---- Apresentação para leigos: tradução de números em texto + tom (cor NUNCA é o único sinal) ---- */
const MARGIN_GOOD_PCT=20,MARGIN_TIGHT_PCT=10; // heurísticas de leitura; ajustáveis (MARGIN_TIGHT_PCT igual ao Super Anúncio)
function toneOfScore(score){return score>=65?'good':score>=50?'warn':'bad'}
function marginInfo(pct){
  if(pct==null||!Number.isFinite(Number(pct)))return null;
  if(pct>=MARGIN_GOOD_PCT)return{tone:'good',label:'Margem saudável'};
  if(pct>=MARGIN_TIGHT_PCT)return{tone:'warn',label:'Margem apertada'};
  return{tone:'bad',label:pct<0?'Prejuízo':'Margem baixa'};
}
function demandInfo(score){
  if(score>=65)return{tone:'good',label:'Demanda forte'};
  if(score>=40)return{tone:'warn',label:'Demanda moderada'};
  return{tone:'bad',label:'Demanda fraca'};
}
function competitionInfo(share){
  if(share==null||!Number.isFinite(Number(share)))return{tone:'info',label:'Concorrência sem dados'};
  if(share>=45)return{tone:'bad',label:'Concorrência alta'};
  if(share>=25)return{tone:'warn',label:'Concorrência média'};
  return{tone:'good',label:'Concorrência baixa'};
}
function dataQualityInfo(pct){
  if(pct==null||!Number.isFinite(Number(pct)))return{tone:'info',label:'Qualidade dos dados não informada'};
  if(pct>=75)return{tone:'good',label:'Dados completos'};
  if(pct>=45)return{tone:'warn',label:'Dados parciais'};
  return{tone:'bad',label:'Poucos dados disponíveis'};
}
const ICONS={
  search:<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
  import:<><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></>,
  export:<><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></>,
  trash:<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  up:<><path d="M6 15l6-6 6 6"/></>,
  down:<><path d="M6 9l6 6 6-6"/></>,
  sparkle:<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></>,
  tag:<><path d="M3 12V4h8l10 10-8 8z"/><path d="M7.5 8.5h.01"/></>,
  trend:<><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></>,
  store:<><path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9a3 3 0 006 0 3 3 0 006 0 3 3 0 004 0M10 20v-6h4v6"/></>,
  shield:<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></>,
  check:<><path d="M5 12.5l4.5 4.5L19 7.5"/></>,
  alert:<><path d="M12 4l9 16H3zM12 10v4M12 17h.01"/></>,
  x:<><path d="M6 6l12 12M18 6L6 18"/></>,
  repeat:<><path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/></>,
  open:<><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></>
};
function Icon({name}){
  return <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICONS[name]||null}</svg>;
}
const TONE_ICON={good:'check',warn:'alert',bad:'x',info:'info'};
function Tone({tone='info',children}){
  return <span className={styles.tone} data-tone={tone}><Icon name={TONE_ICON[tone]||'info'}/>{children}</span>;
}

export default function MarketResearch(){
  const [query,setQuery]=useState('');
  const [rows,setRows]=useState([]);
  const [removedRows,setRemovedRows]=useState([]);
  const [selectedResultKeys,setSelectedResultKeys]=useState([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Digite o produto e clique em pesquisar. Você também pode importar uma coleta salva.');
  const [sort,setSort]=useState('score');
  const [minSold,setMinSold]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [activeTab,setActiveTab]=useState('overview');
  const [mode,setMode]=useState('standard');
  const [currentResearchMode,setCurrentResearchMode]=useState(null);
  const [page,setPage]=useState(1);
  const [saved,setSaved]=useState([]);
  const [researchCosts,setResearchCosts]=useState({});
  const [searchCostDraft,setSearchCostDraft]=useState('');
  const [financeConfig,setFinanceConfig]=useState({commissionRate:20,fixedFee:4.5,packagingCost:0,taxRate:0,otherCost:0});
  const [historyOpen,setHistoryOpen]=useState(false);
  const [historyFilter,setHistoryFilter]=useState('');
  const [historyShowAll,setHistoryShowAll]=useState(false);
  const [selectedHistoryId,setSelectedHistoryId]=useState(null);
  const [comparison,setComparison]=useState(null);
  const [diagnostics,setDiagnostics]=useState(null);
  const [diagnosticsOpen,setDiagnosticsOpen]=useState(false);
  const [overviewVisible,setOverviewVisible]=useState(true);
  const [assistantVisible,setAssistantVisible]=useState(false);
  const [assistantTab,setAssistantTab]=useState('product');
  const [assistantObjective,setAssistantObjective]=useState('sales');
  const [productDetails,setProductDetails]=useState({material:'',size:'',colors:'',contents:'',audience:'',differentials:'',usage:'',notes:''});
  const [aiListing,setAiListing]=useState({title:'',description:'',loadingTitle:false,loadingDescription:false,error:''});
  const fileRef=useRef(null);
  const PAGE_SIZE=20;
  useEffect(()=>{
    try{
      const stored=JSON.parse(localStorage.getItem('gs_market_saved')||'[]');
      const list=Array.isArray(stored)?stored.slice(0,50):[];
      setSaved(list);
      const savedCosts=JSON.parse(localStorage.getItem('gs_market_research_costs')||'{}');
      if(savedCosts&&typeof savedCosts==='object')setResearchCosts(savedCosts);
      const finance=JSON.parse(localStorage.getItem('gs_shopee_finance_config')||'null');
      if(finance&&typeof finance==='object')setFinanceConfig(x=>({...x,...finance}));
      if(list.length)setSelectedHistoryId(list[0].id);
      setHistoryOpen(localStorage.getItem('historico_aberto')==='true');
    }catch{
      setSaved([]);
      setHistoryOpen(false);
    }
  },[]);
  useEffect(()=>{try{localStorage.setItem('historico_aberto',historyOpen?'true':'false')}catch{}},[historyOpen]);
  useEffect(()=>{
    const key=String(query||'').trim().toLowerCase();
    const stored=key?researchCosts[key]:null;
    setSearchCostDraft(stored==null?'':String(stored).replace('.',','));
  },[query]);

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

  function downloadDiagnostics(){
    if(!diagnostics)return;
    const blob=new Blob([JSON.stringify({query:query.trim()||null,exportedAt:new Date().toISOString(),diagnostics},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='diagnostico-pesquisa-produtos-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function loadPayload(payload,source='arquivo'){
    const normalized=extractRows(payload).map(normalizeOne).filter(r=>r.itemId||r.title);
    const diag=payload?.diagnostics??payload?.data?.diagnostics??null;
    setRows(normalized);
    setRemovedRows([]);
    setSelectedResultKeys([]);
    setDiagnostics(diag);
    setMessage(normalized.length?`${normalized.length} anúncios carregados de ${source}.`:'Nenhum anúncio válido foi encontrado nessa coleta.');
    return {normalized,diagnostics:diag};
  }

  function syncRefinedResearch(nextRows){
    if(!selectedHistoryId)return;
    setSaved(current=>{
      const next=current.map(entry=>{
        if(entry.id!==selectedHistoryId)return entry;
        const snapshot=stats(nextRows);
        const coverageValues=Object.values(snapshot.coverage||{});
        const snapshotQuality=nextRows.length?Math.round(coverageValues.reduce((sum,value)=>sum+value,0)/(nextRows.length*Math.max(1,coverageValues.length))*100):0;
        const concentration=sellerConcentration(nextRows);
        return{
          ...entry,
          count:nextRows.length,
          quality:snapshotQuality,
          rows:compactRows(nextRows),
          summary:{
            priceMedian:snapshot.priceMedian,
            soldMedian:snapshot.soldMedian,
            monthlyMedian:snapshot.monthlyMedian,
            mainLocation:snapshot.mainLocation,
            reviewMedian:snapshot.reviewMedian,
            shops:concentration.shops,
            sellerTop5Share:concentration.share,
            coverage:snapshot.coverage
          },
          refinedAt:new Date().toISOString()
        };
      });
      try{localStorage.setItem('gs_market_saved',JSON.stringify(next.slice(0,50)))}catch{}
      return next;
    });
  }

  function toggleResultSelection(key){
    setSelectedResultKeys(current=>current.includes(key)?current.filter(item=>item!==key):[...current,key]);
  }
  function toggleCurrentPageSelection(){
    const pageKeys=paged.map(item=>item.key);
    const allSelected=pageKeys.length>0&&pageKeys.every(key=>selectedResultKeys.includes(key));
    setSelectedResultKeys(current=>allSelected?current.filter(key=>!pageKeys.includes(key)):[...new Set([...current,...pageKeys])]);
  }
  function removeSelectedFromAnalysis(){
    if(!selectedResultKeys.length)return;
    const selectedSet=new Set(selectedResultKeys);
    const selectedRows=rows.filter(item=>selectedSet.has(item.key));
    if(!selectedRows.length){setSelectedResultKeys([]);return}
    setRows(current=>{
      const next=current.filter(item=>!selectedSet.has(item.key));
      syncRefinedResearch(next);
      return next;
    });
    setRemovedRows(current=>[...selectedRows.map(row=>({row})),...current]);
    setSelectedResultKeys([]);
    setPage(1);
  }
  function undoLastRemoval(){
    setRemovedRows(current=>{
      if(!current.length)return current;
      const [last,...rest]=current;
      setRows(rowsNow=>{
        const next=[...rowsNow,last.row].sort((a,b)=>(a.index??0)-(b.index??0));
        syncRefinedResearch(next);
        return next;
      });
      setSelectedResultKeys([]);
      return rest;
    });
  }
  function restoreAllRemoved(){
    setRemovedRows(current=>{
      if(!current.length)return current;
      setRows(rowsNow=>{
        const next=[...rowsNow,...current.map(item=>item.row)].sort((a,b)=>(a.index??0)-(b.index??0));
        syncRefinedResearch(next);
        return next;
      });
      return [];
    });
    setSelectedResultKeys([]);
    setPage(1);
  }

  function compactRows(list){
    return list.map(({raw,...row})=>row);
  }
  function historyEntry(term,list,diag,searchMode=mode){
    const snapshot=stats(list);
    const coverageValues=Object.values(snapshot.coverage||{});
    const snapshotQuality=list.length?Math.round(coverageValues.reduce((sum,value)=>sum+value,0)/(list.length*Math.max(1,coverageValues.length))*100):0;
    return {
      id:Date.now(),
      query:String(term||'Pesquisa importada').trim()||'Pesquisa importada',
      date:new Date().toISOString(),
      mode:searchMode,
      count:list.length,
      quality:snapshotQuality,
      rows:compactRows(list),
      diagnostics:diag||null,
      summary:{
        priceMedian:snapshot.priceMedian,
        soldMedian:snapshot.soldMedian,
        monthlyMedian:snapshot.monthlyMedian,
        mainLocation:snapshot.mainLocation,
        reviewMedian:snapshot.reviewMedian,
        shops:sellerConcentration(list).shops,
        sellerTop5Share:sellerConcentration(list).share,
        coverage:snapshot.coverage
      }
    };
  }
  function persistHistory(next){
    const limited=next.slice(0,50);
    setSaved(limited);
    try{localStorage.setItem('gs_market_saved',JSON.stringify(limited))}catch{}
    return limited;
  }
  function saveSnapshot(term,list,diag,searchMode=mode){
    if(!list.length)return null;
    const entry=historyEntry(term,list,diag,searchMode);
    persistHistory([entry,...saved]);
    setSelectedHistoryId(entry.id);
    return entry;
  }
  function reopenResearch(entry){
    if(!entry)return;
    if(!Array.isArray(entry.rows)||!entry.rows.length){
      setMessage('Esta pesquisa foi salva por uma versão antiga e não possui os anúncios necessários para reabrir.');
      return;
    }
    setQuery(entry.query||'');
    setMode(entry.mode||'standard');
    setCurrentResearchMode(entry.mode||null);
    setRows(entry.rows.map((row,index)=>({...row,index,key:row.key||row.itemId||row.shopId||String(index)})));
    setDiagnostics(entry.diagnostics||null);
    setComparison(null);
    setActiveTab('overview');
    setMessage(`${entry.rows.length} anúncios reabertos do histórico, sem nova coleta.`);
  }
  function deleteResearch(entry){
    if(!entry)return;
    const next=persistHistory(saved.filter(item=>item.id!==entry.id));
    if(selectedHistoryId===entry.id)setSelectedHistoryId(next[0]?.id??null);
    setComparison(current=>current?.historyId===entry.id?null:current);
  }
  function researchKey(entryOrQuery){
    const value=typeof entryOrQuery==='string'?entryOrQuery:entryOrQuery?.query;
    return String(value||'').trim().toLowerCase();
  }
  function saveResearchCost(entry,value){
    const key=researchKey(entry);
    if(!key)return;
    const raw=String(value??'').trim();
    const parsed=raw===''?null:Number(raw.replace(',','.'));
    const next={...researchCosts};
    if(parsed==null||!Number.isFinite(parsed)||parsed<0)delete next[key];
    else next[key]=parsed;
    setResearchCosts(next);
    try{localStorage.setItem('gs_market_research_costs',JSON.stringify(next))}catch{}
  }
  function commitSearchCost(){
    const key=researchKey(query);
    if(!key)return;
    saveResearchCost(query,searchCostDraft);
  }
  function comparableDelta(before,after){
    if(before==null||after==null)return null;
    return after-before;
  }
  async function repeatAndCompare(entry){
    if(!entry||busy)return;
    const term=String(entry.query||'').trim();
    if(!term){setMessage('Esta pesquisa não possui um termo válido para repetir.');return}
    setBusy(true);
    setMessage('Repetindo a pesquisa para comparar com o histórico…');
    try{
      const searchMode=entry.mode||'standard';
      const pagesByMode={quick:1,standard:3,deep:5};
      const data=await motorData('marketplaceSearch',{query:term,sort:'relevance',pages:pagesByMode[searchMode]},75000);
      const result=loadPayload(data,'nova coleta para comparação');
      const currentStats=stats(result.normalized);
      const previous=entry.summary||stats(Array.isArray(entry.rows)?entry.rows:[]);
      setQuery(term);
      setMode(searchMode);
      setCurrentResearchMode(searchMode);
      const newEntry=saveSnapshot(term,result.normalized,result.diagnostics,searchMode);
      setComparison({
        historyId:newEntry?.id??entry.id,
        previousDate:entry.date,
        currentDate:newEntry?.date??new Date().toISOString(),
        before:previous,
        after:currentStats,
        deltas:{
          priceMedian:comparableDelta(previous?.priceMedian,currentStats.priceMedian),
          soldMedian:comparableDelta(previous?.soldMedian,currentStats.soldMedian),
          monthlyMedian:comparableDelta(previous?.monthlyMedian,currentStats.monthlyMedian)
        }
      });
      setMessage('Nova coleta concluída e salva. A comparação usa apenas campos disponíveis nas duas pesquisas.');
    }catch(error){
      setMessage('Não consegui repetir a pesquisa: '+String(error?.message||error)+'.');
    }finally{setBusy(false)}
  }

  async function search(){
    const term=query.trim();
    if(!term){setMessage('Digite uma palavra-chave para pesquisar.');return}
    commitSearchCost();
    setBusy(true);setMessage('Pedindo ao Motor Sênior para coletar a busca da Shopee…');
    try{
      const pagesByMode={quick:1,standard:3,deep:5};
      const data=await motorData('marketplaceSearch',{query:term,sort:'relevance',pages:pagesByMode[mode]},75000);
      const result=loadPayload(data,'busca ao vivo');
      setCurrentResearchMode(mode);
      if(result.normalized.length)saveSnapshot(term,result.normalized,result.diagnostics,mode);
    }catch(error){
      setMessage('Não consegui concluir a pesquisa automática: '+String(error?.message||error)+'. Verifique se o Motor Senior está conectado e tente novamente.');
    }finally{setBusy(false)}
  }

  async function onFile(file){
    if(!file)return;
    try{
      const text=await file.text();
      const result=loadPayload(JSON.parse(text),file.name);
      setCurrentResearchMode(null);
      if(result.normalized.length)saveSnapshot(query.trim()||'Pesquisa importada',result.normalized,result.diagnostics,null);
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
  const variations=useMemo(()=>variationInsights(rows),[rows]);
  const referenceProducts=useMemo(()=>[...rows].filter(r=>r.url).sort((a,b)=>(n(b.monthlySold)??n(b.sold)??0)-(n(a.monthlySold)??n(a.sold)??0)).slice(0,3),[rows]);
  const assistant=useMemo(()=>{
    const base=titleCase(query.trim()||keywords.slice(0,3).map(k=>k.word).join(' ')||'Produto');
    const bestVariation=variations[0]?.name||null;
    const topTerms=keywords.slice(0,6).map(k=>k.word);
    const filled=Object.values(productDetails).filter(v=>String(v||'').trim()).length;
    const completeness=Math.round(filled/8*100);
    const titleParts=[base,productDetails.material,productDetails.size,productDetails.colors,bestVariation&&!base.toLowerCase().includes(String(bestVariation).toLowerCase())?bestVariation:null]
      .map(v=>String(v||'').trim()).filter(Boolean);
    const suggestedTitle=titleParts.filter((v,i,a)=>a.findIndex(x=>x.toLowerCase()===v.toLowerCase())===i).join(' · ').slice(0,120);
    const interest=[
      productDetails.material?`Material: ${productDetails.material}.`:null,
      productDetails.size?`Tamanho/medidas: ${productDetails.size}.`:null,
      productDetails.colors?`Cor(es): ${productDetails.colors}.`:null,
      productDetails.contents?`Conteúdo do produto/kit: ${productDetails.contents}.`:null
    ].filter(Boolean).join(' ');
    const desire=[
      productDetails.differentials?`Diferenciais e benefícios: ${productDetails.differentials}.`:null,
      productDetails.audience?`Indicado para: ${productDetails.audience}.`:null,
      productDetails.usage?`Uso/aplicação: ${productDetails.usage}.`:null,
      productDetails.notes?`Informações adicionais: ${productDetails.notes}.`:null
    ].filter(Boolean).join(' ');
    const description=[
      'ATENÇÃO',
      `Conheça ${base}${productDetails.colors?' na cor '+productDetails.colors:''}${productDetails.size?' — '+productDetails.size:''}. Uma apresentação clara para destacar o que realmente importa no produto.`,
      '',
      'INTERESSE',
      interest||'Complete material, medidas, cores e conteúdo do produto para gerar esta parte com precisão.',
      '',
      'DESEJO',
      desire||'Adicione diferenciais, público e forma de uso para transformar características em benefícios reais.',
      '',
      'AÇÃO',
      `Confira as informações, escolha a variação desejada e garanta seu ${base.toLowerCase()}.`
    ].join('\n');
    return{
      theme:base||'—',
      bestVariation:bestVariation||'Sem padrão claro',
      priceRange:bench.priceMedian!=null?`${money(Math.max(0,bench.priceMedian*.8))} – ${money(bench.priceMedian*1.2)}`:'Não coletado',
      competition:concentration.shops&&rows.length?(concentration.share>=45?'Alta':concentration.share>=25?'Média':'Baixa'):'Sem dados',
      suggestedTitle,
      description,
      topTerms,
      completeness
    };
  },[query,keywords,variations,bench.priceMedian,concentration.shops,concentration.share,rows.length,productDetails]);
  useEffect(()=>setPage(1),[sort,minSold,maxPrice,rows.length]);
  useEffect(()=>setSelectedResultKeys([]),[sort,minSold,maxPrice,page]);
  useEffect(()=>{
    const key=researchKey(query);
    const empty={material:'',size:'',colors:'',contents:'',audience:'',differentials:'',usage:'',notes:''};
    if(!key){setProductDetails(empty);return}
    try{
      const map=JSON.parse(localStorage.getItem('gs_market_product_details')||'{}');
      setProductDetails({...empty,...(map?.[key]||{})});
    }catch{setProductDetails(empty)}
  },[query]);
  function updateProductDetail(field,value){
    const next={...productDetails,[field]:value};
    setProductDetails(next);
    setAiListing(x=>({...x,title:'',description:'',error:''}));
    const key=researchKey(query);
    if(!key)return;
    try{
      const map=JSON.parse(localStorage.getItem('gs_market_product_details')||'{}');
      localStorage.setItem('gs_market_product_details',JSON.stringify({...map,[key]:next}));
    }catch{}
  }
  function aiMarketContext(){
    return [
      `Produto pesquisado: ${query.trim()||assistant.theme}`,
      `Objetivo: ${assistantObjective==='sales'?'priorizar conversão e vendas':assistantObjective==='competition'?'diferenciação com menor concorrência':'posicionamento de preço'}`,
      `Material: ${productDetails.material||'não informado'}`,
      `Tamanho/medidas: ${productDetails.size||'não informado'}`,
      `Cores: ${productDetails.colors||'não informado'}`,
      `Conteúdo do produto/kit: ${productDetails.contents||'não informado'}`,
      `Público: ${productDetails.audience||'não informado'}`,
      `Uso/aplicação: ${productDetails.usage||'não informado'}`,
      `Diferenciais/benefícios: ${productDetails.differentials||'não informado'}`,
      `Outras informações: ${productDetails.notes||'não informado'}`,
      `Palavras-chave recorrentes da pesquisa: ${assistant.topTerms.length?assistant.topTerms.join(', '):'não disponíveis'}`,
      `Variação mais forte observada: ${assistant.bestVariation}`,
      `Preço mediano observado: ${bench.priceMedian!=null?money(bench.priceMedian):'não coletado'}`,
      `Concorrência observada: ${assistant.competition}`
    ].join('\n');
  }
  async function generateWithAI(kind){
    const isTitle=kind==='title';
    setAiListing(x=>({...x,[isTitle?'loadingTitle':'loadingDescription']:true,error:''}));
    try{
      const response=await fetch('/api/ai/improve',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          type:isTitle?'market-title':'market-description',
          marketContext:aiMarketContext()
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.text)throw new Error(data?.error||'A I.A. não conseguiu gerar o conteúdo.');
      setAiListing(x=>({...x,[kind]:String(data.text).trim(),[isTitle?'loadingTitle':'loadingDescription']:false,error:''}));
    }catch(error){
      setAiListing(x=>({...x,[kind]:isTitle?assistant.suggestedTitle:assistant.description,[isTitle?'loadingTitle':'loadingDescription']:false,error:'A I.A. falhou agora. O Gestor exibiu o rascunho local como alternativa.'}));
    }
  }
  function exportCurrentResearch(){
    if(!rows.length)return;
    exportResearch(historyEntry(query.trim()||'Pesquisa importada',rows,diagnostics,currentResearchMode));
  }
  function exportResearch(entry){
    if(!entry)return;
    const blob=new Blob([JSON.stringify(entry,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    const safeName=String(entry.query||'pesquisa').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'pesquisa';
    a.href=url;
    a.download=`pesquisa-${safeName}-${entry.id}.json`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const selectedHistory=useMemo(()=>saved.find(item=>item.id===selectedHistoryId)||saved[0]||null,[saved,selectedHistoryId]);
  const filteredHistory=useMemo(()=>{
    const term=historyFilter.trim().toLowerCase();
    return term?saved.filter(item=>String(item.query||'').toLowerCase().includes(term)):saved;
  },[saved,historyFilter]);
  const visibleHistory=historyShowAll?filteredHistory:filteredHistory.slice(0,6);
  const resaleRanking=useMemo(()=>{
    const unique=[],seen=new Set();
    saved.forEach(entry=>{
      const key=researchKey(entry);
      if(!key||seen.has(key))return;
      seen.add(key);unique.push(entry);
    });
    const metrics=unique.map(entry=>{
      const m=researchMetrics(entry),cost=n(researchCosts[researchKey(entry)]),finance=financeAnalysis(m.price,cost,financeConfig);
      return{entry,metrics:m,cost,finance};
    });
    const demands=metrics.map(x=>x.metrics.demand),revenues=metrics.map(x=>x.metrics.revenueProxy),reviews=metrics.map(x=>x.metrics.reviewMedian),shares=metrics.map(x=>x.metrics.sellerShare),profits=metrics.map(x=>x.finance?.profit??null);
    return metrics.map(({entry,metrics:m,cost,finance})=>{
      const base={
        demand:relativeMetricScore(demands,m.demand,true),
        revenue:relativeMetricScore(revenues,m.revenueProxy,true),
        competition:relativeMetricScore(shares,m.sellerShare,false),
        social:relativeMetricScore(reviews,m.reviewMedian,true),
        quality:Math.max(0,Math.min(100,Math.round(m.quality||0)))
      };
      const profitability=finance?Math.round(absoluteMarginScore(finance.marginPct)*.6+relativeMetricScore(profits,finance.profit,true)*.4):null;
      const provisional=profitability==null;
      const breakdown={...base,profitability};
      const score=provisional
        ?Math.round(base.demand*.35+base.revenue*.25+base.competition*.20+base.social*.10+base.quality*.10)
        :Math.round(base.demand*.25+base.revenue*.15+base.competition*.15+base.social*.05+base.quality*.10+profitability*.30);
      return{entry,metrics:m,cost,finance,breakdown,score,provisional,label:provisional?'Custo pendente · '+resaleScoreLabel(score):resaleScoreLabel(score)};
    }).sort((a,b)=>b.score-a.score||String(b.entry.date||'').localeCompare(String(a.entry.date||'')));
  },[saved,researchCosts,financeConfig]);
  const resaleScoreById=useMemo(()=>Object.fromEntries(resaleRanking.map(x=>[x.entry.id,x])),[resaleRanking]);
  const selectedResale=selectedHistory?resaleScoreById[selectedHistory.id]||null:null;
  const historyFinanceById=useMemo(()=>Object.fromEntries(saved.map(entry=>{
    const metrics=researchMetrics(entry);
    const cost=n(researchCosts[researchKey(entry)]);
    return[entry.id,financeAnalysis(metrics.price,cost,financeConfig)];
  })),[saved,researchCosts,financeConfig]);
  const tabs=[['overview','Visão geral'],['results','Resultados'],['top','Oportunidades'],['keywords','Palavras-chave'],['competition','Concorrência'],['insights','Insights']];

  const relCount=resaleRanking.length;
  const openQuality=dataQualityInfo(rows.length?quality:null);
  const openCompetition=competitionInfo(concentration.shops?concentration.share:null);

  return <div className={styles.page}>
    <header className={styles.header}>
      <span className={styles.eyebrow}>Inteligência de mercado</span>
      <h1>Pesquisa de Produtos</h1>
      <p>Pesquise um produto na Shopee e veja se vale a pena revender: demanda, preço, concorrência e lucro estimado.</p>
    </header>

    {/* 1 · PESQUISA (azul) */}
    <section className={styles.searchCard} aria-labelledby="titulo-pesquisa">
      <div className={styles.cardTitle}>
        <span className={styles.cardIcon} aria-hidden="true"><Icon name="search"/></span>
        <div><h2 id="titulo-pesquisa">Nova pesquisa</h2><p>Siga os 3 passos e clique em pesquisar.</p></div>
      </div>

      <div className={styles.step}>
        <label className={styles.stepLabel} htmlFor="pesquisa-termo"><i>1</i>O que deseja pesquisar?</label>
        <div className={styles.searchLine}>
          <div className={styles.searchBox}>
            <Icon name="search"/>
            <input id="pesquisa-termo" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!busy&&search()} placeholder="Ex.: TAG saída maternidade"/>
          </div>
          <button type="button" className={styles.primaryBtn} onClick={search} disabled={busy}>{busy?'Coletando automaticamente…':'Pesquisar automaticamente'}</button>
        </div>
      </div>

      <div className={styles.stepsRow}>
        <div className={styles.step}>
          <div className={styles.stepLabel} id="passo-profundidade"><i>2</i>Profundidade</div>
          <div className={styles.depthGrid} role="radiogroup" aria-labelledby="passo-profundidade">
            {[['quick','Rápida','Teste inicial','1 pág.'],['standard','Padrão','Recomendada','3 págs.'],['deep','Profunda','Análise mais completa','5 págs.']].map(([id,name,hint,pagesLabel])=><button key={id} type="button" role="radio" aria-checked={mode===id} className={mode===id?styles.depthActive:styles.depth} onClick={()=>setMode(id)}>
              <b>{name}</b><span>{hint}</span><small>{pagesLabel}</small>
            </button>)}
          </div>
        </div>
        <div className={styles.step}>
          <label className={styles.stepLabel} htmlFor="pesquisa-custo"><i>3</i>Custo do produto <em>opcional</em></label>
          <div className={styles.costBox}><span>R$</span><input id="pesquisa-custo" inputMode="decimal" placeholder="0,00" value={searchCostDraft} onChange={e=>setSearchCostDraft(e.target.value)} onBlur={commitSearchCost}/></div>
          <p className={styles.hint}>Usado para estimar lucro e margem. As taxas da Shopee vêm das Configurações do Gestor.</p>
        </div>
      </div>

      <div className={styles.searchFooter}>
        <div className={styles.message} aria-live="polite">
          <span>{message}</span>
          {rows.length>0&&<span className={styles.currentDepth}>Profundidade usada: <b>{modeLabel(currentResearchMode)}</b></span>}
        </div>
        <div className={styles.secondaryActions}>
          <button type="button" className={styles.ghostBtn} onClick={()=>fileRef.current?.click()}><Icon name="import"/>Importar coleta</button>
          <button type="button" className={styles.ghostBtn} onClick={exportCurrentResearch} disabled={!rows.length} title="Exportar a coleta atual em JSON"><Icon name="export"/>Exportar coleta</button>
          <button type="button" className={historyOpen?styles.historyToggleOpen:styles.historyToggle} aria-expanded={historyOpen} aria-controls="pesquisas-anteriores" onClick={()=>setHistoryOpen(v=>!v)}>
            <Icon name="clock"/><b>{historyOpen?'Ocultar histórico':'Histórico de pesquisas'}</b><em>{saved.length}</em><Icon name={historyOpen?'up':'down'}/>
          </button>
          <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={e=>onFile(e.target.files?.[0])}/>
        </div>
      </div>
    </section>

    {/* 2 · HISTÓRICO (roxo) */}
    {historyOpen&&<section id="pesquisas-anteriores" className={styles.historyCard} aria-label="Pesquisas anteriores">
      <div className={styles.historyHeader}>
        <div><span className={styles.kicker}>Histórico</span><h2>Pesquisas anteriores</h2><p>Escolha uma pesquisa para ver o resumo. Abra a que parecer mais promissora ou repita a busca para comparar.</p></div>
        <label className={styles.historySearch}><span className={styles.srOnly}>Filtrar histórico por termo</span><Icon name="search"/><input value={historyFilter} onChange={e=>{setHistoryFilter(e.target.value);setHistoryShowAll(false)}} placeholder="Filtrar por termo"/></label>
      </div>
      {!saved.length?<div className={styles.historyEmpty}><Icon name="clock"/><b>Nenhuma pesquisa salva ainda</b><p>Faça uma pesquisa acima. Ela será salva aqui automaticamente, com os dados realmente coletados.</p></div>:<>
      <div className={styles.historyGrid}>
        <div className={styles.historyList} role="list" aria-label="Lista de pesquisas salvas">
          {!filteredHistory.length?<div className={styles.historyNoMatch}>Nenhuma pesquisa corresponde a “{historyFilter}”.</div>:visibleHistory.map(entry=>{
            const resale=resaleScoreById[entry.id],fin=historyFinanceById[entry.id],margin=fin?marginInfo(fin.marginPct):null,active=selectedHistory?.id===entry.id;
            return <div key={entry.id} role="listitem" className={active?styles.historyItemActive:styles.historyItem}>
              <button type="button" className={styles.historyItemMain} aria-pressed={active} onClick={()=>setSelectedHistoryId(entry.id)}>
                <span className={styles.hiInfo}>
                  <b>{entry.query||'Pesquisa sem termo'}</b>
                  <small>{entry.date?new Date(entry.date).toLocaleDateString('pt-BR'):'Data não disponível'} · {modeLabel(entry.mode)}</small>
                  <small>{entry.count??(Array.isArray(entry.rows)?entry.rows.length:'—')} anúncios analisados</small>
                  {resale?<Tone tone={toneOfScore(resale.score)}>Score {resale.score} · {resaleScoreLabel(resale.score)}</Tone>:<span className={styles.mutedChip}>Coleta anterior · sem nota</span>}
                </span>
                <span className={styles.hiMoney}>
                  {fin?<>
                    <span className={styles.profitBig} data-tone={fin.profit>0?'good':'bad'}><small>Lucro estimado</small><strong>{money(fin.profit)}</strong></span>
                    <Tone tone={margin.tone}>Margem {fin.marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})}% · {margin.label}</Tone>
                  </>:<span className={styles.needCost}>Informe o custo para ver lucro e margem</span>}
                </span>
              </button>
              <div className={styles.historyItemTools}>
                <button type="button" className={styles.iconBtn} onClick={()=>exportResearch(entry)} title="Exportar pesquisa" aria-label={`Exportar pesquisa ${entry.query||''}`}><Icon name="export"/></button>
                <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={()=>deleteResearch(entry)} title="Excluir pesquisa" aria-label={`Excluir pesquisa ${entry.query||''}`}><Icon name="trash"/></button>
              </div>
            </div>;
          })}
          {filteredHistory.length>6&&<button type="button" className={styles.viewAllHistory} onClick={()=>setHistoryShowAll(v=>!v)}>{historyShowAll?'Mostrar menos':'Ver todas'} ({filteredHistory.length})</button>}
        </div>

        <div className={`${styles.historyDetails} ${styles.decisionCard}`}>
          {selectedHistory&&(()=>{
            const m=researchMetrics(selectedHistory),cost=n(researchCosts[researchKey(selectedHistory)]),fin=historyFinanceById[selectedHistory.id],margin=fin?marginInfo(fin.marginPct):null;
            const monthly=selectedHistory.summary?.monthlyMedian!=null;
            const competition=competitionInfo(m.sellerShare),dataQ=dataQualityInfo(n(selectedHistory.quality));
            const demandText=m.demand==null?'Sem dados de demanda':(relCount>=3&&selectedResale?demandInfo(selectedResale.breakdown.demand).label+' (vs. suas pesquisas)':'Demanda: '+compact(m.demand)+(monthly?' vendas em 30 dias':' vendas acumuladas'));
            const demandTone=m.demand==null?'info':(relCount>=3&&selectedResale?demandInfo(selectedResale.breakdown.demand).tone:'info');
            const hasRows=Array.isArray(selectedHistory.rows)&&selectedHistory.rows.length>0;
            return <>
              <div className={styles.decisionHead}>
                <div><span className={styles.kicker}>Resumo da oportunidade</span><h3>{selectedHistory.query||'Pesquisa sem termo'}</h3><p>{selectedHistory.date?new Date(selectedHistory.date).toLocaleString('pt-BR'):'Data não disponível'} · {modeLabel(selectedHistory.mode)}</p></div>
                {selectedResale&&<div className={styles.scoreBox} data-tone={toneOfScore(selectedResale.score)}><strong>{selectedResale.score}<small> / 100</small></strong><span>{resaleScoreLabel(selectedResale.score)}</span></div>}
              </div>
              {selectedResale?.provisional&&<p className={styles.provisional}><Icon name="info"/>Nota provisória: informe o custo para incluir lucro e margem no cálculo.</p>}

              <div className={styles.decisionGrid}>
                <div><span>Preço mediano encontrado</span><b>{money(m.price)}</b></div>
                <div><span>Custo informado</span>
                  <div className={styles.costInline}><em>R$</em><input key={selectedHistory.id+':'+(cost??'')} defaultValue={cost!=null?String(cost).replace('.',','):''} placeholder="0,00" inputMode="decimal" aria-label="Custo do produto desta pesquisa" onBlur={e=>saveResearchCost(selectedHistory,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/></div>
                </div>
                <div data-tone={fin?(fin.profit>0?'good':'bad'):'none'}><span>Lucro estimado por venda</span><b>{fin?money(fin.profit):'—'}</b>{!fin&&<small>Informe o custo</small>}</div>
                <div data-tone={margin?margin.tone:'none'}><span>Margem estimada</span><b>{fin?fin.marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}</b>{margin?<Tone tone={margin.tone}>{margin.label}</Tone>:<small>Informe o custo</small>}</div>
                <div><span>Anúncios encontrados</span><b>{selectedHistory.count??(Array.isArray(selectedHistory.rows)?selectedHistory.rows.length:'—')}</b></div>
              </div>

              <div className={styles.chips}>
                <Tone tone={demandTone}>{demandText}</Tone>
                <Tone tone={competition.tone}>{competition.label}</Tone>
                <Tone tone={dataQ.tone}>{dataQ.label}</Tone>
              </div>

              {comparison?.historyId===selectedHistory.id&&<div className={styles.comparisonBox} aria-live="polite">
                <b>Comparação com nova coleta</b>
                <div><span>Preço mediano</span><strong>{comparison.before?.priceMedian!=null&&comparison.after?.priceMedian!=null?`${money(comparison.before.priceMedian)} → ${money(comparison.after.priceMedian)}`:'Sem dados comparáveis'}</strong></div>
                <div><span>Vendas medianas</span><strong>{comparison.before?.soldMedian!=null&&comparison.after?.soldMedian!=null?`${compact(comparison.before.soldMedian)} → ${compact(comparison.after.soldMedian)}`:'Sem dados comparáveis'}</strong></div>
                <div><span>Vendas 30 dias</span><strong>{comparison.before?.monthlyMedian!=null&&comparison.after?.monthlyMedian!=null?`${compact(comparison.before.monthlyMedian)} → ${compact(comparison.after.monthlyMedian)}`:'Sem dados comparáveis'}</strong></div>
              </div>}

              {selectedResale&&<details className={styles.scoreWhy}>
                <summary>Como esta nota é calculada</summary>
                <p>A nota compara as suas pesquisas salvas entre si, usando só os dados coletados. Não é uma previsão de vendas.</p>
                <div className={styles.breakdown}>{[['Demanda','demand'],['Faturamento estimado','revenue'],['Pouca concorrência','competition'],['Avaliações','social'],['Qualidade dos dados','quality'],['Rentabilidade','profitability']].map(([label,key])=>{const v=selectedResale.breakdown[key];return <div key={key}><span>{label}</span><b>{v==null?'sem custo':v+' / 100'}</b><i><u style={{width:(v==null?0:v)+'%'}}/></i></div>})}</div>
              </details>}

              <div className={styles.historyActions}>
                <button type="button" className={styles.primaryBtn} onClick={()=>reopenResearch(selectedHistory)} disabled={!hasRows} title={!hasRows?'Pesquisa salva por uma versão antiga, sem os anúncios':''}><Icon name="open"/>Abrir pesquisa</button>
                <button type="button" className={styles.ghostBtn} onClick={()=>repeatAndCompare(selectedHistory)} disabled={busy}><Icon name="repeat"/>Repetir e comparar</button>
                <button type="button" className={styles.ghostBtn} onClick={()=>exportResearch(selectedHistory)}><Icon name="export"/>Exportar</button>
                <button type="button" className={`${styles.ghostBtn} ${styles.deleteHistory}`} onClick={()=>deleteResearch(selectedHistory)}><Icon name="trash"/>Excluir</button>
              </div>
            </>;
          })()}
        </div>
      </div></>}
    </section>}

    {/* 3 · ANÁLISE (azul) */}
    <section className={styles.analysisCard} data-empty={rows.length?'false':'true'} aria-labelledby="titulo-analise">
      <div className={styles.analysisHeader}>
        <div><span className={styles.kicker}>Análise da pesquisa</span><h2 id="titulo-analise">{rows.length?(query.trim()||'Pesquisa aberta'):'Nenhuma pesquisa aberta'}</h2>{rows.length>0&&<p>{rows.length} anúncios carregados</p>}</div>
        {rows.length>0&&<div className={styles.analysisHeaderActions}>
          <button type="button" className={styles.infoButton} onClick={()=>setDiagnosticsOpen(v=>!v)} aria-expanded={diagnosticsOpen} aria-controls="cobertura-dados"><Icon name="info"/>Qualidade dos dados</button>
          <button type="button" className={styles.sectionToggle} onClick={()=>setOverviewVisible(v=>!v)} aria-expanded={overviewVisible} aria-controls="conteudo-visao-geral"><Icon name={overviewVisible?'up':'down'}/>{overviewVisible?'Ocultar visão geral':'Mostrar visão geral'}</button>
        </div>}
      </div>

      {rows.length===0&&<div className={styles.emptyState}>
        <span className={styles.emptyIcon} aria-hidden="true"><Icon name="search"/></span>
        <div>
          <b>Selecione uma pesquisa no histórico ou faça uma nova busca para ver a análise completa.</b>
          <p>{selectedHistory?`Pesquisa selecionada: ${selectedHistory.query||'sem termo'}.`:'Você ainda não tem pesquisas salvas. Comece pelo passo 1 acima.'}</p>
        </div>
        {selectedHistory&&<button type="button" className={styles.primaryBtn} onClick={()=>reopenResearch(selectedHistory)} disabled={!Array.isArray(selectedHistory.rows)||!selectedHistory.rows.length}>Abrir pesquisa selecionada</button>}
      </div>}

      {diagnosticsOpen&&rows.length>0&&<section id="cobertura-dados" className={styles.qualityCard}>
        <div className={styles.qualityHead}>
          <div><span className={styles.kicker}>COBERTURA DOS DADOS</span><b>{qualityLabel} · {quality}%</b><p>Mostra quantos anúncios vieram com cada informação. O que não veio continua “não coletado” e nunca vira zero.</p></div>
          <Tone tone={openQuality.tone}>{openQuality.label}</Tone>
        </div>
        <div className={styles.coverageGrid}>{[['Preço','price'],['Vendas','sold'],['Vendas 30d','monthly'],['Localização','location'],['Avaliação','rating'],['Reviews','reviews']].map(([label,key])=><div key={key}><b>{bench.coverage[key]}/{rows.length}</b><span>{label}</span><i><u style={{width:(bench.coverage[key]/rows.length*100)+'%'}}/></i></div>)}</div>
        <p className={styles.preferredLine}>Anúncios de Vendedor Indicado: <b>{rows.filter(r=>r.preferred).length}</b></p>
        {suspiciousSales&&<div className={styles.dataWarning}><Icon name="alert"/><span>Todos os anúncios vieram com vendas = 0. O Gestor não assume que isso significa ausência de demanda; este campo está marcado como suspeito até uma nova coleta confirmar.</span></div>}
        <details className={styles.techDetails}>
          <summary>Ver detalhes técnicos</summary>
          <div id="diagnostico-coleta" className={styles.diagnosticPanel}>
            <div className={styles.diagnosticIntro}><b>Motor Sênior × Gestor</b><span>{diagnostics?'O Motor informou a cobertura antes da normalização. Assim dá para saber exatamente onde um campo se perdeu.':'Esta coleta não trouxe diagnóstico do Motor. Faça uma nova pesquisa para gerar essa comparação quando o Motor disponibilizar o diagnóstico.'}</span></div>
            {diagnostics&&<>
              <div className={styles.diagnosticActions}><button type="button" className={styles.ghostBtn} onClick={downloadDiagnostics}><Icon name="export"/>Baixar diagnóstico técnico</button>{diagnostics?.mode==='diagnostic-only'&&<span>Modo diagnóstico: amostra controlada de {diagnostics?.sampleSize||0} item(ns), sem enriquecimento misturado.</span>}</div>
              <div className={styles.diagnosticGrid}>{[['Preço','price','price'],['Vendas','sold','sold'],['Vendas 30d','monthlySold','monthly'],['Localização','shopLocation','location'],['Avaliação','rating','rating'],['Reviews','reviewCount','reviews']].map(([label,motorKey,gestorKey])=>{const motor=Number(diagnostics?.coverage?.[motorKey]??0),gestor=Number(bench.coverage?.[gestorKey]??0);const status=motor===0?'source':gestor<motor?'normalizer':'ok';return <div key={label} data-status={status}><b>{label}</b><span>Motor: {motor}/{rows.length}</span><span>Gestor: {gestor}/{rows.length}</span><strong>{status==='ok'?'✓ aproveitado':status==='normalizer'?'⚠ normalização':'○ não veio da busca'}</strong></div>})}</div>
              {Array.isArray(diagnostics.detectedPaths)&&diagnostics.detectedPaths.length>0&&<details className={styles.detectedPaths}><summary>Campos estruturados detectados pelo Motor</summary><code>{diagnostics.detectedPaths.join(' · ')}</code></details>}
            </>}
          </div>
        </details>
      </section>}

      {rows.length>0&&overviewVisible&&<div id="conteudo-visao-geral" className={styles.analysisBody}>
        <nav className={styles.tabs} aria-label="Seções da Pesquisa de Produtos">
          <div className={styles.tabScroller}>{tabs.map(([id,label])=><button key={id} type="button" aria-current={activeTab===id?'page':undefined} className={activeTab===id?styles.activeTab:''} onClick={()=>setActiveTab(id)}>{id==='overview'?'Resumo':label}</button>)}</div>
        </nav>

        {activeTab==='overview'&&<section className={styles.kpis} aria-label="Resumo simples da pesquisa">
          <article><span>Preço mediano</span><strong>{bench.coverage.price?money(bench.priceMedian):'Não coletado'}</strong><small>Preço do anúncio “do meio”. {bench.coverage.price}/{rows.length} com preço.</small></article>
          <article><span>Vendas medianas</span><strong>{bench.coverage.sold?compact(bench.soldMedian):'Não coletado'}</strong><small>Total vendido por anúncio. {bench.coverage.sold}/{rows.length} com vendas.</small></article>
          <article><span>Vendas em 30 dias</span><strong>{bench.coverage.monthly?compact(bench.monthlyMedian):'Não coletado'}</strong><small>Vendas recentes por anúncio. {bench.coverage.monthly}/{rows.length} com o campo.</small></article>
          <article><span>Lojas concorrentes</span><strong>{concentration.shops||'—'}</strong>{concentration.shops?<Tone tone={openCompetition.tone}>{openCompetition.label}</Tone>:null}<small>{concentration.shops?'As 5 maiores lojas concentram '+concentration.share+'% dos anúncios.':'shop_id não coletado'}</small></article>
          <article><span>Qualidade dos dados</span><strong>{quality}%</strong><Tone tone={openQuality.tone}>{openQuality.label}</Tone><small>Quanto da coleta veio completo.</small></article>
        </section>}

        {activeTab==='results'&&<section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><h2>Radar de oportunidades</h2><p>A nota usa somente os dados carregados e não é gerada por IA.</p></div>
            <div className={styles.filters}>
              <input inputMode="numeric" aria-label="Vendas mínimas" value={minSold} onChange={e=>setMinSold(e.target.value)} placeholder="Vendas mín."/>
              <input inputMode="decimal" aria-label="Preço máximo" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Preço máx."/>
              <select aria-label="Ordenar resultados" value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Melhor oportunidade</option><option value="sales">Mais vendidos</option><option value="monthly">Mais vendas 30d</option><option value="price">Menor preço</option></select>
            </div>
          </div>
          <div className={styles.refineGuide} role="note">
            <div className={styles.refineGuideIcon}><Icon name="trash"/></div>
            <div className={styles.refineGuideText}>
              <b>Refine os resultados antes de decidir</b>
              <p>Marque as caixas dos produtos que não correspondem à busca e depois clique em <strong>Excluir selecionados</strong>. Eles deixam de influenciar demanda, preço, concorrência, palavras-chave e oportunidades.</p>
              <small><strong>{rows.length}</strong> usados na análise{removedRows.length?<> · <strong>{removedRows.length}</strong> removidos</>:null}{selectedResultKeys.length?<> · <strong>{selectedResultKeys.length}</strong> selecionados</>:null}</small>
            </div>
            <div className={styles.refineGuideActions}>
              {selectedResultKeys.length>0&&<button type="button" className={styles.bulkDeleteBtn} onClick={removeSelectedFromAnalysis}><Icon name="trash"/>Excluir selecionados ({selectedResultKeys.length})</button>}
              {removedRows.length>0&&<button type="button" onClick={undoLastRemoval}>Desfazer última</button>}
              {removedRows.length>0&&<button type="button" onClick={restoreAllRemoved}>Restaurar todos</button>}
            </div>
          </div>
          {!filtered.length?<div className={styles.empty}>{removedRows.length?'Todos os resultados foram removidos da análise. Use “Desfazer última” ou “Restaurar todos” para recuperar itens.':'Faça uma pesquisa automática ou importe uma coleta para começar.'}</div>:<>
          <div className={styles.tableWrap}><table><thead><tr><th className={styles.selectCol}><input type="checkbox" aria-label="Selecionar todos os resultados desta página" checked={paged.length>0&&paged.every(r=>selectedResultKeys.includes(r.key))} onChange={toggleCurrentPageSelection}/></th><th>Produto</th><th>Preço</th><th>Vendas</th><th>30 dias</th><th>Avaliações</th><th>Local</th><th>Oportunidade</th><th>Confiança</th><th><span className={styles.srOnly}>Abrir anúncio</span></th></tr></thead><tbody>
            {paged.map(r=><tr key={r.key} className={selectedResultKeys.includes(r.key)?styles.selectedRow:''}>
              <td className={styles.selectCol}><input type="checkbox" aria-label={'Selecionar '+r.title} checked={selectedResultKeys.includes(r.key)} onChange={()=>toggleResultSelection(r.key)}/></td>
              <td><div className={styles.product}>{r.image?<img src={r.image} alt=""/>:<div className={styles.noImg}><Icon name="tag"/></div>}<div><b title={r.title}>{r.title}</b><small>{r.preferred?'Vendedor Indicado · ':''}{r.itemId?'ID '+r.itemId:'ID não coletado'}</small></div></div></td>
              <td><b>{money(r.price)}</b>{r.discount?<small className={styles.discount}>-{r.discount}%</small>:null}</td>
              <td><b>{compact(r.sold)}</b><small>{r.revenue!=null?money(r.revenue)+' estimado bruto':'—'}</small></td>
              <td><b>{compact(r.monthlySold)}</b><small>{r.monthlyRevenue!=null?money(r.monthlyRevenue)+' / 30d':'não coletado'}</small></td>
              <td><b>{r.rating!=null?'★ '+number(r.rating):'—'}</b><small>{r.reviews!=null?compact(r.reviews)+' avaliações':'—'}</small></td>
              <td>{r.location||'—'}</td>
              <td><span className={styles.score} data-level={r.score>=70?'high':r.score>=50?'mid':'low'}>{r.score}<small>{r.score>=70?'Forte':r.score>=50?'Média':'Fraca'}</small></span></td>
              <td><span className={styles.confidence} data-level={r.confidence.label==='Alta'?'high':r.confidence.label==='Média'?'mid':'low'}>{r.confidence.label}<small>{r.confidence.value}%</small></span></td>
              <td><div className={styles.rowActions}>{r.url?<a href={r.url} target="_blank" rel="noreferrer">Abrir ↗</a>:'—'}</div></td>
            </tr>)}
          </tbody></table></div>
          <div className={styles.resultCards}>{paged.map(r=><article key={r.key} className={selectedResultKeys.includes(r.key)?styles.selectedCard:''}>
            <label className={styles.mobileSelect}><input type="checkbox" checked={selectedResultKeys.includes(r.key)} onChange={()=>toggleResultSelection(r.key)}/><span>Selecionar para excluir</span></label>
            <div className={styles.product}>{r.image?<img src={r.image} alt=""/>:<div className={styles.noImg}><Icon name="tag"/></div>}<div><b title={r.title}>{r.title}</b><small>{r.preferred?'Vendedor Indicado · ':''}{r.itemId?'ID '+r.itemId:'ID não coletado'}</small></div></div>
            <dl>
              <div><dt>Preço</dt><dd>{money(r.price)}{r.discount?<small className={styles.discount}> -{r.discount}%</small>:null}</dd></div>
              <div><dt>Vendas</dt><dd>{compact(r.sold)}</dd></div>
              <div><dt>30 dias</dt><dd>{compact(r.monthlySold)}</dd></div>
              <div><dt>Avaliação</dt><dd>{r.rating!=null?'★ '+number(r.rating):'—'}</dd></div>
            </dl>
            <div className={styles.resultCardFoot}>
              <span className={styles.score} data-level={r.score>=70?'high':r.score>=50?'mid':'low'}>{r.score}<small>{r.score>=70?'Forte':r.score>=50?'Média':'Fraca'}</small></span>
              <span className={styles.confidence} data-level={r.confidence.label==='Alta'?'high':r.confidence.label==='Média'?'mid':'low'}>Confiança {r.confidence.label}<small>{r.confidence.value}%</small></span>
              {r.url&&<a href={r.url} target="_blank" rel="noreferrer">Abrir ↗</a>}
            </div>
          </article>)}</div></>}
          {filtered.length>0&&<div className={styles.pagination}><span>Mostrando {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} de {filtered.length}</span><div><button type="button" aria-label="Página anterior" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>←</button><b>{page} / {pages}</b><button type="button" aria-label="Próxima página" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>→</button></div></div>}
        </section>}

        {activeTab==='top'&&<section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Oportunidades com evidência</h2><p>A nota vem acompanhada da confiança, baseada na quantidade de campos realmente disponíveis.</p></div></div>
          <div className={styles.topList}>{top.length?top.map((r,i)=><div key={r.key}><span>{i+1}</span><div><b>{r.title}</b><small>{money(r.price)} · {compact(r.sold)} vendidos</small></div><strong>{r.score}</strong></div>):<div className={styles.emptySmall}>Sem dados ainda.</div>}</div>
        </section>}

        {activeTab==='keywords'&&<section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Palavras-chave dos concorrentes</h2><p>Extraídas dos títulos, sem IA. Frequência, preço e vendas aparecem somente quando existem na coleta.</p></div></div>
          {keywords.length?<ul className={styles.keywordList}>{keywords.map(k=><li key={k.word}>
            <b>{k.word}</b>
            <span><em>Anúncios</em>{k.count}</span>
            <span><em>Preço</em>{k.price!=null?money(k.price):'—'}</span>
            <span><em>Vendas medianas</em>{k.sales!=null?compact(k.sales):'—'}</span>
          </li>)}</ul>:<div className={styles.empty}>Sem termos recorrentes suficientes.</div>}
        </section>}

        {activeTab==='competition'&&<section className={styles.competitionGrid}>
          <div className={styles.panel}><div className={styles.panelHead}><div><h2>Concentração de vendedores</h2><p>Muitos anúncios podem pertencer à mesma loja.</p></div></div><div className={styles.bigMetric}><strong>{concentration.shops||'—'}</strong><span>lojas únicas identificadas</span></div><div className={styles.bigMetric}><strong>{concentration.shops?concentration.share+'%':'—'}</strong><span>dos anúncios nas 5 lojas com mais resultados</span></div></div>
          <div className={styles.panel}><div className={styles.panelHead}><div><h2>Origem dos anúncios</h2><p>Somente localizações realmente coletadas.</p></div></div><div className={styles.bigMetric}><strong>{bench.mainLocation==='—'?'Não coletado':bench.mainLocation}</strong><span>origem mais comum</span></div><div className={styles.bigMetric}><strong>{bench.coverage.location}/{rows.length||0}</strong><span>anúncios com localização</span></div></div>
        </section>}

        {activeTab==='insights'&&<section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Insights da coleta</h2><p>Conclusões descritivas baseadas apenas nos campos disponíveis.</p></div></div>
          <div className={styles.insightGrid}>
            <article><span aria-hidden="true"><Icon name="tag"/></span><div><b>Preço</b><p>{bench.coverage.price?'Mediana observada: '+money(bench.priceMedian)+' em '+bench.coverage.price+' anúncios.':'Preço insuficiente para análise.'}</p></div></article>
            <article><span aria-hidden="true"><Icon name="trend"/></span><div><b>Demanda</b><p>{bench.coverage.sold?'Vendas disponíveis em '+bench.coverage.sold+' de '+rows.length+' anúncios.'+(suspiciousSales?' O padrão de zeros foi marcado como suspeito.':''):'A coleta atual não permite avaliar demanda por vendas.'}</p></div></article>
            <article><span aria-hidden="true"><Icon name="store"/></span><div><b>Concorrência</b><p>{concentration.shops?concentration.shops+' lojas únicas; as 5 com mais resultados concentram '+concentration.share+'% dos anúncios.':'Sem shop_id suficiente para medir concentração.'}</p></div></article>
            <article><span aria-hidden="true"><Icon name="search"/></span><div><b>Termos recorrentes</b><p>{keywords.length?'Mais usados: '+keywords.slice(0,5).map(k=>k.word).join(', ')+'.':'Sem títulos suficientes.'}</p></div></article>
            <article><span aria-hidden="true"><Icon name="shield"/></span><div><b>Confiabilidade</b><p>Qualidade geral: {qualityLabel.toLowerCase()} ({quality}%). Dados ausentes continuam ausentes e não viram zero.</p></div></article>
          </div>
        </section>}
      </div>}
    </section>

    {/* 4 · ASSISTENTE (roxo de acento) */}
    {rows.length>0&&<section className={styles.creationAssistant}>
      <div className={styles.assistantHeader}>
        <div><span className={styles.assistantEyebrow}><Icon name="sparkle"/>ASSISTENTE DE CRIAÇÃO DO ANÚNCIO</span><h2>Crie o anúncio usando os sinais desta pesquisa</h2><p>As sugestões usam apenas os dados coletados. Onde a pesquisa não prova algo, o Gestor sinaliza para revisão.</p></div>
        <button type="button" className={styles.assistantToggle} aria-expanded={assistantVisible} onClick={()=>setAssistantVisible(v=>!v)}><Icon name={assistantVisible?'up':'down'}/>{assistantVisible?'Ocultar assistente':'Mostrar assistente'}</button>
      </div>

      {assistantVisible&&<>
        <div className={styles.assistantSummary}>
          <div><span>Tema forte</span><b>{assistant.theme}</b></div>
          <div><span>Melhor variação</span><b>{assistant.bestVariation}</b></div>
          <div><span>Faixa de preço</span><b>{assistant.priceRange}</b></div>
          <div><span>Concorrência</span><b>{assistant.competition}</b></div>
          <div className={styles.objective}><span id="rotulo-objetivo">Objetivo da recomendação</span>
            <div role="group" aria-labelledby="rotulo-objetivo">{[['sales','Mais vendido'],['competition','Menor concorrência'],['price','Melhor preço']].map(([id,label])=><button key={id} type="button" aria-pressed={assistantObjective===id} className={assistantObjective===id?styles.objectiveActive:''} onClick={()=>setAssistantObjective(id)}>{label}</button>)}</div>
          </div>
        </div>

        <div className={styles.assistantTabs} role="tablist" aria-label="Etapas do Assistente de Criação">
          {[
            ['product','Dados do produto'],['strategy','Estratégia'],['title','Título'],['description','Descrição'],['images','Imagens'],
            ['category','Categoria / NCM'],['variations','Variações'],['references','Referências'],['checklist','Checklist']
          ].map(([id,label],i)=><button key={id} type="button" role="tab" aria-selected={assistantTab===id} className={assistantTab===id?styles.assistantTabActive:''} onClick={()=>setAssistantTab(id)}><i>{i+1}</i>{label}</button>)}
        </div>

        <div className={styles.assistantContent}>
          {assistantTab==='product'&&<section className={styles.productInfoPanel}>
            <div className={styles.productInfoHead}>
              <div><span>ANTES DE GERAR TÍTULO E DESCRIÇÃO</span><h3>Conte mais sobre o produto</h3><p>A pesquisa mostra o mercado, mas não sabe exatamente como é o seu produto. Preencha o que souber para o assistente não inventar características e montar uma descrição AIDA mais completa.</p></div>
              <div className={styles.productInfoProgress}><b>{assistant.completeness}%</b><span>preenchido</span></div>
            </div>
            <div className={styles.productInfoGrid}>
              <label><span>Material</span><input value={productDetails.material} onChange={e=>updateProductDetail('material',e.target.value)} placeholder="Ex.: papel fotográfico 180g, algodão, MDF..."/></label>
              <label><span>Tamanho / medidas</span><input value={productDetails.size} onChange={e=>updateProductDetail('size',e.target.value)} placeholder="Ex.: 20 × 15 cm, tamanho M..."/></label>
              <label><span>Cor(es)</span><input value={productDetails.colors} onChange={e=>updateProductDetail('colors',e.target.value)} placeholder="Ex.: rosa, azul, colorido..."/></label>
              <label><span>Conteúdo do produto / kit</span><input value={productDetails.contents} onChange={e=>updateProductDetail('contents',e.target.value)} placeholder="Ex.: 6 peças, 10 tags, 1 suporte..."/></label>
              <label><span>Público / para quem é</span><input value={productDetails.audience} onChange={e=>updateProductDetail('audience',e.target.value)} placeholder="Ex.: mães, crianças, festas infantis..."/></label>
              <label><span>Uso / aplicação</span><input value={productDetails.usage} onChange={e=>updateProductDetail('usage',e.target.value)} placeholder="Ex.: decoração, presente, organização..."/></label>
              <label className={styles.productInfoWide}><span>Diferenciais / benefícios</span><textarea value={productDetails.differentials} onChange={e=>updateProductDetail('differentials',e.target.value)} placeholder="Ex.: resistente, fácil de montar, personalizado, reutilizável..."/></label>
              <label className={styles.productInfoWide}><span>Outras informações importantes</span><textarea value={productDetails.notes} onChange={e=>updateProductDetail('notes',e.target.value)} placeholder="Prazo, cuidados, personalização, compatibilidade, limitações ou qualquer detalhe relevante."/></label>
            </div>
            <div className={styles.productInfoActions}><button type="button" className={styles.primaryBtn} onClick={()=>{setAssistantTab('title');generateWithAI('title')}}>Criar título com I.A.</button><button type="button" className={styles.ghostBtn} onClick={()=>{setAssistantTab('description');generateWithAI('description')}}>Criar descrição AIDA com I.A.</button></div>
          </section>}

          {assistantTab==='strategy'&&<div className={styles.strategyGrid}>
            <article><span>Demanda observada</span><strong>{bench.coverage.monthly?compact(bench.monthlyMedian)+' vendas/30d medianas':'Sem dados de 30 dias'}</strong><small>Base: {bench.coverage.monthly}/{rows.length} anúncios com vendas 30d.</small></article>
            <article><span>Variação mais forte</span><strong>{assistant.bestVariation}</strong><small>{variations[0]?variations[0].count+' anúncios encontrados com esse termo.':'Nenhum padrão de variação claro nos títulos.'}</small></article>
            <article><span>Preço de referência</span><strong>{bench.priceMedian!=null?money(bench.priceMedian):'Sem dados'}</strong><small>Mediana dos preços realmente coletados.</small></article>
            <article><span>Concentração</span><strong>{assistant.competition}</strong><small>{concentration.shops?concentration.shops+' lojas únicas; top 5 concentram '+concentration.share+'%.':'Sem shop_id suficiente.'}</small></article>
          </div>}

          {assistantTab==='title'&&<div className={styles.recommendationBox}>
            <div className={styles.recommendationHead}><div><span>Título sugerido</span><b>Pesquisa + informações reais do seu produto</b></div><em>{assistant.completeness>=50?'Mais completo':'Faltam dados'}</em></div>
            {assistant.completeness<50&&<div className={styles.assistantWarning}>Preencha mais informações em “Dados do produto” para melhorar o título e evitar termos genéricos. <button type="button" onClick={()=>setAssistantTab('product')}>Completar agora</button></div>}
            {aiListing.error&&<div className={styles.assistantWarning}>{aiListing.error}</div>}
            <div className={styles.titleSuggestion}>{aiListing.loadingTitle?'A I.A. está criando o título…':(aiListing.title||'Clique em “Gerar com I.A.” para criar o título.')}</div>
            <p><b>Como é criado?</b> A I.A. recebe os dados reais do produto, palavras-chave e sinais da pesquisa. Ela é proibida de inventar características.</p>
            <div className={styles.assistantActions}><button type="button" onClick={()=>generateWithAI('title')} disabled={aiListing.loadingTitle}>{aiListing.loadingTitle?'Gerando…':'Gerar com I.A.'}</button><button type="button" className={styles.secondaryAction} onClick={()=>copyText(aiListing.title)} disabled={!aiListing.title}>Copiar título</button><button type="button" className={styles.secondaryAction} onClick={()=>setAssistantTab('product')}>Editar dados do produto</button></div>
          </div>}

          {assistantTab==='description'&&<div className={styles.recommendationBox}>
            <div className={styles.recommendationHead}><div><span>Descrição AIDA sugerida</span><b>Atenção · Interesse · Desejo · Ação, usando os dados informados</b></div><em>{assistant.completeness>=50?'AIDA':'Faltam dados'}</em></div>
            {assistant.completeness<50&&<div className={styles.assistantWarning}>A descrição ainda está genérica. Complete material, medidas, cores, conteúdo e diferenciais para gerar um texto melhor. <button type="button" onClick={()=>setAssistantTab('product')}>Adicionar informações</button></div>}
            {aiListing.error&&<div className={styles.assistantWarning}>{aiListing.error}</div>}
            <textarea className={styles.descriptionDraft} aria-label="Descrição sugerida" readOnly value={aiListing.loadingDescription?'A I.A. está criando a descrição AIDA…':aiListing.description}/>
            <div className={styles.assistantActions}><button type="button" onClick={()=>generateWithAI('description')} disabled={aiListing.loadingDescription}>{aiListing.loadingDescription?'Gerando…':'Gerar com I.A.'}</button><button type="button" className={styles.secondaryAction} onClick={()=>copyText(aiListing.description)} disabled={!aiListing.description}>Copiar descrição</button><button type="button" className={styles.secondaryAction} onClick={()=>setAssistantTab('product')}>Editar dados do produto</button></div>
          </div>}

          {assistantTab==='images'&&<div className={styles.referenceGrid}>
            {referenceProducts.length?referenceProducts.map((r,i)=><article key={r.key}><div className={styles.referenceImage}>{r.image?<img src={r.image} alt=""/>:<span>Sem imagem</span>}</div><div><span>Referência {i+1}</span><b>{r.title}</b><small>{money(r.price)} · {compact(r.sold)} vendas</small><div className={styles.referenceActions}>{r.url&&<a href={r.url} target="_blank" rel="noreferrer">Ver anúncio ↗</a>}{r.image&&<a href={r.image} target="_blank" rel="noreferrer">Abrir imagem</a>}</div></div></article>):<div className={styles.empty}>Nenhum concorrente com URL disponível nesta coleta.</div>}
          </div>}

          {assistantTab==='category'&&<div className={styles.categoryGrid}>
            <article><span>Categoria sugerida</span><strong>Revisar no cadastro da Shopee</strong><p>A busca pública atual não devolve, de forma confiável para todos os resultados, a categoria de cadastro do concorrente. O Gestor não vai inventar esse campo.</p></article>
            <article><span>NCM sugerido</span><strong>Não confirmado pela pesquisa</strong><p>NCM depende da natureza/material do produto. O sistema só deve sugerir quando houver evidência suficiente e deve sempre pedir revisão fiscal.</p></article>
          </div>}

          {assistantTab==='variations'&&<div className={styles.variationList}>
            {variations.length?variations.slice(0,6).map((v,i)=><div key={v.name}><span>{i+1}</span><b>{v.name}</b><small>{v.count} anúncios com o termo</small><em>{i===0?'Mais forte':'Alternativa'}</em></div>):<div className={styles.empty}>A pesquisa ainda não mostrou padrões claros de modelo, personagem ou público.</div>}
          </div>}

          {assistantTab==='references'&&<div className={styles.referenceGrid}>
            {referenceProducts.length?referenceProducts.map((r,i)=><article key={r.key}><div className={styles.referenceImage}>{r.image?<img src={r.image} alt=""/>:<span>Sem imagem</span>}</div><div><span>{i===0?'Referência principal':'Concorrente '+(i+1)}</span><b>{r.title}</b><small>{money(r.price)} · {compact(r.sold)} vendas · {r.rating!=null?'★ '+number(r.rating):'sem nota'}</small><div className={styles.referenceActions}>{r.url&&<a href={r.url} target="_blank" rel="noreferrer">Ver anúncio ↗</a>}{r.image&&<a href={r.image} target="_blank" rel="noreferrer">Abrir imagem</a>}</div></div></article>):<div className={styles.empty}>Sem concorrentes utilizáveis nesta coleta.</div>}
          </div>}

          {assistantTab==='checklist'&&<div className={styles.checklistGrid}>
            {[
              ['Escolher tema / público',assistant.theme!=='—'],
              ['Definir variações principais',variations.length>0],
              ['Gerar e revisar título com I.A.',Boolean(aiListing.title)],
              ['Informar características reais do produto',assistant.completeness>=50],
              ['Gerar e revisar descrição AIDA com I.A.',Boolean(aiListing.description)],
              ['Confirmar categoria na Shopee',false],
              ['Confirmar NCM com base no produto real',false],
              ['Escolher concorrente de referência',referenceProducts.length>0],
              ['Criar imagens próprias inspiradas na estratégia',false]
            ].map(([label,done])=><div key={label} data-done={done?'yes':'no'}><span aria-hidden="true">{done?'✓':'○'}</span><b>{label}</b><small>{done?'Pronto':'A fazer'}</small></div>)}
          </div>}
        </div>
      </>}
    </section>}
  </div>;
}
