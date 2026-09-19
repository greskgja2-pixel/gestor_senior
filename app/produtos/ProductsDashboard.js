'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import shell from '../extensao-shopee-intelligence/page.module.css';
import styles from './products.module.css';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';

const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const money=v=>valid(v)?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const pct=v=>valid(v)?`${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`:'—';
const marginProof=item=>valid(item?.price)&&valid(item?.cost)&&valid(item?.marginPct)
  ?`Preço ${money(item.price)} − custo ${money(item.cost)} = ${money(Number(item.price)-Number(item.cost))}. Margem exibida: ${pct(item.marginPct)}. Quando houver taxas/Ads no relatório, a Super Análise mostra a conta completa.`
  :'Margem indisponível: falta preço ou custo válido.';

export default function ProductsDashboard({items=[],source='cache',syncedAt=null,shopId=null,loadError=null}){
  const router=useRouter();
  const [query,setQuery]=useState('');
  const [pageSize,setPageSize]=useState(25);
  const [page,setPage]=useState(1);
  const [sort,setSort]=useState('name');
  const [refreshing,setRefreshing]=useState(false);
  const [refreshError,setRefreshError]=useState('');
  const [refreshState,setRefreshState]=useState('idle');
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const rows=items.filter(x=>!q||String(x.title||'').toLowerCase().includes(q)||String(x.itemId||'').includes(q)||String(x.status||'').toLowerCase().includes(q));
    return [...rows].sort((a,b)=>{
      if(sort==='price-asc')return (a.price??Infinity)-(b.price??Infinity);
      if(sort==='price-desc')return (b.price??-Infinity)-(a.price??-Infinity);
      if(sort==='stock-desc')return (b.stock??-Infinity)-(a.stock??-Infinity);
      if(sort==='margin-desc')return (b.marginPct??-Infinity)-(a.marginPct??-Infinity);
      return String(a.title||'').localeCompare(String(b.title||''),'pt-BR');
    });
  },[items,query,sort]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,totalPages);
  const start=(currentPage-1)*pageSize;
  const visible=filtered.slice(start,start+pageSize);
  useEffect(()=>{setPage(1);},[query,pageSize,sort]);

  async function refresh(){
    setRefreshing(true);setRefreshError('');setRefreshState('loading');
    try{
      await fetchJsonWithTimeout('/api/shopee/products?refresh=1',{cache:'no-store'},25000);
      setRefreshState('success');
      router.refresh();
    }catch(e){
      console.error('[Produtos] atualização falhou',e);
      const kind=classifyAsyncError(e);
      setRefreshState(kind);
      setRefreshError(kind==='timeout'?'A atualização excedeu 25 segundos. Tente novamente.':String(e?.message||e));
    }finally{setRefreshing(false);}
  }

  function sendToAnalysis(item){
    const shopeeUrl=`https://shopee.com.br/product/${shopId}/${item.itemId}`;
    const q=new URLSearchParams({start_url:shopeeUrl,start_item_id:String(item.itemId||''),start_title:String(item.title||''),start_image:String(item.image||'')});
    router.push(`/super-analise?${q.toString()}`);
  }

  const from=filtered.length?start+1:0,to=Math.min(start+pageSize,filtered.length);
  return <div className={shell.shell}>
    <main className={shell.page}>
      <header className={shell.top}>
        <div className={shell.brand}><div className={shell.logo}>▱</div><div><h1>Produtos</h1><p>Escolha o anúncio que seguirá para a Super Análise guiada</p></div></div>
        <div className={shell.topTools}><label className={shell.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, ID ou status..."/></label><button className={styles.refreshButton} type="button" onClick={refresh} disabled={refreshing}>{refreshing?'Atualizando…':'↻ Atualizar da Shopee'}</button></div>
      </header>

      <section className={styles.summaryRow}>
        <div><small>Produtos</small><b>{items.length}</b></div><div><small>Com preço</small><b>{items.filter(x=>x.price!=null).length}</b></div><div><small>Com custo</small><b>{items.filter(x=>x.cost!=null).length}</b></div><div><small>Com margem</small><b>{items.filter(x=>x.marginPct!=null).length}</b></div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><div><h2>Produtos da loja</h2><p>{source==='cache'&&syncedAt?`Servido do cache · sincronizado em ${new Date(syncedAt).toLocaleString('pt-BR')}`:'Dados buscados da Shopee'} · {filtered.length} resultado(s)</p></div><div className={styles.controls}><label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Nome</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="stock-desc">Maior estoque</option><option value="margin-desc">Maior margem</option></select></label><label>Por página<select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label></div></div>
        {refreshError&&<div className={styles.error}>{refreshError} <button type="button" onClick={refresh}>Tentar novamente</button></div>}
        {refreshState==='success'&&!refreshError&&<div className={styles.success}>Dados atualizados com sucesso.</div>}
        {loadError&&<div className={styles.error}>{loadError}</div>}
        {!loadError&&visible.length===0?<div className={styles.empty}>Nenhum produto encontrado.</div>:<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Produto</th><th>Status</th><th>Preço</th><th>Custo</th><th>Margem</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>{visible.map(item=><tr key={item.itemId}><td><div className={styles.product}><div className={styles.thumb}>{item.image?<img src={item.image} alt=""/>:<span>▱</span>}</div><div><b>{item.title}</b><small>ID {item.itemId}{item.hasModel?' · com variações':''}</small></div></div></td><td><span className={`${styles.status} ${item.status==='NORMAL'?styles.statusOk:styles.statusWarn}`}>{item.status||'—'}</span></td><td><b>{money(item.price)}</b></td><td>{item.cost!=null?<><b>{money(item.cost)}</b>{item.costSource&&<small className={styles.cellNote}>{item.costSource}</small>}</>:<span className={styles.muted}>—</span>}</td><td title={marginProof(item)}>{item.marginPct!=null?<div className={styles.margin}><b className={item.marginPct<0?styles.negative:styles.positive}>{pct(item.marginPct)}</b><span>{money(item.marginR)}</span>{item.marginSource&&<small>{item.marginSource}</small>}</div>:<span className={styles.muted}>—</span>}</td><td>{item.stock??'—'}</td><td><button className={styles.analysisButton} type="button" onClick={()=>sendToAnalysis(item)}>🧠 Enviar para Super Análise</button></td></tr>)}</tbody></table></div>}
        <div className={styles.pagination}><span>{from}–{to} de {filtered.length} produtos</span><div><button type="button" onClick={()=>setPage(1)} disabled={currentPage===1}>«</button><button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={currentPage===1}>‹</button><span>Página {currentPage} de {totalPages}</span><button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>›</button><button type="button" onClick={()=>setPage(totalPages)} disabled={currentPage===totalPages}>»</button></div></div>
      </section>
    </main>
  </div>;
}