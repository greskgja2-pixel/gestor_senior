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
  const [assistantVisible,setAssistantVisible]=useState(true);
  const [assistantTab,setAssistantTab]=useState('strategy');
  const [assistantObjective,setAssistantObjective]=useState('sales');
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
    setDiagnostics(diag);
    setMessage(normalized.length?`${normalized.length} anúncios carregados de ${source}.`:'Nenhum anúncio válido foi encontrado nessa coleta.');
    return {normalized,diagnostics:diag};
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
    const suggestedTitle=[base,bestVariation&&!base.toLowerCase().includes(bestVariation.toLowerCase())?bestVariation:null,'Shopee'].filter(Boolean).join(' · ').slice(0,120);
    const topTerms=keywords.slice(0,6).map(k=>k.word);
    const description=[
      `Produto relacionado a ${base.toLowerCase()}.`,
      bestVariation?`Variação em destaque na pesquisa: ${bestVariation}.`:null,
      topTerms.length?`Termos recorrentes observados: ${topTerms.join(', ')}.`:null,
      'Revise medidas, materiais, conteúdo do kit e prazo antes de publicar.'
    ].filter(Boolean).join('\n\n');
    return{
      theme:base||'—',
      bestVariation:bestVariation||'Sem padrão claro',
      priceRange:bench.priceMedian!=null?`${money(Math.max(0,bench.priceMedian*.8))} – ${money(bench.priceMedian*1.2)}`:'Não coletado',
      competition:concentration.shops&&rows.length?(concentration.share>=45?'Alta':concentration.share>=25?'Média':'Baixa'):'Sem dados',
      suggestedTitle,
      description,
      topTerms
    };
  },[query,keywords,variations,bench.priceMedian,concentration.shops,concentration.share,rows.length]);
  useEffect(()=>setPage(1),[sort,minSold,maxPrice,rows.length]);
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

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>INTELIGÊNCIA DE MERCADO</span><h1>Pesquisa de Produtos</h1><p>Pesquise na Shopee de forma automática pelo Motor Senior e compare demanda, preço, concorrência e oportunidades.</p></div>
    </header>

    <section className={styles.searchCard}>
      <div className={styles.searchTopline}><div><span className={styles.searchStep}>1</span><b>O que você quer pesquisar?</b><small>Digite o produto ou termo que deseja avaliar para revenda.</small></div></div>
      <div className={styles.searchLine}>
        <div className={styles.searchBox}><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!busy&&search()} placeholder="Ex.: TAG saída maternidade"/></div>
        <button type="button" onClick={search} disabled={busy}>{busy?'Coletando automaticamente…':'Pesquisar automaticamente'}</button>
        <button type="button" className={styles.secondary} onClick={()=>fileRef.current?.click()}>Importar coleta</button>
        <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={e=>onFile(e.target.files?.[0])}/>
      </div>
      <div className={styles.searchOptionsRow}>
        <div className={styles.modeRow}><span><b>2</b> Profundidade</span>{[['quick','Rápida · 1 pág.'],['standard','Padrão · 3 págs.'],['deep','Profunda · 5 págs.']].map(([id,label])=><button key={id} type="button" className={mode===id?styles.modeActive:''} onClick={()=>setMode(id)}>{label}</button>)}</div>
        <label className={styles.searchCostField}><span className={styles.costStep}>3</span><b>Custo do produto</b><span>R$</span><input inputMode="decimal" placeholder="0,00" value={searchCostDraft} onChange={e=>setSearchCostDraft(e.target.value)} onBlur={commitSearchCost}/><small>opcional · taxas do Gestor aplicadas automaticamente</small></label>
      </div>
      <div className={styles.searchStatusRow}>
        <div className={styles.message} aria-live="polite">{message}{rows.length>0&&<span className={styles.currentDepth}>Profundidade usada: <b>{modeLabel(currentResearchMode)}</b></span>}</div>
        <div className={styles.statusActions}>
          <button type="button" className={styles.saveSearchBtn} onClick={exportCurrentResearch} disabled={!rows.length} title="Exportar a coleta atual em JSON">⇧ Exportar coleta</button>
          <button type="button" className={historyOpen?styles.historyToggleOpen:styles.historyToggle} aria-expanded={historyOpen} aria-controls="pesquisas-anteriores" onClick={()=>setHistoryOpen(v=>!v)}>
            <span aria-hidden="true">◷</span><b>{historyOpen?'Ocultar histórico':'Histórico de pesquisas'}</b><em>{saved.length}</em><span aria-hidden="true">{historyOpen?'⌃':'⌄'}</span>
          </button>
        </div>
      </div>
    </section>

    {historyOpen&&<section id="pesquisas-anteriores" className={styles.historyCard} aria-label="Pesquisas anteriores">
      <div className={styles.historyHeader}>
        <div><span>HISTÓRICO</span><h2>Pesquisas anteriores</h2><p>Reabra uma coleta salva ou repita a mesma busca para comparar os dados disponíveis.</p></div>
        <label className={styles.historySearch}><span className={styles.srOnly}>Filtrar histórico por termo</span><span aria-hidden="true">⌕</span><input value={historyFilter} onChange={e=>{setHistoryFilter(e.target.value);setHistoryShowAll(false)}} placeholder="Filtrar por termo"/></label>
      </div>
      {!saved.length?<div className={styles.historyEmpty}><span aria-hidden="true">◷</span><b>Nenhuma pesquisa salva ainda</b><p>Quando você salvar uma pesquisa, ela aparecerá aqui com os dados realmente coletados.</p></div>:<>
      <div className={styles.historyGrid}>
        <div className={styles.historyList} role="list" aria-label="Lista de pesquisas salvas">
          {!filteredHistory.length?<div className={styles.historyNoMatch}>Nenhuma pesquisa corresponde a “{historyFilter}”.</div>:visibleHistory.map(entry=><div key={entry.id} className={(selectedHistory?.id===entry.id)?styles.historyItemActive:styles.historyItem}>
            <button type="button" role="listitem" className={styles.historyItemMain} onClick={()=>setSelectedHistoryId(entry.id)}>
              <span><b>{entry.query||'Pesquisa sem termo'}</b><small>{entry.date?new Date(entry.date).toLocaleString('pt-BR'):'Data não disponível'} · {modeLabel(entry.mode)}</small></span>
              <span>{resaleScoreById[entry.id]&&<em className={styles.resaleMiniScore}>{resaleScoreById[entry.id].score}</em>}<strong>{entry.count??(Array.isArray(entry.rows)?entry.rows.length:'—')}</strong><small>anúncios</small>{historyFinanceById[entry.id]&&<small className={styles.historyProfit}>Lucro {money(historyFinanceById[entry.id].profit)} · {historyFinanceById[entry.id].marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</small>}</span>
            </button>
            <div className={styles.historyItemTools}>
              <button type="button" className={styles.historyExport} onClick={()=>exportResearch(entry)} title="Exportar pesquisa" aria-label={`Exportar pesquisa ${entry.query||''}`}>⇧</button>
              <button type="button" className={styles.historyTrash} onClick={()=>deleteResearch(entry)} title="Excluir pesquisa" aria-label={`Excluir pesquisa ${entry.query||''}`}>🗑</button>
            </div>
          </div>)}
          {filteredHistory.length>6&&<button type="button" className={styles.viewAllHistory} onClick={()=>setHistoryShowAll(v=>!v)}>{historyShowAll?'Mostrar menos':'Ver todas'} ({filteredHistory.length})</button>}
        </div>
        <div className={styles.historyDetails}>
          {selectedHistory&&<>
            <div className={styles.historyDetailHead}><div><span>PESQUISA SELECIONADA</span><h3>{selectedHistory.query||'Pesquisa sem termo'}</h3><p>{selectedHistory.date?new Date(selectedHistory.date).toLocaleString('pt-BR'):'Data não disponível'} · {modeLabel(selectedHistory.mode)}</p></div><div className={styles.historyDetailBadges}>{selectedResale&&<strong className={styles.resaleMainScore}>{selectedResale.score}<small>/100</small><i>{selectedResale.label}</i></strong>}</div></div>
            <div className={styles.decisionStrip}>
              <label><span>Custo</span><div>R$ <input inputMode="decimal" value={researchCosts[researchKey(selectedHistory)]??''} placeholder="0,00" onChange={e=>saveResearchCost(selectedHistory,e.target.value)}/></div></label>
              <div><span>Preço de referência</span><b>{selectedResale?.metrics?.price!=null?money(selectedResale.metrics.price):'—'}</b></div>
              <div data-tone={selectedResale?.finance?.profit>=0?'positive':'negative'}><span>Lucro / venda</span><b>{selectedResale?.finance?money(selectedResale.finance.profit):'Informe o custo'}</b></div>
              <div><span>Margem</span><b>{selectedResale?.finance?selectedResale.finance.marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}</b></div>
            </div>
            {comparison?.historyId===selectedHistory.id&&<div className={styles.comparisonBox} aria-live="polite">
              <b>Comparação com nova coleta</b>
              <div><span>Preço mediano</span><strong>{comparison.before?.priceMedian!=null&&comparison.after?.priceMedian!=null?`${money(comparison.before.priceMedian)} → ${money(comparison.after.priceMedian)}`:'Sem dados comparáveis'}</strong></div>
              <div><span>Vendas medianas</span><strong>{comparison.before?.soldMedian!=null&&comparison.after?.soldMedian!=null?`${compact(comparison.before.soldMedian)} → ${compact(comparison.after.soldMedian)}`:'Sem dados comparáveis'}</strong></div>
              <div><span>Vendas 30 dias</span><strong>{comparison.before?.monthlyMedian!=null&&comparison.after?.monthlyMedian!=null?`${compact(comparison.before.monthlyMedian)} → ${compact(comparison.after.monthlyMedian)}`:'Sem dados comparáveis'}</strong></div>
            </div>}
            <div className={styles.historyActions}>
              <button type="button" onClick={()=>reopenResearch(selectedHistory)} disabled={!Array.isArray(selectedHistory.rows)||!selectedHistory.rows.length} title={!Array.isArray(selectedHistory.rows)||!selectedHistory.rows.length?'Pesquisa antiga sem snapshot dos anúncios':''}>Reabrir pesquisa</button>
              <button type="button" onClick={()=>repeatAndCompare(selectedHistory)} disabled={busy}>Repetir e comparar</button>
              <button type="button" className={styles.deleteHistory} onClick={()=>deleteResearch(selectedHistory)}>Excluir</button>
            </div>
          </>}
        </div>
      </div></>}
    </section>}

    <section className={styles.analysisCard}>
      <div className={styles.analysisHeader}>
        <div><span>ANÁLISE DA PESQUISA</span><h2>{rows.length?'Pesquisa aberta':'Visão geral'}</h2><p>{rows.length?(query||'Pesquisa atual')+' · '+rows.length+' anúncios carregados':'Escolha uma pesquisa do histórico e abra para visualizar resultados, oportunidades, palavras-chave e concorrência.'}</p></div>
        <div className={styles.analysisHeaderActions}>
          {rows.length>0&&<button type="button" className={styles.infoButton} onClick={()=>setDiagnosticsOpen(v=>!v)} aria-expanded={diagnosticsOpen} aria-controls="cobertura-dados">ⓘ Cobertura dos dados</button>}
          {rows.length>0&&<button type="button" className={styles.sectionToggle} onClick={()=>setOverviewVisible(v=>!v)} aria-expanded={overviewVisible} aria-controls="conteudo-visao-geral">{overviewVisible?'⌃ Ocultar análise':'⌄ Mostrar análise'}</button>}
        </div>
      </div>

      {!rows.length&&<div className={styles.analysisEmptyState}>
        <span>◫</span>
        <div><b>Nenhuma pesquisa aberta</b><p>Selecione uma pesquisa acima e clique em “Reabrir pesquisa”, ou faça uma nova busca.</p></div>
        {selectedHistory&&<button type="button" onClick={()=>reopenResearch(selectedHistory)}>Abrir “{selectedHistory.query}”</button>}
      </div>}

      {diagnosticsOpen&&rows.length>0&&<section id="cobertura-dados" className={styles.qualityCard}><div className={styles.qualityHead}><div><span>COBERTURA DOS DADOS</span><b>{qualityLabel} · {quality}%</b></div><em data-level={quality>=75?'high':quality>=45?'mid':'low'}>{qualityLabel}</em></div><div className={styles.coverageGrid}>{[['Preço','price'],['Vendas','sold'],['Vendas 30d','monthly'],['Localização','location'],['Avaliação','rating'],['Reviews','reviews']].map(([label,key])=><div key={key}><b>{bench.coverage[key]}/{rows.length}</b><span>{label}</span><i><u style={{width:(bench.coverage[key]/rows.length*100)+'%'}}/></i></div>)}</div>{suspiciousSales&&<div className={styles.dataWarning}>⚠️ Todos os anúncios vieram com vendas = 0. O Gestor não assume que isso significa ausência de demanda; este campo está marcado como suspeito até uma nova coleta confirmar.</div>}<div id="diagnostico-coleta" className={styles.diagnosticPanel}><div className={styles.diagnosticIntro}><b>Motor Sênior × Gestor</b><span>{diagnostics?'O Motor informou a cobertura antes da normalização. Assim dá para saber exatamente onde um campo se perdeu.':'Esta coleta não trouxe diagnóstico do Motor. Faça uma nova pesquisa para gerar essa comparação quando o Motor disponibilizar o diagnóstico.'}</span></div>{diagnostics&&<><div className={styles.diagnosticActions}><button type="button" className={styles.secondary} onClick={downloadDiagnostics}>Baixar diagnóstico técnico</button>{diagnostics?.mode==='diagnostic-only'&&<span>Modo diagnóstico: amostra controlada de {diagnostics?.sampleSize||0} item(ns), sem enriquecimento misturado.</span>}</div><div className={styles.diagnosticGrid}>{[['Preço','price','price'],['Vendas','sold','sold'],['Vendas 30d','monthlySold','monthly'],['Localização','shopLocation','location'],['Avaliação','rating','rating'],['Reviews','reviewCount','reviews']].map(([label,motorKey,gestorKey])=>{const motor=Number(diagnostics?.coverage?.[motorKey]??0),gestor=Number(bench.coverage?.[gestorKey]??0);const status=motor===0?'source':gestor<motor?'normalizer':'ok';return <div key={label} data-status={status}><b>{label}</b><span>Motor: {motor}/{rows.length}</span><span>Gestor: {gestor}/{rows.length}</span><strong>{status==='ok'?'✓ aproveitado':status==='normalizer'?'⚠ normalização':'○ não veio da busca'}</strong></div>})}</div>{Array.isArray(diagnostics.detectedPaths)&&diagnostics.detectedPaths.length>0&&<details className={styles.detectedPaths}><summary>Campos estruturados detectados pelo Motor</summary><code>{diagnostics.detectedPaths.join(' · ')}</code></details>}</>}</div></section>}

      {rows.length>0&&overviewVisible&&<div id="conteudo-visao-geral" className={styles.analysisBody}>
        <nav className={styles.tabs} aria-label="Seções da Pesquisa de Produtos">
          <div className={styles.tabScroller}>{tabs.map(([id,label])=><button key={id} type="button" className={activeTab===id?styles.activeTab:''} onClick={()=>setActiveTab(id)}>{id==='overview'?'Resumo':label}</button>)}</div>
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

      </div>}
    </section>

    {rows.length>0&&<section className={styles.creationAssistant}>
      <div className={styles.assistantHeader}>
        <div><span className={styles.assistantEyebrow}>✨ ASSISTENTE DE CRIAÇÃO DO ANÚNCIO</span><h2>Crie o anúncio usando os sinais desta pesquisa</h2><p>As sugestões abaixo usam apenas os dados coletados. Onde a pesquisa não prova algo, o Gestor sinaliza para revisão.</p></div>
        <button type="button" className={styles.assistantToggle} onClick={()=>setAssistantVisible(v=>!v)}>{assistantVisible?'⌃ Ocultar assistente':'⌄ Mostrar assistente'}</button>
      </div>

      {assistantVisible&&<>
        <div className={styles.assistantSummary}>
          <div><span>🎯 Tema forte</span><b>{assistant.theme}</b></div>
          <div><span>👑 Melhor variação</span><b>{assistant.bestVariation}</b></div>
          <div><span>🏷 Faixa de preço</span><b>{assistant.priceRange}</b></div>
          <div><span>📊 Concorrência</span><b>{assistant.competition}</b></div>
          <label><span>Objetivo da recomendação</span><select value={assistantObjective} onChange={e=>setAssistantObjective(e.target.value)}><option value="sales">🏆 Mais vendido</option><option value="competition">🎯 Menor concorrência</option><option value="price">💰 Melhor preço</option></select></label>
        </div>

        <div className={styles.assistantTabs} role="tablist" aria-label="Etapas do Assistente de Criação">
          {[
            ['strategy','Estratégia','🎯'],['title','Título','✍'],['description','Descrição','▤'],['images','Imagens','▧'],
            ['category','Categoria / NCM','◇'],['variations','Variações','▦'],['references','Referências','↗'],['checklist','Checklist','☑']
          ].map(([id,label,icon])=><button key={id} type="button" role="tab" aria-selected={assistantTab===id} className={assistantTab===id?styles.assistantTabActive:''} onClick={()=>setAssistantTab(id)}><span>{icon}</span>{label}</button>)}
        </div>

        <div className={styles.assistantContent}>
          {assistantTab==='strategy'&&<div className={styles.strategyGrid}>
            <article><span>Demanda observada</span><strong>{bench.coverage.monthly?compact(bench.monthlyMedian)+' vendas/30d medianas':'Sem dados de 30 dias'}</strong><small>Base: {bench.coverage.monthly}/{rows.length} anúncios com vendas 30d.</small></article>
            <article><span>Variação mais forte</span><strong>{assistant.bestVariation}</strong><small>{variations[0]?variations[0].count+' anúncios encontrados com esse termo.':'Nenhum padrão de variação claro nos títulos.'}</small></article>
            <article><span>Preço de referência</span><strong>{bench.priceMedian!=null?money(bench.priceMedian):'Sem dados'}</strong><small>Mediana dos preços realmente coletados.</small></article>
            <article><span>Concentração</span><strong>{assistant.competition}</strong><small>{concentration.shops?concentration.shops+' lojas únicas; top 5 concentram '+concentration.share+'%.':'Sem shop_id suficiente.'}</small></article>
          </div>}

          {assistantTab==='title'&&<div className={styles.recommendationBox}>
            <div className={styles.recommendationHead}><div><span>Título sugerido</span><b>Baseado nas palavras e variações da pesquisa</b></div><em>Rascunho</em></div>
            <div className={styles.titleSuggestion}>{assistant.suggestedTitle||'Ainda não há dados suficientes para sugerir um título.'}</div>
            <p><b>Por que este título?</b> Combina a pesquisa principal com a variação mais forte detectada sem copiar integralmente o título de um concorrente.</p>
            <div className={styles.assistantActions}><button onClick={()=>copyText(assistant.suggestedTitle)}>Copiar título</button><button className={styles.secondaryAction} onClick={()=>setAssistantTab('strategy')}>Ver evidências</button><button className={styles.secondaryAction} onClick={()=>setActiveTab('keywords')}>Ver palavras usadas</button></div>
          </div>}

          {assistantTab==='description'&&<div className={styles.recommendationBox}>
            <div className={styles.recommendationHead}><div><span>Descrição sugerida</span><b>Rascunho para você completar com os dados reais do produto</b></div><em>Revisar</em></div>
            <textarea className={styles.descriptionDraft} readOnly value={assistant.description}/>
            <div className={styles.assistantActions}><button onClick={()=>copyText(assistant.description)}>Copiar descrição</button></div>
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
            {referenceProducts.length?referenceProducts.map((r,i)=><article key={r.key}><div className={styles.referenceImage}>{r.image?<img src={r.image} alt=""/>:<span>Sem imagem</span>}</div><div><span>{i===0?'🔥 Referência principal':'Concorrente '+(i+1)}</span><b>{r.title}</b><small>{money(r.price)} · {compact(r.sold)} vendas · {r.rating!=null?'★ '+number(r.rating):'sem nota'}</small><div className={styles.referenceActions}>{r.url&&<a href={r.url} target="_blank" rel="noreferrer">Ver anúncio ↗</a>}{r.image&&<a href={r.image} target="_blank" rel="noreferrer">Abrir imagem</a>}</div></div></article>):<div className={styles.empty}>Sem concorrentes utilizáveis nesta coleta.</div>}
          </div>}

          {assistantTab==='checklist'&&<div className={styles.checklistGrid}>
            {[
              ['Escolher tema / público',assistant.theme!=='—'],
              ['Definir variações principais',variations.length>0],
              ['Revisar título sugerido',Boolean(assistant.suggestedTitle)],
              ['Completar descrição com dados reais',false],
              ['Confirmar categoria na Shopee',false],
              ['Confirmar NCM com base no produto real',false],
              ['Escolher concorrente de referência',referenceProducts.length>0],
              ['Criar imagens próprias inspiradas na estratégia',false]
            ].map(([label,done])=><div key={label} data-done={done?'yes':'no'}><span>{done?'✓':'○'}</span><b>{label}</b></div>)}
          </div>}
        </div>
      </>}
    </section>}
  </div>;
}
 