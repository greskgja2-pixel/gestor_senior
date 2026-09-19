'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import styles from './page.module.css';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const money=v=>num(v)==null?'—':num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const roas=v=>num(v)==null?'—':num(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2});
const when=v=>{if(!v)return'Nunca verificado';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR');};
const statusText={
  valid:'Ativa',
  invalid:'Desativada',
  unsupported:'Sem suporte',
  suspended_assumed:'Aguardando confirmação',
  unknown:'Não verificada'
};
const statusClass={
  valid:'statusOn',
  invalid:'statusOff',
  unsupported:'statusUnsupported',
  suspended_assumed:'statusPending',
  unknown:'statusUnknown'
};
const PAGE_SIZE=20;

function productImage(p){
  const candidates=[
    p?.image_url,p?.imageUrl,p?.cover_image,p?.coverImage,
    p?.image?.image_url_list?.[0],p?.image?.image_url,p?.images?.[0],
    p?.image_info?.image_url_list?.[0]
  ];
  return candidates.find(Boolean)||null;
}

function Sidebar({connected}){
  return <aside className={styles.sidebar}>
    <div className={styles.brand}><span>GS</span><div><b>Gestor Sênior</b><small>Shopee Intelligence</small></div></div>
    <nav>
      <Link href="/">⌂ <span>Dashboard</span></Link>
      <Link href="/produtos">▱ <span>Produtos</span></Link>
      <Link href="/super-analise">▤ <span>Super Análise</span></Link>
      <Link href="/extensao-shopee-intelligence">▣ <span>Super Anúncio</span></Link>
      <Link href="/extensao-shopee-intelligence#concorrentes">⌘ <span>Concorrentes</span></Link>
      <Link href="/extensao-shopee-intelligence#shopee-ads">◎ <span>Shopee Ads</span></Link>
      <Link className={styles.sideActive} href="/protecao-roas">◈ <span>Proteção ROAS</span></Link>
      <Link href="/extensao-shopee-intelligence#reanálises">↻ <span>Reanálises</span></Link>
      <Link href="/extensao-shopee-intelligence#prioridades">☆ <span>Prioridades</span></Link>
      <Link href="/extensao-shopee-intelligence#relatorios">▤ <span>Relatórios</span></Link>
    </nav>
    <div className={styles.engineCard}>
      <div><i className={connected?styles.online:styles.offline}/><b>Motor Senior</b></div>
      <strong>{connected?'Conectado e pronto':'Não detectado'}</strong>
      <small>Os estados confirmados de Proteção ROAS capturados pelo Motor aparecem nesta página.</small>
    </div>
  </aside>
}

function KpiCard({kind,title,subtitle,row,value,children}){
  return <article className={`${styles.kpi} ${styles[kind]||''}`}>
    <div className={styles.kpiHead}><span className={styles.kpiIcon}>{kind==='best'?'🏆':kind==='worst'?'↘':kind==='active'?'📣':'🛡'}</span><div><b>{title}</b><small>{subtitle}</small></div></div>
    {row?<div className={styles.kpiProduct}>
      {row.image?<img src={row.image} alt=""/>:<div className={styles.noImage}/>}
      <div><strong>{row.name}</strong><small>ID {row.campaignId}</small></div>
      <em>{value}</em>
    </div>:children}
  </article>
}

function ProtectionBadge({status}){
  const s=statusText[status]?status:'unknown';
  return <span className={`${styles.status} ${styles[statusClass[s]]}`}>
    <i/>{statusText[s]}
  </span>
}

export default function ProtectionRoasDashboard(){
  const [connected,setConnected]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [campaigns,setCampaigns]=useState([]);
  const [protectionStates,setProtectionStates]=useState([]);
  const [products,setProducts]=useState([]);
  const [selected,setSelected]=useState([]);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [page,setPage]=useState(1);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState({current:0,total:0,name:''});
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    const onMessage=e=>{if(e.source===window&&e.data?.source==='GS_EXTENSION'&&(e.data?.type==='GS_EXTENSION_READY'||e.data?.type==='GS_EXTENSION_PONG'))setConnected(true);};
    window.addEventListener('message',onMessage);
    window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin);
    const ping=setInterval(()=>window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin),1800);
    const marker=setInterval(()=>{if(document.documentElement?.dataset?.gsExtensionBridge==='ready'||document.querySelector('meta[name="gestor-senior-extension"]'))setConnected(true);},1800);
    return()=>{clearInterval(ping);clearInterval(marker);window.removeEventListener('message',onMessage);};
  },[]);

  async function load(){
    setLoading(true);setError('');
    try{
      const [adsR,protectionR,productsR]=await Promise.all([
        fetch('/api/shopee/ads?days=30',{cache:'no-store'}),
        fetch('/api/shopee/ads-protection',{cache:'no-store'}),
        fetch('/api/shopee/products',{cache:'no-store'})
      ]);
      const [ads,protection,productData]=await Promise.all([
        adsR.json().catch(()=>({})),protectionR.json().catch(()=>({})),productsR.json().catch(()=>({}))
      ]);
      if(!adsR.ok)throw new Error(ads?.error||'Não consegui carregar o Shopee Ads.');
      if(!protectionR.ok)throw new Error(protection?.error||'Não consegui carregar os estados da Proteção ROAS.');
      setCampaigns(ads?.v7?.campaigns||ads?.v5?.campaigns||[]);
      setProtectionStates(protection?.states||[]);
      setProducts(productsR.ok?(productData?.items||[]):[]);
    }catch(e){setError(String(e?.message||e));}
    finally{setLoading(false);}
  }

  useEffect(()=>{load();},[]);
  useEffect(()=>{setPage(1);},[query,filter]);

  const rows=useMemo(()=>{
    const pMap=new Map(products.map(p=>[String(p.item_id??p.itemId),p]));
    const sMap=new Map(protectionStates.map(s=>[String(s.campaign_id),s]));
    return campaigns
      .filter(c=>String(c.state||'').toLowerCase()==='ongoing')
      .map(c=>{
        const product=pMap.get(String(c.itemId||''))||{};
        const protection=sMap.get(String(c.campaignId))||null;
        const ps=protection?.status||'unknown';
        return {
          ...c,
          name:c.productName||product.item_name||c.title||`Campanha ${c.campaignId}`,
          image:productImage(product),
          protectionStatus:statusText[ps]?ps:'unknown',
          protection,
          canDisable:ps==='valid',
          updatedAt:protection?.last_confirmed_at||protection?.last_action_at||protection?.updated_at||null
        };
      });
  },[campaigns,protectionStates,products]);

  const best=useMemo(()=>rows.filter(r=>num(r.roas)!=null).sort((a,b)=>num(b.roas)-num(a.roas))[0]||null,[rows]);
  const worst=useMemo(()=>rows.filter(r=>num(r.roas)!=null).sort((a,b)=>num(a.roas)-num(b.roas))[0]||null,[rows]);
  const activeProtection=rows.filter(r=>r.protectionStatus==='valid').length;
  const protectionPct=rows.length?Math.round(activeProtection/rows.length*100):0;

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return rows.filter(r=>{
      if(filter!=='all'){
        if(filter==='pending'&&!['suspended_assumed','unknown'].includes(r.protectionStatus))return false;
        if(filter!=='pending'&&r.protectionStatus!==filter)return false;
      }
      if(!q)return true;
      return [r.name,r.campaignId,r.itemId].some(v=>String(v??'').toLowerCase().includes(q));
    });
  },[rows,query,filter]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safePage=Math.min(page,totalPages);
  const paged=filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);
  const selectablePage=paged.filter(r=>r.canDisable);
  const selectedSet=new Set(selected.map(String));
  const selectedRows=rows.filter(r=>selectedSet.has(String(r.campaignId))&&r.canDisable);
  const allPageSelected=selectablePage.length>0&&selectablePage.every(r=>selectedSet.has(String(r.campaignId)));

  function toggle(id){
    const key=String(id);
    setSelected(prev=>prev.map(String).includes(key)?prev.filter(x=>String(x)!==key):[...prev,key]);
  }
  function togglePage(){
    const ids=selectablePage.map(r=>String(r.campaignId));
    setSelected(prev=>{
      const s=new Set(prev.map(String));
      if(ids.every(id=>s.has(id)))ids.forEach(id=>s.delete(id));else ids.forEach(id=>s.add(id));
      return [...s];
    });
  }
  function openFor(rowsToSelect){
    if(running)return;
    if(rowsToSelect?.length)setSelected(rowsToSelect.map(r=>String(r.campaignId)));
    setConfirmOpen(true);
  }

  async function disableSelected(){
    const targets=rows.filter(r=>new Set(selected.map(String)).has(String(r.campaignId))&&r.canDisable);
    if(!targets.length){setConfirmOpen(false);return;}
    setRunning(true);setConfirmOpen(false);setNotice('');setProgress({current:0,total:targets.length,name:''});
    let ok=0;const failures=[];
    for(let i=0;i<targets.length;i++){
      const c=targets[i];
      setProgress({current:i+1,total:targets.length,name:c.name});
      try{
        const response=await fetch('/api/shopee/ads-action',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            campaignId:Number(c.campaignId),
            action:'protection_reset',
            mode:c.controlMode==='gms'?'gms':'manual',
            confirmed:true
          })
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${response.status}`);
        ok++;
      }catch(e){failures.push({id:c.campaignId,name:c.name,error:String(e?.message||e)});}
    }
    await load();
    setSelected([]);
    setRunning(false);
    setProgress({current:0,total:0,name:''});
    if(failures.length)setNotice(`${ok} campanha(s) concluída(s); ${failures.length} falharam. ${failures[0]?.name}: ${failures[0]?.error}`);
    else setNotice(`${ok} campanha(s) processada(s). O Gestor agora mostra “Aguardando confirmação” até receber o estado interno confirmado da Shopee.`);
  }

  return <div className={styles.screen}>
    <Sidebar connected={connected}/>
    <main className={styles.main}>
      <header className={styles.header}>
        <div><span className={styles.spark}>✦</span><div><h1>Central de Proteção ROAS</h1><p>Monitore campanhas ativas, encontre os extremos de ROAS e gerencie a proteção dos anúncios selecionados.</p></div></div>
        <div className={styles.headerActions}><span className={connected?styles.connected:styles.disconnected}><i/>{connected?'Motor Senior conectado':'Motor Senior não detectado'}</span><button onClick={load} disabled={loading}>↻ Atualizar dados</button></div>
      </header>

      {error&&<div className={styles.error}>{error}<button onClick={load}>Tentar novamente</button></div>}
      {notice&&<div className={styles.notice}>{notice}<button onClick={()=>setNotice('')}>×</button></div>}

      <section className={styles.kpis}>
        <KpiCard kind="best" title="Melhor ROAS" subtitle="Anúncio ativo com maior retorno" row={best} value={best?roas(best.roas):'—'}/>
        <KpiCard kind="worst" title="Pior ROAS" subtitle="Anúncio ativo com menor retorno" row={worst} value={worst?roas(worst.roas):'—'}/>
        <KpiCard kind="active" title="Anúncios Ativos" subtitle="Total em veiculação"><div className={styles.bigNumber}><b>{rows.length}</b><span>anúncios ativos</span><small>Campanhas em andamento encontradas no Shopee Ads.</small></div></KpiCard>
        <KpiCard kind="protection" title="Proteção ROAS Ativa" subtitle="Estado interno confirmado"><div className={styles.protectionKpi}><div><b>{activeProtection}</b><span>de {rows.length} ativos</span></div><div className={styles.bar}><i style={{width:`${protectionPct}%`}}/></div><small>{protectionPct}% com proteção confirmada como ativa.</small></div></KpiCard>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>☷ Anúncios ativos</h2><p>Selecione apenas os anúncios desejados e execute a desativação em lote.</p></div><span>{loading?'Carregando…':`${rows.length} campanhas ativas`}</span></div>

        <div className={styles.toolbar}>
          <div className={styles.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, ID da campanha ou produto…"/></div>
          <div className={styles.filters}>
            <button className={filter==='all'?styles.filterActive:''} onClick={()=>setFilter('all')}>Todos ({rows.length})</button>
            <button className={filter==='valid'?styles.filterActive:''} onClick={()=>setFilter('valid')}>Proteção Ativa ({activeProtection})</button>
            <button className={filter==='invalid'?styles.filterActive:''} onClick={()=>setFilter('invalid')}>Desativada ({rows.filter(r=>r.protectionStatus==='invalid').length})</button>
            <button className={filter==='unsupported'?styles.filterActive:''} onClick={()=>setFilter('unsupported')}>Sem suporte ({rows.filter(r=>r.protectionStatus==='unsupported').length})</button>
            <button className={filter==='pending'?styles.filterActive:''} onClick={()=>setFilter('pending')}>A confirmar ({rows.filter(r=>['suspended_assumed','unknown'].includes(r.protectionStatus)).length})</button>
          </div>
        </div>

        {selectedRows.length>0&&<div className={styles.selectionBar}>
          <div><span>✓</span><b>{selectedRows.length} anúncio{selectedRows.length===1?'':'s'} selecionado{selectedRows.length===1?'':'s'}</b><small>Somente campanhas com Proteção ROAS confirmada como ativa entram na operação.</small></div>
          <div><button className={styles.danger} disabled={running} onClick={()=>openFor()}>⏻ Desativar Proteção de ROAS dos selecionados</button><button onClick={()=>setSelected([])}>Limpar seleção</button></div>
        </div>}

        {running&&<div className={styles.runBar}><div><b>Processando {progress.current}/{progress.total}</b><span>{progress.name}</span></div><div><i style={{width:`${progress.total?Math.round(progress.current/progress.total*100):0}%`}}/></div><small>Cada campanha passa pela sequência pausar → retomar → pausar → retomar e termina retomada.</small></div>}

        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th><input type="checkbox" checked={allPageSelected} onChange={togglePage} disabled={!selectablePage.length}/></th><th>Anúncio</th><th>Status</th><th>ROAS atual</th><th>ROAS alvo</th><th>Proteção ROAS</th><th>Última verificação</th><th>Ações</th></tr></thead>
            <tbody>
              {!loading&&paged.length===0&&<tr><td colSpan="8" className={styles.empty}>Nenhum anúncio encontrado com este filtro.</td></tr>}
              {paged.map(r=><tr key={r.campaignId} className={selectedSet.has(String(r.campaignId))?styles.rowSelected:''}>
                <td><input type="checkbox" checked={selectedSet.has(String(r.campaignId))} onChange={()=>toggle(r.campaignId)} disabled={!r.canDisable||running} title={r.canDisable?'Selecionar campanha':'Disponível somente quando a Proteção ROAS estiver confirmada como ativa.'}/></td>
                <td><div className={styles.adCell}>{r.image?<img src={r.image} alt=""/>:<div className={styles.noImage}/>}<div><b>{r.name}</b><small>Campanha {r.campaignId}{r.itemId?` · Produto ${r.itemId}`:''}</small></div></div></td>
                <td><span className={styles.live}><i/>Ativo</span></td>
                <td><b className={num(r.roas)!=null&&num(r.roas)<3?styles.badRoas:styles.goodRoas}>{roas(r.roas)}</b></td>
                <td>{roas(r.targetRoas)}</td>
                <td><ProtectionBadge status={r.protectionStatus}/></td>
                <td><span className={styles.updated}>{when(r.updatedAt)}</span></td>
                <td>{r.canDisable?<button className={styles.rowDanger} disabled={running} onClick={()=>openFor([r])}>⏻ Desativar Proteção</button>:<span className={styles.noAction}>{r.protectionStatus==='suspended_assumed'?'Aguardando confirmação':r.protectionStatus==='unknown'?'Verificação necessária':'Sem ação necessária'}</span>}</td>
              </tr>)}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}><span>Mostrando {filtered.length?((safePage-1)*PAGE_SIZE)+1:0}–{Math.min(safePage*PAGE_SIZE,filtered.length)} de {filtered.length}</span><div><button disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹</button><b>{safePage}</b><span>de {totalPages}</span><button disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>›</button></div></div>

        <div className={styles.info}><b>ⓘ Como o Gestor confirma a Proteção ROAS</b><p>O status mostrado aqui usa o estado interno capturado da campanha, e não apenas o selo visual da Shopee. Depois da rotina de desativação, a campanha fica como “Aguardando confirmação” até o Motor Senior capturar um novo estado interno. Só mostramos “Desativada” quando a Shopee retornar o estado confirmado correspondente.</p></div>
      </section>
    </main>

    {confirmOpen&&<div className={styles.modalBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget&&!running)setConfirmOpen(false)}}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <span className={styles.modalIcon}>🛡</span>
        <h2 id="confirm-title">Desativar Proteção de ROAS?</h2>
        <p>Você selecionou <b>{selectedRows.length} campanha{selectedRows.length===1?'':'s'}</b>. Para cada uma, o Gestor executará <b>pausar → retomar → pausar → retomar</b>.</p>
        <div className={styles.modalWarning}><b>A campanha termina ativa.</b><span>O resultado será marcado como aguardando confirmação até o estado interno da Shopee ser capturado novamente.</span></div>
        <div className={styles.modalList}>{selectedRows.slice(0,5).map(r=><span key={r.campaignId}>{r.name} <small>#{r.campaignId}</small></span>)}{selectedRows.length>5&&<em>+ {selectedRows.length-5} outras campanhas</em>}</div>
        <div className={styles.modalActions}><button onClick={()=>setConfirmOpen(false)}>Cancelar</button><button className={styles.danger} onClick={disableSelected}>Sim, desativar selecionados</button></div>
      </div>
    </div>}
  </div>;
}
