'use client';

import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import styles from './intelligence-sections.module.css';
import ReminderButton from '../components/ReminderButton';
import {fetchJsonWithTimeout,motorRequest,motorData,classifyAsyncError} from '../lib/client-async';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const when=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR')};
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;
const titles={
  concorrentes:['Concorrentes','Acompanhe preço, vendas e mudanças dos concorrentes vinculados aos anúncios já analisados.','⌘'],
  'shopee-ads':['Shopee Ads','Veja campanhas, ROAS, meta, investimento e resultados sem sair do Gestor.','◎'],
  reanalises:['Reanálises','Confira quais anúncios estão vencidos ou próximos de uma nova análise.','↻'],
  prioridades:['Prioridades','Centralize os anúncios e melhorias que merecem atenção primeiro.','☆'],
  relatorios:['Relatórios','Resumo consolidado das análises, Ads e evolução dos anúncios.','▤']
};

function Empty({text,action,onAction}){return <div className={styles.empty}><span>{text}</span>{action&&<button type="button" onClick={onAction}>{action}</button>}</div>}
function missingKind(obj){
  const status=String(obj?.collectionStatus||obj?.collection_status||obj?.status||'').toLowerCase();
  if(obj?.collectionError||obj?.collection_error||obj?.error||status==='error')return'Erro de coleta';
  if(status==='not_integrated'||status==='unsupported')return'Não integrado';
  if(obj&&Object.keys(obj).length)return'Sem dados';
  return'Não coletado';
}
function dataText(value,formatter,context){return n(value)!=null?formatter(value):missingKind(context)}
function competitorPrice(c){
  if(n(c?.price)!=null)return n(c.price);
  const m=String(c?.searchText||'').match(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/i);
  return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
}
function competitorSold(c){
  if(n(c?.sold)!=null)return n(c.sold);
  const m=String(c?.searchText||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*(mil)?\+?\s*Vendido/i);
  if(!m)return null;
  const base=Number(m[1].replace(',','.'));
  return Number.isFinite(base)?Math.round(base*(m[2]?1000:1)):null;
}
function validCompetitorTitle(value){
  const s=String(value||'').trim();
  if(!s)return'';
  if(/^produto[_\s-]*\d+$/i.test(s))return'';
  if(/^product[_\s-]*\d+$/i.test(s))return'';
  if(/^item[_\s-]*\d+$/i.test(s))return'';
  return s;
}
function competitorTitle(...values){
  for(const value of values){
    const s=validCompetitorTitle(value);
    if(s)return s;
  }
  return'Concorrente';
}
function explicitBool(...values){
  for(const value of values){
    if(value===true||value===1||value==='1'||String(value).toLowerCase()==='true')return true;
    if(value===false||value===0||value==='0'||String(value).toLowerCase()==='false')return false;
  }
  return null;
}
function competitorOriginalPrice(comp,snap){
  const raw=snap?.raw&&typeof snap.raw==='object'?snap.raw:{};
  const direct=n(raw?.originalPrice??raw?.original_price??raw?.price_before_discount??comp?.originalPrice??comp?.original_price??comp?.price_before_discount);
  if(direct!=null)return direct;
  const prices=[...String(comp?.searchText||'').matchAll(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/gi)].map(m=>Number(m[1].replace(/\./g,'').replace(',','.'))).filter(Number.isFinite);
  return prices.length>1?prices[1]:null;
}
const BRAZIL_STATES=[
  'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal','Espírito Santo','Goiás','Maranhão',
  'Mato Grosso','Mato Grosso do Sul','Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí',
  'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia','Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins'
];
function normalizeLooseText(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function stateFromText(value){
  const raw=String(value||'').trim(); if(!raw)return'';
  const loose=normalizeLooseText(raw);
  const found=BRAZIL_STATES.find(state=>loose.includes(normalizeLooseText(state)));
  return found||'';
}
function historyRawValue(history,keys){
  for(const snap of arr(history)){
    const raw=snap?.raw&&typeof snap.raw==='object'?snap.raw:{};
    for(const key of keys){const value=raw?.[key];if(value!==null&&value!==undefined&&value!=='')return value}
  }
  return null;
}
function preferredSignalsFromObject(value,depth=0,path='root'){
  const result={trueEvidence:null,falseEvidence:null};
  if(!value||typeof value!=='object'||depth>6)return result;
  const keys=['is_preferred_plus_seller','is_preferred_shop','is_preferred_seller','isPreferredPlusSeller','isPreferredShop','isPreferredSeller','preferred','preferred_seller'];
  for(const key of keys){
    if(!Object.prototype.hasOwnProperty.call(value,key))continue;
    const b=explicitBool(value?.[key]);
    if(b===true&&!result.trueEvidence)result.trueEvidence=path+'.'+key;
    if(b===false&&!result.falseEvidence)result.falseEvidence=path+'.'+key;
  }
  for(const [key,v] of Object.entries(value)){
    if(v==null)continue;
    const keyText=normalizeLooseText(key);
    if(typeof v==='string'){
      const raw=String(v).trim(),valueText=normalizeLooseText(raw);
      const sellerKey=/(badge|label|tag|seller|shop|store|preferred|prefer)/.test(keyText);
      const explicitSellerLabel=/\bvendedor\s+indicado\b|\bpreferred\s+seller\b|\bvendedor\s+preferido\b/.test(valueText);
      const badgeLabel=sellerKey&&/(^|\W)(indicado|preferred|preferido)(\W|$)/.test(valueText);
      const isolatedVisibleLabel=raw.split(/\r?\n|\|/).map(x=>normalizeLooseText(x.trim())).some(line=>line==='indicado'||line==='vendedor indicado'||line==='preferred seller'||line==='vendedor preferido');
      if((explicitSellerLabel||badgeLabel||isolatedVisibleLabel)&&!result.trueEvidence)result.trueEvidence=path+'.'+key+':visible-label';
    }else if(typeof v==='object'){
      const nested=preferredSignalsFromObject(v,depth+1,path+'.'+key);
      if(nested.trueEvidence&&!result.trueEvidence)result.trueEvidence=nested.trueEvidence;
      if(nested.falseEvidence&&!result.falseEvidence)result.falseEvidence=nested.falseEvidence;
    }
  }
  return result;
}
function preferredFromObject(value){
  const signal=preferredSignalsFromObject(value);
  return signal.trueEvidence?true:(signal.falseEvidence?false:null);
}
function preferredEvidenceFromObject(value){
  const signal=preferredSignalsFromObject(value);
  return signal.trueEvidence||signal.falseEvidence||null;
}
function locationFromObject(value,depth=0){
  if(!value||typeof value!=='object'||depth>5)return'';
  const directKeys=['shop_location','seller_location','shop_location_name','shopLocation','sellerLocation','shop_city','seller_city','state','state_name'];
  for(const key of directKeys){
    const v=value?.[key];
    if(v!==null&&v!==undefined&&v!==''){
      const state=stateFromText(v);
      if(state)return state;
      if(typeof v==='string'&&v.trim())return v.trim();
    }
  }
  for(const [key,v] of Object.entries(value)){
    if(v==null)continue;
    const keyText=normalizeLooseText(key);
    if(typeof v==='string'&&/(location|localizacao|cidade|city|estado|state|address|endereco)/.test(keyText)){
      const state=stateFromText(v);
      if(state)return state;
    }
    if(typeof v==='object'){
      const nested=locationFromObject(v,depth+1);
      if(nested)return nested;
    }
  }
  return'';
}
function competitorMonthlySold(comp,snap,history=[]){
  const raw=snap?.raw&&typeof snap.raw==='object'?snap.raw:{};
  return n(raw?.monthlySold??raw?.monthly_sold??raw?.sold_30d??historyRawValue(history,['monthlySold','monthly_sold','sold_30d'])??comp?.monthlySold??comp?.monthly_sold??comp?.sold_30d);
}
function competitorPreferred(comp,snap,history=[]){
  const raw=snap?.raw&&typeof snap.raw==='object'?snap.raw:{};
  const direct=explicitBool(
    raw?.preferred,raw?.is_preferred_plus_seller,raw?.is_preferred_shop,
    historyRawValue(history,['preferred','is_preferred_plus_seller','is_preferred_shop']),
    comp?.preferred,comp?.is_preferred_plus_seller,comp?.is_preferred_shop
  );
  if(direct!==null)return direct;
  const searchText=String(comp?.searchText||'');
  if(searchText){
    const lines=searchText.split(/\r?\n|\|/).map(x=>normalizeLooseText(x.trim()));
    if(lines.some(line=>line==='indicado'||line==='vendedor indicado'||line==='preferred seller'))return true;
  }
  return preferredFromObject(comp);
}
function competitorLocation(comp,snap,history=[]){
  const raw=snap?.raw&&typeof snap.raw==='object'?snap.raw:{};
  const value=raw?.location??raw?.shop_location??raw?.seller_location??historyRawValue(history,['location','shop_location','seller_location'])??comp?.location??comp?.shop_location??comp?.seller_location;
  const direct=value==null?'':String(value).trim();
  return stateFromText(direct)||stateFromText(comp?.searchText)||stateFromText(comp?.description)||direct;
}
function shopIdentityFromObject(value,depth=0){
  if(!value||typeof value!=='object'||depth>5)return{name:'',username:'',url:''};
  const nameKeys=['shopName','shop_name','shopname','sellerName','seller_name','sellername','merchant_name','merchantName'];
  const userKeys=['shopUsername','shop_username','username','seller_username','sellerUsername'];
  const urlKeys=['shopUrl','shop_url','seller_url','sellerUrl'];
  let name='',username='',url='';
  for(const key of nameKeys){if(typeof value?.[key]==='string'&&value[key].trim()){name=value[key].trim();break}}
  for(const key of userKeys){if(typeof value?.[key]==='string'&&value[key].trim()){username=value[key].trim();break}}
  for(const key of urlKeys){if(typeof value?.[key]==='string'&&/^https?:\/\//i.test(value[key].trim())){url=value[key].trim();break}}
  if(name||username||url)return{name,username,url};
  for(const [key,v] of Object.entries(value)){
    if(!v||typeof v!=='object')continue;
    if(!/(shop|seller|merchant|account|store)/i.test(key))continue;
    const nested=shopIdentityFromObject(v,depth+1);
    if(nested.name||nested.username||nested.url)return nested;
  }
  return{name:'',username:'',url:''};
}
function competitorStore(comp,snap,history=[],watch){
  const raw=snap?.raw&&typeof snap.raw==='object'?snap.raw:{};
  const historicalName=historyRawValue(history,['shopName','shop_name','sellerName','seller_name']);
  const historicalUser=historyRawValue(history,['shopUsername','shop_username','username','seller_username']);
  const historicalUrl=historyRawValue(history,['shopUrl','shop_url','sellerUrl','seller_url']);
  const direct=shopIdentityFromObject(comp);
  const name=String(raw?.shopName??raw?.shop_name??raw?.sellerName??raw?.seller_name??historicalName??direct.name??'').trim();
  const username=String(raw?.shopUsername??raw?.shop_username??raw?.username??raw?.seller_username??historicalUser??direct.username??'').trim();
  const shopId=String(comp?.shopId??comp?.shop_id??watch?.competitor_shop_id??'').trim();
  const explicitUrl=String(raw?.shopUrl??raw?.shop_url??raw?.sellerUrl??raw?.seller_url??historicalUrl??direct.url??'').trim();
  const href=/^https?:\/\//i.test(explicitUrl)?explicitUrl:(username?('https://shopee.com.br/'+encodeURIComponent(username)):(shopId?'https://shopee.com.br/shop/'+encodeURIComponent(shopId):''));
  return{name,username,shopId,href};
}
function yesNo(value){return value===true?'Sim':value===false?'Não':'Não confirmado'}
function competitorImage(c){
  const asUrl=value=>{
    if(value==null)return null;
    if(typeof value==='object')return asUrl(value.url??value.src??value.image_url??value.imageUrl??value.image??value.image_id??value.imageId);
    const raw=String(value||'').trim();
    if(!raw)return null;
    if(/^https?:\/\//i.test(raw))return raw;
    if(/^[a-z0-9_-]{20,}$/i.test(raw))return 'https://down-br.img.susercontent.com/file/'+raw;
    return null;
  };
  const nested=c?.item_basic||c?.item||c?.product||{};
  const rows=[
    c?.imageUrl,c?.image_url,c?.image,c?.cover,c?.cover_url,c?.thumbnail,c?.image_id,c?.imageId,
    nested?.image,nested?.image_url,nested?.imageUrl,nested?.image_id,nested?.imageId,
    ...arr(c?.imageUrls),...arr(c?.image_urls),...arr(c?.images),
    ...arr(nested?.imageUrls),...arr(nested?.image_urls),...arr(nested?.images)
  ].map(asUrl).filter(Boolean).filter(u=>!/\.svg(?:\?|$)/i.test(u)&&!/productdetailspage|avatar|profile|logo/i.test(u));
  const score=u=>{let score=0;if(/down-br\.img\.susercontent\.com\/file\//i.test(u))score+=4;if(/\/br-11134207-/i.test(u))score+=10;if(/@resize_w/i.test(u))score+=2;if(/_tn(?:\?|$)/i.test(u))score-=6;if(/_cover(?:\?|$)/i.test(u))score-=7;return score};
  return rows.map((u,i)=>({u,i,score:score(u)})).sort((a,b)=>b.score-a.score||a.i-b.i)[0]?.u||null;
}
function VectorIcon({name,size=15,className=''}) {
  const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true',className};
  if(name==='search'||name==='zoom')return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>;
  if(name==='refresh')return <svg {...common}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.5 6.5L20 11"/><path d="M17.9 15A7 7 0 0 1 5.5 17.5L4 13"/></svg>;
  if(name==='edit')return <svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
  if(name==='external')return <svg {...common}><path d="M14 5h5v5"/><path d="M10 14 19 5"/><path d="M19 13v6H5V5h6"/></svg>;
  if(name==='trash')return <svg {...common}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>;
  if(name==='history')return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>;
  if(name==='store')return <svg {...common}><path d="M4 10v10h16V10"/><path d="M3 10 5 4h14l2 6"/><path d="M8 20v-6h8v6"/><path d="M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0"/></svg>;
  if(name==='chart')return <svg {...common}><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-8"/><path d="M22 19V3"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
}
function CompetitorThumb({src,title}){
  const [failed,setFailed]=useState(false);
  const [zoom,setZoom]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  useEffect(()=>{
    if(!zoom)return;
    const onKey=e=>{if(e.key==='Escape')setZoom(false)};
    window.addEventListener('keydown',onKey);
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{window.removeEventListener('keydown',onKey);document.body.style.overflow=previous};
  },[zoom]);
  const canZoom=!!src&&!failed;
  return <>
    {!canZoom
      ?<div className={styles.noImage}>▧</div>
      :<>
        <img src={src} alt={title||'Imagem do concorrente'} loading="lazy" onError={()=>setFailed(true)}/>
        <button type="button" className={styles.radarExactZoomButton} aria-label="Ampliar imagem do concorrente" title="Ampliar imagem" onClick={()=>setZoom(true)}><VectorIcon name="zoom" size={16}/></button>
      </>}
    {zoom&&canZoom&&typeof document!=='undefined'&&createPortal(
      <div className={styles.radarExactLightbox} role="dialog" aria-modal="true" aria-label="Imagem ampliada do concorrente" onClick={()=>setZoom(false)}>
        <button type="button" className={styles.radarExactLightboxClose} aria-label="Fechar imagem ampliada" onClick={()=>setZoom(false)}>×</button>
        <img src={src} alt={title||'Imagem ampliada do concorrente'} onClick={e=>e.stopPropagation()}/>
        <small>{title||'Imagem do concorrente'}</small>
      </div>,
      document.body
    )}
  </>;
}

function relativeTime(value){
  if(!value)return'';
  const d=new Date(value),diff=Date.now()-d.getTime();
  if(Number.isNaN(d.getTime()))return'';
  const abs=Math.max(0,diff),min=Math.floor(abs/60000),hours=Math.floor(abs/3600000),days=Math.floor(abs/86400000);
  if(min<2)return'agora';
  if(min<60)return min+' min atrás';
  if(hours<24)return hours+'h atrás';
  return days+' dia'+(days===1?'':'s')+' atrás';
}
function dueInfo(value){
  if(!value)return{due:false,label:'Sem data'};
  const ts=new Date(value).getTime();
  if(!Number.isFinite(ts))return{due:false,label:'Sem data'};
  const days=Math.ceil((ts-Date.now())/86400000);
  if(days<0)return{due:true,label:'Vencida há '+Math.abs(days)+' dia'+(Math.abs(days)===1?'':'s')};
  if(days===0)return{due:true,label:'Vence hoje'};
  return{due:false,label:'em '+days+' dia'+(days===1?'':'s')};
}
function MiniTrend({values=[],bars=false,tone='blue'}){
  const clean=values.map(n).filter(v=>v!=null);
  if(!clean.length)return <div className={styles.radarSparkEmpty}>Sem histórico</div>;
  if(bars){
    const max=Math.max(...clean,1);
    return <div className={styles.radarBars} data-tone={tone}>{clean.slice(-14).map((v,i)=><i key={i} style={{height:Math.max(10,(v/max)*100)+'%'}}/>)}</div>;
  }
  const data=clean.slice(-14),min=Math.min(...data),max=Math.max(...data),span=max-min||1;
  const points=data.map((v,i)=>`${data.length===1?50:(i/(data.length-1))*100},${88-((v-min)/span)*70}`).join(' ');
  return <svg className={styles.radarLine} data-tone={tone} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points}/></svg>;
}
function searchPositionLabel(position,page,found,maxPages=3,itemsPerPage=60){
  const pos=n(position),pg=n(page),perPage=Math.max(1,n(itemsPerPage)??60);
  if(pos!=null){
    const resolvedPage=pg!=null?pg:Math.floor((pos-1)/perPage)+1;
    const withinPage=((Math.max(1,pos)-1)%perPage)+1;
    return resolvedPage+'ª página · '+withinPage+'º anúncio';
  }
  if(found===false)return'Não encontrado até '+maxPages+'ª página';
  return'Aguardando leitura';
}
function shopeeSearchPrice(value){
  const raw=n(value);
  if(raw==null)return null;
  return raw>10000?raw/100000:raw;
}
function searchMarketData(row){
  const b=row?.item_basic||row?.item||row||{};
  const searchText=String(row?.searchText||b?.searchText||row?.display_text||b?.display_text||'');
  const textPrices=[...searchText.matchAll(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/gi)].map(m=>Number(m[1].replace(/\./g,'').replace(',','.'))).filter(Number.isFinite);
  const price=shopeeSearchPrice(b?.price??b?.price_min??b?.price_min_before_discount)??(textPrices[0]??null);
  const originalPrice=shopeeSearchPrice(b?.price_before_discount??b?.original_price)??(textPrices.length>1?textPrices[1]:null);
  const sold=n(b?.historical_sold??b?.sold);
  const monthlySold=n(b?.monthly_sold??b?.sold_30d);
  const preferred=/\bindicado\b|vendedor\s+indicado/i.test(searchText)?true:preferredFromObject(row);
  const locationRaw=b?.shop_location??b?.location??b?.shop_location_name??b?.seller_location??row?.shop_location??row?.location??row?.seller_location??null;
  const location=stateFromText(locationRaw)||locationFromObject(row)||stateFromText(searchText)||stateFromText(row?.description??b?.description);
  const shop=shopIdentityFromObject(row);
  return{
    price,originalPrice,sold,monthlySold,preferred,
    location:location||null,shopName:shop.name||null,shopUsername:shop.username||null,shopUrl:shop.url||null,
    title:b?.name||b?.item_name||row?.title||null,
    rating:n(b?.item_rating?.rating_star??b?.rating_star??row?.rating),
    rawSource:'search-item'
  };
}
function detectAdsFromSearchRow(row){
  if(!row||typeof row!=='object')return{status:'unknown',evidence:null};
  if(row?.is_ads===true)return{status:'detected',evidence:row?.ads_evidence||'extension.is_ads=true'};
  if(row?.is_ads===false)return{status:'not_detected',evidence:row?.ads_evidence||'extension.is_ads=false'};
  const visibleText=String(row?.searchText??row?.item_basic?.searchText??row?.item?.searchText??'');
  if(/(^|\n)\s*Ad\s*(\n|$)/i.test(visibleText))return{status:'detected',evidence:'search-label-ad'};
  const scopes=[row,row?.item_basic,row?.item,row?.ads,row?.ad,row?.tracking_info,row?.tracking].filter(x=>x&&typeof x==='object');
  const fields=['isSponsored','is_sponsored','isAd','is_ad','isAds','is_ads','sponsored','sponsored_listing'];
  for(const scope of scopes){
    for(const key of fields)if(scope[key]===true||scope[key]===1||scope[key]==='1')return{status:'detected',evidence:key+'=true'};
  }
  for(const scope of scopes){
    for(const key of fields)if(scope[key]===false||scope[key]===0||scope[key]==='0')return{status:'not_detected',evidence:key+'=false'};
  }
  return{status:'unknown',evidence:null};
}
function normalizeSearchVisibility(data,{ownerItemId,competitorItemId,maxPages=3}){
  const root=data?.data||data||{};
  const discovery=root?.discovery||null;
  if(discovery){
    const candidates=discovery?.candidates&&typeof discovery.candidates==='object'?Object.values(discovery.candidates):[];
    const queries=arr(root?.queries);
    const keyword=String(queries[0]||root?.title||'').trim();
    const selectCandidate=id=>candidates.find(c=>String(c?.itemid??c?.itemId??c?.item_id??'')===String(id))||null;
    const bestAppearance=c=>{
      const rows=arr(c?.appearances).filter(a=>(!a?.sort||a.sort==='relevance')&&(!keyword||String(a?.query||'').trim().toLowerCase()===keyword.toLowerCase()));
      const pool=rows.length?rows:arr(c?.appearances).filter(a=>!a?.sort||a.sort==='relevance');
      return [...pool].sort((a,b)=>(n(a?.rank)??Infinity)-(n(b?.rank)??Infinity))[0]||null;
    };
    const comp=selectCandidate(competitorItemId),own=selectCandidate(ownerItemId),compAppearance=bestAppearance(comp),ownAppearance=bestAppearance(own);
    let ads={status:'unknown',evidence:null},market=searchMarketData(comp||{});
    for(const search of arr(discovery?.rawSearches)){
      if(search?.sort&&search.sort!=='relevance')continue;
      if(keyword&&String(search?.query||'').trim().toLowerCase()!==keyword.toLowerCase())continue;
      for(const rawRow of arr(search?.body?.items)){
        const b=rawRow?.item_basic||rawRow?.item||rawRow||{};
        const id=String(b?.itemid??b?.item_id??rawRow?.itemid??rawRow?.item_id??'');
        if(id===String(competitorItemId)){
          const evidence=detectAdsFromSearchRow(rawRow);
          if(evidence.status==='detected')ads=evidence;
          else if(ads.status==='unknown'&&evidence.status==='not_detected')ads=evidence;
          const observed=searchMarketData(rawRow);
          market={...market,...Object.fromEntries(Object.entries(observed).filter(([,v])=>v!==null&&v!==undefined&&v!==''))};
        }
      }
    }
    const perPage=60;
    return{
      keyword,searchedAt:new Date().toISOString(),maxPages:Math.max(1,Math.min(5,n(root?.pages)??maxPages)),itemsPerPage:perPage,
      competitor:{found:!!comp,position:n(compAppearance?.rank),page:n(compAppearance?.page)!=null?n(compAppearance.page)+1:null},
      owner:{found:!!own,position:n(ownAppearance?.rank),page:n(ownAppearance?.page)!=null?n(ownAppearance.page)+1:null},
      ads,market,rawCount:candidates.length
    };
  }

  const directComp=root.competitor||root.target||null,directOwner=root.owner||root.own||root.my_listing||null;
  const rows=arr(root.results).length?arr(root.results):arr(root.items).length?arr(root.items):arr(root.products).length?arr(root.products):arr(root.candidates).length?arr(root.candidates):arr(root.search_results);
  const norm=(row,index)=>{
    const itemId=String(row?.itemId??row?.item_id??row?.itemid??row?.id??'');
    const rank=n(row?.rank??row?.position??row?.search_position??row?.relevance_rank)??(index+1);
    const perPage=n(root?.items_per_page??root?.per_page)??60;
    const page=n(row?.page??row?.page_number)??(rank?Math.floor((rank-1)/perPage)+1:null);
    return{...row,itemId,rank,page,ads:detectAdsFromSearchRow(row),market:searchMarketData(row)};
  };
  const normalized=rows.map(norm);
  const pick=(direct,id)=>{
    if(direct){const x=norm(direct,0);if(!x.itemId)x.itemId=String(id);return x}
    return normalized.find(x=>x.itemId===String(id))||null;
  };
  const competitor=pick(directComp,competitorItemId),owner=pick(directOwner,ownerItemId);
  const explicitAds=String(root?.competitor_ads_status||'');
  const ads=['detected','not_detected','unknown'].includes(explicitAds)?{status:explicitAds,evidence:root?.competitor_ads_evidence||null}:(competitor?.ads||{status:'unknown',evidence:null});
  return{
    keyword:String(root?.keyword||root?.search_term||'').trim(),
    searchedAt:root?.searched_at||root?.collected_at||new Date().toISOString(),
    maxPages:Math.max(1,Math.min(5,n(root?.max_pages)??maxPages)),
    itemsPerPage:n(root?.items_per_page??root?.per_page)??60,
    competitor:{found:!!competitor,position:competitor?.rank??null,page:competitor?.page??null},
    owner:{found:!!owner,position:owner?.rank??null,page:owner?.page??null},
    ads,market:competitor?.market||{price:null,originalPrice:null,sold:null,monthlySold:null,preferred:null,location:null,shopName:null,shopUsername:null,shopUrl:null,title:null,rating:null},rawCount:normalized.length
  };
}

async function visibilityViaMega({keyword,maxPages}){
  let status=null,startedResearch=false,finalStatus=null;
  try{status=await motorData('megaGetStatus',{},8000)}catch{}
  if(status?.active)throw new Error('O Motor Senior já está executando outra pesquisa. Aguarde ela terminar para atualizar a posição.');
  try{
    await motorData('megaStartResearch',{
      title:keyword,queries:[keyword],sortModes:['relevance'],includeSales:false,pages:maxPages,adLimit:1,mode:'economy',
      reviewLimits:{'1':0,'2':0,'3':0,'4':0,'5':0},delayMs:1500
    },12000);
    startedResearch=true;
    const started=Date.now();
    while(Date.now()-started<75000){
      await new Promise(resolve=>setTimeout(resolve,900));
      finalStatus=await motorData('megaGetStatus',{},8000);
      if(finalStatus?.stage!=='discovery'||['finished','finished_with_errors','cancelled','failed'].includes(String(finalStatus?.state||'')))break;
    }
    if(finalStatus?.stage==='discovery')throw new Error('A leitura da busca excedeu o tempo limite.');
    return await motorData('megaGetResult',{includeRaw:true},12000);
  }finally{
    if(startedResearch){
      try{
        const current=finalStatus||await motorData('megaGetStatus',{},5000);
        if(current?.active)await motorData('megaCancelResearch',{},8000);
      }catch{}
    }
  }
}

function competitorPriority(row){
  const due=dueInfo(row.watch?.next_check_at).due;
  const pricePct=n(row.change?.price_change_pct),velocity=n(row.change?.sold_velocity_change_pct);
  if(due&&pricePct!=null&&pricePct<0)return{rank:0,label:'Alta urgência',tone:'urgent'};
  if(pricePct!=null&&pricePct<0)return{rank:1,label:'Atenção',tone:'attention'};
  if(velocity!=null&&velocity>=50)return{rank:1,label:'Atenção',tone:'attention'};
  if(pricePct!=null&&pricePct>0)return{rank:2,label:'Oportunidade',tone:'opportunity'};
  if(row.price==null&&row.sold==null)return{rank:4,label:'Sem dados',tone:'nodata'};
  return{rank:3,label:'Estável',tone:'stable'};
}
function mainSignal(row){
  const pricePct=n(row.change?.price_change_pct),velocity=n(row.change?.sold_velocity_change_pct);
  if(pricePct!=null&&pricePct<-.1)return'down';
  if(pricePct!=null&&pricePct>.1)return'up';
  if(velocity!=null&&velocity>=25)return'accelerating';
  if(dueInfo(row.watch?.next_check_at).due)return'due';
  return'stable';
}

function Competitors({items}){
  const [monitor,setMonitor]=useState({phase:'loading',watches:[],error:''});
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const [sort,setSort]=useState('priority');
  const [period,setPeriod]=useState('7');
  const [openHistory,setOpenHistory]=useState('');
  const [openMenu,setOpenMenu]=useState('');
  const [bulkPhase,setBulkPhase]=useState('idle');
  const [bulkProgress,setBulkProgress]=useState({done:0,total:0,label:''});
  const [openSearchDetails,setOpenSearchDetails]=useState('');
  const [visibilityPhase,setVisibilityPhase]=useState({});
  const [checkingCompetitor,setCheckingCompetitor]=useState('');

  async function loadMonitor(){
    setMonitor(x=>({...x,phase:'loading',error:''}));
    try{
      const data=await fetchJsonWithTimeout('/api/competitor-monitor',{cache:'no-store'},15000);
      setMonitor({phase:'success',watches:arr(data?.watches),error:''});
    }catch(e){setMonitor({phase:'error',watches:[],error:String(e?.message||e)})}
  }
  useEffect(()=>{loadMonitor()},[]);
  useEffect(()=>{
    const close=()=>setOpenMenu('');
    window.addEventListener('click',close);
    return()=>window.removeEventListener('click',close);
  },[]);

  const watchMap=useMemo(()=>new Map(arr(monitor.watches).map(w=>[`${w.owner_item_id}:${w.competitor_item_id}`,w])),[monitor.watches]);

  const rows=useMemo(()=>items.flatMap(item=>arr(item.latest?.competitors).slice(0,3).map((comp,i)=>{
    const compItem=String(comp?.itemId??comp?.item_id??comp?.id??'');
    const watch=watchMap.get(`${item.itemId}:${compItem}`)||null;
    const snap=watch?.latest_snapshot||null;
    const ownerSnapshot=item.latest?.product_snapshot||{};
    const unverifiedPdpPrice=snap?.source==='pdp_get_pc_intercepted'&&n(snap?.raw?.priceVerification?.publicPrice)==null;
    return{
      key:`${item.itemId}:${compItem||i}`,ownerItemId:item.itemId,
      owner:ownerSnapshot.title||ownerSnapshot.item_name||`Produto ${item.itemId}`,
      ownerCategory:ownerSnapshot.category||ownerSnapshot.category_name||'',
      competitorItemId:compItem,title:competitorTitle(snap?.title,watch?.competitor_title,comp.title,comp.name,`Concorrente ${i+1}`),
      price:unverifiedPdpPrice?competitorPrice(comp):(n(snap?.price)??competitorPrice(comp)),
      originalPrice:unverifiedPdpPrice?competitorOriginalPrice(comp,null):competitorOriginalPrice(comp,snap),
      priceFallback:unverifiedPdpPrice,
      sold:n(snap?.sold)??competitorSold(comp),sold30d:competitorMonthlySold(comp,snap,watch?.snapshot_history),
      preferred:competitorPreferred(comp,snap,watch?.snapshot_history),location:competitorLocation(comp,snap,watch?.snapshot_history),
      store:competitorStore(comp,snap,watch?.snapshot_history,watch),
      adsFallback:explicitBool(snap?.raw?.ads,historyRawValue(watch?.snapshot_history,['ads'])),
      adsFallbackEvidence:snap?.raw?.adsEvidence||historyRawValue(watch?.snapshot_history,['adsEvidence'])||null,
      rating:n(snap?.rating)??n(comp.rating),raw:comp,
      image:competitorImage(comp)||competitorImage(snap)||snap?.image_url||null,link:comp.link||comp.url||watch?.competitor_url||null,
      collected:snap?.collected_at||item.latest?.analyzed_at,watch,change:watch?.latest_change||null,
      history:arr(watch?.snapshot_history),confidence:snap?.confidence||null,
      visibility:watch?.latest_visibility||null,visibilityHistory:arr(watch?.visibility_history)
    };
  }).filter(r=>monitor.phase!=='success'||!!r.watch)),[items,watchMap,monitor.phase]);

  async function updateWatch(watch,patch){
    if(!watch?.id)return;
    try{
      await fetchJsonWithTimeout('/api/competitor-monitor',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:watch.id,...patch})},12000);
      await loadMonitor();
    }catch(e){setMonitor(x=>({...x,phase:'error',error:String(e?.message||e)}))}
  }

  async function collectVisibilityGroup(group,{silent=false}={}){
    const list=arr(group).filter(r=>r.watch?.id);
    if(!list.length)return{updated:0,failed:0};
    const first=list[0],keyword=String(first.watch?.settings?.search_keyword||first.owner||'').trim();
    const maxPages=Math.max(1,Math.min(5,n(first.watch?.settings?.search_max_pages)??3));
    const phaseKey=String(first.ownerItemId);
    if(!silent)setVisibilityPhase(x=>({...x,[phaseKey]:'loading'}));
    try{
      let data;
      try{
        data=await motorData('collectSearchVisibility',{
          keyword,maxPages,ownerItemId:String(first.ownerItemId),
          competitorItemIds:list.map(r=>String(r.competitorItemId)).filter(Boolean),
          reason:'competitor-search-visibility'
        },90000);
      }catch(error){
        const message=String(error?.message||error);
        if(!/não reconhecida|not recognized|unknown action|collectSearchVisibility/i.test(message))throw error;
        data=await visibilityViaMega({keyword,maxPages});
      }
      let updated=0;
      for(const row of list){
        const normalized=normalizeSearchVisibility(data,{ownerItemId:row.ownerItemId,competitorItemId:row.competitorItemId,maxPages});
        await fetchJsonWithTimeout('/api/competitor-visibility',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            watch_id:row.watch.id,keyword:normalized.keyword||keyword,searched_at:normalized.searchedAt,
            max_pages:normalized.maxPages,items_per_page:normalized.itemsPerPage,
            competitor_found:normalized.competitor.found,competitor_position:normalized.competitor.position,competitor_page:normalized.competitor.page,
            owner_found:normalized.owner.found,owner_position:normalized.owner.position,owner_page:normalized.owner.page,
            competitor_ads_status:normalized.ads.status,competitor_ads_evidence:normalized.ads.evidence,
            source:'motor-senior-search',confidence:'observed',
            raw:{results_count:normalized.rawCount,search_order:'relevance',session_observed:true}
          })
        },15000);
        const market=normalized.market||{};
        const hasMarketData=n(market.price)!=null||n(market.sold)!=null||n(market.monthlySold)!=null||market.preferred!==null||!!market.location||!!market.shopName||!!market.shopUsername||!!market.shopUrl;
        if(hasMarketData){
          await fetchJsonWithTimeout('/api/competitor-monitor',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              watch_id:row.watch.id,
              collected_at:normalized.searchedAt,
              title:competitorTitle(market.title,row.title,row.watch?.competitor_title),
              price:n(market.price),sold:n(market.sold),rating:n(market.rating),
              image_url:row.image||null,
              source:'shopee-search-structured',confidence:'observed',
              raw:{
                originalPrice:n(market.originalPrice),
                monthlySold:n(market.monthlySold),
                preferred:market.preferred,
                location:market.location||null,
                shopName:market.shopName||null,
                shopUsername:market.shopUsername||null,
                shopUrl:market.shopUrl||null,
                searchRank:normalized.competitor.position,
                searchPage:normalized.competitor.page,
                keyword:normalized.keyword||keyword
              }
            })
          },15000);
        }
        updated++;
      }
      if(!silent)setVisibilityPhase(x=>({...x,[phaseKey]:'success'}));
      return{updated,failed:0};
    }catch(error){
      if(!silent)setVisibilityPhase(x=>({...x,[phaseKey]:'error',error:String(error?.message||error)}));
      return{updated:0,failed:list.length,error};
    }
  }

  async function checkCompetitor(row){
    if(!row?.watch?.id)return;
    setCheckingCompetitor(row.key);
    try{
      const watch=row.watch;
      const keyword=String(watch?.settings?.search_keyword||row.owner||'').trim();
      let details=null,directError='';
      try{
        details=await motorData('collectCompetitorDetails',{
          url:watch.competitor_url,
          expectedItemId:String(watch.competitor_item_id),
          keyword
        },65000);
      }catch(error){
        directError=String(error?.message||error);
        if(!/não reconhecida|not recognized|unknown action|collectCompetitorDetails/i.test(directError))console.warn('[Concorrentes] checagem direta falhou',error);
      }

      if(details){
        const itemId=String(details?.itemId??details?.item_id??'');
        const shopId=String(details?.shopId??details?.shop_id??'');
        if(itemId!==String(watch.competitor_item_id)||shopId!==String(watch.competitor_shop_id))throw new Error('A extensão retornou outro anúncio.');
        await fetchJsonWithTimeout('/api/competitor-monitor',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            watch_id:watch.id,
            title:competitorTitle(details?.title,watch.competitor_title,row.title),
            price:null,
            sold:n(details?.historicalSold),
            rating:null,stock:null,image_url:row.image||null,
            source:'motor-senior-competitor-details',
            confidence:'observed',
            raw:{
              monthlySold:n(details?.monthlySold),
              preferred:explicitBool(details?.preferred),
              preferredEvidence:details?.preferredEvidence||null,
              location:details?.shopLocation||null,
              shopName:details?.shopName||null,
              shopUsername:details?.shopUsername||null,
              shopUrl:details?.shopUrl||null,
              ads:explicitBool(details?.ads),
              adsEvidence:details?.adsEvidence||null,
              diagnostics:details?.diagnostics||null
            }
          })
        },15000);
      }else{
        // Compatibilidade temporária com Motor Senior anterior.
        const data=await motorData('collectProduct',{url:watch.competitor_url,reason:'single-competitor-check',expectedItemId:String(watch.competitor_item_id)},45000);
        const p=data?.product||data;
        const itemId=String(p?.itemId??p?.item_id??''),shopId=String(p?.shopId??p?.shop_id??'');
        if(itemId!==String(watch.competitor_item_id)||shopId!==String(watch.competitor_shop_id))throw new Error('A extensão retornou outro anúncio.');
        const shop=shopIdentityFromObject(data);
        await fetchJsonWithTimeout('/api/competitor-monitor',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            watch_id:watch.id,title:competitorTitle(p?.title,p?.item_name,watch.competitor_title),
            price:null,sold:n(p?.sold??p?.historicalSold??p?.historical_sold),rating:n(p?.rating),stock:n(p?.stock),image_url:competitorImage(p),
            source:'pdp_get_pc_metadata',confidence:'structured',
            raw:{
              monthlySold:n(p?.monthlySold??p?.monthly_sold??p?.sold30d??p?.sold_30d),
              preferred:preferredFromObject(data),preferredEvidence:preferredEvidenceFromObject(data),
              location:locationFromObject(data)||null,
              shopName:shop.name||null,shopUsername:shop.username||null,shopUrl:shop.url||null
            }
          })
        },15000);
      }

      // Mantém rank e dados de busca sincronizados. No 0.14.5, o retorno também inclui is_ads.
      const result=await collectVisibilityGroup([row],{silent:true});
      await loadMonitor();
      if(result.failed){
        setMonitor(x=>({...x,phase:'success',error:'Dados do anúncio foram checados, mas a busca de rank não respondeu completamente.'}));
      }else if(directError&&details==null){
        setMonitor(x=>({...x,phase:'success',error:'Use o Motor Senior 0.14.5 para a checagem direta completa.'}));
      }
    }catch(e){
      setMonitor(x=>({...x,phase:'error',error:'Falha ao checar o concorrente: '+String(e?.message||e)}));
    }finally{setCheckingCompetitor('')}
  }

  async function recheckAll(){
    const targets=filtered.map(r=>r.watch).filter(Boolean).slice(0,12);
    if(!targets.length)return;
    const grouped=new Map();
    for(const row of filtered){if(!grouped.has(String(row.ownerItemId)))grouped.set(String(row.ownerItemId),[]);grouped.get(String(row.ownerItemId)).push(row)}
    const visibilityGroups=[...grouped.values()].slice(0,6);
    const totalSteps=Math.max(1,targets.length+visibilityGroups.length);
    let done=0,updated=0,failed=0;
    setBulkPhase('loading');
    setBulkProgress({done:0,total:totalSteps,label:'Preparando rechecagem…'});
    for(const watch of targets){
      setBulkProgress({done,total:totalSteps,label:`Verificando anúncio ${done+1} de ${targets.length}…`});
      try{
        const data=await motorData('collectProduct',{url:watch.competitor_url,reason:'manual-competitor-refresh',expectedItemId:String(watch.competitor_item_id),includeVisibleText:true,detectLabels:['Indicado','Vendedor Indicado','Preferred Seller']},45000);
        const p=data?.product||data;
        const itemId=String(p?.itemId??p?.item_id??''),shopId=String(p?.shopId??p?.shop_id??'');
        if(itemId!==String(watch.competitor_item_id)||shopId!==String(watch.competitor_shop_id))throw new Error('A extensão retornou outro anúncio.');
        const source=String(p?.ratingSource||p?.validationSource||p?.source||data?.source||'').toLowerCase();
        const structured=/pdp_get_pc|structured|api/.test(source)||p?.ratingDebug?.pdpGetPc?.ok===true||p?.rating_debug?.pdp_get_pc?.ok===true||p?.validation?.pdpGetPc?.ok===true;
        if(!structured)throw new Error('A coleta estruturada deste concorrente não foi confirmada.');

        let publicProduct=null;
        try{
          const publicData=await fetchJsonWithTimeout('/api/shopee/product-public?direct=1&shop_id='+encodeURIComponent(shopId)+'&item_ids='+encodeURIComponent(itemId),{cache:'no-store'},18000);
          publicProduct=arr(publicData?.results).find(x=>String(x?.item_id??x?.itemId??'')===itemId&&x?.ok!==false)||null;
        }catch(error){
          console.warn('[Concorrentes] validação pública de preço falhou',error);
        }
        const extensionPrice=n(p?.currentPrice??p?.price);
        const publicPrice=n(publicProduct?.price);
        // O retorno collectProduct já confundiu cupom/valor auxiliar com preço real.
        // Sem confirmação independente, não gravamos mais esse preço como atual.
        const verifiedPrice=publicPrice;
        const extensionOriginalPrice=n(p?.originalPrice??p?.original_price??p?.priceBeforeDiscount??p?.price_before_discount);
        const publicOriginalPrice=n(publicProduct?.priceBeforeDiscount??publicProduct?.originalPrice);
        const verifiedOriginalPrice=publicOriginalPrice??extensionOriginalPrice;
        const verifiedSold=n(publicProduct?.historicalSold)??n(p?.sold??p?.historicalSold??p?.historical_sold);

        await fetchJsonWithTimeout('/api/competitor-monitor',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            watch_id:watch.id,title:p?.title||p?.item_name||watch.competitor_title,
            price:verifiedPrice,sold:verifiedSold,rating:p?.rating??publicProduct?.rating??null,stock:p?.stock??publicProduct?.stock??null,
            image_url:competitorImage(p),source:publicPrice!=null?'shopee-public-item-verified':'pdp_get_pc_intercepted',confidence:publicPrice!=null?'verified':'price-unverified',
            raw:{
              ratingSource:p?.ratingSource||null,validationSource:p?.validationSource||null,categoryId:p?.categoryId??p?.category_id??null,
              originalPrice:verifiedOriginalPrice,
              monthlySold:p?.monthlySold??p?.monthly_sold??p?.sold30d??p?.sold_30d??null,
              preferred:explicitBool(publicProduct?.preferred)??preferredFromObject(data),
              preferredEvidence:publicProduct?.preferredEvidence||preferredEvidenceFromObject(data),
              location:stateFromText(publicProduct?.shopLocation)||locationFromObject(data)||stateFromText(p?.searchText??p?.description)||null,
              shopName:publicProduct?.shopName||shopIdentityFromObject(data).name||null,
              shopUsername:publicProduct?.shopUsername||shopIdentityFromObject(data).username||null,
              shopUrl:publicProduct?.shopUrl||shopIdentityFromObject(data).url||null,
              priceVerification:{
                publicPrice,extensionPrice,
                publicOriginalPrice,extensionOriginalPrice,
                mismatch:publicPrice!=null&&extensionPrice!=null&&Math.abs(publicPrice-extensionPrice)>.009
              }
            }
          })
        },15000);
        updated++;
      }catch(error){
        failed++;
        try{await fetchJsonWithTimeout('/api/competitor-monitor',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:watch.id,action:'record_error',last_error:String(error?.message||error).slice(0,900)})},8000)}catch{}
      }
      done++;
      setBulkProgress({done,total:totalSteps,label:`${done} de ${totalSteps} etapas concluídas`});
      if(targets.length>1)await new Promise(resolve=>setTimeout(resolve,1200));
    }
    let visibilityFailed=0;
    for(let i=0;i<visibilityGroups.length;i++){
      setBulkProgress({done,total:totalSteps,label:`Medindo posição na busca ${i+1} de ${visibilityGroups.length}…`});
      const result=await collectVisibilityGroup(visibilityGroups[i],{silent:true});
      visibilityFailed+=result.failed||0;
      done++;
      setBulkProgress({done,total:totalSteps,label:`${done} de ${totalSteps} etapas concluídas`});
    }
    await loadMonitor();
    setBulkProgress({done:totalSteps,total:totalSteps,label:'Rechecagem concluída.'});
    setBulkPhase(failed||visibilityFailed?'error':'success');
    if(failed||visibilityFailed)setMonitor(x=>({...x,error:`${updated} concorrente(s) atualizados; ${failed} coleta(s) de produto e ${visibilityFailed} leitura(s) de busca aguardam nova tentativa.`}));
    setTimeout(()=>{setBulkPhase('idle');setBulkProgress({done:0,total:0,label:''})},3500);
  }

  async function removeWatch(row){
    if(!row.watch?.id)return;
    const ok=window.confirm(`Excluir “${row.title}” da página Concorrentes? Ele deixará de ser monitorado. O histórico já coletado será preservado para não perder dados antigos.`);
    if(!ok)return;
    setOpenMenu('');
    try{
      await fetchJsonWithTimeout('/api/competitor-monitor',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:row.watch.id,enabled:false})
      },12000);
      await loadMonitor();
    }catch(e){
      setMonitor(x=>({...x,phase:'error',error:'Não foi possível excluir o concorrente: '+String(e?.message||e)}));
    }
  }

  const counts=useMemo(()=>{
    const down=rows.filter(r=>n(r.change?.price_change_pct)!=null&&n(r.change.price_change_pct)<-.1).length;
    const up=rows.filter(r=>n(r.change?.price_change_pct)!=null&&n(r.change.price_change_pct)>.1).length;
    const accelerating=rows.filter(r=>n(r.change?.sold_velocity_change_pct)!=null&&n(r.change.sold_velocity_change_pct)>=25).length;
    const due=rows.filter(r=>dueInfo(r.watch?.next_check_at).due).length;
    return{down,up,accelerating,due,total:rows.length};
  },[rows]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const matchesStatus=r=>{
      const signal=mainSignal(r);
      if(status==='all')return true;
      if(status==='down')return signal==='down';
      if(status==='up')return signal==='up';
      if(status==='accelerating')return n(r.change?.sold_velocity_change_pct)!=null&&n(r.change.sold_velocity_change_pct)>=25;
      if(status==='due')return dueInfo(r.watch?.next_check_at).due;
      if(status==='nodata')return r.price==null&&r.sold==null;
      return true;
    };
    const list=rows.filter(r=>(!q||[r.title,r.owner,r.competitorItemId,r.ownerItemId].some(v=>String(v||'').toLowerCase().includes(q)))&&matchesStatus(r));
    return [...list].sort((a,b)=>{
      if(sort==='price')return Math.abs(n(b.change?.price_change_pct)||0)-Math.abs(n(a.change?.price_change_pct)||0);
      if(sort==='sales')return (n(b.change?.sold_delta)||0)-(n(a.change?.sold_delta)||0);
      if(sort==='collected')return new Date(b.collected||0)-new Date(a.collected||0);
      if(sort==='recheck')return new Date(a.watch?.next_check_at||8640000000000000)-new Date(b.watch?.next_check_at||8640000000000000);
      return competitorPriority(a).rank-competitorPriority(b).rank;
    });
  },[rows,query,status,sort]);

  const alerts=useMemo(()=>{
    const out=[];
    for(const r of rows){
      const pricePct=n(r.change?.price_change_pct),priceDelta=n(r.change?.price_change),soldDelta=n(r.change?.sold_delta);
      if(pricePct!=null&&Math.abs(pricePct)>=.1)out.push({
        key:r.key+':price',tone:pricePct<0?'down':'up',image:r.image,at:r.collected,
        text:`${r.title} ${pricePct<0?'reduziu':'aumentou'} ${priceDelta==null?Math.abs(pricePct).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':money(Math.abs(priceDelta))+' ('+(pricePct>0?'+':'')+pricePct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%)'}`
      });
      if(soldDelta!=null&&soldDelta>0)out.push({key:r.key+':sales',tone:'sales',image:r.image,at:r.collected,text:`${r.title} vendeu +${soldDelta.toLocaleString('pt-BR')} desde a última coleta`});
      if(!r.image)out.push({key:r.key+':image',tone:'image',image:null,at:r.collected,text:`${r.title} está sem imagem confiável`});
    }
    if(counts.due)out.push({key:'due',tone:'due',image:null,at:null,text:`${counts.due} concorrente${counts.due===1?' está':'s estão'} com rechecagem vencida`});
    return out.sort((a,b)=>new Date(b.at||Date.now())-new Date(a.at||Date.now())).slice(0,6);
  },[rows,counts.due]);

  const distribution=useMemo(()=>{
    const bucket={down:0,up:0,accelerating:0,due:0,stable:0};
    rows.forEach(r=>{bucket[mainSignal(r)]++});
    return bucket;
  },[rows]);

  const donut=useMemo(()=>{
    const total=Math.max(1,rows.length),parts=[
      ['#27b36a',distribution.down],['#ef5360',distribution.up],['#2d77e5',distribution.accelerating],['#f2a323',distribution.due],['#b7c4d4',distribution.stable]
    ];
    let cursor=0;const stops=[];
    parts.forEach(([color,count])=>{const from=cursor;cursor+=(count/total)*360;stops.push(`${color} ${from}deg ${cursor}deg`)});
    if(cursor<360)stops.push(`#e7edf5 ${cursor}deg 360deg`);
    return`conic-gradient(${stops.join(',')})`;
  },[distribution,rows.length]);

  if(monitor.phase==='loading'&&!rows.length)return <Empty text="Carregando Radar de concorrentes…"/>;
  if(!rows.length&&monitor.phase!=='error')return <Empty text="Nenhum concorrente monitorado. Faça uma Super Análise e selecione de 1 a 3 concorrentes."/>;
  return <div className={styles.radarExact}>
    <section className={styles.radarExactToolbar}>
      <label className={styles.radarExactSearch}><span><VectorIcon name="search" size={17}/></span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar concorrente, anúncio ou ID..."/></label>
      <label><small>Status</small><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option><option value="down">Queda de preço</option><option value="up">Alta de preço</option><option value="accelerating">Vendas acelerando</option><option value="due">Rechecagem vencida</option><option value="nodata">Sem dados</option></select></label>
      <label><small>Ordenar por</small><select value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Maior prioridade</option><option value="price">Maior variação de preço</option><option value="sales">Mais vendas</option><option value="collected">Última coleta</option><option value="recheck">Próxima rechecagem</option></select></label>
      <label><small>Período</small><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="7">Últimos 7 dias</option><option value="14">Últimos 14 dias</option><option value="30">Últimos 30 dias</option><option value="all">Todo histórico</option></select></label>
      <button type="button" className={styles.radarExactRefresh} onClick={recheckAll} disabled={bulkPhase==='loading'}><VectorIcon name="refresh" size={15}/>{bulkPhase==='loading'?'Rechecando…':'Atualizar / Rechecar agora'}</button>
      <button type="button" className={styles.radarExactIcon} aria-label="Ajuda">?</button>
      <button type="button" className={styles.radarExactIcon} aria-label="Notificações">♟</button>
      <span className={styles.radarExactAvatar}>GS</span>
    </section>

    <section className={styles.radarExactKpis}>
      <article data-tone="down"><span>↓</span><div><b>{counts.down}</b><strong>com queda de preço</strong><small>{counts.total?((counts.down/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="up"><span>↑</span><div><b>{counts.up}</b><strong>com alta de preço</strong><small>{counts.total?((counts.up/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="sales"><span>▥</span><div><b>{counts.accelerating}</b><strong>com vendas acelerando</strong><small>{counts.total?((counts.accelerating/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="due"><span>◷</span><div><b>{counts.due}</b><strong>rechecagens vencidas</strong><small>{counts.total?((counts.due/counts.total)*100).toFixed(1).replace('.',','):'0'}% do total</small></div></article>
      <article data-tone="total"><span>♟</span><div><b>{counts.total}</b><strong>concorrentes monitorados</strong><small>100% do total</small></div></article>
    </section>

    {bulkPhase==='loading'&&<section className={styles.radarExactProgress}>
      <div className={styles.radarExactProgressIcon}>↻</div>
      <div className={styles.radarExactProgressCopy}><b>Rechecando concorrentes…</b><span>{bulkProgress.label||'Verificando anúncios e posições na busca…'}</span></div>
      <div className={styles.radarExactProgressTrack}><i style={{width:(bulkProgress.total?Math.max(2,Math.round((bulkProgress.done/bulkProgress.total)*100)):2)+'%'}}/></div>
      <strong>{bulkProgress.total?Math.round((bulkProgress.done/bulkProgress.total)*100):0}%</strong>
      <small>Isso pode levar alguns minutos.<br/>Mantenha esta página aberta.</small>
    </section>}

    {monitor.phase==='error'&&<div className={styles.error}>{monitor.error}<button onClick={loadMonitor}>Tentar novamente</button></div>}

    <div className={styles.radarExactColumns}>
      <section className={styles.radarExactListArea}>
        <div className={styles.radarExactListHead}>
          <b>{filtered.length} concorrente{filtered.length===1?'':'s'} encontrado{filtered.length===1?'':'s'}</b>
          <div><i data-tone="down"/> Queda de preço <i data-tone="up"/> Alta de preço <i data-tone="sales"/> Vendas acelerando <i data-tone="due"/> Rechecagem vencida</div>
        </div>

        <div className={styles.radarExactList}>{filtered.map(r=>{
          const priority=competitorPriority(r),signal=mainSignal(r),due=dueInfo(r.watch?.next_check_at),pricePct=n(r.change?.price_change_pct),soldDelta=n(r.change?.sold_delta),velocity=n(r.change?.sold_velocity_change_pct);
          const previousPrice=n(r.change?.price_before);
          const cutoff=period==='all'?0:Date.now()-Number(period)*86400000;
          const hist=r.history.filter(h=>!cutoff||new Date(h.collected_at).getTime()>=cutoff).slice().reverse();
          const normalPrice=r.originalPrice!=null&&r.originalPrice>r.price?r.originalPrice:r.price;
          const offerPrice=r.originalPrice!=null&&r.price!=null&&r.originalPrice>r.price?r.price:null;
          const ownerHref='/extensao-shopee-intelligence?section=super-anuncio&item_id='+r.ownerItemId;
          const priceHref='/super-analise?item_id='+r.ownerItemId+'&tab=price';
          return <article className={styles.radarExactCard} data-tone={priority.tone} data-signal={signal} key={r.key}>
            <section className={styles.radarExactIdentity}>
              <div className={styles.radarExactThumb}><CompetitorThumb src={r.image} title={r.title}/></div>
              <div>
                {r.link?<a className={styles.radarExactTitle} href={r.link} target="_blank" rel="noreferrer">{r.title}</a>:<b className={styles.radarExactTitle}>{r.title}</b>}
                <div className={styles.radarExactStore}><span className={styles.radarExactStoreGlyph}><VectorIcon name="store" size={17}/></span><span>Loja:</span>{r.store?.name?(r.store?.href?<a href={r.store.href} target="_blank" rel="noreferrer">{r.store.name}<VectorIcon name="external" size={11}/></a>:<b>{r.store.name}</b>):<small>aguardando coleta</small>}</div>
                <span>Vinculado ao seu anúncio:</span><Link href={ownerHref}>{r.owner}</Link><em>Concorrente Direto</em>
              </div>
            </section>

            <section className={styles.radarExactPrice}>
              <small>Preço normal / oferta</small>
              <div><b>{money(normalPrice)}</b>{offerPrice!=null&&<b className={styles.radarExactOffer}>{money(offerPrice)}</b>}{pricePct!=null&&Math.abs(pricePct)>=.1&&<mark data-tone={pricePct<0?'down':'up'}>{pricePct<0?'↓':'↑'} {pricePct>0?'+':''}{pricePct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</mark>}</div>
              {r.priceFallback?<span>Preço anterior confiável · aguardando rechecagem atual</span>:previousPrice!=null&&<span>Preço na coleta anterior: {money(previousPrice)}</span>}
              <div className={styles.radarExactMeta}><span><small>Indicado</small><b data-bool={r.preferred===true?'yes':r.preferred===false?'no':'unknown'}>{yesNo(r.preferred)}</b></span><span><small>Localização</small><b>{r.location||'Não coletado'}</b></span></div>
              <button type="button" className={styles.radarExactHistoryChip} onClick={()=>setOpenHistory(openHistory===r.key?'':r.key)}><VectorIcon name="history" size={12}/> Histórico</button>
              <p>Última coleta: {when(r.collected)}</p><p>Rechecagem: {due.label}</p>
            </section>

            <section className={styles.radarExactSales}>
              <small>Venda acumulada</small><div className={styles.radarExactSalesTop}><b>{r.sold==null?'—':Number(r.sold).toLocaleString('pt-BR')}</b></div>
              {r.sold30d!=null&&<div className={styles.radarExactSales30}><small>Últimos 30 dias</small><b>{Number(r.sold30d).toLocaleString('pt-BR')}</b></div>}
              {velocity!=null&&<mark data-tone={velocity>=0?'down':'up'}>{velocity>=0?'↑':'↓'} {velocity>0?'+':''}{velocity.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</mark>}
              {soldDelta!=null&&<span>{soldDelta>=0?'+':''}{soldDelta.toLocaleString('pt-BR')} desde a última coleta</span>}
              <button type="button" onClick={()=>setOpenHistory(openHistory===r.key?'':r.key)}><VectorIcon name="history" size={13}/> Histórico <span>{openHistory===r.key?'⌃':'⌄'}</span></button>
            </section>

            <section className={styles.radarExactVisibility}>
              <h4><VectorIcon name="search" size={13}/> Visibilidade na busca</h4>
              <div><span>Rank</span><b>{searchPositionLabel(r.visibility?.competitor_position,r.visibility?.competitor_page,r.visibility?.competitor_found,r.visibility?.max_pages||3,r.visibility?.items_per_page||60)}</b></div>
              <div><span>Ads</span><b data-ads={r.visibility?.competitor_ads_status&&r.visibility.competitor_ads_status!=='unknown'?r.visibility.competitor_ads_status:(r.adsFallback===true?'detected':r.adsFallback===false?'not_detected':'unknown')}>{r.visibility?.competitor_ads_status==='detected'?'Ads ativo nesta busca':r.visibility?.competitor_ads_status==='not_detected'?'Não':r.adsFallback===true?'Ads ativo nesta busca':r.adsFallback===false?'Não':'Não confirmado'}</b></div>
              <div><span>Meu anúncio</span><b>{searchPositionLabel(r.visibility?.owner_position,r.visibility?.owner_page,r.visibility?.owner_found,r.visibility?.max_pages||3,r.visibility?.items_per_page||60)}</b></div>
              <button type="button" onClick={()=>setOpenSearchDetails(openSearchDetails===r.key?'':r.key)}>Ver análise da busca →</button>
            </section>

            <section className={styles.radarExactActions}>
              <button type="button" className={styles.radarExactCheck} disabled={checkingCompetitor===r.key} onClick={()=>checkCompetitor(r)}><VectorIcon name="search" size={14}/>{checkingCompetitor===r.key?'Checando…':'Checar dados'}</button>
              <Link href={priceHref}><VectorIcon name="edit" size={14}/>Editar preço do meu anúncio</Link>
              <Link href={ownerHref}><VectorIcon name="external" size={14}/>Ir para meu anúncio</Link>
              {r.link?<a href={r.link} target="_blank" rel="noreferrer"><VectorIcon name="external" size={14}/>Abrir anúncio</a>:<button type="button" disabled><VectorIcon name="external" size={14}/>Abrir anúncio</button>}
              <button type="button" className={styles.radarExactDelete} onClick={()=>removeWatch(r)}><VectorIcon name="trash" size={14}/>Excluir concorrente</button>
            </section>

            {(openHistory===r.key||openSearchDetails===r.key)&&<section className={styles.radarExactDetails}>
              {openHistory===r.key&&<div className={styles.radarExactDetailGrid}>
                <label>Rechecar a cada<select value={r.watch?.frequency_days||7} onChange={e=>updateWatch(r.watch,{frequency_days:Number(e.target.value),reset_next:true})}><option value="2">2 dias</option><option value="3">3 dias</option><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></label>
                <div><small>Preço anterior</small><b>{money(previousPrice)}</b></div>
                <div><small>Vendas desde a última coleta</small><b>{soldDelta==null?'—':(soldDelta>=0?'+':'')+soldDelta.toLocaleString('pt-BR')}</b></div>
                <div><small>Última coleta</small><b>{when(r.collected)}</b></div>
              </div>}
              {openSearchDetails===r.key&&<div className={styles.radarExactSearchDetails}>
                <div><small>Palavra-chave</small><b>{r.watch?.settings?.search_keyword||r.owner}</b></div>
                <div><small>Diferença</small><b>{n(r.visibility?.competitor_position)!=null&&n(r.visibility?.owner_position)!=null?(n(r.visibility.owner_position)-n(r.visibility.competitor_position)>0?'+':'')+(n(r.visibility.owner_position)-n(r.visibility.competitor_position)).toLocaleString('pt-BR')+' posições':'—'}</b></div>
                <div><small>Última leitura</small><b>{r.visibility?.searched_at?when(r.visibility.searched_at):'Ainda não coletado'}</b></div>
                <button type="button" disabled={visibilityPhase[String(r.ownerItemId)]==='loading'} onClick={()=>collectVisibilityGroup(rows.filter(x=>String(x.ownerItemId)===String(r.ownerItemId))).then(loadMonitor)}>↻ {visibilityPhase[String(r.ownerItemId)]==='loading'?'Pesquisando…':'Atualizar posições'}</button>
              </div>}
            </section>}
          </article>
        })}</div>
      </section>

      <aside className={styles.radarExactAside}>
        <section className={styles.radarExactSideCard}><header><b>🔔 Alertas do radar competitivo</b><span>{alerts.length}</span></header><div className={styles.radarExactAlerts}>{alerts.length?alerts.slice(0,5).map(a=><article key={a.key}>{a.image?<img src={a.image} alt=""/>:<i>!</i>}<b>{a.text}</b><small>{a.at?relativeTime(a.at):'agora'}</small></article>):<p>Nenhuma mudança importante detectada.</p>}</div></section>
        <section className={styles.radarExactSideCard}><header><b>ⓘ Distribuição dos concorrentes</b></header><div className={styles.radarExactDistribution}><div className={styles.radarExactDonut} style={{background:donut}}><span><b>{rows.length}</b><small>total</small></span></div><div>{[['down','com queda de preço',distribution.down],['up','com alta de preço',distribution.up],['sales','com vendas acelerando',distribution.accelerating],['due','rechecagem vencida',distribution.due],['stable','estáveis',distribution.stable]].map(([tone,label,value])=><p key={tone}><i data-tone={tone}/><span>{value} {label} ({rows.length?(value/rows.length*100).toFixed(1).replace('.',','):'0'}%)</span></p>)}</div></div></section>
        <section className={styles.radarExactSideCard}><header><b>💡 Dicas e insights</b></header><div className={styles.radarExactInsight}><i>1</i><p>{counts.down>0?<><b>{counts.down} concorrente{counts.down===1?' reduziu':'s reduziram'} o preço.</b><span>Atenção a impactos na sua posição de busca.</span></>:<><b>Nenhum sinal urgente agora.</b><span>Continue acompanhando as próximas coletas.</span></>}</p></div></section>
      </aside>
    </div>
  </div>;
}
function Ads(){
  const [data,setData]=useState(null),[phase,setPhase]=useState('loading'),[error,setError]=useState(''),[syncSource,setSyncSource]=useState('');

  async function load(){
    setPhase('loading');setError('');setSyncSource('Consultando dados reais do Shopee Ads…');
    const motorPromise=motorRequest('syncShopeeAds',{days:30,reason:'open-shopee-ads'},12000)
      .then(result=>result?.data?.v7||result?.data?.v5||null)
      .catch(err=>{console.warn('[Shopee Ads] Motor Senior não respondeu',err);return null});
    try{
      const server=await fetchJsonWithTimeout('/api/shopee/ads?days=30',{cache:'no-store'},18000);
      const primary=server?.v7||server?.v5||null;
      if(primary){
        setData(primary);
        const campaigns=arr(primary.campaigns);
        const campaignCapability=primary?.availability?.campaigns;
        if(campaignCapability==='error'&&!campaigns.length){
          setPhase('error');setError(primary?.availability?.messages?.campaigns||'A fonte de campanhas do Shopee Ads não respondeu.');
        }else{
          setPhase(campaigns.length?'success':'empty');
          setSyncSource(primary?.scope==='product_ads'?'Dados reais de campanhas e desempenho da Shopee.':'Dados reais disponíveis; algumas métricas de campanha podem não estar integradas.');
        }
      }else{
        const motor=await motorPromise;
        if(!motor)throw new Error('Nenhuma fonte de Shopee Ads retornou dados.');
        setData(motor);setPhase(arr(motor.campaigns).length?'success':'empty');setSyncSource('Dados atualizados pelo Motor Senior.');
      }
      motorPromise.then(motor=>{
        if(!motor)return;
        const currentCount=arr(primary?.campaigns).length;
        if(arr(motor.campaigns).length>=currentCount){setData(motor);setPhase(arr(motor.campaigns).length?'success':'empty');setSyncSource('Dados atualizados pelo Motor Senior.')}
      });
    }catch(e){
      console.error('[Shopee Ads] carregamento falhou',e);
      const motor=await motorPromise;
      if(motor){setData(motor);setPhase(arr(motor.campaigns).length?'success':'empty');setSyncSource('API do Gestor indisponível; usando retorno real do Motor Senior.');return}
      const kind=classifyAsyncError(e);setPhase(kind);setError(kind==='timeout'?'A consulta do Shopee Ads excedeu o tempo limite.':String(e?.message||e));
    }
  }

  useEffect(()=>{load()},[]);
  const campaigns=arr(data?.campaigns),active=campaigns.filter(c=>String(c.state||'').toLowerCase()==='ongoing'),summary=data?.summary||{};
  if(phase==='loading')return <Empty text="Consultando o Shopee Ads. Esta etapa tem tempo limite e não ficará carregando indefinidamente."/>;
  if(phase==='error'||phase==='timeout')return <div className={styles.error}>{error||'Não foi possível carregar o Shopee Ads.'}<button onClick={load}>Tentar novamente</button></div>;
  if(phase==='empty')return <section className={styles.panel}><div className={styles.panelHead}><div><h2>Shopee Ads</h2><p>{syncSource}</p></div><button onClick={load}>↻ Atualizar</button></div><Empty text="A fonte respondeu corretamente, mas não retornou campanhas para esta loja/período."/></section>;
  return <><div className={styles.kpis}><Kpi label="Campanhas ativas" value={active.length}/><Kpi label="Investimento 30 dias" value={n(summary.spend)==null?'Sem dados':money(summary.spend)}/><Kpi label="GMV via Ads" value={n(summary.gmv)==null?'Sem dados':money(summary.gmv)}/><Kpi label="ROAS" value={n(summary.roas)==null?'Sem dados':num(summary.roas)}/></div><section className={styles.panel}><div className={styles.panelHead}><div><h2>Campanhas</h2><p>{syncSource}</p></div><button onClick={load}>↻ Atualizar</button></div><div className={styles.tableWrap}><table><thead><tr><th>Campanha</th><th>Status</th><th>ROAS</th><th>Meta</th><th>Gasto</th><th>GMV</th><th>Pedidos</th></tr></thead><tbody>{campaigns.map(c=><tr key={c.campaignId}><td><b>{c.productName||c.title||`Campanha ${c.campaignId}`}</b><small>#{c.campaignId}</small></td><td><span className={String(c.state)==='ongoing'?styles.live:styles.mutedBadge}>{String(c.state)==='ongoing'?'Ativo':c.state||'Sem dados'}</span></td><td>{n(c.roas)==null?'Sem dados':num(c.roas)}</td><td>{n(c.targetRoas)==null?'Sem dados':num(c.targetRoas)}</td><td>{n(c.spend)==null?'Sem dados':money(c.spend)}</td><td>{n(c.gmv)==null?'Sem dados':money(c.gmv)}</td><td>{n(c.orders)==null?'Sem dados':n(c.orders).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div></section></>;
}

function Reanalises({items}){
  const rows=items.map(item=>{const s=item.schedule||{};const next=s.next_run_at||item.latest?.next_reanalysis_at;const ts=next?new Date(next).getTime():null;return{...item,next,due:Number.isFinite(ts)&&ts<=Date.now(),title:item.latest?.product_snapshot?.title||item.latest?.product_snapshot?.item_name||s.title||`Produto ${item.itemId}`}}).sort((a,b)=>(b.due?1:0)-(a.due?1:0)||new Date(a.next||8640000000000000)-new Date(b.next||8640000000000000));
  if(!rows.length)return <Empty text="Nenhum anúncio possui histórico de análise ainda."/>;
  return <section className={styles.panel}><div className={styles.tableWrap}><table><thead><tr><th>Anúncio</th><th>Última análise</th><th>Próxima reanálise</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={r.itemId}><td><b>{r.title}</b><small>Produto {r.itemId}</small></td><td>{when(r.latest?.analyzed_at)}</td><td>{when(r.next)}</td><td><span className={r.due?styles.due:styles.live}>{r.due?'Vencida':'Agendada'}</span></td><td><div className={styles.rowActions}><Link className={styles.linkButton} href={`/super-analise?item_id=${r.itemId}`}>{r.due?'Reanalisar agora':'Abrir análise'}</Link><ReminderButton itemId={r.itemId} taskType="reanalysis" priority={r.due?'urgent':'medium'} title="Refazer Super Análise" description={`Refazer a Super Análise de ${r.title}.`} actionUrl={`/super-analise?item_id=${r.itemId}`} label="🔔"/></div></td></tr>)}</tbody></table></div></section>
}

function Prioridades({items}){
  const [tasks,setTasks]=useState([]),[taskPhase,setTaskPhase]=useState('loading');
  async function loadTasks(){
    setTaskPhase('loading');
    try{const r=await fetchJsonWithTimeout('/api/tasks',{cache:'no-store'},12000);setTasks(arr(r?.tasks));setTaskPhase('success')}catch{setTaskPhase('error')}
  }
  useEffect(()=>{loadTasks()},[]);
  async function taskAction(id,action,hours){
    try{await fetchJsonWithTimeout('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,hours})},12000);await loadTasks()}catch{}
  }
  const rows=items.map(item=>{const r=item.latest||{},ai=r.report?.ai_analysis||{},priorities=arr(ai.priorities);return{itemId:item.itemId,title:r.product_snapshot?.title||r.product_snapshot?.item_name||`Produto ${item.itemId}`,score:n(r.score),priority:priorities[0],analyzed:r.analyzed_at}}).sort((a,b)=>(a.score??999)-(b.score??999));
  const urgent=tasks.filter(t=>t.priority==='urgent').length;
  const competitorTasks=tasks.filter(t=>t.task_type==='competitors').length;
  const adsTasks=tasks.filter(t=>t.task_type==='ads').length;
  const dueToday=tasks.filter(t=>{if(!t.due_at)return false;const d=new Date(t.due_at);if(Number.isNaN(d.getTime()))return false;const end=new Date();end.setHours(23,59,59,999);return d.getTime()<=end.getTime()}).length;
  return <div className={styles.priorityStack}>
    <div className={styles.kpis}><Kpi label="Urgentes" value={urgent}/><Kpi label="Concorrentes" value={competitorTasks}/><Kpi label="Shopee Ads" value={adsTasks}/><Kpi label="Até hoje" value={dueToday}/></div>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><h2>Tarefas e lembretes</h2><p>O que você pediu para lembrar e o que o Gestor marcou como vencido.</p></div><span>{tasks.length} aberta{tasks.length===1?'':'s'}</span></div>
      {taskPhase==='loading'?<Empty text="Carregando tarefas…"/>:taskPhase==='error'?<Empty text="Não foi possível carregar as tarefas agora." action="Tentar novamente" onAction={loadTasks}/>:tasks.length?<div className={styles.taskList}>{tasks.map(t=><article key={t.id} data-priority={t.priority}><div><b>{t.title}</b><small>{t.due_at?'Prazo: '+when(t.due_at):'Sem prazo definido'} · {t.task_type||'tarefa'}</small><p>{t.description||'Tarefa pendente.'}</p></div><div className={styles.taskActions}>{t.action_url&&<Link href={t.action_url}>Resolver agora</Link>}<button onClick={()=>taskAction(t.id,'snooze',24)}>Amanhã</button><button onClick={()=>taskAction(t.id,'done')}>Concluir</button></div></article>)}</div>:<Empty text="Nenhuma tarefa aberta agora."/>}
    </section>
    <section>
      <div className={styles.sectionCaption}><h2>Prioridades da Super Análise</h2><p>Oportunidades detectadas nas análises dos anúncios.</p></div>
      {rows.length?<div className={styles.priorityList}>{rows.map(r=><article key={r.itemId}><div className={styles.score}>{r.score==null?'—':Math.round(r.score)}</div><div><b>{r.title}</b><small>Última análise: {when(r.analyzed)}</small><p>{r.priority?.why||r.priority?.reason||r.priority?.area||'Revisar os pontos com menor nota na Super Análise.'}</p></div><Link href={`/extensao-shopee-intelligence?section=super-anuncio&item_id=${r.itemId}&tab=analysis`}>Ver anúncio</Link></article>)}</div>:<Empty text="Ainda não há análises suficientes para montar prioridades."/>}
    </section>
  </div>
}

function Reports({items}){
  const latest=items.map(x=>x.latest).filter(Boolean),scores=latest.map(r=>n(r.score)).filter(v=>v!=null),roases=latest.map(r=>n(metric(r,'roas'))).filter(v=>v!=null),withComp=latest.filter(r=>arr(r.competitors).length>0).length,totalRounds=items.reduce((s,x)=>s+arr(x.history).length,0);
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  return <><div className={styles.kpis}><Kpi label="Anúncios analisados" value={items.length}/><Kpi label="Rodadas registradas" value={totalRounds}/><Kpi label="Nota média atual" value={avg(scores)==null?'—':avg(scores).toFixed(1)+'/100'}/><Kpi label="ROAS médio registrado" value={num(avg(roases))}/></div><section className={styles.panel}><div className={styles.reportSummary}><article><b>{withComp}</b><span>anúncios com concorrentes vinculados</span></article><article><b>{items.filter(x=>x.schedule?.enabled).length}</b><span>reanálises automáticas/agendadas</span></article><article><b>{latest.filter(r=>r.report?.ai_analysis).length}</b><span>análises com IA concluída</span></article></div></section></>
}

function Kpi({label,value}){return <article className={styles.kpi}><small>{label}</small><b>{value}</b></article>}

export default function IntelligenceSections({items=[],section='shopee-ads'}){
  if(section==='concorrentes')return <div className={styles.screen}><main className={styles.main}><Competitors items={items}/></main></div>;
  const [title,subtitle,icon]=titles[section]||titles['shopee-ads'];
  return <div className={styles.screen}><main className={styles.main}><header className={styles.header}><div><span>{icon}</span><div><h1>{title}</h1><p>{subtitle}</p></div></div></header><div className={styles.body}>{section==='shopee-ads'&&<Ads/>} {section==='reanalises'&&<Reanalises items={items}/>} {section==='prioridades'&&<Prioridades items={items}/>} {section==='relatorios'&&<Reports items={items}/>}</div></main></div>
}
