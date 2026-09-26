'use client';

import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import styles from './super-anuncio-mockup.module.css';
import ReminderButton from '../components/ReminderButton';
import SuperAnaliseInteligente from '../super-analise/SuperAnaliseInteligente';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>n(v)==null?'—':`${n(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const num=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const when=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');};
const flashWhen=v=>{const x=n(v);if(x==null)return'—';const d=new Date(x<1e12?x*1000:x);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;
const imageOf=p=>p?.imageUrl||p?.image_url||p?.imageUrls?.[0]||p?.image?.image_url_list?.[0]||null;
const competitorUrl=c=>c?.url||c?.link||c?.productUrl||c?.product_url||(c?.shopId&&c?.itemId?`https://shopee.com.br/product/${c.shopId}/${c.itemId}`:c?.shop_id&&c?.item_id?`https://shopee.com.br/product/${c.shop_id}/${c.item_id}`:null);
const competitorPrice=c=>{if(n(c?.price)!=null)return n(c.price);const m=String(c?.searchText||'').match(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/i);return m?Number(m[1].replace(/\./g,'').replace(',','.')):null};
const competitorSold=c=>{if(n(c?.sold)!=null)return n(c.sold);const m=String(c?.searchText||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*(mil)?\+?\s*Vendido/i);if(!m)return null;const base=Number(m[1].replace(',','.'));return Number.isFinite(base)?Math.round(base*(m[2]?1000:1)):null};
const imageCandidates=obj=>{const fields=[obj?.imageUrl,obj?.image_url,obj?.thumbnail,obj?.thumbnailUrl,obj?.cover,...arr(obj?.imageUrls),...arr(obj?.image_urls),...arr(obj?.images),...arr(obj?.image?.image_url_list)];const clean=[...new Set(fields.map(v=>typeof v==='string'?v:(v?.url||v?.image_url||v?.src||'')).map(v=>String(v||'').trim()).filter(Boolean).map(v=>/^https?:\/\//i.test(v)?v:(/^[A-Za-z0-9_-]{16,}$/.test(v)?`https://down-br.img.susercontent.com/file/${v}`:'')).filter(Boolean))].filter(u=>!/\.svg(?:\?|$)/i.test(u)&&!/productdetailspage/i.test(u));const score=u=>{let s=0;if(/down-br\.img\.susercontent\.com\/file\//i.test(u))s+=3;if(/\/br-11134207-/i.test(u))s+=8;if(/_tn(?:\?|$)/i.test(u))s-=5;if(/_cover(?:\?|$)/i.test(u))s-=6;return s};return clean.map((u,i)=>({u,i,s:score(u)})).sort((a,b)=>b.s-a.s||a.i-b.i).map(x=>x.u)};
const productTaskRequests=new Map();
async function fetchProductTasksOnce(itemId,{force=false}={}){
  const key=String(itemId||'');
  if(!key)return{tasks:[]};
  const now=Date.now(),cached=productTaskRequests.get(key);
  if(!force&&cached&&now-cached.createdAt<1500)return cached.promise;
  const promise=fetchJsonWithTimeout('/api/tasks?item_id='+encodeURIComponent(key),{cache:'no-store'},12000)
    .finally(()=>setTimeout(()=>{const current=productTaskRequests.get(key);if(current?.promise===promise)productTaskRequests.delete(key)},1500));
  productTaskRequests.set(key,{createdAt:now,promise});
  return promise;
}
const TABS=[
  ['overview','Visão geral','home'],
  ['ads','Shopee Ads','megaphone'],
  ['competitors','Concorrentes','users'],
  ['history','Histórico','clock']
];
const ATTRIBUTE_BLOCKS=[
  ['title','Título','file',['título','titulo']],
  ['description','Descrição','file',['descrição','descricao']],
  ['images','Imagens','image',['imagem']],
  ['video','Vídeo','play',['vídeo','video']],
  ['category','Categoria','tag',['categoria']],
  ['price','Preço','coins',['preço','preco','concorr']],
  ['variations','Atributos & Variações','grid',['atributo','varia']]
];

function missingKind(obj){
  const status=String(obj?.collectionStatus||obj?.collection_status||obj?.status||'').toLowerCase();
  if(obj?.collectionError||obj?.collection_error||obj?.error||status==='error')return'Erro de coleta';
  if(status==='not_integrated'||status==='unsupported')return'Não integrado';
  if(obj&&typeof obj==='object'&&Object.keys(obj).length)return'Sem dados';
  return'Não coletado';
}
function dataText(value,formatter,context){return n(value)!=null?formatter(value):missingKind(context)}
function countText(explicit,rows,context){
  if(n(explicit)!=null)return Number(explicit).toLocaleString('pt-BR');
  if(Array.isArray(rows)&&rows.length)return rows.length.toLocaleString('pt-BR');
  return missingKind(context);
}
function boolText(value,context){return value===true?'Sim':value===false?'Não':missingKind(context)}
function deltaPct(cur,prev){
  const a=n(cur),b=n(prev);
  if(a==null||b==null)return'—';
  if(b===0)return a===0?'0,0%':'—';
  const d=((a-b)/Math.abs(b))*100;
  return `${d>0?'+':''}${d.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
}
function attributeScore(report,terms){
  const row=arr(report?.report?.dimensions).find(x=>terms.some(t=>String(x?.name||'').toLowerCase().includes(t)));
  if(!row)return null;
  const score=n(row.score),max=n(row.maxScore)||100;
  if(score==null)return null;
  return Math.round(Math.max(0,Math.min(100,(score/max)*100)));
}
function attributeTone(score){
  if(score==null)return'gray';
  if(score>=85)return'green';
  if(score>=70)return'yellow';
  return'red';
}

function Icon({name,className=''}) {
  const common={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,className};
  switch(name){
    case 'home': return <svg {...common}><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.8V21h13V9.8"/><path d="M9.5 21v-6h5v6"/></svg>;
    case 'search': return <svg {...common}><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.3 4.3"/></svg>;
    case 'bell': return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
    case 'chevron': return <svg {...common}><path d="m9 10 3 3 3-3"/></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>;
    case 'megaphone': return <svg {...common}><path d="m3 11 13-5v12L3 13z"/><path d="M16 9.5c2 0 4-1.2 5-2.5v10c-1-1.3-3-2.5-5-2.5"/><path d="m6 14 1.4 5h3.4l-1.8-6"/></svg>;
    case 'tag': return <svg {...common}><path d="M20 13 13 20l-9-9V4h7z"/><circle cx="8.5" cy="8.5" r="1.2"/></svg>;
    case 'coins': return <svg {...common}><ellipse cx="12" cy="6" rx="6.5" ry="3"/><path d="M5.5 6v4c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V6"/><path d="M5.5 10v4c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-4"/><path d="M5.5 14v4c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-4"/></svg>;
    case 'chart': return <svg {...common}><path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/></svg>;
    case 'cart': return <svg {...common}><path d="M3 4h2l2.2 10h10.7l2.1-7H6"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/></svg>;
    case 'star': return <svg {...common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9z"/></svg>;
    case 'image': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m4 17 5-5 4 4 2-2 5 5"/></svg>;
    case 'play': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>;
    case 'grid': return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>;
    case 'bars': return <svg {...common}><path d="M5 20V11M12 20V5M19 20v-8"/></svg>;
    case 'refresh': return <svg {...common}><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-1.7-4.6L20 10"/></svg>;
    case 'trophy': return <svg {...common}><path d="M8 4h8v4c0 4-1.7 6-4 6s-4-2-4-6z"/><path d="M8 6H4v2c0 2 1.4 3.5 4.2 3.8M16 6h4v2c0 2-1.4 3.5-4.2 3.8M12 14v4M8 21h8M9 18h6"/></svg>;
    case 'sparkles': return <svg {...common}><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/><path d="m5 14 .7 1.8 1.8.7-1.8.7L5 19l-.7-1.8-1.8-.7 1.8-.7z"/></svg>;
    case 'users': return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c3.2-.3 5 1.5 5.5 4.5"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'lightbulb': return <svg {...common}><path d="M8.5 15.5c-1.6-1.1-2.5-2.9-2.5-5a6 6 0 1 1 12 0c0 2.1-.9 3.9-2.5 5-.8.6-1.1 1-1.2 1.5H9.7c-.1-.5-.4-.9-1.2-1.5"/><path d="M9.5 20h5M10 17v1h4v-1"/></svg>;
    case 'file': return <svg {...common}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>;
    case 'arrowUp': return <svg {...common}><path d="m5 12 7-7 7 7"/><path d="M12 5v14"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'trash': return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
  }
}

function ClockBadge(){
  const [now,setNow]=useState(null);
  useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer)},[]);
  let dateLabel='Carregando data…',timeLabel='—';
  if(now){
    const d=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(now).replace('.','');
    dateLabel=d.charAt(0).toUpperCase()+d.slice(1);
    timeLabel=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(now);
  }
  return <div className={styles.clockBadge}><Icon name="calendar"/><div><b>{dateLabel}</b><small>{timeLabel} • Horário de Brasília</small></div></div>;
}

function Gauge({score,label}){const s=n(score);const p=Math.max(0,Math.min(100,s??0));return <div className={styles.gaugeWrap}><div className={styles.gauge} style={{'--score':`${p*1.8}deg`}}><div><b>{s==null?'—':Math.round(s)}</b><small>/100</small></div></div><span>{label}</span></div>}
function ZoomModal({src,onClose}){useEffect(()=>{if(!src)return undefined;const onKey=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[src,onClose]);if(!src)return null;return <div className={styles.zoomModal} role="dialog" aria-modal="true" onClick={onClose}><button type="button" onClick={onClose}>×</button><img src={src} alt="Visualização ampliada" onClick={e=>e.stopPropagation()}/></div>}
function Metric({label,value,good,title,icon,tone='blue',primary=false}){return <div className={`${styles.metric} ${primary?styles.metricPrimary:styles.metricSecondary}`} title={title||''}><span className={styles.metricIcon} data-tone={tone}><Icon name={icon}/></span><small>{label}</small><b className={good?styles.good:''}>{value}</b></div>}
function Fact({label,value,icon,tone='blue'}){return <div className={styles.fact}><span className={styles.factIcon} data-tone={tone}><Icon name={icon}/></span><span className={styles.factText}><small>{label}</small><b>{value}</b></span></div>}
function PanelTitle({icon,title,subtitle,tone='blue'}){return <div className={styles.panelTitle}><span className={styles.panelIcon} data-tone={tone}><Icon name={icon}/></span><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div></div>}
function Reason({icon,title,children}){return <article><div className={styles.reasonGridTop}><Icon name={icon}/><b>{title}</b></div><p>{children}</p></article>}

// Margem abaixo deste valor (em %) é tratada como "apertada" na leitura em cadeia. Ajustável.
const MARGIN_TIGHT_PCT=10;
// ROAS mínimo para não ter prejuízo com Ads = 100 / margem% (margem líquida do produto antes dos anúncios).
function chainVerdict({cost,margin,roas}){
  const breakEven=margin!=null&&margin>0?100/margin:null;
  if(cost==null)return{tone:'amber',needCost:true,breakEven,text:'Sem o custo cadastrado não dá para calcular a margem nem o ROAS mínimo deste anúncio.'};
  if(margin==null)return{tone:'',needCost:false,breakEven,text:'O custo está registrado, mas a margem não pôde ser calculada (preço ou taxas não capturados).'};
  if(margin<=0)return{tone:'red',needCost:false,breakEven,text:'A margem é zero ou negativa: cada venda dá prejuízo antes mesmo dos anúncios. Revise preço ou custo antes de investir em Ads.'};
  if(roas==null)return{tone:'',needCost:false,breakEven,text:`Para não ter prejuízo com Ads, o ROAS precisa ficar acima de ${num(breakEven)}. Ainda não há ROAS coletado para comparar.`};
  if(roas>=breakEven*1.3)return{tone:'green',needCost:false,breakEven,text:`O ROAS ${num(roas)} está bem acima do mínimo de ${num(breakEven)}: há folga para testar uma meta de ROAS menor e vender mais.`};
  if(roas>=breakEven)return{tone:'amber',needCost:false,breakEven,text:`O ROAS ${num(roas)} está acima do mínimo de ${num(breakEven)}, mas com pouca folga. Mantenha a meta e acompanhe.`};
  return{tone:'red',needCost:false,breakEven,text:`O ROAS ${num(roas)} está abaixo do mínimo de ${num(breakEven)}: as vendas por Ads não cobrem o custo. Suba a meta de ROAS ou revise preço e custo.`};
}
function DecisionChain({steps,verdict,onRegisterCost}){
  return <section className={styles.chain} data-tone={verdict.tone} aria-label="Leitura do anúncio: custo, preço, margem, vendas e ROAS">
    <div className={styles.chainSteps}>{steps.map((s,i)=><Fragment key={s.label}>{i>0&&<span className={styles.chainArrow} aria-hidden="true">→</span>}<div className={styles.chainStep} data-tone={s.tone||''}><small>{s.label}</small><b>{s.value}</b>{s.note&&<em>{s.note}</em>}</div></Fragment>)}</div>
    <div className={styles.chainVerdict}><span className={styles.chainTag}>Leitura automática · estimativa</span><p>{verdict.text}</p>{verdict.needCost&&<button type="button" onClick={onRegisterCost}>Cadastrar custo</button>}</div>
  </section>;
}

export default function SuperAnuncioMockup({items=[],shopName='',initialItemId='',initialTab='overview'}){
  const initialSelected=items.find(x=>String(x.itemId)===String(initialItemId))||items[0]||null;
  const allowedTabs=useMemo(()=>new Set(TABS.map(([key])=>key)),[]);
  const [selectedId,setSelectedId]=useState(initialSelected?.itemId||'');
  const [tab,setTab]=useState(allowedTabs.has(initialTab)?initialTab:'overview');
  const [editorTab,setEditorTab]=useState(null);
  const [liveAds,setLiveAds]=useState({phase:'idle',campaign:null,error:''});
  const [flashSales,setFlashSales]=useState({phase:'idle',offers:[],scheduled:[],automation:null,planning:null,error:''});
  const [productTasks,setProductTasks]=useState({phase:'idle',rows:[],error:''});
  const [query,setQuery]=useState('');
  const [deleting,setDeleting]=useState(false);
  const [deleteError,setDeleteError]=useState('');
  const [zoomSrc,setZoomSrc]=useState('');
  const [searchMsg,setSearchMsg]=useState('');
  const [showList,setShowList]=useState(!initialItemId);
  const router=useRouter();
  const searchRef=useRef(null);
  const item=useMemo(()=>items.find(x=>String(x.itemId)===String(selectedId))||items[0]||null,[items,selectedId]);

  useEffect(()=>{
    const selected=items.find(x=>String(x.itemId)===String(initialItemId));
    if(selected)setSelectedId(selected.itemId);
    if(allowedTabs.has(initialTab))setTab(initialTab);
    if(['title','description','images','category','price','competitors'].includes(initialTab))setEditorTab(initialTab);
  },[items,initialItemId,initialTab,allowedTabs]);

  useEffect(()=>{
    const onKey=e=>{
      if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);

  async function loadLiveAds(targetItemId){
    if(!targetItemId)return;
    setLiveAds({phase:'loading',campaign:null,error:''});
    try{
      const data=await fetchJsonWithTimeout('/api/shopee/ads?days=30',{cache:'no-store'},18000);
      const root=data?.v7||data?.v5||{};
      const campaigns=arr(root.campaigns);
      const campaign=campaigns.find(x=>String(x.itemId||'')===String(targetItemId)||arr(x.itemIds).some(id=>String(id)===String(targetItemId)))||null;
      setLiveAds({phase:campaign?'success':'empty',campaign,error:''});
    }catch(error){
      console.error('[Super Anúncio] complemento Shopee Ads falhou',error);
      const kind=classifyAsyncError(error);
      setLiveAds({phase:kind,campaign:null,error:kind==='timeout'?'A consulta atual do Shopee Ads expirou.':String(error?.message||error)});
    }
  }

  async function loadFlashSales(targetItemId){
    if(!targetItemId)return;
    setFlashSales({phase:'loading',offers:[],scheduled:[],automation:null,planning:null,error:''});
    try{
      const data=await fetchJsonWithTimeout('/api/shopee/flash-sale?item_id='+encodeURIComponent(targetItemId),{cache:'no-store'},25000);
      const offers=arr(data?.activeOffers),scheduled=arr(data?.scheduledOffers);
      setFlashSales({
        phase:(offers.length||scheduled.length||data?.automation)?'success':'empty',
        offers,scheduled,automation:data?.automation||null,planning:data?.planning||null,error:''
      });
    }catch(error){
      console.error('[Super Anúncio] Ofertas Relâmpago falharam',error);
      const kind=classifyAsyncError(error);
      setFlashSales({phase:kind,offers:[],scheduled:[],automation:null,planning:null,error:kind==='timeout'?'A consulta das Ofertas Relâmpago expirou.':String(error?.message||error)});
    }
  }

  async function loadProductTasks(targetItemId,{force=false}={}){
    if(!targetItemId)return;
    setProductTasks({phase:'loading',rows:[],error:''});
    try{
      const data=await fetchProductTasksOnce(targetItemId,{force});
      const rows=arr(data?.tasks);
      setProductTasks({phase:rows.length?'success':'empty',rows,error:''});
    }catch(error){
      const kind=classifyAsyncError(error);
      setProductTasks({phase:kind,rows:[],error:kind==='timeout'?'A consulta das próximas ações expirou.':String(error?.message||error)});
    }
  }

  async function resolveProductTask(taskId,action='done',hours){
    try{
      await fetchJsonWithTimeout('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:taskId,action,hours})},12000);
      await loadProductTasks(item?.itemId,{force:true});
    }catch(error){console.error('[Super Anúncio] ação de tarefa falhou',error)}
  }

  useEffect(()=>{if(item?.itemId){loadLiveAds(item.itemId);loadFlashSales(item.itemId);loadProductTasks(item.itemId)}},[item?.itemId]);

  async function deleteAnalysis(){
    if(!item?.itemId||deleting)return;
    const title=item.latest?.product_snapshot?.title||item.latest?.product_snapshot?.item_name||`Produto ${item.itemId}`;
    const ok=window.confirm(`Excluir todas as análises e o agendamento salvos de "${title}"? Esta ação não pode ser desfeita.`);
    if(!ok)return;
    setDeleting(true);setDeleteError('');
    try{
      await fetchJsonWithTimeout('/api/extension-intelligence/reports',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:item.itemId}),cache:'no-store'},15000);
      location.href='/extensao-shopee-intelligence?section=super-anuncio';
    }catch(error){
      console.error('[Super Anúncio] exclusão falhou',error);
      const kind=classifyAsyncError(error);
      setDeleteError(kind==='timeout'?'A exclusão demorou demais. Tente novamente.':String(error?.message||error));
      setDeleting(false);
    }
  }

  function searchProduct(e){
    e?.preventDefault?.();
    const q=query.trim().toLowerCase();
    if(!q)return;
    const found=items.find(x=>{
      const row=x.latest?.product_snapshot||{};
      return String(row.title||row.item_name||x.itemId||'').toLowerCase().includes(q);
    });
    if(found){setSelectedId(found.itemId);setTab('overview');setEditorTab(null);setSearchMsg('');setShowList(false)}
    else setSearchMsg(`Nenhum anúncio acompanhado corresponde a "${query.trim()}".`);
  }

  if(!item)return <div className={styles.screen}><main className={styles.empty}><h1>Super Anúncio</h1><p>Nenhum anúncio analisado ainda. Comece em Produtos → Enviar para Super Análise.</p></main></div>;

  if(showList){
    const ranked=[...items].sort((a,b)=>{
      const ar=n(a.latest?.score),br=n(b.latest?.score);
      const aa=n(a.latest?.report?.ai_analysis?.afterScore),ba=n(b.latest?.report?.ai_analysis?.afterScore);
      const ag=(aa!=null&&ar!=null)?aa-ar:0,bg=(ba!=null&&br!=null)?ba-br:0;
      return bg-ag||(ar??999)-(br??999);
    });
    return <div className={styles.screen}><main className={styles.main}>
      <section className={styles.phase1Header}>
        <div><span className={styles.heroIcon}><Icon name="megaphone"/></span><div><h1>Super Anúncio</h1><p>Anúncios que já passaram pela Super Análise. Comece pelos que têm maior oportunidade de melhoria.</p></div></div>
        <Link href="/produtos" className={styles.followBtn}><Icon name="plus"/> Nova análise</Link>
      </section>
      <section className={styles.phase1Filters}>
        <div className={styles.phase1Search}><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar anúncio analisado..."/></div>
        <span>{ranked.length} anúncio{ranked.length===1?'':'s'} analisado{ranked.length===1?'':'s'}</span>
      </section>
      <section className={styles.phase1List}>
        {ranked.filter(x=>{const q=query.trim().toLowerCase();if(!q)return true;const pp=x.latest?.product_snapshot||{};return String(pp.title||pp.item_name||x.itemId).toLowerCase().includes(q)}).map((x,i)=>{
          const rr=x.latest||{},pp=rr.product_snapshot||{},sc=n(rr.score),pot=n(rr.report?.ai_analysis?.afterScore);
          const safePot=pot==null?sc:(sc==null?pot:Math.max(sc,pot));
          const gain=sc!=null&&safePot!=null?Math.round(safePot-sc):null;
          const dims=arr(rr.report?.dimensions),weak=[...dims].sort((a,b)=>(n(a.score)??999)-(n(b.score)??999))[0];
          const priority=(gain??0)>=25?'Alta':(gain??0)>=10?'Média':'Acompanhar';
          return <article key={x.itemId} className={styles.phase1Row}>
            {imageOf(pp)?<img src={imageOf(pp)} alt=""/>:<div className={styles.phase1NoImage}><Icon name="image"/></div>}
            <div className={styles.phase1Identity}><b>{pp.title||pp.item_name||`Produto ${x.itemId}`}</b><small>Última análise: {when(rr.analyzed_at)}</small><span data-priority={priority}>{priority==='Alta'?'Prioridade alta':priority}</span></div>
            <div className={styles.phase1Stat}><small>Nota atual</small><b>{sc==null?'—':Math.round(sc)}</b></div>
            <div className={styles.phase1Stat} data-potential="true"><small>Potencial</small><b>{safePot==null?'—':Math.round(safePot)}</b><em>{gain==null?'Sem projeção':gain>0?`+${gain} pts`:'Sem ganho projetado'}</em></div>
            <div className={styles.phase1Problem}><small>Principal ponto</small><b>{weak?.name||'Sem diagnóstico'}</b></div>
            <button type="button" className={styles.phase1Open} onClick={()=>{setSelectedId(x.itemId);setShowList(false);setTab('overview');setEditorTab(null)}}>Abrir análise <span>→</span></button>
          </article>
        })}
      </section>
    </main></div>;
  }

  const r=item.latest||{},prev=item.previous||{},p=r.product_snapshot||{},f=r.finance_snapshot||{},ai=r.report?.ai_analysis||{};
  const price=n(metric(r,'price')??p.price??p.currentPrice);
  const cost=n(f.productCost??p.referenceCost);
  const margin=n(f.marginPct);
  const sold=n(metric(r,'sold')??p.sold);
  const rating=n(p.rating??metric(r,'rating'));
  const reviews=n(p.reviewCount??p.ratingCount??metric(r,'reviewCount'));
  const images=arr(p.imageUrls||p.image?.image_url_list);
  const variations=arr(p.models||p.variations);
  const competitors=arr(r.competitors).slice(0,3);
  const score=n(r.score);
  const afterScore=n(ai.afterScore);
  const safeAfterScore=afterScore==null?score:(score==null?afterScore:Math.max(score,afterScore));
  const gain=score!=null&&safeAfterScore!=null?Math.round(safeAfterScore-score):null;
  const prevPrice=n(metric(prev,'price')??prev?.product_snapshot?.price);
  const prevSold=n(metric(prev,'sold')??prev?.product_snapshot?.sold);
  const historicalAds=r.ads_snapshot&&Object.keys(r.ads_snapshot).length?r.ads_snapshot:null;
  const liveCampaign=liveAds.campaign;
  const adsContext=historicalAds||liveCampaign||(liveAds.phase==='error'||liveAds.phase==='timeout'?{collectionError:liveAds.error}:liveAds.phase==='empty'?{collectionStatus:'success'}:null);
  const pickAds=(historyKey,liveKey=historyKey)=>metric(r,historyKey)??liveCampaign?.[liveKey]??null;
  const ads=[['ROAS atual',dataText(pickAds('roas'),num,adsContext)],['ROAS alvo',dataText(pickAds('targetRoas'),num,adsContext)],['Gasto Ads',dataText(pickAds('spend'),money,adsContext)],['GMV',dataText(pickAds('gmv'),money,adsContext)],['Custo por venda',dataText(metric(r,'cpa')??liveCampaign?.costPerOrder??(n(metric(r,'sales'))?n(metric(r,'spend'))/n(metric(r,'sales')):null),money,adsContext)],['CTR',dataText(pickAds('ctr'),pct,adsContext)]];
  const roasNow=n(pickAds('roas')),roasTarget=n(pickAds('targetRoas'));
  const verdict=chainVerdict({cost,margin,roas:roasNow});
  const chainSteps=[
    {label:'Custo',value:dataText(cost,money,f),tone:''},
    {label:'Preço de venda',value:dataText(price,money,p),tone:''},
    {label:'Margem',value:dataText(margin,pct,f),tone:margin==null?'':margin<=0?'red':margin<MARGIN_TIGHT_PCT?'amber':'green',note:margin!=null&&margin>0&&margin<MARGIN_TIGHT_PCT?'apertada':''},
    {label:'Vendas',value:dataText(sold,v=>Number(v).toLocaleString('pt-BR'),p),tone:''},
    {label:'ROAS atual',value:dataText(roasNow,num,adsContext),tone:roasNow!=null&&verdict.breakEven!=null?(roasNow>=verdict.breakEven*1.3?'green':roasNow>=verdict.breakEven?'amber':'red'):'',note:[verdict.breakEven!=null?`mínimo ${num(verdict.breakEven)}`:'',roasTarget!=null?`meta ${num(roasTarget)}`:''].filter(Boolean).join(' · ')}
  ];
  const sku=p.item_sku||p.itemSku||p.sku||null;
  const statusText=p.status||p.item_status||'';
  const active=/active|normal|ativo/i.test(String(statusText));

  return <div className={styles.screen}>
    <ZoomModal src={zoomSrc} onClose={()=>setZoomSrc('')}/>
    <main className={styles.main}>
      <div className={styles.topbar}>
        <div className={styles.breadcrumb}><Icon name="home"/><span>›</span><b>Super Anúncio</b></div>
        <div className={styles.topTools}>
          <form className={styles.searchBox} onSubmit={searchProduct}>
            <Icon name="search"/>
            <input ref={searchRef} value={query} onChange={e=>{setQuery(e.target.value);setSearchMsg('')}} placeholder="Buscar anúncio acompanhado..." aria-label="Buscar anúncio acompanhado"/>
            <kbd>Ctrl + K</kbd>
          </form>
          <button type="button" className={styles.notify} aria-label="Ver prioridades e pendências" title="Ver prioridades e pendências" onClick={()=>router.push('/extensao-shopee-intelligence?section=prioridades')}><Icon name="bell"/>{arr(productTasks.rows).length>0&&<i/>}</button>
          <div className={styles.account}><span className={styles.avatar}>GS</span><div><b>Gestor Sênior</b><small>Minha conta</small></div><Icon name="chevron"/></div>
        </div>
      </div>

      {searchMsg&&<div className={styles.searchMsg} role="status">{searchMsg}<Link href="/produtos">Acompanhar outro anúncio</Link></div>}

      <section className={styles.hero}>
        <div className={styles.heroTitle}><span className={styles.heroIcon}><Icon name="megaphone"/></span><div><div className={styles.heroHeading}><h1>Super Anúncio</h1><div className={styles.scoreCompact}><b>{score==null?'—':Math.round(score)}</b><span>→</span><b>{safeAfterScore==null?'—':Math.round(safeAfterScore)}</b><em>{gain==null?'Sem projeção':gain>0?`+${gain} pts`:'sem perda'}</em><small>Nota geral</small></div></div><p>Acompanhe o anúncio, histórico, concorrentes e descubra oportunidades para vender mais na Shopee.</p></div></div>
        <ClockBadge/>
      </section>

      <section className={styles.productBar}>
        {imageOf(p)?<button type="button" className={styles.productImageButton} onClick={()=>setZoomSrc(imageOf(p))} title="Ampliar imagem"><img src={imageOf(p)} alt=""/><span>⌕</span></button>:<div className={styles.noImage}/>}
        <div className={styles.productInfo}>
          <span className={styles.sourceBadge}>Anúncio acompanhado</span>
          <b>{p.title||p.item_name||`Produto ${item.itemId}`}</b>
          <small>Categoria: {p.category||missingKind(p)}</small>
          <div className={styles.productMeta}>
            <span>Loja: <strong>{shopName||'Loja conectada'}</strong></span>
            <span>SKU: <strong>{sku||'não coletado'}</strong></span>
            <span className={styles.statusPill} data-active={active?'true':'false'}>{statusText||'Status não coletado'}</span>
          </div>
        </div>
        <div className={styles.metrics}>
          <Metric label="Preço" value={dataText(price,money,p)} icon="tag" primary/>
          <Metric label="Custo" value={dataText(cost,money,f)} icon="coins" tone="amber" primary/>
          <Metric label="Margem estimada" value={dataText(margin,pct,f)} good={margin!=null&&margin>=0} icon="chart" tone="green" primary/>
          <Metric label="Vendas" value={dataText(sold,v=>Number(v).toLocaleString('pt-BR'),p)} icon="cart" tone="purple" primary/>
          <Metric label="Avaliação" value={dataText(rating,v=>`${Number(v).toFixed(1)} ★`,p)} title={reviews!=null?`${reviews.toLocaleString('pt-BR')} avaliações`:missingKind(p)} icon="star" tone="gold"/>
          <Metric label="Fotos" value={countText(p.imageCount,images,p)} icon="image"/>
          <Metric label="Vídeo" value={boolText(p.hasVideo,p)} icon="play" tone="pink"/>
          <Metric label="Variações" value={countText(p.variationCount,variations,p)} icon="grid" tone="slate"/>
        </div>
      </section>

      <DecisionChain steps={chainSteps} verdict={verdict} onRegisterCost={()=>setEditorTab('price')}/>

      <section className={styles.selector}>
        <div className={styles.selectorGroup}>
          <div className={styles.selectorField}><small>Anúncio atual</small><select value={selectedId} onChange={e=>{setSelectedId(e.target.value);setTab('overview');setEditorTab(null)}}>{items.map(x=><option key={x.itemId} value={x.itemId}>{x.latest?.product_snapshot?.title||x.latest?.product_snapshot?.item_name||`Produto ${x.itemId}`}</option>)}</select></div>
        </div>
        <div className={styles.selectorActions}>
          <Link href="/produtos" className={styles.followBtn}><Icon name="plus"/> Acompanhar outro anúncio</Link>
        </div>
      </section>
      {deleteError&&<div className={styles.deleteError}>{deleteError}</div>}

      <div id="gs-editor-toolbar" className={styles.toolbarSlot}/>

      <nav className={styles.phase2Tabs} aria-label="Áreas do Super Anúncio">
        <button type="button" data-active={!editorTab&&tab!=='history'?'true':'false'} onClick={()=>{setTab('overview');setEditorTab(null)}}><Icon name="home"/> Resumo</button>
        <button type="button" data-active={editorTab==='title'||editorTab==='description'||editorTab==='category'?'true':'false'} onClick={()=>{setTab('overview');setEditorTab('title')}}><Icon name="file"/> Conteúdo</button>
        <button type="button" data-active={editorTab==='images'?'true':'false'} onClick={()=>{setTab('overview');setEditorTab('images')}}><Icon name="image"/> Imagens</button>
        <button type="button" data-active={editorTab==='competitors'?'true':'false'} onClick={()=>{setTab('competitors');setEditorTab('competitors')}}><Icon name="users"/> Concorrentes</button>
        <button type="button" data-active={editorTab==='price'?'true':'false'} onClick={()=>{setTab('overview');setEditorTab('price')}}><Icon name="coins"/> Preço</button>
        <button type="button" data-active={tab==='history'?'true':'false'} onClick={()=>{setTab('history');setEditorTab(null)}}><Icon name="clock"/> Histórico</button>
      </nav>

      <div className={styles.workspace}>
        <section className={styles.content}>
          {!editorTab&&tab!=='history'&&<><Overview item={item} price={price} prevPrice={prevPrice} sold={sold} prevSold={prevSold} margin={margin} ai={ai} flashSales={flashSales} productTasks={productTasks} onTaskAction={resolveProductTask} onReloadTasks={()=>loadProductTasks(item.itemId,{force:true})} onReloadFlash={()=>loadFlashSales(item.itemId)} onOpenPrice={()=>setEditorTab('price')}/><BottomCards item={item} competitors={competitors} score={score} afterScore={safeAfterScore}/></>}
          {tab==='history'&&<HistoryPanel history={item.history||[r]}/>}
          {editorTab==='competitors'&&<CompetitorsPanel competitors={competitors} collectedAt={r.analyzed_at} onZoom={setZoomSrc}/>}
          {editorTab&&editorTab!=='competitors'&&<div className={styles.inlineEditor}><SuperAnaliseInteligente report={r} products={[]} initialTab={editorTab} embedded/></div>}
        </section>
      </div>
      <section className={styles.manageZone}><span>Gerenciar análise deste anúncio</span><button type="button" className={styles.deleteBtn} onClick={deleteAnalysis} disabled={deleting}><Icon name="trash"/>{deleting?'Excluindo…':'Excluir análises'}</button></section>
    </main>
  </div>;
}

function Overview({item,price,prevPrice,sold,prevSold,margin,ai,flashSales,productTasks,onTaskAction,onReloadTasks,onReloadFlash,onOpenPrice}){
  const r=item.latest||{};
  return <><section className={styles.compare}>
    <article className={`${styles.panel} ${styles.overviewPanel}`}>
      <div className={styles.panelHead}><PanelTitle icon="bars" title="Retrato atual do anúncio" subtitle="Principais métricas coletadas no último monitoramento."/><span>Atual</span></div>
      <div className={styles.bigFacts}>
        <Fact label="Preço atual" value={money(price)} icon="tag"/>
        <Fact label="Vendas acumuladas" value={sold?.toLocaleString('pt-BR')||'—'} icon="cart"/>
        <Fact label="Margem estimada" value={pct(margin)} icon="chart" tone="green"/>
        <Fact label="Última coleta" value={when(r.analyzed_at)} icon="calendar"/>
      </div>
    </article>
    <article className={`${styles.panel} ${styles.overviewPanel}`}>
      <div className={styles.panelHead}><PanelTitle icon="refresh" title="Comparação com a análise anterior" subtitle="Veja como o anúncio evoluiu em relação à última análise."/><span>Histórico</span></div>
      <div className={styles.changeList}>
        <div><Icon name="tag"/><span>Preço</span><b>{prevPrice==null?'Sem comparação (só 1 coleta)':`${money(prevPrice)} → ${money(price)}`}</b><em>{deltaPct(price,prevPrice)}</em></div>
        <div><Icon name="chart"/><span>Vendas</span><b>{prevSold==null?'Sem comparação (só 1 coleta)':`${prevSold.toLocaleString('pt-BR')} → ${sold?.toLocaleString('pt-BR')||'—'}`}</b><em>{deltaPct(sold,prevSold)}</em></div>
        <div><Icon name="calendar"/><span>Próxima rechecagem</span><b>{when(item.schedule?.next_run_at||r.next_reanalysis_at)}</b><em> </em></div>
        <div><Icon name="sparkles"/><span>IA</span><b>{ai?.afterScore!=null?'Sugestões disponíveis':'Sem nova projeção'}</b><em>›</em></div>
      </div>
    </article>
  </section>
  <FlashSaleCard state={flashSales} itemId={item.itemId} onReload={onReloadFlash} onOpenPrice={onOpenPrice}/>
  <NextActionsCard state={productTasks} itemId={item.itemId} onAction={onTaskAction} onReload={onReloadTasks}/>
  <section className={styles.explain}>
    <div className={styles.explainHead}><span className={styles.panelIcon}><Icon name="file"/></span><div><h2>Resumo do acompanhamento</h2><p className={styles.sub}>Visão consolidada das principais informações e recomendações.</p></div></div>
    <div className={styles.reasonGrid}>
      <Reason icon="tag" title="Preço">Acompanhe mudanças de preço entre as coletas e compare.</Reason>
      <Reason icon="megaphone" title="Ads">ROAS, metas, gastos, GMV e custo por venda da Shopee Ads.</Reason>
      <Reason icon="users" title="Concorrentes">Concorrentes vinculados para comparação ao longo do tempo.</Reason>
      <Reason icon="sparkles" title="Super Análise">IA identifica oportunidades com base nos dados atuais.</Reason>
      <Reason icon="chart" title="Margem">Preço e custo registrados são usados para acompanhar a margem.</Reason>
    </div>
  </section></>;
}

function NextActionsCard({state,itemId,onAction,onReload}){
  const rows=arr(state?.rows);
  const loading=state?.phase==='loading';
  const failed=state?.phase==='error'||state?.phase==='timeout';
  const priorityLabel={urgent:'Urgente',high:'Alta',medium:'Média',low:'Baixa'};
  const typeLabel={flash_sale:'Oferta Relâmpago',reanalysis:'Reanálise',competitors:'Concorrentes',images:'Imagens',video:'Vídeo',ads:'Shopee Ads',other:'Tarefa'};
  const dueText=v=>{if(!v)return'Sem prazo';const d=new Date(v);if(Number.isNaN(d.getTime()))return'Sem prazo';return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};
  return <section className={styles.nextActionsCard}>
    <div className={styles.nextActionsHead}><div><span>☷</span><div><h2>Próximas ações deste anúncio</h2><p>Lembretes e pendências em ordem de prioridade.</p></div></div><button type="button" onClick={onReload} disabled={loading}>↻ {loading?'Atualizando…':'Atualizar'}</button></div>
    {failed?<div className={styles.flashError}>{state.error||'Não foi possível carregar as próximas ações.'}<button type="button" onClick={onReload}>Tentar novamente</button></div>:null}
    {!failed&&loading?<div className={styles.flashEmpty}>Carregando próximas ações…</div>:null}
    {!failed&&!loading&&!rows.length?<div className={styles.flashEmpty}>Nenhuma pendência aberta para este anúncio agora. <ReminderButton itemId={itemId} taskType="other" title="Revisar anúncio" description="Revisar este anúncio no Gestor Sênior." actionUrl={'/extensao-shopee-intelligence?section=super-anuncio&item_id='+itemId} label="🔔 Criar lembrete"/></div>:null}
    {!failed&&!loading&&rows.length?<div className={styles.nextActionsList}>{rows.slice(0,6).map(t=><article key={t.id} data-priority={t.priority}>
      <i/>
      <div><div className={styles.nextActionMeta}><span>{typeLabel[t.task_type]||'Tarefa'}</span><em>{priorityLabel[t.priority]||'Média'}</em></div><b>{t.title}</b><p>{t.description||'Tarefa pendente.'}</p><small>Prazo: {dueText(t.due_at)}</small></div>
      <div className={styles.nextActionButtons}>{t.action_url&&<Link href={t.action_url}>Resolver agora</Link>}<button type="button" onClick={()=>onAction?.(t.id,'snooze',24)}>Amanhã</button><button type="button" onClick={()=>onAction?.(t.id,'done')}>Concluir</button></div>
    </article>)}</div>:null}
  </section>;
}

function FlashSaleCard({state,itemId,onReload,onOpenPrice}){
  const offers=arr(state?.offers);
  const scheduled=arr(state?.scheduled);
  const automation=state?.automation||null;
  const planning=state?.planning||null;
  const loading=state?.phase==='loading';
  const failed=state?.phase==='error'||state?.phase==='timeout';
  const total=offers.length+scheduled.length;
  const coverage=n(planning?.coverage_until);
  const activeEnd=offers.length?Math.max(...offers.map(x=>n(x?.end_time)||0)):null;
  const automationEnabled=automation?.enabled===true;

  let attentionTitle='Sem oferta futura agendada';
  let attentionText='Este produto precisa de atenção: vale programar a próxima Oferta Relâmpago.';
  let attentionTone='warn';
  if(automationEnabled){
    attentionTitle='Automação cuidando das próximas ofertas';
    attentionText=automation?.next_run_at?('Próxima verificação automática: '+when(automation.next_run_at)+'.'):'A automação está ativa e fará a próxima verificação em segundo plano.';
    attentionTone='auto';
  }else if(scheduled.length&&coverage){
    attentionTitle='Cobertura futura já programada';
    attentionText='Você já possui Oferta Relâmpago agendada até '+flashWhen(coverage)+'. Depois dessa data, programe a próxima.';
    attentionTone='ok';
  }else if(offers.length&&activeEnd){
    attentionTitle='Oferta ativa, mas sem próxima agendada';
    attentionText='A oferta atual termina em '+flashWhen(activeEnd)+'. Programe a próxima antes desse horário.';
    attentionTone='warn';
  }

  const renderOffer=(offer,i,kind)=>{
    const priceMin=n(offer.price),priceMax=n(offer.max_price),stock=n(offer.stock);
    const priceText=priceMin==null?'Não informado':priceMax!=null&&priceMax!==priceMin?(money(priceMin)+' a '+money(priceMax)):money(priceMin);
    return <article key={(kind||'offer')+'-'+(offer.flash_sale_id||i)} className={kind==='scheduled'?styles.flashScheduledRow:''}>
      <div className={kind==='scheduled'?styles.flashScheduled:styles.flashLive}><i/>{kind==='scheduled'?' AGENDADA':' ATIVA AGORA'}</div>
      <div className={styles.flashField}><small>Período</small><b>{flashWhen(offer.start_time)}</b><span>até {flashWhen(offer.end_time)}</span></div>
      <div className={styles.flashField}><small>Preço da oferta</small><b>{priceText}</b>{offer.variation_count>1&&<span>{offer.variation_count} variações</span>}</div>
      <div className={styles.flashField}><small>Estoque da oferta</small><b>{stock==null?'—':stock.toLocaleString('pt-BR')}</b><span>unidades disponíveis na oferta</span></div>
      <button type="button" className={styles.flashInlineLink} onClick={onOpenPrice}>Ver preço e oferta ↗</button>
    </article>;
  };

  return <section className={styles.flashActiveCard}>
    <div className={styles.flashActiveHead}>
      <div><span className={styles.flashBolt}>⚡</span><div><h2>Ofertas Relâmpago do produto</h2><p>Veja o que está ativo, o que já está agendado e quando será preciso se preocupar novamente.</p></div></div>
      <div className={styles.flashHeadActions}><span data-live={total?'true':'false'}>{offers.length} ativa{offers.length===1?'':'s'} · {scheduled.length} futura{scheduled.length===1?'':'s'}</span><button type="button" onClick={onReload} disabled={loading}>↻ {loading?'Atualizando…':'Atualizar'}</button></div>
    </div>

    <div className={styles.flashAttention} data-tone={attentionTone}>
      <span>{attentionTone==='ok'?'✓':attentionTone==='auto'?'🤖':'!'}</span>
      <div><b>{attentionTitle}</b><p>{attentionText}</p></div>
      <span className={styles.flashAttentionActions}>
        {!automationEnabled&&<button type="button" onClick={onOpenPrice}>{scheduled.length?'Planejar próxima':'Agendar agora'} ↗</button>}
        <ReminderButton itemId={itemId} taskType="flash_sale" priority={scheduled.length?'medium':'high'} title="Criar próxima Oferta Relâmpago" description={scheduled.length&&coverage?('Revisar a próxima Oferta Relâmpago deste produto. Cobertura atual até '+flashWhen(coverage)+'.'):'Programar uma nova Oferta Relâmpago para este produto.'} actionUrl={'/extensao-shopee-intelligence?section=super-anuncio&item_id='+itemId} label="🔔 Lembrar depois"/>
      </span>
    </div>

    {failed?<div className={styles.flashError}>{state.error||'Não foi possível consultar as ofertas.'}<button type="button" onClick={onReload}>Tentar novamente</button></div>:null}
    {!failed&&loading?<div className={styles.flashEmpty}>Consultando Ofertas Relâmpago do produto na Shopee…</div>:null}

    {!failed&&!loading&&offers.length?<><div className={styles.flashSectionTitle}><b>Ativa agora</b><span>{offers.length}</span></div><div className={styles.flashOfferList}>{offers.map((offer,i)=>renderOffer(offer,i,'active'))}</div></>:null}

    {!failed&&!loading&&scheduled.length?<><div className={styles.flashSectionTitle}><b>Próximas ofertas agendadas</b><span>{scheduled.length}</span></div><div className={styles.flashOfferList}>{scheduled.map((offer,i)=>renderOffer(offer,i,'scheduled'))}</div></>:null}

    {!failed&&!loading&&!offers.length&&!scheduled.length?<div className={styles.flashEmpty}>Nenhuma Oferta Relâmpago ativa ou futura foi encontrada para este produto. <button type="button" className={styles.flashInlineLink} onClick={onOpenPrice}>Criar oferta ↗</button></div>:null}

    {!failed&&!loading&&automation?<div className={styles.flashAutomationSummary}>
      <b>🤖 Automação {automationEnabled?'ativa':'desativada'}</b>
      <span>Preço configurado: {money(automation.promo_price)} · estoque: {n(automation.stock)?.toLocaleString('pt-BR')||'—'} · intervalo mínimo: {n(automation.min_gap_hours)||'—'}h</span>
      {automationEnabled&&automation.next_run_at&&<span>Próxima checagem: {when(automation.next_run_at)}</span>}
    </div>:null}
  </section>;
}

function AdsPanel({ads,liveAds,onRetry,hasHistorical}){
  const liveState=liveAds?.phase;
  return <section className={styles.panel}>
    <div className={styles.panelHead}><PanelTitle icon="megaphone" title="Shopee Ads" subtitle="Desempenho e eficiência das campanhas vinculadas."/><span>{hasHistorical&&liveState==='success'?'Histórico + atual':hasHistorical?'Dados salvos':liveState==='success'?'Dados atuais':'Fonte de Ads'}</span></div>
    <p className={styles.dataLegend}>“Não coletado” = a rodada não trouxe essa fonte. “Não integrado” = fonte sem suporte. “Sem dados” = a fonte respondeu, mas não trouxe o campo. “Erro de coleta” = houve falha registrada.</p>
    {liveState==='loading'&&<p className={styles.dataLegend}>Consultando a fonte atual do Shopee Ads para complementar campos ausentes…</p>}
    {(liveState==='error'||liveState==='timeout')&&<div className={styles.dataError}>{liveAds.error}<button type="button" onClick={onRetry}>Tentar novamente</button></div>}
    <div className={styles.adsGrid}>{ads.map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div>
  </section>;
}

function AnalysisPanel({report,ai}){
  const dims=arr(report?.report?.dimensions);
  return <section className={styles.panel}>
    <div className={styles.panelHead}><PanelTitle icon="sparkles" title="Última Super Análise" subtitle="Critérios, notas e prioridades da rodada atual."/><span>{when(report?.analyzed_at)}</span></div>
    <div className={styles.analysisGrid}>{dims.length?dims.map((d,i)=><div key={i}><span>{d.name||`Critério ${i+1}`}</span><b>{n(d.score)==null?'—':`${d.score}/${d.maxScore||100}`}</b></div>):<p className={styles.muted}>Sem notas detalhadas registradas nesta rodada.</p>}</div>
    {ai?.priorities?.length?<div className={styles.priorityBox}><b>Prioridades detectadas pela IA</b>{ai.priorities.slice(0,5).map((x,i)=><p key={i}>• {x.area||'Melhoria'}: {x.why||x.reason||''}</p>)}</div>:null}
  </section>;
}

function CompetitorsPanel({competitors,collectedAt,onZoom}){
  return <section className={styles.panel}>
    <div className={styles.panelHead}><PanelTitle icon="users" title="Concorrentes vinculados" subtitle="Compare imagem, preço, vendas e abra o anúncio real."/><span>{competitors.length} de até 3</span></div>
    <div className={styles.competitors}>{competitors.length?competitors.map((c,i)=>{
      const urls=imageCandidates(c),url=competitorUrl(c),price=competitorPrice(c),sold=competitorSold(c);
      return <article key={i}>
        {urls[0]?<button type="button" className={styles.compImageButton} onClick={()=>onZoom?.(urls[0])} title="Ampliar imagem"><img src={urls[0]} alt=""/><span>⌕</span></button>:<div className={styles.noComp}>Imagem não coletada</div>}
        <div>{url?<a className={styles.compTitle} href={url} target="_blank" rel="noreferrer">{c.title||`Concorrente ${i+1}`} ↗</a>:<b>{c.title||`Concorrente ${i+1}`}</b>}<small><strong>{money(price)}</strong> · <strong>{sold==null?'—':sold.toLocaleString('pt-BR')}</strong> vendidos · {dataText(c.rating,v=>Number(v).toFixed(1)+'★',c)}</small><small>Coleta: {when(c.collectedAt||c.collected_at||collectedAt)}</small><p>{c.description?String(c.description).slice(0,170):missingKind(c)}</p></div>
      </article>
    }):<p className={styles.muted}>Nenhum concorrente foi coletado/vinculado nesta análise.</p>}</div>
  </section>;
}

function HistoryPanel({history=[]}){
  return <section className={styles.panel}>
    <div className={styles.panelHead}><PanelTitle icon="clock" title="Histórico completo de análises" subtitle="Todas as rodadas preservadas para comparação."/><span>{history.length} rodada{history.length===1?'':'s'}</span></div>
    <div className={styles.history}>{history.map((r,i)=><article key={r.id||i}><div><b>{when(r.analyzed_at)}</b><small>Relatório {r.id||'—'}</small></div><Gauge score={r.score} label={i===0?'Atual':`Rodada ${history.length-i}`}/><span>{money(metric(r,'price')??r.product_snapshot?.price)}</span></article>)}</div>
  </section>;
}

function VariationsPanel({variations=[],costs=[],product={}}){
  const cm=new Map(costs.map(x=>[String(x.modelId??x.model_id),n(x.cost)]));
  const explicit=n(product?.variationCount);
  const emptyText=explicit===0?'0 variações — a coleta registrou explicitamente que o anúncio não possui variações.':`${missingKind(product)}: nenhuma estrutura de variações foi salva nesta rodada.`;
  return <section className={styles.panel}>
    <div className={styles.panelHead}><PanelTitle icon="grid" title="Atributos & Variações" subtitle="Preço, custo e estoque por opção do anúncio."/><span>{variations.length?variations.length:explicit===0?'0':'—'} variações</span></div>
    {variations.length?<div className={styles.variationTable}><div><b>Variação</b><b>Preço</b><b>Custo</b><b>Estoque</b></div>{variations.map((v,i)=>{const id=String(v.modelId??v.model_id??v.id??i);return <div key={id}><span>{v.name||v.model_name||`Variação ${i+1}`}</span><span>{dataText(v.price??v.currentPrice,money,v)}</span><span>{dataText(v.cost??cm.get(id),money,v)}</span><span>{dataText(v.stock??v.normal_stock,x=>Number(x).toLocaleString('pt-BR'),v)}</span></div>})}</div>:<p className={styles.muted}>{emptyText}</p>}
  </section>;
}

function BottomCards({item,competitors,score,afterScore}){
  const latest=item.latest||{},prev=item.previous||{};
  const price=n(metric(latest,'price')??latest.product_snapshot?.price),old=n(metric(prev,'price')??prev.product_snapshot?.price);
  return <div className={styles.bottom}>
    <section><h3><Icon name="bars"/> Nota e potencial</h3><div className={styles.gaugePair}><Gauge score={score} label="Atual"/><span>→</span><Gauge score={afterScore} label="Com sugestões"/></div></section>
    <section><h3><Icon name="refresh"/> Mudanças recentes</h3><p>Preço: {old==null?'sem comparação':`${money(old)} → ${money(price)}`}</p><p>Última análise: {when(latest.analyzed_at)}</p><p>Próxima rechecagem: {when(item.schedule?.next_run_at||latest.next_reanalysis_at)}</p></section>
    <section><h3><Icon name="users"/> Monitoramento competitivo</h3><p>{competitors.length} concorrente{competitors.length===1?'':'s'} vinculado{competitors.length===1?'':'s'}.</p><p>Os snapshots apresentam preço, vendas e demais dados capturados em cada coleta.</p></section>
  </div>;
}
