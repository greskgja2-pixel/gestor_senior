'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>n(v)==null?'—':`${n(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const arr=v=>Array.isArray(v)?v:[];
const missingStatus=obj=>{const s=String(obj?.collectionStatus||obj?.collection_status||'').toLowerCase();if(obj?.collectionError||obj?.collection_error||obj?.error||s==='error')return'Erro de coleta';if(s==='not_integrated'||s==='unsupported')return'Não integrado';if(obj&&Object.keys(obj).length)return'Sem dados';return'Não coletado'};
const countValue=(explicit,rows,obj)=>n(explicit)!=null?Number(explicit).toLocaleString('pt-BR'):(Array.isArray(rows)&&rows.length?rows.length.toLocaleString('pt-BR'):missingStatus(obj));
const boolValue=(value,obj)=>value===true?'Sim':value===false?'Não':missingStatus(obj);
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;
const productImage=p=>p?.imageUrl||p?.image_url||p?.imageUrls?.[0]||p?.image?.image_url_list?.[0]||null;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

const TABS=[
  ['title','Título','T'],['description','Descrição','▤'],['images','Imagens','▧'],['video','Vídeo','▶'],
  ['category','Categoria Shopee','◇'],['price','Preço & Concorrência','$'],['variations','Atributos & Variações','⌘']
];
const SCORE_TERMS={title:['título','titulo'],description:['descrição','descricao'],images:['imagem'],video:['vídeo','video'],category:['categoria'],price:['preço','preco','concorr'],variations:['atributo','varia']};
const TAB_LABEL={title:'Título',description:'Descrição',images:'Imagens',video:'Vídeo',category:'Categoria',price:'Preço',variations:'Atributos & Variações'};

function Help({text}){return <span className={styles.help} title={text}>?</span>}
function Gauge({score,label}){const v=n(score);const p=Math.max(0,Math.min(100,v??0));return <div className={styles.gaugeWrap}><div className={styles.gauge} style={{'--g':`${p*1.8}deg`}}><b>{v==null?'—':Math.round(v)}</b><small>/100</small></div><span>{label}</span></div>}
function dimScore(report,terms){const d=arr(report?.report?.dimensions).find(x=>terms.some(t=>String(x?.name||'').toLowerCase().includes(t)));if(!d)return null;const s=n(d.score),max=n(d.maxScore)||100;return s==null?null:Math.round(Math.max(0,Math.min(100,s/max*100)))}
function scoreMap(report){return Object.fromEntries(Object.entries(SCORE_TERMS).map(([k,t])=>[k,dimScore(report,t)]))}
function currentMargin(price,cost,deductions=0){const p=n(price),c=n(cost),d=n(deductions)??0;if(p==null||p<=0||c==null)return null;return ((p-c-d)/p)*100}
function Metric({label,value,title}){return <div className={styles.metric} title={title||''}><small>{label}</small><b>{value}</b></div>}
function competitorUrl(c){return c?.url||c?.productUrl||c?.product_url||(c?.shopId&&c?.itemId?`https://shopee.com.br/product/${c.shopId}/${c.itemId}`:c?.shop_id&&c?.item_id?`https://shopee.com.br/product/${c.shop_id}/${c.item_id}`:null)}
function competitorCategory(c){return c?.categoryPath||c?.category_path||c?.category||c?.categoryName||c?.category_name||null}
function competitorCategoryId(c){return c?.categoryId??c?.category_id??null}
function imageCandidates(obj){return [obj?.imageUrl,obj?.image_url,...arr(obj?.imageUrls),...arr(obj?.images),...arr(obj?.image?.image_url_list)].filter(Boolean)}

function SmartImage({urls,alt='',onZoom,className=''}) {
  const list=useMemo(()=>arr(urls).filter(Boolean),[urls]);
  const [index,setIndex]=useState(0);
  useEffect(()=>setIndex(0),[list.join('|')]);
  const src=list[index];
  if(!src)return <div className={`${styles.imageFallback} ${className}`}>Imagem não coletada</div>;
  return <div className={`${styles.zoomWrap} ${className}`}>
    <img src={src} alt={alt} onError={()=>setIndex(i=>i+1)} onLoad={e=>{if((e.currentTarget.naturalWidth<120||e.currentTarget.naturalHeight<120)&&index<list.length-1)setIndex(i=>i+1)}}/>
    <button type="button" className={styles.zoomBtn} onClick={()=>onZoom?.(src)}>⌕ Zoom</button>
  </div>
}

function ActionsPanel({canUndo,canRedo,dirtyCount,onUndo,onRedo,onRestore,onSave,saving,saveDisabled=false,message}) {
  return <aside className={styles.actionPanel}>
    <h3>Ações desta aba</h3>
    <button type="button" onClick={onUndo} disabled={!canUndo}>↶ Desfazer</button>
    <button type="button" onClick={onRedo} disabled={!canRedo}>↷ Refazer</button>
    <button type="button" onClick={onRestore}>⟳ Restaurar original</button>
    <button type="button" className={styles.saveShopee} onClick={onSave} disabled={saveDisabled||dirtyCount===0||saving}>{saving?'Salvando…':'⇧ Salvar na Shopee'}</button>
    <small className={dirtyCount?styles.pending:styles.noPending}>● {dirtyCount} alteração{dirtyCount===1?'':'ões'} pendente{dirtyCount===1?'':'s'}</small>
    <p>O botão salvar só fica disponível quando houver alteração real nesta aba.</p>
    {message&&<div className={styles.message}>{message}</div>}
  </aside>
}

function ZoomModal({src,onClose}) {
  if(!src)return null;
  return <div className={styles.zoomModal} role="dialog" aria-modal="true" onClick={onClose}>
    <button type="button" onClick={onClose}>×</button>
    <img src={src} alt="Visualização ampliada" onClick={e=>e.stopPropagation()}/>
  </div>
}

export default function SuperAnaliseInteligente({report,products=[],initialTab='title'}){
  const allowedTabs=useMemo(()=>new Set(TABS.map(([key])=>key)),[]);
  const [tab,setTab]=useState(allowedTabs.has(initialTab)?initialTab:'title');
  const [analysis,setAnalysis]=useState(report?.report?.ai_analysis||null);
  const [message,setMessage]=useState('');
  const [draft,setDraft]=useState({});
  const [chosenCategory,setChosenCategory]=useState('');
  const [gallery,setGallery]=useState([]);
  const [baseline,setBaseline]=useState(null);
  const [history,setHistory]=useState({past:[],future:[]});
  const [saving,setSaving]=useState(false);
  const [zoomSrc,setZoomSrc]=useState('');
  const [slots,setSlots]=useState([]);
  const [slotError,setSlotError]=useState('');
  const [flash,setFlash]=useState({timeslotId:'',promoPrice:'',stock:'',purchaseLimit:'0'});
  const [flashBusy,setFlashBusy]=useState(false);
  const [flashMessage,setFlashMessage]=useState('');
  const uploadRef=useRef(null);

  const p=report?.product_snapshot||{};
  const f=report?.finance_snapshot||{};
  const before=useMemo(()=>scoreMap(report),[report]);
  const after=analysis?.afterScores||{};
  const images=arr(p.imageUrls||p.image?.image_url_list);
  const competitors=arr(report?.competitors).slice(0,3);
  const basePrice=n(metric(report,'price')??p.price??p.currentPrice);
  const baseCost=n(f.productCost??p.referenceCost);
  const baseProfit=n(f.profit);
  const inferredDeductions=basePrice!=null&&baseCost!=null&&baseProfit!=null?Math.max(0,basePrice-baseCost-baseProfit):0;
  const marginNow=n(f.marginPct)??currentMargin(basePrice,baseCost,inferredDeductions);
  const marginProof=basePrice!=null&&baseCost!=null?`Preço ${money(basePrice)} − custo ${money(baseCost)}${inferredDeductions>0?` − taxas/Ads/outros registrados ${money(inferredDeductions)}`:''} = margem ${pct(marginNow)}`:'Margem indisponível: preço ou custo não capturado.';

  useEffect(()=>{if(allowedTabs.has(initialTab))setTab(initialTab)},[initialTab,allowedTabs]);

  useEffect(()=>{
    const a=report?.report?.ai_analysis||null;
    const nextDraft={
      title:p.title||p.item_name||'',description:p.description||'',
      suggestionTitle:a?.title?.suggestion||'',suggestionDescription:a?.description?.suggestion||'',
      price:basePrice??'',cost:baseCost??'',imagePlan:a?.images?.suggestion||'',
      videoPlan:a?.video?.suggestion||'',pricePlan:a?.price?.suggestion||'',variationsPlan:a?.variations?.suggestion||''
    };
    const nextGallery=images.map((url,index)=>({source:'existing',index,url}));
    const categoryId=String(p.categoryId??p.category_id??'');
    setAnalysis(a);setDraft(nextDraft);setGallery(nextGallery);setChosenCategory(categoryId);
    setBaseline({draft:nextDraft,gallery:nextGallery,chosenCategory:categoryId});
    setHistory({past:[],future:[]});setMessage('');
    setFlash(x=>({...x,promoPrice:basePrice?String(basePrice):'',stock:String(p.stock??'')}));
  },[report?.id]);

  useEffect(()=>{
    if(tab!=='price'||slots.length)return;
    fetchJsonWithTimeout('/api/shopee/flash-sale',{cache:'no-store'},20000).then(j=>{
      const next=arr(j?.slots);setSlots(next);setSlotError('');
      if(next[0]?.timeslot_id)setFlash(x=>({...x,timeslotId:String(next[0].timeslot_id)}));
    }).catch(e=>setSlotError(String(e?.message||e)));
  },[tab,slots.length]);

  function stateNow(){return{draft:{...draft},gallery:gallery.map(x=>({...x})),chosenCategory:String(chosenCategory||'')}}
  function pushHistory(){const current=stateNow();setHistory(h=>({past:[...h.past,current].slice(-80),future:[]}))}
  function mutate(fn){pushHistory();fn()}
  function setField(k,v){if(draft[k]===v)return;mutate(()=>setDraft(d=>({...d,[k]:v})))}
  function undo(){setHistory(h=>{if(!h.past.length)return h;const prev=h.past[h.past.length-1],current=stateNow();setDraft(prev.draft);setGallery(prev.gallery);setChosenCategory(prev.chosenCategory);return{past:h.past.slice(0,-1),future:[current,...h.future].slice(0,80)}})}
  function redo(){setHistory(h=>{if(!h.future.length)return h;const next=h.future[0],current=stateNow();setDraft(next.draft);setGallery(next.gallery);setChosenCategory(next.chosenCategory);return{past:[...h.past,current].slice(-80),future:h.future.slice(1)}})}
  function restoreOriginal(){if(!baseline)return;pushHistory();setDraft({...baseline.draft});setGallery(baseline.gallery.map(x=>({...x})));setChosenCategory(baseline.chosenCategory);setMessage('Valores restaurados para o último estado salvo.')}
  function openExtension(){window.postMessage({source:'GS_GESTOR',type:'GS_OPEN_SIDE_PANEL'},location.origin)}

  const realChanges=useMemo(()=>{
    if(!baseline)return{};
    const changes={};
    if(draft.title!==baseline.draft.title)changes.title=draft.title;
    if(draft.description!==baseline.draft.description)changes.description=draft.description;
    if(n(draft.price)!==n(baseline.draft.price))changes.price=n(draft.price);
    if(String(chosenCategory||'')!==String(baseline.chosenCategory||'')&&chosenCategory)changes.categoryId=Number(chosenCategory);
    const baseGallery=baseline.gallery.map(x=>x.source==='existing'?['e',x.index]:['u',x.image_id]);
    const nowGallery=gallery.map(x=>x.source==='existing'?['e',x.index]:['u',x.image_id]);
    if(!same(baseGallery,nowGallery))changes.images=gallery.map(x=>x.source==='existing'?{source:'existing',index:x.index}:{source:'uploaded',image_id:x.image_id});
    return changes;
  },[draft,chosenCategory,gallery,baseline]);

  const dirtyForTab=useMemo(()=>{
    const keys=Object.keys(realChanges);
    if(tab==='title')return keys.filter(k=>k==='title').length;
    if(tab==='description')return keys.filter(k=>k==='description').length;
    if(tab==='images')return keys.filter(k=>k==='images').length;
    if(tab==='category')return keys.filter(k=>k==='categoryId').length;
    if(tab==='price')return keys.filter(k=>k==='price').length;
    return 0;
  },[realChanges,tab]);

  async function saveTab(){
    const allowed=tab==='title'?['title']:tab==='description'?['description']:tab==='images'?['images']:tab==='category'?['categoryId']:tab==='price'?['price']:[];
    const changes=Object.fromEntries(Object.entries(realChanges).filter(([k])=>allowed.includes(k)));
    if(!Object.keys(changes).length)return;
    setSaving(true);setMessage('');
    try{
      const result=await fetchJsonWithTimeout('/api/shopee/product-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:report.item_id,changes})},30000);
      const next={draft:{...draft},gallery:gallery.map(x=>({...x})),chosenCategory:String(chosenCategory||'')};
      setBaseline(next);setHistory({past:[],future:[]});
      setMessage(`Alteração salva na Shopee com sucesso${result?.applied?.length?` (${result.applied.join(', ')})`:''}.`);
    }catch(e){setMessage(String(e?.message||e))}finally{setSaving(false)}
  }

  const activeBefore=before[tab]??report?.score;
  const activeAfter=n(after?.[tab]);
  const suggestionImproves=activeBefore==null||activeAfter==null||activeAfter>=activeBefore;
  const guardedAfter=suggestionImproves?activeAfter:activeBefore;

  function applySuggestion(field,value){
    if(!suggestionImproves){setMessage('A sugestão foi descartada porque a nota estimada ficaria menor que a atual. O conteúdo existente foi preservado.');return}
    setField(field,value);
  }

  async function uploadImage(file){
    const fd=new FormData();fd.append('image',file);
    const r=await fetch('/api/shopee/image-upload',{method:'POST',body:fd});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j?.image_id)throw new Error(j?.error||`HTTP ${r.status}`);
    return{source:'uploaded',image_id:j.image_id,url:j.image_url||URL.createObjectURL(file),name:file.name};
  }
  async function onUploadFiles(files){
    const list=[...files].slice(0,Math.max(0,9-gallery.length));if(!list.length)return;
    setSaving(true);setMessage('Enviando imagem para a Shopee…');
    try{
      const uploaded=[];for(const file of list)uploaded.push(await uploadImage(file));
      mutate(()=>setGallery(g=>[...g,...uploaded].slice(0,9)));
      setMessage('Imagem enviada. Clique em “Salvar na Shopee” para aplicar a nova galeria ao anúncio.');
    }catch(e){setMessage(String(e?.message||e))}finally{setSaving(false);if(uploadRef.current)uploadRef.current.value=''}
  }
  function removeImage(i){if(gallery.length<=1){setMessage('O anúncio precisa manter pelo menos uma imagem.');return}mutate(()=>setGallery(g=>g.filter((_,idx)=>idx!==i)))}
  function moveImage(i,dir){const j=i+dir;if(j<0||j>=gallery.length)return;mutate(()=>setGallery(g=>{const next=[...g];[next[i],next[j]]=[next[j],next[i]];return next}))}
  async function downloadImage(url,i){try{const r=await fetch(url);const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`imagem-${i+1}.jpg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch{window.open(url,'_blank','noopener,noreferrer')}}

  const compCategoryRows=competitors.map((c,i)=>({c,i,label:competitorCategory(c),id:competitorCategoryId(c)}));
  const categoryCounts=compCategoryRows.reduce((m,x)=>{if(!x.label)return m;const k=String(x.label).trim();m.set(k,(m.get(k)||0)+1);return m},new Map());
  const dominantCategory=[...categoryCounts.entries()].sort((a,b)=>b[1]-a[1])[0]||null;
  const dominantRow=dominantCategory?compCategoryRows.find(x=>String(x.label).trim()===dominantCategory[0]):null;
  const currentCategory=String(p.category||'').trim();
  const categoryAligned=dominantCategory&&currentCategory&&dominantCategory[0].toLowerCase()===currentCategory.toLowerCase();

  const liveMargin=currentMargin(draft.price,draft.cost,inferredDeductions);
  const selectedSlot=slots.find(x=>String(x.timeslot_id)===String(flash.timeslotId));

  async function createFlash(){
    if(!flash.timeslotId)return setFlashMessage('Selecione um horário oficial disponibilizado pela Shopee.');
    setFlashBusy(true);setFlashMessage('');
    try{
      const j=await fetchJsonWithTimeout('/api/shopee/flash-sale',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:report.item_id,timeslot_id:Number(flash.timeslotId),promo_price:Number(flash.promoPrice),stock:Number(flash.stock),purchase_limit:Number(flash.purchaseLimit||0)})},30000);
      setFlashMessage(`Oferta Relâmpago criada na Shopee. ID ${j.flash_sale_id}.`);
    }catch(e){setFlashMessage(String(e?.message||e))}finally{setFlashBusy(false)}
  }

  if(!report)return <div className={styles.screen}><main className={styles.empty}><h1>✦ Super Análise Inteligente</h1><p>Nenhuma análise encontrada.</p></main></div>;

  return <div className={styles.screen}>
    <ZoomModal src={zoomSrc} onClose={()=>setZoomSrc('')}/>
    <main className={styles.main}>
      <header className={styles.header}><div><h1>✦ Super Análise Inteligente</h1><p>Compare os dados originais com a sugestão da IA e aplique apenas o que fizer sentido.</p></div><div className={styles.headerActions}><button type="button" data-gs-super-analysis onClick={openExtension}>↗ Abrir Motor Senior</button></div></header>
      <section className={styles.productBar}>
        {productImage(p)?<img src={productImage(p)} alt=""/>:<div className={styles.noImage}/>}
        <div className={styles.productInfo}><b>{p.title||p.item_name||`Produto ${report.item_id}`}</b><small>ID do anúncio: {report.item_id}</small><small>Categoria: {p.category||missingStatus(p)}</small></div>
        <div className={styles.metrics}><Metric label="Preço" value={money(basePrice)}/><Metric label="Custo" value={money(baseCost)}/><Metric label="Margem estimada" value={pct(marginNow)} title={marginProof}/><Metric label="Vendas" value={n(metric(report,'sold')??p.sold)?.toLocaleString('pt-BR')||'—'}/><Metric label="Avaliação" value={n(p.rating)!=null?`${n(p.rating).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} ★`:'—'}/><Metric label="Fotos" value={countValue(p.imageCount,images,p)}/><Metric label="Vídeo" value={boolValue(p.hasVideo,p)}/><Metric label="Variações" value={countValue(p.variationCount,arr(p.models||p.variations),p)}/></div>
      </section>
      <div className={styles.tabs}>{TABS.map(([k,label,icon])=><button key={k} className={tab===k?styles.tabActive:''} onClick={()=>setTab(k)}><span>{icon}</span>{label}</button>)}</div>

      <div className={styles.tabWorkspace}>
        <section className={styles.tabContent}>
          {tab==='title'&&<TextCompare title="Título" original={draft.title||''} suggestion={suggestionImproves?draft.suggestionTitle:''} onOriginal={v=>setField('title',v)} onSuggestion={v=>setField('suggestionTitle',v)} onApply={()=>applySuggestion('title',draft.suggestionTitle)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves}/>}
          {tab==='description'&&<TextCompare title="Descrição" original={draft.description||''} suggestion={suggestionImproves?draft.suggestionDescription:''} onOriginal={v=>setField('description',v)} onSuggestion={v=>setField('suggestionDescription',v)} onApply={()=>applySuggestion('description',draft.suggestionDescription)} before={activeBefore} after={guardedAfter} multiline blocked={!suggestionImproves}/>}
          {tab==='images'&&<ImagesSection gallery={gallery} competitors={competitors} plan={suggestionImproves?draft.imagePlan:''} onPlan={v=>setField('imagePlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves} setZoomSrc={setZoomSrc} downloadImage={downloadImage} removeImage={removeImage} moveImage={moveImage} uploadRef={uploadRef} onUploadFiles={onUploadFiles}/>}
          {tab==='video'&&<PlanSection title="Vídeo" original={p.hasVideo?'O anúncio possui vídeo.':'O anúncio não possui vídeo.'} plan={suggestionImproves?draft.videoPlan:''} onPlan={v=>setField('videoPlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves}/>}
          {tab==='category'&&<CategoryComparison current={currentCategory||'—'} competitors={compCategoryRows} dominant={dominantCategory} aligned={categoryAligned} onApply={()=>{if(dominantRow?.id)mutate(()=>setChosenCategory(String(dominantRow.id)));else setMessage('A categoria predominante foi identificada, mas o ID oficial não foi coletado. Nenhuma alteração será enviada sem um ID real da Shopee.')}} selected={chosenCategory} setZoomSrc={setZoomSrc}/>}
          {tab==='price'&&<PriceSection price={draft.price} cost={draft.cost} setPrice={v=>setField('price',v)} setCost={v=>setField('cost',v)} margin={liveMargin} deductions={inferredDeductions} competitors={competitors} plan={suggestionImproves?draft.pricePlan:''} onPlan={v=>setField('pricePlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves} setZoomSrc={setZoomSrc} slots={slots} slotError={slotError} flash={flash} setFlash={setFlash} selectedSlot={selectedSlot} createFlash={createFlash} flashBusy={flashBusy} flashMessage={flashMessage}/>}
          {tab==='variations'&&<VariationsSection product={p} plan={suggestionImproves?draft.variationsPlan:''} onPlan={v=>setField('variationsPlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves}/>}
          {tab!=='category'&&<><WhyBlock analysis={analysis} tab={tab}/><BottomSummary tab={tab} before={activeBefore} after={guardedAfter} analysis={analysis} blocked={!suggestionImproves}/></>}
        </section>
        <ActionsPanel canUndo={history.past.length>0} canRedo={history.future.length>0} dirtyCount={dirtyForTab} onUndo={undo} onRedo={redo} onRestore={restoreOriginal} onSave={saveTab} saving={saving} saveDisabled={!['title','description','images','category','price'].includes(tab)} message={message}/>
      </div>
    </main>
  </div>
}

function TextCompare({title,original,suggestion,onOriginal,onSuggestion,onApply,before,after,multiline=false,blocked=false}){return <section className={styles.compare}>
  <article className={styles.panel}><div className={styles.panelHead}><h2>{title} atual do anúncio</h2><span>✎ Editável</span></div><textarea rows={multiline?14:6} value={original} onChange={e=>onOriginal(e.target.value)}/><div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div></article>
  <div className={styles.arrow}>→</div>
  <article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão da IA</h2><span>✎ Editável</span></div>{blocked?<div className={styles.preserveBox}>A análise estimou uma nota menor com a alteração. O Gestor recomenda preservar o conteúdo atual e não apresenta uma mudança só para preencher espaço.</div>:<textarea rows={multiline?14:6} value={suggestion} onChange={e=>onSuggestion(e.target.value)} placeholder="A IA não encontrou uma alteração necessária para esta área."/>}<div className={styles.applyLine}><button className={styles.primary} onClick={onApply} disabled={!suggestion||blocked}>✓ Aplicar sugestão</button><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article>
</section>}

function ImagesSection({gallery,competitors,plan,onPlan,before,after,blocked,setZoomSrc,downloadImage,removeImage,moveImage,uploadRef,onUploadFiles}){
  return <>
    <section className={styles.imageTopGrid}>
      <article className={styles.panel}>
        <div className={styles.panelHead}><h2>Imagens atuais do anúncio</h2><span>{gallery.length} imagens</span></div>
        <div className={styles.imageToolbar}>
          <button type="button" onClick={()=>gallery.forEach((x,i)=>downloadImage(x.url,i))}>⇩ Baixar imagens</button>
          <button type="button" onClick={()=>uploadRef.current?.click()}>⇧ Enviar imagem</button>
          <input ref={uploadRef} hidden type="file" accept="image/jpeg,image/png" multiple onChange={e=>onUploadFiles(e.target.files||[])}/>
        </div>
        <div className={styles.imageInfo}>ⓘ Você pode baixar, editar no computador, enviar novamente e só depois salvar na Shopee.</div>
        <div className={styles.galleryEdit}>{gallery.map((x,i)=><figure key={x.source==='uploaded'?x.image_id:`${x.index}-${x.url}`}><SmartImage urls={[x.url]} alt="" onZoom={setZoomSrc}/><figcaption>Imagem {i+1}</figcaption><div className={styles.imageActions}><button onClick={()=>moveImage(i,-1)} disabled={i===0}>←</button><button onClick={()=>moveImage(i,1)} disabled={i===gallery.length-1}>→</button><button onClick={()=>removeImage(i)}>Remover</button></div></figure>)}</div>
        <div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div>
      </article>
      <article className={styles.panel}><div className={styles.panelHead}><h2>✦ Recomendações visuais da IA</h2><span>✎ Editável</span></div>{blocked?<div className={styles.preserveBox}>As imagens atuais obtiveram nota igual ou melhor. Nenhuma alteração visual é sugerida.</div>:<textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma mudança visual necessária."/>}<div className={styles.applyLine}><button className={styles.primary} disabled={!plan||blocked}>✓ Aplicar plano de imagens</button><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article>
    </section>
    <section className={styles.competitorsVisual}><h2>Comparação visual com os concorrentes</h2><div className={styles.competitorGrid}>{competitors.map((c,i)=><article key={i}><SmartImage urls={imageCandidates(c)} alt="" onZoom={setZoomSrc}/><div><small>Concorrente {i+1}</small>{competitorUrl(c)?<a href={competitorUrl(c)} target="_blank" rel="noreferrer">{c.title||`Concorrente ${i+1}`} ↗</a>:<b>{c.title||`Concorrente ${i+1}`}</b>}<span>Preço <strong>{money(c.price)}</strong></span><span>Vendidos <strong>{n(c.sold)?.toLocaleString('pt-BR')||missingStatus(c)}</strong></span></div></article>)}</div></section>
  </>
}

function CategoryComparison({current,competitors,dominant,aligned,onApply,selected,setZoomSrc}){
  return <>
    <section className={styles.categoryCompare}>
      <article className={styles.panel}><div className={styles.panelHead}><h2>Categoria atual do anúncio</h2><span className={aligned?styles.okChip:styles.warnChip}>● {aligned?'Alinhada':'Não alinhada'}</span></div><div className={styles.textBox}>{current}</div><div className={styles.imageInfo}>{dominant?aligned?'Sua categoria é a mesma predominante entre os concorrentes analisados.':'Sua categoria atual é diferente da mais usada pelos concorrentes analisados.':'Os concorrentes não trouxeram categoria suficiente para comparar.'}</div></article>
      <article className={styles.panel}><div className={styles.panelHead}><h2>Categorias dos concorrentes</h2><span>{competitors.length} concorrentes</span></div><div className={styles.categoryCompetitors}>{competitors.map(({c,i,label})=><div key={i}><SmartImage urls={imageCandidates(c)} alt="" onZoom={setZoomSrc}/><div>{competitorUrl(c)?<a href={competitorUrl(c)} target="_blank" rel="noreferrer">{c.title||`Concorrente ${i+1}`} ↗</a>:<b>{c.title||`Concorrente ${i+1}`}</b>}<small>{label||'Categoria não coletada'}</small></div><span><small>Preço</small><b>{money(c.price)}</b></span><span><small>Vendidos</small><b>{n(c.sold)?.toLocaleString('pt-BR')||'—'}</b></span></div>)}</div>{dominant&&<div className={styles.dominantStrip}>{dominant[1]} de {competitors.length} concorrentes usam “{dominant[0]}”.</div>}</article>
    </section>
    <section className={styles.categoryConclusion}><h2>Comparação de categoria</h2>{!dominant?<p>Não há dados suficientes para recomendar mudança de categoria.</p>:aligned?<div className={styles.goodConclusion}><b>✓ Você já usa a categoria predominante.</b><p>A IA não sugere alteração de categoria porque seus dados estão alinhados com a maioria dos concorrentes coletados.</p></div>:<div className={styles.goodConclusion}><b>Comparação indica uma categoria predominante entre concorrentes.</b><p>Sua categoria atual é “{current}”; a mais recorrente nos concorrentes coletados é “{dominant[0]}”. A decisão continua com você.</p><button type="button" className={styles.primary} onClick={onApply}>Aplicar categoria predominante ao rascunho</button></div>}</section>
  </>
}

function PriceSection({price,cost,setPrice,setCost,margin,deductions,competitors,plan,onPlan,before,after,blocked,setZoomSrc,slots,slotError,flash,setFlash,selectedSlot,createFlash,flashBusy,flashMessage}){
  const promoMargin=currentMargin(flash.promoPrice,cost,deductions);
  return <>
    <section className={styles.priceTopGrid}>
      <article className={styles.panel}><div className={styles.panelHead}><h2>Preço e margem atuais</h2><span>✎ Editável</span></div><div className={styles.priceGrid}><label>Preço<input type="number" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Custo<input type="number" step="0.01" value={cost} onChange={e=>setCost(e.target.value)}/></label><div><small>Margem recalculada</small><b>{pct(margin)}</b></div></div><div className={styles.formula}>Conta resumida: preço de venda {money(price)} − 20% Shopee − R$ 4,00 de taxa fixa − custo {money(cost)} = margem estimada. <small>Taxas exibidas são a regra de cálculo configurada no Gestor.</small></div><div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div></article>
      <article className={styles.panel}><div className={styles.panelHead}><h2>✦ Estratégia de preço e concorrência</h2><span>✎ Editável</span></div>{blocked?<div className={styles.preserveBox}>A alteração sugerida reduziria a nota estimada. O preço atual foi preservado.</div>:<textarea rows={9} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma mudança necessária no preço."/>}<div className={styles.applyLine}><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article>
    </section>
    <section className={styles.flashCard}><div className={styles.panelHead}><h2>⚡ Oferta Relâmpago real</h2><span>Horários oficiais da Shopee</span></div><p>Escolha um dos horários disponibilizados pela Shopee. A oferta só será criada quando você clicar no botão abaixo.</p><div className={styles.flashGrid}><label>Horário<select value={flash.timeslotId} onChange={e=>setFlash(x=>({...x,timeslotId:e.target.value}))}><option value="">Selecione</option>{slots.map(s=><option key={s.timeslot_id} value={s.timeslot_id}>{new Date(Number(s.start_time)*1000).toLocaleString('pt-BR')} → {new Date(Number(s.end_time)*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</option>)}</select></label><label>Preço promocional<input type="number" step="0.01" value={flash.promoPrice} onChange={e=>setFlash(x=>({...x,promoPrice:e.target.value}))}/></label><label>Estoque reservado<input type="number" min="1" value={flash.stock} onChange={e=>setFlash(x=>({...x,stock:e.target.value}))}/></label><label>Limite por comprador<input type="number" min="0" value={flash.purchaseLimit} onChange={e=>setFlash(x=>({...x,purchaseLimit:e.target.value}))}/></label><div><small>Margem projetada</small><b>{pct(promoMargin)}</b></div></div>{selectedSlot&&<small className={styles.slotHint}>Início {new Date(Number(selectedSlot.start_time)*1000).toLocaleString('pt-BR')} · término {new Date(Number(selectedSlot.end_time)*1000).toLocaleString('pt-BR')}</small>}{slotError&&<div className={styles.message}>{slotError}</div>}<button type="button" className={styles.primary} onClick={createFlash} disabled={flashBusy||!flash.timeslotId}>{flashBusy?'Criando…':'⚡ Criar Oferta Relâmpago na Shopee'}</button>{flashMessage&&<div className={styles.message}>{flashMessage}</div>}</section>
    <section className={styles.competitorsVisual}><h2>{competitors.length} concorrentes selecionados</h2><div className={styles.competitorGrid}>{competitors.map((c,i)=><article key={i}><SmartImage urls={imageCandidates(c)} alt="" onZoom={setZoomSrc}/><div><small>Concorrente {i+1}</small>{competitorUrl(c)?<a href={competitorUrl(c)} target="_blank" rel="noreferrer">{c.title||`Concorrente ${i+1}`} ↗</a>:<b>{c.title||`Concorrente ${i+1}`}</b>}<span>Preço <strong>{money(c.price)}</strong></span><span>Vendidos <strong>{n(c.sold)?.toLocaleString('pt-BR')||'—'}</strong></span></div></article>)}</div></section>
  </>
}

function PlanSection({title,original,plan,onPlan,before,after,blocked}){return <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>{title} atual</h2></div><div className={styles.textBox}>{original}</div><div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div></article><div className={styles.arrow}>→</div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão da IA</h2><span>✎ Editável</span></div>{blocked?<div className={styles.preserveBox}>A análise estimou uma nota menor. Nenhuma alteração é sugerida.</div>:<textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma alteração necessária."/>}<div className={styles.applyLine}><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article></section>}

function VariationsSection({product,plan,onPlan,before,after,blocked}){const models=arr(product.models||product.variations);const costs=arr(product.variationCosts);const costMap=new Map(costs.map(x=>[String(x.modelId??x.model_id),n(x.cost)]));return <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>Variações atuais</h2><span>{models.length}</span></div>{models.length?<div className={styles.variationTable}><div><b>Variação</b><b>Preço</b><b>Custo</b><b>Margem</b></div>{models.map((m,i)=>{const id=String(m.modelId??m.model_id??m.id??i),price=n(m.price??m.currentPrice),cost=n(m.cost)??costMap.get(id),margin=currentMargin(price,cost,0);return <div key={id}><span>{m.name||m.model_name||`Variação ${i+1}`}</span><span>{money(price)}</span><span>{money(cost)}</span><span>{pct(margin)}</span></div>})}</div>:<div className={styles.textBox}>Este anúncio não possui variações estruturadas capturadas.</div>}<div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div></article><div className={styles.arrow}>→</div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão para atributos & variações</h2></div>{blocked?<div className={styles.preserveBox}>A estrutura atual pontuou melhor. Nenhuma alteração é sugerida.</div>:<textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma alteração necessária."/>}<div className={styles.applyLine}><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article></section>}

function WhyBlock({analysis,tab}){const a=analysis?.[tab]||{};return <section className={styles.why}><h2><span>?</span> Por que a IA sugeriu essa alteração?</h2><div className={styles.whyGrid}><article><b>SEO</b><p>{a.seo||'Palavras-chave, intenção de busca e coerência com o produto.'}</p></article><article><b>AIDA</b><p>{a.aida||'Atenção, interesse, desejo e ação quando fizer sentido.'}</p></article><article><b>Concorrentes</b><p>{a.competitors||'Padrões observados nos concorrentes selecionados.'}</p></article><article><b>Clareza</b><p>{a.clarity||a.reason||'Leitura fácil e melhor compreensão da oferta.'}</p></article><article><b>Conversão</b><p>{a.conversion||'Impacto provável na decisão de compra, sem prometer vendas.'}</p></article></div></section>}

function BottomSummary({tab,before,after,analysis,blocked}){const priorities=arr(analysis?.priorities);const strengths=arr(analysis?.strengths);return <div className={styles.bottomGrid}><section><h3>◉ Velocímetro da categoria: {TAB_LABEL[tab]}</h3><div className={styles.gaugePair}><Gauge score={before} label="Atual"/><span>→</span><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div><p>{blocked?'A sugestão com perda de nota foi descartada.':after!=null&&before!=null?`Impacto estimado: ${after-before>=0?'+':''}${Math.round(after-before)} pontos.`:'Sem estimativa de alteração.'}</p></section><section><h3>✓ Melhorias detectadas</h3>{priorities.length?<ul>{priorities.slice(0,5).map((x,i)=><li key={i}><b>{x.area}</b> · prioridade {x.priority}: {x.why}</li>)}</ul>:<p>Nenhuma prioridade adicional registrada.</p>}</section><section><h3>★ Pontos fortes para preservar</h3>{strengths.length?<ul>{strengths.slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>O Gestor preserva o que já está funcionando bem.</p>}</section></div>}
