'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import styles from './page.module.css';
const C=[['name','Produto',260],['cost','Custo',115],['pack','Embalagem',115],['stock','Estoque',115],['original','Preço original',145],['offer','Preço/oferta',140],['promo','Promoção',170],['profit','Lucro antes Ads',165],['roas','ROAS equilíbrio',160]];
const defaults=Object.fromEntries(C.map(([k,,w])=>[k,w]));
const num=v=>v==null||v===''?null:Number(v);
const br=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Não disponível';
const price=v=>v==null?null:Number(v)/100000;
function normalize(x){
 const p=x?.price_info?.[0]||{};
 const raw=p.current_price??p.original_price??x?.price??null;
 const val=raw==null?null:Number(raw)/100000;
 const stock=x?.stock_info_v2?.summary_info?.total_available_stock??x?.stock_info?.[0]?.normal_stock??x?.stock??null;
 return {id:String(x.item_id),name:x.item_name||x.name||('Produto '+x.item_id),stock:num(stock),original:val,offer:val,cost:null,pack:null,promo:null,profit:null,roas:null,raw:x};
}
function read(k,fallback){try{const x=JSON.parse(localStorage.getItem('gs_pricing_'+k));return x??fallback}catch{return fallback}}
export default function Precificacao(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[sort,setSort]=useState('name'),[desc,setDesc]=useState(false);
 const [columns,setColumns]=useState(C.map(c=>c[0])),[widths,setWidths]=useState(defaults),[perPage,setPerPage]=useState(25),[page,setPage]=useState(1),[showCols,setShowCols]=useState(false);
 const [drafts,setDrafts]=useState({}),[notice,setNotice]=useState('');const drag=useRef(null);
 useEffect(()=>{setColumns(read('columns',C.map(c=>c[0])));setWidths(read('widths',defaults));setPerPage(read('perPage',25));},[]);
 useEffect(()=>{try{localStorage.setItem('gs_pricing_columns',JSON.stringify(columns));localStorage.setItem('gs_pricing_widths',JSON.stringify(widths));localStorage.setItem('gs_pricing_perPage',JSON.stringify(perPage))}catch{}},[columns,widths,perPage]);
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/shopee/products',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Falha ao carregar produtos');setRows((j.items||[]).filter(x=>x?.item_id!=null).map(normalize))}catch(e){setError(String(e.message||e))}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 useEffect(()=>{const onMove=e=>{if(!drag.current)return;setWidths(s=>({...s,[drag.current.key]:Math.max(90,Math.min(600,drag.current.width+e.clientX-drag.current.x))}))};const onUp=()=>{drag.current=null;document.body.style.cursor=''};window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp)}},[]);
 const filtered=useMemo(()=>rows.filter(x=>x.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))||x.id.includes(query)).sort((a,b)=>{const v=k=>drafts[k+'_'+sort]??(rows.find(r=>r.id===k)?.[sort]);const aa=v(a.id),bb=v(b.id);const d=aa==null?1:bb==null?-1:typeof aa==='string'&&typeof bb==='string'?aa.localeCompare(bb,'pt-BR',{numeric:true}):Number(aa)-Number(bb);return desc?-d:d}),[rows,query,sort,desc,drafts]);
 const pages=Math.max(1,Math.ceil(filtered.length/perPage));const current=Math.min(page,pages),shown=filtered.slice((current-1)*perPage,current*perPage);
 const visible=C.filter(c=>columns.includes(c[0]));const changeSort=k=>{if(sort===k)setDesc(!desc);else{setSort(k);setDesc(false)}};
 const change=(id,key,val)=>setDrafts(s=>({...s,[id+'_'+key]:val}));
 const edit=(r,key)=>{const k=r.id+'_'+key;const v=drafts[k]??r[key];return <div className={styles.edit}><input aria-label={key+' '+r.name} value={v??''} placeholder="—" onChange={e=>change(r.id,key,e.target.value)}/>{Object.prototype.hasOwnProperty.call(drafts,k)&&<button title="Salvar somente no rascunho local; não altera a Shopee" onClick={()=>setNotice('Alteração ainda não enviada: a integração de gravação na Shopee precisa ser validada.')}>Aplicar</button>}</div>};
 const cell=(r,key)=>{if(key==='name')return <span title={r.name} className={styles.product}><b>{r.name}</b><small>ID {r.id}</small></span>;
 if(['stock','original','offer'].includes(key))return edit(r,key);
 if(key==='cost'||key==='pack')return <span className={styles.muted}>Não cadastrado</span>;
 if(key==='promo')return <span className={styles.muted}>Não integrado</span>;
 if(key==='profit'||key==='roas')return <span className={styles.muted} title="Aguardando custos e taxas confirmados">Sem dados</span>;
 return '—'};
 return <main className={styles.page}><header className={styles.header}><div><small>GESTOR SÊNIOR / PRODUTOS</small><h1>💰 Precificação Inteligente</h1><p>Preços, estoque e rentabilidade dos seus produtos.</p></div><button onClick={load} disabled={loading}>{loading?'Carregando…':'↻ Atualizar lista'}</button></header>
 <section className={styles.summary}><article><small>Produtos encontrados</small><strong>{loading?'—':rows.length}</strong></article><article><small>Estoque conhecido</small><strong>{loading?'—':rows.filter(r=>r.stock!=null).length}</strong><small>produtos com estoque coletado</small></article><article><small>Margem média</small><strong>Sem dados</strong><small>Exige custos e taxas</small></article></section>
 <div className={styles.notice}>Versão inicial de visualização e simulação. <b>Editar um campo não altera a Shopee nesta etapa.</b> Os comandos de gravação serão habilitados após validação da integração de preço, estoque e promoção.</div>
 <section className={styles.panel}><div className={styles.toolbar}><input placeholder="Buscar produto por nome ou ID…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/><div className={styles.cols}><button aria-expanded={showCols} onClick={()=>setShowCols(!showCols)}>⚙ Selecionar colunas</button>{showCols&&<div className={styles.dropdown}>{C.map(([k,label])=><label key={k}><input type="checkbox" checked={columns.includes(k)} disabled={k==='name'} onChange={e=>setColumns(s=>e.target.checked?[...s,k]:s.filter(v=>v!==k))}/>{label}</label>)}<button onClick={()=>{setColumns(C.map(c=>c[0]));setWidths(defaults)}}>Restaurar padrão</button></div>}</div></div>
 {notice&&<div className={styles.notice} role="status">{notice}<button onClick={()=>setNotice('')}>Fechar</button></div>}
 {error&&<p role="alert">Erro: {error} <button onClick={load}>Tentar novamente</button></p>}
 <div className={styles.scroller}><table><colgroup>{visible.map(([k])=><col key={k} style={{width:widths[k]||defaults[k]}}/>)}</colgroup><thead><tr>{visible.map(([k,label])=><th key={k}><button onClick={()=>changeSort(k)}>{label} {sort===k?(desc?'↓':'↑'):'↕'}</button><span className={styles.resize} role="separator" aria-label={'Redimensionar '+label} onPointerDown={e=>{e.preventDefault();drag.current={key:k,x:e.clientX,width:widths[k]||defaults[k]};document.body.style.cursor='col-resize'}} onDoubleClick={()=>setWidths(s=>({...s,[k]:defaults[k]}))}/></th>)}</tr></thead><tbody>{shown.map(r=><tr key={r.id}>{visible.map(([k])=><td key={k}>{cell(r,k)}</td>)}</tr>)}{!loading&&!shown.length&&<tr><td colSpan={visible.length}>Nenhum produto encontrado.</td></tr>}</tbody></table></div>
 <footer className={styles.footer}><span>Mostrando {filtered.length?(current-1)*perPage+1:0}–{Math.min(current*perPage,filtered.length)} de {filtered.length} produtos</span><div className={styles.pager}><button disabled={current===1} onClick={()=>setPage(1)}>«</button><button disabled={current===1} onClick={()=>setPage(current-1)}>‹</button><span>Página {current} de {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>›</button><button disabled={current===pages} onClick={()=>setPage(pages)}>»</button><label>Por página <select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));setPage(1)}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label></div></footer></section></main>
}