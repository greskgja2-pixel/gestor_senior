'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';
import ReminderButton from '../components/ReminderButton';

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
function flashSlotLabel(slot){
  const start=new Date(Number(slot?.start_time)*1000),end=new Date(Number(slot?.end_time)*1000);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return 'Horário oficial';
  const duration=end-start;
  const d=v=>v.toLocaleDateString('pt-BR');
  const hm=v=>v.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  if(Math.abs(duration-86400000)<60000)return `${d(start)} — 24h (${hm(start)} → ${d(end)} ${hm(end)})`;
  return `${d(start)} ${hm(start)} → ${d(end)} ${hm(end)}`;
}
function localYmd(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function addLocalDays(value,days){const d=new Date(String(value)+'T12:00:00');d.setDate(d.getDate()+Number(days||0));return localYmd(d)}
function endOfLocalMonth(value){const d=new Date(String(value)+'T12:00:00');d.setMonth(d.getMonth()+1,0);return localYmd(d)}
function dateRangeLabel(period){if(!period?.start||!period?.end)return'Período não definido';const a=new Date(period.start+'T12:00:00'),b=new Date(period.end+'T12:00:00');return `${a.toLocaleDateString('pt-BR')} → ${b.toLocaleDateString('pt-BR')}`}

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
function shopeeMarginCalc(price,cost){const p=n(price),c=n(cost);if(p==null||p<=0||c==null)return null;const commissionRate=.20,fixedFee=4.5,commission=p*commissionRate,profit=p-c-commission-fixedFee;return{price:p,cost:c,commissionRate,fixedFee,commission,profit,marginPct:(profit/p)*100}}
function currentMargin(price,cost){return shopeeMarginCalc(price,cost)?.marginPct??null}
function Metric({label,value,title}){return <div className={styles.metric} title={title||''}><small>{label}</small><b>{value}</b></div>}
function competitorUrl(c){return c?.url||c?.productUrl||c?.product_url||(c?.shopId&&c?.itemId?`https://shopee.com.br/product/${c.shopId}/${c.itemId}`:c?.shop_id&&c?.item_id?`https://shopee.com.br/product/${c.shop_id}/${c.item_id}`:null)}
function competitorCategory(c){
  const direct=c?.categoryPath||c?.category_path||c?.category||c?.categoryName||c?.category_name;
  if(direct)return String(direct).trim();
  const text=String(c?.description||'');
  const m=text.match(/CategoriaShopee(.+?)(?:Estoque|País de Origem|Envio de|Descrição do produto)/i);
  if(!m?.[1])return null;
  const raw=m[1].trim();
  const known=['Casa e Construção','Artigos de Festa','Cenários e Banners','Papelaria e Festa','Decoração de Festa','Brinquedos e Hobbies','Figuras de Ação'];
  const found=known.filter(x=>raw.includes(x));
  return found.length?found.join(' > '):raw.slice(0,140);
}
function competitorCategoryId(c){return c?.categoryId??c?.category_id??null}
function parsedSearchPrice(c){
  if(n(c?.price)!=null)return n(c.price);
  const s=String(c?.searchText||'');
  const m=s.match(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/i);
  return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
}
function parsedSearchSold(c){
  if(n(c?.sold)!=null)return n(c.sold);
  const s=String(c?.searchText||'');
  const m=s.match(/([0-9]+(?:[.,][0-9]+)?)\s*(mil)?\+?\s*Vendido/i);
  if(!m)return null;
  const base=Number(m[1].replace(',','.'));
  return Number.isFinite(base)?Math.round(base*(m[2]?1000:1)):null;
}
function imageCandidates(obj){
  const fields=[
    obj?.imageUrl,obj?.image_url,obj?.thumbnail,obj?.thumbnailUrl,obj?.thumbnail_url,obj?.cover,obj?.coverUrl,obj?.cover_url,
    ...arr(obj?.imageUrls),...arr(obj?.image_urls),...arr(obj?.images),...arr(obj?.image?.image_url_list),...arr(obj?.media?.images)
  ];
  const normalized=fields.map(value=>{
    const raw=typeof value==='string'?value:(value?.url||value?.image_url||value?.imageUrl||value?.src||value?.image_id||value?.imageId||'');
    const s=String(raw||'').trim();
    if(!s)return'';
    if(/^https?:\/\//i.test(s))return s;
    if(/^[A-Za-z0-9_-]{16,}$/.test(s))return `https://down-br.img.susercontent.com/file/${s}`;
    return'';
  }).filter(Boolean);
  const clean=[...new Set(normalized)].filter(u=>!/\.svg(?:\?|$)/i.test(String(u))&&!/productdetailspage\/.*\.svg/i.test(String(u)));
  const score=u=>{
    const s=String(u||'');let v=0;
    if(/down-br\.img\.susercontent\.com\/file\//i.test(s))v+=3;
    if(/\/br-11134207-/i.test(s))v+=8;
    if(/_tn(?:\?|$)/i.test(s))v-=5;
    if(/_cover(?:\?|$)/i.test(s))v-=6;
    if(/shopee-pcmall-live-sg|productdetailspage/i.test(s))v-=20;
    return v;
  };
  return clean.map((u,i)=>({u,i,s:score(u)})).sort((a,b)=>b.s-a.s||a.i-b.i).map(x=>x.u);
}

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
    <div className={styles.actionButtons}>
      <button type="button" onClick={onUndo} disabled={!canUndo}>↶ Desfazer</button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>↷ Refazer</button>
      <button type="button" onClick={onRestore}>⟳ Restaurar original</button>
    </div>
    <div className={styles.actionState}>
      <small className={dirtyCount?styles.pending:styles.noPending}>● {dirtyCount?`${dirtyCount} alteração${dirtyCount===1?'':'ões'} não salva${dirtyCount===1?'':'s'}`:'Nenhuma alteração pendente'}</small>
      <button type="button" className={styles.saveShopee} onClick={onSave} disabled={saveDisabled||dirtyCount===0||saving}>{saving?'Salvando…':'▣ Salvar alterações'}</button>
    </div>
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

function FlashVariationModal({open,models,draft,setDraft,basePromo,onApplyAll,onClose,onConfirm,busy}) {
  if(!open)return null;
  return <div className={styles.flashVariationModal} role="dialog" aria-modal="true" aria-label="Preços da Oferta Relâmpago por variação" onClick={onClose}>
    <section className={styles.flashVariationDialog} onClick={e=>e.stopPropagation()}>
      <header>
        <div><b>⚡ Preço por variação</b><span>Defina o preço e o estoque reservado para cada variação antes de criar a Oferta Relâmpago.</span></div>
        <button type="button" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      <div className={styles.flashVariationTools}>
        <span>{models.length} variação{models.length===1?'':'ões'}</span>
        {Number(basePromo)>0&&<button type="button" onClick={onApplyAll}>Aplicar {money(basePromo)} em todas</button>}
      </div>
      <div className={styles.flashVariationTable}>
        <div><b>Variação</b><b>Preço atual</b><b>Preço da oferta</b><b>Estoque reservado</b></div>
        {models.map((model,index)=>{
          const id=String(model.model_id??model.modelId??model.id??index);
          const row=draft[id]||{};
          return <div key={id}>
            <span><b>{model.name||model.model_name||model.modelSku||('Variação '+(index+1))}</b>{model.sku&&<small>SKU: {model.sku}</small>}</span>
            <span>{money(model.current_price??model.price??model.original_price)}</span>
            <label><input type="number" min="0.01" step="0.01" value={row.promoPrice??''} onChange={e=>setDraft(d=>({...d,[id]:{...(d[id]||{}),promoPrice:e.target.value}}))}/></label>
            <label><input type="number" min="1" step="1" value={row.stock??''} onChange={e=>setDraft(d=>({...d,[id]:{...(d[id]||{}),stock:e.target.value}}))}/>{model.available_stock!=null&&<small>Disponível: {Number(model.available_stock).toLocaleString('pt-BR')}</small>}</label>
          </div>
        })}
      </div>
      <footer><button type="button" className={styles.secondaryAction} onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className={styles.primary} onClick={onConfirm} disabled={busy}>{busy?'Criando…':'Criar Oferta Relâmpago'}</button></footer>
    </section>
  </div>
}

function FlashConfirmModal({open,period,slotCount,models,variationDraft,flash,notify,setNotify,onClose,onConfirm,busy}) {
  if(!open)return null;
  return <div className={styles.flashVariationModal} role="dialog" aria-modal="true" aria-label="Confirmar Ofertas Relâmpago" onClick={onClose}>
    <section className={styles.flashVariationDialog} onClick={e=>e.stopPropagation()}>
      <header><div><b>⚡ Confirmar criação das Ofertas Relâmpago</b><span>Confira o período e as notificações antes de enviar para a Shopee.</span></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <div className={styles.flashConfirmSummary}>
        <div><small>Período</small><b>{dateRangeLabel(period)}</b></div>
        <div><small>Horários oficiais encontrados</small><b>{slotCount}</b></div>
        <div><small>Produto</small><b>{models.length?models.length+' variações':'Preço único'}</b></div>
      </div>
      {models.length?<div className={styles.flashConfirmModels}>{models.map((model,index)=>{const id=String(model.model_id??index),row=variationDraft[id]||{};return <div key={id}><span>{model.name||('Variação '+(index+1))}</span><b>{money(row.promoPrice)}</b><small>Estoque {n(row.stock)?.toLocaleString('pt-BR')||'—'}</small></div>})}</div>:<div className={styles.flashConfirmSingle}><span>Preço promocional</span><b>{money(flash.promoPrice)}</b><small>Estoque {n(flash.stock)?.toLocaleString('pt-BR')||'—'}</small></div>}
      <div className={styles.flashNotifyChoices}>
        <b>Quando esse período terminar:</b>
        <label><input type="checkbox" checked={notify.app} onChange={e=>setNotify(x=>({...x,app:e.target.checked}))}/> Mostrar aviso no Gestor</label>
        <label><input type="checkbox" checked={notify.email} onChange={e=>setNotify(x=>({...x,email:e.target.checked}))}/> Enviar também por e-mail</label>
      </div>
      <footer><button type="button" className={styles.secondaryAction} onClick={onClose} disabled={busy}>Voltar</button><button type="button" className={styles.primary} onClick={onConfirm} disabled={busy||(!notify.app&&!notify.email)}>{busy?'Criando…':`Criar ${slotCount} oferta${slotCount===1?'':'s'}`}</button></footer>
    </section>
  </div>
}

export default function SuperAnaliseInteligente({report,products=[],initialTab='title',embedded=false}){
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
  const [flashModels,setFlashModels]=useState([]);
  const [flashVariationOpen,setFlashVariationOpen]=useState(false);
  const [flashVariationDraft,setFlashVariationDraft]=useState({});
  const [flashPeriod,setFlashPeriod]=useState(()=>{const start=localYmd(new Date());return{start,end:addLocalDays(start,7)}});
  const [flashConfirmOpen,setFlashConfirmOpen]=useState(false);
  const [flashNotify,setFlashNotify]=useState({app:true,email:false});
  const [flashBusy,setFlashBusy]=useState(false);
  const [flashMessage,setFlashMessage]=useState('');
  const [flashDays,setFlashDays]=useState(30);
  const [flashInsight,setFlashInsight]=useState({phase:'idle',recommendation:null,recommendedSlots:[],error:''});
  const [automation,setAutomation]=useState({enabled:false,useBestTime:true,minGapHours:'20'});
  const [automationBusy,setAutomationBusy]=useState(false);
  const [automationMessage,setAutomationMessage]=useState('');
  const uploadRef=useRef(null);

  const p=report?.product_snapshot||{};
  const f=report?.finance_snapshot||{};
  const before=useMemo(()=>scoreMap(report),[report]);
  const after=analysis?.afterScores||{};
  const images=arr(p.imageUrls||p.image?.image_url_list);
  const competitors=arr(report?.competitors).slice(0,3);
  const basePrice=n(metric(report,'price')??p.price??p.currentPrice);
  const baseCost=n(f.productCost??p.referenceCost);
  const marginCalc=shopeeMarginCalc(basePrice,baseCost);
  const marginNow=marginCalc?.marginPct??null;
  const marginProof=marginCalc?`Preço ${money(marginCalc.price)} − 20% Shopee (${money(marginCalc.commission)}) − taxa fixa ${money(marginCalc.fixedFee)} − custo ${money(marginCalc.cost)} = lucro ${money(marginCalc.profit)} · margem ${pct(marginCalc.marginPct)}`:'Margem indisponível: preço ou custo não capturado.';
  const overallBefore=n(report?.score);
  const overallSuggested=n(analysis?.afterScore);
  const overallAfter=overallSuggested==null?overallBefore:(overallBefore==null?overallSuggested:Math.max(overallBefore,overallSuggested));
  const overallDelta=overallBefore!=null&&overallAfter!=null?Math.round(overallAfter-overallBefore):null;

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
    setFlashVariationOpen(false);setFlashVariationDraft({});setFlashModels([]);setFlashConfirmOpen(false);const today=localYmd(new Date());setFlashPeriod({start:today,end:addLocalDays(today,7)});
  },[report?.id]);

  async function loadFlashMeta(days=flashDays,period=flashPeriod){
    if(!report?.item_id)return;
    setFlashInsight(x=>({...x,phase:'loading',error:''}));
    try{
      const q=new URLSearchParams({item_id:String(report.item_id),days:String(Number(days)||30)});
      if(period?.start)q.set('start_date',period.start);
      if(period?.end)q.set('end_date',period.end);
      const j=await fetchJsonWithTimeout('/api/shopee/flash-sale?'+q.toString(),{cache:'no-store'},30000);
      const next=arr(j?.slots),recommended=arr(j?.recommendedSlots),models=arr(j?.productModels);
      setSlots(next);setSlotError('');setFlashModels(models);
      setFlashInsight({phase:'success',recommendation:j?.recommendation||null,recommendedSlots:recommended,error:j?.productModelError||''});
      if(models.length){
        setFlashVariationDraft(current=>{
          const nextDraft={...current};
          for(const model of models){
            const id=String(model.model_id);
            const available=n(model.available_stock);
            const row=nextDraft[id]||{};
            nextDraft[id]={
              promoPrice:row.promoPrice??(Number(flash.promoPrice)>0?String(flash.promoPrice):String(model.current_price??'')),
              stock:row.stock??String(available??'')
            };
          }
          return nextDraft;
        });
      }
    }catch(e){
      const msg=String(e?.message||e);setSlotError(msg);setFlashInsight({phase:'error',recommendation:null,recommendedSlots:[],error:msg});
    }
  }

  async function loadFlashAutomation(){
    if(!report?.item_id)return;
    try{
      const j=await fetchJsonWithTimeout('/api/shopee/flash-sale/automation?item_id='+encodeURIComponent(report.item_id),{cache:'no-store'},12000);
      const a=j?.automation;
      if(!a)return;
      setAutomation({enabled:!!a.enabled,useBestTime:a.use_best_time!==false,minGapHours:String(a.min_gap_hours||20)});
      if([7,30,60,90].includes(Number(a.lookback_days)))setFlashDays(Number(a.lookback_days));
      setFlash(x=>({...x,promoPrice:String(a.promo_price??x.promoPrice),stock:String(a.stock??x.stock),purchaseLimit:String(a.purchase_limit??x.purchaseLimit)}));
    }catch(e){console.warn('[Oferta Relâmpago] configuração de automação indisponível',e)}
  }

  useEffect(()=>{
    if(tab!=='price')return;
    loadFlashMeta(flashDays,flashPeriod);
  },[tab,report?.item_id]);

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
  const categoryLeaf=value=>String(value||'').split(/>|\/|→/).map(x=>x.trim()).filter(Boolean).pop()?.toLowerCase()||'';
  const categoryAligned=Boolean(dominantCategory&&currentCategory&&categoryLeaf(dominantCategory[0])===categoryLeaf(currentCategory));

  const liveMargin=currentMargin(draft.price,draft.cost);
  const reportFlashModels=arr(p.models||p.variations).map((m,index)=>({
    model_id:m?.model_id??m?.modelId??m?.id,
    name:m?.name||m?.model_name||m?.modelName||('Variação '+(index+1)),
    sku:m?.model_sku||m?.sku||null,
    current_price:n(m?.current_price??m?.currentPrice??m?.price),
    original_price:n(m?.original_price??m?.originalPrice??m?.price),
    available_stock:n(m?.available_stock??m?.stock??m?.normal_stock)
  })).filter(x=>x.model_id!=null);
  const effectiveFlashModels=flashModels.length?flashModels:reportFlashModels;
  const selectedSlots=useMemo(()=>{
    const startAt=flashPeriod?.start?new Date(flashPeriod.start+'T00:00:00').getTime():-Infinity;
    const endAt=flashPeriod?.end?new Date(flashPeriod.end+'T23:59:59').getTime():Infinity;
    return slots.filter(slot=>{
      const at=Number(slot?.start_time)*1000;
      return Number.isFinite(at)&&at>=startAt&&at<=endAt;
    });
  },[slots,flashPeriod?.start,flashPeriod?.end]);

  function ensureVariationDraft(){
    const next={...flashVariationDraft};
    for(const model of effectiveFlashModels){
      const id=String(model.model_id),row=next[id]||{};
      const available=n(model.available_stock);
      next[id]={
        promoPrice:row.promoPrice??(Number(flash.promoPrice)>0?String(flash.promoPrice):String(model.current_price??'')),
        stock:row.stock??String(available??'')
      };
    }
    setFlashVariationDraft(next);
    return next;
  }

  function setFlashPreset(kind){
    const start=localYmd(new Date());
    let next={start,end:start};
    if(kind==='7')next={start,end:addLocalDays(start,6)};
    else if(kind==='30')next={start,end:addLocalDays(start,29)};
    else if(kind==='month')next={start,end:endOfLocalMonth(start)};
    setFlashPeriod(next);
    loadFlashMeta(flashDays,next);
  }

  function applyFlashPriceToAll(){
    setFlashVariationDraft(d=>{
      const next={...d};
      for(const model of effectiveFlashModels){
        const id=String(model.model_id);
        next[id]={...(next[id]||{}),promoPrice:String(flash.promoPrice||'')};
      }
      return next;
    });
  }

  function prepareFlashCreation(){
    if(!flashPeriod?.start||!flashPeriod?.end)return setFlashMessage('Escolha a data inicial e final do período.');
    if(new Date(flashPeriod.end+'T23:59:59')<new Date(flashPeriod.start+'T00:00:00'))return setFlashMessage('A data final precisa ser igual ou posterior à data inicial.');
    if(!selectedSlots.length)return setFlashMessage('A Shopee não retornou horários oficiais disponíveis dentro desse período. Atualize os horários ou escolha outro período.');

    if(effectiveFlashModels.length){
      const draftRows=ensureVariationDraft();
      for(const model of effectiveFlashModels){
        const id=String(model.model_id),row=draftRows[id]||{};
        const promo=Number(row.promoPrice),reserved=Number(row.stock);
        if(!(promo>0))return setFlashMessage('Defina o preço da oferta para todas as variações.');
        if(!(Number.isInteger(reserved)&&reserved>0))return setFlashMessage('Defina o estoque reservado de todas as variações.');
        if(n(model.available_stock)!=null&&reserved>Number(model.available_stock))return setFlashMessage('O estoque reservado de '+(model.name||'uma variação')+' excede o estoque disponível.');
      }
    }else{
      if(!(Number(flash.promoPrice)>0))return setFlashMessage('Informe o preço promocional.');
      if(!(Number.isInteger(Number(flash.stock))&&Number(flash.stock)>0))return setFlashMessage('Informe o estoque reservado.');
    }
    setFlashMessage('');
    setFlashConfirmOpen(true);
  }

  async function confirmFlashCreation(){
    setFlashBusy(true);setFlashMessage('');
    try{
      const body={
        item_id:report.item_id,
        timeslot_ids:selectedSlots.map(x=>Number(x.timeslot_id)).filter(Boolean),
        purchase_limit:Number(flash.purchaseLimit||0),
        notify_app:flashNotify.app,
        notify_email:flashNotify.email
      };
      if(effectiveFlashModels.length){
        body.models=effectiveFlashModels.map(model=>{
          const row=flashVariationDraft[String(model.model_id)]||{};
          return{model_id:Number(model.model_id),promo_price:Number(row.promoPrice),stock:Number(row.stock)};
        });
      }else{
        body.promo_price=Number(flash.promoPrice);
        body.stock=Number(flash.stock);
      }
      const j=await fetchJsonWithTimeout('/api/shopee/flash-sale',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
      },55000);
      setFlashConfirmOpen(false);
      const created=Number(j?.created_count||j?.flash_sale_ids?.length||1);
      const failed=Number(j?.failed_count||0);
      setFlashMessage(failed?(`${created} oferta(s) criada(s); ${failed} horário(s) não puderam ser criados.`):(`${created} Oferta(s) Relâmpago criada(s) na Shopee.`));
      await loadFlashMeta(flashDays,flashPeriod);
    }catch(e){setFlashMessage(String(e?.message||e))}finally{setFlashBusy(false)}
  }

  function useRecommendedSlot(){
    const slot=flashInsight.recommendedSlots?.[0];
    if(!slot?.start_time){setFlashMessage('Ainda não há um horário recomendado disponível para aplicar.');return}
    const day=localYmd(new Date(Number(slot.start_time)*1000));
    const next={start:day,end:day};
    setFlashPeriod(next);
    loadFlashMeta(flashDays,next);
    setFlashMessage('O período foi ajustado para o melhor dia sugerido pelo histórico de vendas.');
  }

  if(!report)return <div className={styles.screen}><main className={styles.empty}><h1>✦ Super Análise Inteligente</h1><p>Nenhuma análise encontrada.</p></main></div>;

  return <div className={`${styles.screen} ${embedded?styles.embeddedScreen:''}`}>
    <ZoomModal src={zoomSrc} onClose={()=>setZoomSrc('')}/>
    <FlashConfirmModal open={flashConfirmOpen} period={flashPeriod} slotCount={selectedSlots.length} models={effectiveFlashModels} variationDraft={flashVariationDraft} flash={flash} notify={flashNotify} setNotify={setFlashNotify} onClose={()=>!flashBusy&&setFlashConfirmOpen(false)} onConfirm={confirmFlashCreation} busy={flashBusy}/>
    <main className={embedded?styles.embeddedMain:styles.main}>
      {!embedded&&<><header className={styles.header}><div className={styles.titleBlock}><div className={styles.titleRow}><h1>✦ Super Análise Inteligente</h1><div className={styles.scoreChip} title="Nota geral estimada do anúncio"><b>{overallBefore==null?'—':Math.round(overallBefore)}</b><span>→</span><b className={styles.scoreAfter}>{overallAfter==null?'—':Math.round(overallAfter)}</b><em>{overallDelta==null?'':overallDelta>0?`+${overallDelta} pontos`:'sem perda'}</em><small>Nota geral do anúncio</small></div></div><p>Compare os dados originais com a sugestão da IA e aplique apenas o que fizer sentido.</p></div><div className={styles.headerActions}><button type="button" data-gs-super-analysis onClick={openExtension}>↗ Abrir Motor Senior</button></div></header>
      <section className={styles.productBar}>
        {productImage(p)?<img src={productImage(p)} alt=""/>:<div className={styles.noImage}/>}
        <div className={styles.productInfo}><b>{p.title||p.item_name||`Produto ${report.item_id}`}</b><small>ID do anúncio: {report.item_id}</small><small>Categoria: {p.category||missingStatus(p)}</small></div>
        <div className={styles.metrics}><Metric label="Preço" value={money(basePrice)}/><Metric label="Custo" value={money(baseCost)}/><Metric label="Margem estimada" value={pct(marginNow)} title={marginProof}/><Metric label="Vendas" value={n(metric(report,'sold')??p.sold)?.toLocaleString('pt-BR')||'—'}/><Metric label="Avaliação" value={n(p.rating)!=null?`${n(p.rating).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} ★`:'—'}/><Metric label="Fotos" value={countValue(p.imageCount,images,p)}/><Metric label="Vídeo" value={boolValue(p.hasVideo,p)}/><Metric label="Variações" value={countValue(p.variationCount,arr(p.models||p.variations),p)}/></div>
      </section>
      <div className={styles.tabs}>{TABS.map(([k,label,icon])=><button key={k} className={tab===k?styles.tabActive:''} onClick={()=>setTab(k)}><span>{icon}</span>{label}</button>)}</div></>}

      <div className={styles.tabWorkspace}>
        <section className={styles.tabContent}>
          {tab==='title'&&<TextCompare title="Título" original={draft.title||''} suggestion={suggestionImproves?draft.suggestionTitle:''} onOriginal={v=>setField('title',v)} onSuggestion={v=>setField('suggestionTitle',v)} onApply={()=>applySuggestion('title',draft.suggestionTitle)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves}/>}
          {tab==='description'&&<TextCompare title="Descrição" original={draft.description||''} suggestion={suggestionImproves?draft.suggestionDescription:''} onOriginal={v=>setField('description',v)} onSuggestion={v=>setField('suggestionDescription',v)} onApply={()=>applySuggestion('description',draft.suggestionDescription)} before={activeBefore} after={guardedAfter} multiline blocked={!suggestionImproves}/>}
          {tab==='images'&&<ImagesSection gallery={gallery} competitors={competitors} plan={suggestionImproves?draft.imagePlan:''} onPlan={v=>setField('imagePlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves} setZoomSrc={setZoomSrc} downloadImage={downloadImage} removeImage={removeImage} moveImage={moveImage} uploadRef={uploadRef} onUploadFiles={onUploadFiles}/>}
          {tab==='video'&&<PlanSection title="Vídeo" original={p.hasVideo?'O anúncio possui vídeo.':'O anúncio não possui vídeo.'} plan={suggestionImproves?draft.videoPlan:''} onPlan={v=>setField('videoPlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves}/>}
          {tab==='category'&&<CategoryComparison current={currentCategory||'—'} competitors={compCategoryRows} dominant={dominantCategory} aligned={categoryAligned} onApply={()=>{if(dominantRow?.id)mutate(()=>setChosenCategory(String(dominantRow.id)));else setMessage('A categoria predominante foi identificada, mas o ID oficial não foi coletado. Nenhuma alteração será enviada sem um ID real da Shopee.')}} selected={chosenCategory} setZoomSrc={setZoomSrc}/>}
          {tab==='price'&&<PriceSection price={draft.price} cost={draft.cost} setPrice={v=>setField('price',v)} setCost={v=>setField('cost',v)} margin={liveMargin} competitors={competitors} plan={suggestionImproves?draft.pricePlan:''} onPlan={v=>setField('pricePlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves} setZoomSrc={setZoomSrc} slots={slots} selectedSlots={selectedSlots} slotError={slotError} flash={flash} setFlash={setFlash} createFlash={prepareFlashCreation} flashBusy={flashBusy} flashMessage={flashMessage} flashDays={flashDays} setFlashDays={setFlashDays} flashInsight={flashInsight} reloadFlash={()=>loadFlashMeta(flashDays,flashPeriod)} useRecommendedSlot={useRecommendedSlot} flashPeriod={flashPeriod} setFlashPeriod={setFlashPeriod} setFlashPreset={setFlashPreset} models={effectiveFlashModels} variationDraft={flashVariationDraft} setVariationDraft={setFlashVariationDraft} applyFlashPriceToAll={applyFlashPriceToAll}/>}
          {tab==='variations'&&<VariationsSection product={p} plan={suggestionImproves?draft.variationsPlan:''} onPlan={v=>setField('variationsPlan',v)} before={activeBefore} after={guardedAfter} blocked={!suggestionImproves}/>}
          {(tab==='images'||tab==='video')&&<div className={styles.reminderStrip}><span>{tab==='images'?'Quer revisar essas imagens mais tarde?':'Quer voltar depois para adicionar ou atualizar o vídeo?'}</span><ReminderButton itemId={report.item_id} taskType={tab} priority="medium" title={tab==='images'?'Revisar imagens do anúncio':'Adicionar ou atualizar vídeo do anúncio'} description={tab==='images'?'Revisar e melhorar as imagens deste produto.':'Revisar a necessidade de adicionar ou atualizar o vídeo deste produto.'} actionUrl={'/super-analise?item_id='+report.item_id+'&tab='+tab}/></div>}
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
          <button type="button" onClick={()=>uploadRef.current?.click()}>⇧ Substituir / adicionar imagem</button>
          <input ref={uploadRef} hidden type="file" accept="image/jpeg,image/png" multiple onChange={e=>onUploadFiles(e.target.files||[])}/>
        </div>
        <div className={styles.imageInfo}>ⓘ Você pode baixar, editar no computador, enviar novamente e só depois salvar na Shopee.</div>
        <div className={styles.galleryEdit}>{gallery.map((x,i)=><figure key={x.source==='uploaded'?x.image_id:`${x.index}-${x.url}`}><SmartImage urls={[x.url]} alt="" onZoom={setZoomSrc}/><figcaption>Imagem {i+1}</figcaption><div className={styles.imageActions}><button onClick={()=>moveImage(i,-1)} disabled={i===0}>←</button><button onClick={()=>moveImage(i,1)} disabled={i===gallery.length-1}>→</button><button onClick={()=>removeImage(i)}>Remover</button></div></figure>)}</div>
        <div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div>
      </article>
      <article className={styles.panel}><div className={styles.panelHead}><h2>✦ Recomendações visuais da IA</h2><span>✎ Editável</span></div>{blocked?<div className={styles.preserveBox}>As imagens atuais obtiveram nota igual ou melhor. Nenhuma alteração visual é sugerida.</div>:<textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma mudança visual necessária."/>}<div className={styles.applyLine}><button className={styles.primary} disabled={!plan||blocked}>✓ Aplicar plano de imagens</button><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article>
    </section>
    <section className={styles.competitorsVisual}><h2>Comparação visual com os concorrentes</h2><div className={styles.competitorGrid}>{competitors.map((c,i)=><article key={i}><SmartImage urls={imageCandidates(c)} alt="" onZoom={setZoomSrc}/><div><small>Concorrente {i+1}</small>{competitorUrl(c)?<a href={competitorUrl(c)} target="_blank" rel="noreferrer">{c.title||`Concorrente ${i+1}`} ↗</a>:<b>{c.title||`Concorrente ${i+1}`}</b>}<span>Preço <strong>{money(parsedSearchPrice(c))}</strong></span><span>Vendidos <strong>{n(parsedSearchSold(c))?.toLocaleString('pt-BR')||missingStatus(c)}</strong></span></div></article>)}</div></section>
  </>
}

function CategoryComparison({current,competitors,dominant,aligned,onApply,selected,setZoomSrc}){
  return <>
    <section className={styles.categoryCompare}>
      <article className={styles.panel}><div className={styles.panelHead}><h2>Categoria atual do anúncio</h2><span className={aligned?styles.okChip:styles.warnChip}>● {aligned?'Alinhada':'Não alinhada'}</span></div><div className={styles.textBox}>{current}</div><div className={styles.imageInfo}>{dominant?aligned?'Sua categoria é a mesma predominante entre os concorrentes analisados.':'Sua categoria atual é diferente da mais usada pelos concorrentes analisados.':'Os concorrentes não trouxeram categoria suficiente para comparar.'}</div></article>
      <article className={styles.panel}><div className={styles.panelHead}><h2>Categorias dos concorrentes</h2><span>{competitors.length} concorrentes</span></div><div className={styles.categoryCompetitors}>{competitors.map(({c,i,label})=><div key={i}><SmartImage urls={imageCandidates(c)} alt="" onZoom={setZoomSrc}/><div>{competitorUrl(c)?<a href={competitorUrl(c)} target="_blank" rel="noreferrer">{c.title||`Concorrente ${i+1}`} ↗</a>:<b>{c.title||`Concorrente ${i+1}`}</b>}<small>{label||'Categoria não coletada'}</small></div><span><small>Preço</small><b>{money(parsedSearchPrice(c))}</b></span><span><small>Vendidos</small><b>{n(parsedSearchSold(c))?.toLocaleString('pt-BR')||'—'}</b></span></div>)}</div>{dominant&&<div className={styles.dominantStrip}>{dominant[1]} de {competitors.length} concorrentes usam “{dominant[0]}”.</div>}</article>
    </section>
    <section className={styles.categoryConclusion}><h2>Comparação de categoria</h2>{!dominant?<p>Não há dados suficientes para recomendar mudança de categoria.</p>:aligned?<div className={styles.goodConclusion}><b>✓ Você já usa a categoria predominante.</b><p>A IA não sugere alteração de categoria porque seus dados estão alinhados com a maioria dos concorrentes coletados.</p></div>:<div className={styles.goodConclusion}><b>Comparação indica uma categoria predominante entre concorrentes.</b><p>Sua categoria atual é “{current}”; a mais recorrente nos concorrentes coletados é “{dominant[0]}”. A decisão continua com você.</p><button type="button" className={styles.primary} onClick={onApply}>Aplicar categoria predominante ao rascunho</button></div>}</section>
  </>
}


function PriceSection({price,cost,setPrice,setCost,margin,competitors,plan,onPlan,before,after,blocked,setZoomSrc,slots,selectedSlots,slotError,flash,setFlash,createFlash,flashBusy,flashMessage,flashDays,setFlashDays,flashInsight,reloadFlash,useRecommendedSlot,flashPeriod,setFlashPeriod,setFlashPreset,models,variationDraft,setVariationDraft,applyFlashPriceToAll}){
  const promoMargin=currentMargin(flash.promoPrice,cost);
  const rec=flashInsight?.recommendation;
  const dayNames=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const confidence={high:'alta',medium:'média',low:'baixa',insufficient:'dados insuficientes'}[rec?.confidence]||'—';
  const rangeDays=flashPeriod?.start&&flashPeriod?.end?Math.max(1,Math.round((new Date(flashPeriod.end+'T12:00:00')-new Date(flashPeriod.start+'T12:00:00'))/86400000)+1):0;
  return <>
    <section className={styles.priceTopGrid}>
      <article className={styles.panel}><div className={styles.panelHead}><h2>Preço e margem atuais</h2><span>✎ Editável</span></div><div className={styles.priceGrid}><label>Preço<input type="number" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Custo<input type="number" step="0.01" value={cost} onChange={e=>setCost(e.target.value)}/></label><div><small>Margem recalculada</small><b>{pct(margin)}</b></div></div><div className={styles.formula}>Conta resumida: preço de venda {money(price)} − 20% Shopee − R$ 4,50 de taxa fixa − custo {money(cost)} = margem estimada. <small>Ads é acompanhado separadamente e não reduz esta margem do produto.</small></div><div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div></article>
      <article className={styles.panel}><div className={styles.panelHead}><h2>✦ Estratégia de preço e concorrência</h2><span>✎ Editável</span></div>{blocked?<div className={styles.preserveBox}>A alteração sugerida reduziria a nota estimada. O preço atual foi preservado.</div>:<textarea rows={9} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma mudança necessária no preço."/>}<div className={styles.applyLine}><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article>
    </section>

    <section className={styles.flashCard}>
      <div className={styles.panelHead}><h2>⚡ Oferta Relâmpago real</h2><span>Horários oficiais da Shopee</span></div>
      <p>Escolha um período no calendário. O Gestor encontra os horários oficiais da Shopee dentro desse período e cria as ofertas somente depois da sua confirmação.</p>

      <div className={styles.flashRecommendation}>
        <div className={styles.flashRecommendationMain}>
          <b>💡 Melhor horário sugerido</b>
          {flashInsight?.phase==='loading'?<span>Analisando vendas…</span>:rec?.bestWindowLabel?<><strong>{rec.bestWindowLabel}</strong><span>{rec.bestWeekday!=null?('Melhor dia: '+dayNames[rec.bestWeekday]+' · '):''}{rec.units} unidade{rec.units===1?'':'s'} vendida{rec.units===1?'':'s'} em {rec.days} dias · confiança {confidence}.</span></>:<span>Ainda não há vendas suficientes neste período para indicar uma janela confiável.</span>}
        </div>
        <label>Histórico<select value={flashDays} onChange={e=>setFlashDays(Number(e.target.value))}><option value="7">7 dias</option><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option></select></label>
        <button type="button" onClick={reloadFlash} disabled={flashInsight?.phase==='loading'}>↻ Atualizar horários</button>
        <button type="button" className={styles.recommendButton} onClick={useRecommendedSlot} disabled={!flashInsight?.recommendedSlots?.length}>✓ Usar melhor dia</button>
      </div>

      <div className={styles.flashPeriodCard}>
        <div className={styles.flashPeriodHead}><div><b>📅 Período das ofertas</b><span>Selecione a data inicial e final.</span></div><strong>{rangeDays?rangeDays+' dia'+(rangeDays===1?'':'s'):'—'}</strong></div>
        <div className={styles.flashPeriodInputs}>
          <label>De<input type="date" value={flashPeriod?.start||''} onChange={e=>setFlashPeriod(x=>({...x,start:e.target.value}))}/></label>
          <span>até</span>
          <label>Até<input type="date" value={flashPeriod?.end||''} onChange={e=>setFlashPeriod(x=>({...x,end:e.target.value}))}/></label>
          <button type="button" onClick={reloadFlash}>Buscar horários oficiais</button>
        </div>
        <div className={styles.flashPeriodPresets}>
          <button type="button" onClick={()=>setFlashPreset('today')}>Hoje</button>
          <button type="button" onClick={()=>setFlashPreset('7')}>Próximos 7 dias</button>
          <button type="button" onClick={()=>setFlashPreset('30')}>Próximos 30 dias</button>
          <button type="button" onClick={()=>setFlashPreset('month')}>Este mês</button>
        </div>
        <div className={styles.flashPeriodResult}><b>{selectedSlots.length} horário{selectedSlots.length===1?'':'s'} oficial{selectedSlots.length===1?'':'is'} encontrado{selectedSlots.length===1?'':'s'}</b><span>{selectedSlots.length?selectedSlots.slice(0,3).map(flashSlotLabel).join(' · '):'Escolha o período e clique em buscar horários oficiais.'}</span></div>
      </div>

      {models.length?<div className={styles.flashVariationInline}>
        <div className={styles.flashVariationInlineHead}><div><b>Preço da oferta por variação</b><span>A Shopee exige um preço válido para cada variação.</span></div><div className={styles.flashApplyAll}><input type="number" min="0.01" step="0.01" placeholder="Preço para todas" value={flash.promoPrice} onChange={e=>setFlash(x=>({...x,promoPrice:e.target.value}))}/><button type="button" onClick={applyFlashPriceToAll}>Aplicar em todas</button></div></div>
        <div className={styles.flashVariationInlineTable}>
          <div><b>Variação</b><b>Preço atual</b><b>Preço da oferta</b><b>Estoque reservado</b></div>
          {models.map((model,index)=>{const id=String(model.model_id??index),row=variationDraft[id]||{};return <div key={id}><span><b>{model.name||('Variação '+(index+1))}</b>{model.sku&&<small>SKU: {model.sku}</small>}</span><span>{money(model.current_price??model.original_price)}</span><label><input type="number" min="0.01" step="0.01" value={row.promoPrice??''} onChange={e=>setVariationDraft(d=>({...d,[id]:{...(d[id]||{}),promoPrice:e.target.value}}))}/></label><label><input type="number" min="1" step="1" value={row.stock??''} onChange={e=>setVariationDraft(d=>({...d,[id]:{...(d[id]||{}),stock:e.target.value}}))}/>{model.available_stock!=null&&<small>Disponível: {Number(model.available_stock).toLocaleString('pt-BR')}</small>}</label></div>})}
        </div>
        <label className={styles.flashPurchaseLimit}>Limite por comprador<input type="number" min="0" value={flash.purchaseLimit} onChange={e=>setFlash(x=>({...x,purchaseLimit:e.target.value}))}/></label>
      </div>:<div className={styles.flashGrid}><label>Preço promocional<input type="number" step="0.01" value={flash.promoPrice} onChange={e=>setFlash(x=>({...x,promoPrice:e.target.value}))}/></label><label>Estoque reservado<input type="number" min="1" value={flash.stock} onChange={e=>setFlash(x=>({...x,stock:e.target.value}))}/></label><label>Limite por comprador<input type="number" min="0" value={flash.purchaseLimit} onChange={e=>setFlash(x=>({...x,purchaseLimit:e.target.value}))}/></label><div><small>Margem projetada</small><b>{pct(promoMargin)}</b></div></div>}

      {slotError&&<div className={styles.message}>{slotError}</div>}
      <button type="button" className={styles.primary} onClick={createFlash} disabled={flashBusy||!selectedSlots.length}>{flashBusy?'Criando…':`⚡ Criar Ofertas Relâmpago (${selectedSlots.length})`}</button>
      <small className={styles.recommendNote}>Antes de criar, o Gestor abre uma confirmação com o período, preços e opção para avisar quando as ofertas terminarem.</small>
      {flashMessage&&<div className={styles.message}>{flashMessage}</div>}
    </section>

    <section className={styles.competitorsVisual}><h2>{competitors.length} concorrentes selecionados</h2><div className={styles.competitorGrid}>{competitors.map((c,i)=><article key={i}><SmartImage urls={imageCandidates(c)} alt="" onZoom={setZoomSrc}/><div><small>Concorrente {i+1}</small>{competitorUrl(c)?<a href={competitorUrl(c)} target="_blank" rel="noreferrer">{c.title||('Concorrente '+(i+1))} ↗</a>:<b>{c.title||('Concorrente '+(i+1))}</b>}<span>Preço <strong>{money(parsedSearchPrice(c))}</strong></span><span>Vendidos <strong>{n(parsedSearchSold(c))?.toLocaleString('pt-BR')||'—'}</strong></span></div></article>)}</div></section>
  </>
}

function PlanSection({title,original,plan,onPlan,before,after,blocked}){return <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>{title} atual</h2></div><div className={styles.textBox}>{original}</div><div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div></article><div className={styles.arrow}>→</div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão da IA</h2><span>✎ Editável</span></div>{blocked?<div className={styles.preserveBox}>A análise estimou uma nota menor. Nenhuma alteração é sugerida.</div>:<textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma alteração necessária."/>}<div className={styles.applyLine}><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article></section>}

function VariationsSection({product,plan,onPlan,before,after,blocked}){const models=arr(product.models||product.variations);const costs=arr(product.variationCosts);const costMap=new Map(costs.map(x=>[String(x.modelId??x.model_id),n(x.cost)]));return <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>Variações atuais</h2><span>{models.length}</span></div>{models.length?<div className={styles.variationTable}><div><b>Variação</b><b>Preço</b><b>Custo</b><b>Margem</b></div>{models.map((m,i)=>{const id=String(m.modelId??m.model_id??m.id??i),price=n(m.price??m.currentPrice),cost=n(m.cost)??costMap.get(id),margin=currentMargin(price,cost);return <div key={id}><span>{m.name||m.model_name||`Variação ${i+1}`}</span><span>{money(price)}</span><span>{money(cost)}</span><span>{pct(margin)}</span></div>})}</div>:<div className={styles.textBox}>Este anúncio não possui variações estruturadas capturadas.</div>}<div className={styles.scoreFloat}><Gauge score={before} label="Atual"/></div></article><div className={styles.arrow}>→</div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão para atributos & variações</h2></div>{blocked?<div className={styles.preserveBox}>A estrutura atual pontuou melhor. Nenhuma alteração é sugerida.</div>:<textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="A IA não encontrou uma alteração necessária."/>}<div className={styles.applyLine}><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div></article></section>}

function WhyBlock({analysis,tab}){const a=analysis?.[tab]||{};return <section className={styles.why}><h2><span>?</span> Por que a IA sugeriu essa alteração?</h2><div className={styles.whyGrid}><article><b>SEO</b><p>{a.seo||'Palavras-chave, intenção de busca e coerência com o produto.'}</p></article><article><b>AIDA</b><p>{a.aida||'Atenção, interesse, desejo e ação quando fizer sentido.'}</p></article><article><b>Concorrentes</b><p>{a.competitors||'Padrões observados nos concorrentes selecionados.'}</p></article><article><b>Clareza</b><p>{a.clarity||a.reason||'Leitura fácil e melhor compreensão da oferta.'}</p></article><article><b>Conversão</b><p>{a.conversion||'Impacto provável na decisão de compra, sem prometer vendas.'}</p></article></div></section>}

function BottomSummary({tab,before,after,analysis,blocked}){const priorities=arr(analysis?.priorities);const strengths=arr(analysis?.strengths);return <div className={styles.bottomGrid}><section><h3>◉ Velocímetro da categoria: {TAB_LABEL[tab]}</h3><div className={styles.gaugePair}><Gauge score={before} label="Atual"/><span>→</span><Gauge score={after} label={blocked?'Preservado':'Depois'}/></div><p>{blocked?'A sugestão com perda de nota foi descartada.':after!=null&&before!=null?`Impacto estimado: ${after-before>=0?'+':''}${Math.round(after-before)} pontos.`:'Sem estimativa de alteração.'}</p></section><section><h3>✓ Melhorias detectadas</h3>{priorities.length?<ul>{priorities.slice(0,5).map((x,i)=><li key={i}><b>{x.area}</b> · prioridade {x.priority}: {x.why}</li>)}</ul>:<p>Nenhuma prioridade adicional registrada.</p>}</section><section><h3>★ Pontos fortes para preservar</h3>{strengths.length?<ul>{strengths.slice(0,5).map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>O Gestor preserva o que já está funcionando bem.</p>}</section></div>}
