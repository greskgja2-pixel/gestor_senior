'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './page.module.css';
import {fetchJsonWithTimeout,motorRequest,classifyAsyncError} from '../lib/client-async';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;
const money=v=>num(v)==null?'—':num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const roas=v=>num(v)==null?'—':num(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2});
const integer=v=>num(v)==null?'—':Math.round(num(v)).toLocaleString('pt-BR');
const percent=v=>num(v)==null?'—':`${num(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
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
const PERIOD_STORAGE='gs-roas-period-v1';
const PERIOD_OPTIONS=[
  ['1','Hoje'],
  ['7','7 dias'],
  ['14','14 dias'],
  ['30','30 dias'],
  ['custom','Personalizado']
];
function zonedIsoDate(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const read=type=>parts.find(p=>p.type===type)?.value||'';
  return `${read('year')}-${read('month')}-${read('day')}`;
}
function shiftIsoDate(iso,delta){
  const [y,m,d]=String(iso).split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d,12));
  date.setUTCDate(date.getUTCDate()+delta);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}
function customDays(start,end){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(start))||!/^\d{4}-\d{2}-\d{2}$/.test(String(end)))return null;
  const a=new Date(`${start}T12:00:00.000Z`),b=new Date(`${end}T12:00:00.000Z`);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||b<a)return null;
  return Math.floor((b-a)/86400000)+1;
}
function productImage(p){
  const candidates=[
    p?.image_url,p?.imageUrl,p?.cover_image,p?.coverImage,
    p?.image?.image_url_list?.[0],p?.image?.image_url,p?.images?.[0],
    p?.image_info?.image_url_list?.[0]
  ];
  return candidates.find(Boolean)||null;
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
  const [phase,setPhase]=useState('loading');
  const [hasResolved,setHasResolved]=useState(false);
  const [error,setError]=useState('');
  const [campaigns,setCampaigns]=useState([]);
  const [protectionStates,setProtectionStates]=useState([]);
  const [products,setProducts]=useState([]);
  const [selected,setSelected]=useState([]);
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(1);
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [running,setRunning]=useState(false);
  const [progress,setProgress]=useState({current:0,total:0,name:''});
  const [notice,setNotice]=useState('');
  const today=useMemo(()=>zonedIsoDate(),[]);
  const [period,setPeriod]=useState('7');
  const [customStart,setCustomStart]=useState(()=>shiftIsoDate(zonedIsoDate(),-6));
  const [customEnd,setCustomEnd]=useState(()=>zonedIsoDate());

  async function load(overrides={}){
    const selectedPeriod=String(overrides.period??period);
    const selectedStart=String(overrides.customStart??customStart);
    const selectedEnd=String(overrides.customEnd??customEnd);
    const rangeDays=selectedPeriod==='custom'?customDays(selectedStart,selectedEnd):Number(selectedPeriod);
    if(!rangeDays||rangeDays<1||rangeDays>90){
      setError('Escolha um período válido entre 1 e 90 dias.');
      return;
    }
    const queryString=selectedPeriod==='custom'
      ?`start_date=${encodeURIComponent(selectedStart)}&end_date=${encodeURIComponent(selectedEnd)}`
      :`days=${rangeDays}`;
    const refreshing=hasResolved;
    setPhase(refreshing?'refreshing':'loading');setError('');setNotice('');
    const motorPromise=selectedPeriod==='custom'
      ?Promise.resolve(null)
      :motorRequest('syncShopeeAds',{days:rangeDays,reason:'open-protecao-roas'},12000)
        .then(result=>result?.data?.v7||result?.data?.v5||null)
        .catch(err=>{console.warn('[Proteção ROAS] Motor Senior não respondeu',err);return null});
    try{
      const [adsResult,protectionResult,productsResult,motorData]=await Promise.all([
        fetchJsonWithTimeout(`/api/shopee/ads?${queryString}`,{cache:'no-store'},18000).then(value=>({ok:true,value})).catch(error=>({ok:false,error})),
        fetchJsonWithTimeout('/api/shopee/ads-protection',{cache:'no-store'},15000).then(value=>({ok:true,value})).catch(error=>({ok:false,error})),
        fetchJsonWithTimeout('/api/shopee/products',{cache:'no-store'},18000).then(value=>({ok:true,value})).catch(error=>({ok:false,error})),
        motorPromise
      ]);
      const adsPayload=adsResult.ok?(adsResult.value?.v7||adsResult.value?.v5||null):null;
      const serverCampaigns=Array.isArray(adsPayload?.campaigns)?adsPayload.campaigns:null;
      const motorCampaigns=Array.isArray(motorData?.campaigns)?motorData.campaigns:null;
      const finalCampaigns=(serverCampaigns&&serverCampaigns.length?serverCampaigns:(motorCampaigns??serverCampaigns));
      if(!Array.isArray(finalCampaigns))throw adsResult.error||new Error('Nenhuma fonte do Shopee Ads retornou campanhas.');
      setCampaigns(finalCampaigns);
      let finalProtectionStates=protectionResult.ok?(protectionResult.value?.states||[]):[];
      const activeCampaignIds=finalCampaigns.filter(c=>String(c?.state||'').toLowerCase()==='ongoing').map(c=>Number(c.campaignId)).filter(Number.isSafeInteger);
      let protectionSyncOk=false;
      if(activeCampaignIds.length){
        try{
          const synced=await motorRequest('syncProtectionStates',{campaignIds:activeCampaignIds},35000);
          const syncedStates=synced?.data?.states||synced?.states;
          if(Array.isArray(syncedStates)){finalProtectionStates=syncedStates;protectionSyncOk=true;}
          else{
            const refreshed=await fetchJsonWithTimeout('/api/shopee/ads-protection',{cache:'no-store'},12000);
            if(Array.isArray(refreshed?.states)){finalProtectionStates=refreshed.states;protectionSyncOk=true;}
          }
        }catch(err){console.warn('[Proteção ROAS] verificação automática pelo Motor não concluiu',err);}
      }
      setProtectionStates(finalProtectionStates);
      setProducts(productsResult.ok?(productsResult.value?.items||[]):[]);
      setHasResolved(true);
      setPhase(finalCampaigns.length?'success':'empty');
      const partial=[];
      if(!protectionResult.ok&&!protectionSyncOk)partial.push('estado da Proteção ROAS');
      if(!productsResult.ok)partial.push('dados auxiliares dos produtos');
      if(!adsResult.ok&&motorCampaigns)partial.push('API de Ads (foi usado o Motor Senior)');
      if(activeCampaignIds.length&&!protectionSyncOk&&finalProtectionStates.length<activeCampaignIds.length)partial.push('verificação automática da Proteção ROAS pelo Motor Senior');
      if(partial.length)setNotice(`Dados principais carregados, mas houve falha em: ${[...new Set(partial)].join(', ')}. Campos dependentes aparecem como não verificados.`);
    }catch(e){
      console.error('[Proteção ROAS] carregamento falhou',e);
      const kind=classifyAsyncError(e);
      setPhase(kind);
      setError(kind==='timeout'?'A atualização excedeu o tempo limite. Os dados anteriores foram preservados; tente novamente.':String(e?.message||e));
    }
  }

  useEffect(()=>{
    let saved={period:'7',customStart:shiftIsoDate(today,-6),customEnd:today};
    try{
      const raw=JSON.parse(localStorage.getItem(PERIOD_STORAGE)||'null');
      if(raw&&PERIOD_OPTIONS.some(([value])=>value===String(raw.period)))saved={...saved,...raw};
    }catch{}
    setPeriod(String(saved.period));
    setCustomStart(String(saved.customStart||shiftIsoDate(today,-6)));
    setCustomEnd(String(saved.customEnd||today));
    load({period:String(saved.period),customStart:String(saved.customStart||shiftIsoDate(today,-6)),customEnd:String(saved.customEnd||today)});
  },[]);
  useEffect(()=>{setPage(1);},[query]);

  function savePeriod(nextPeriod,nextStart=customStart,nextEnd=customEnd){
    try{localStorage.setItem(PERIOD_STORAGE,JSON.stringify({period:nextPeriod,customStart:nextStart,customEnd:nextEnd}))}catch{}
  }
  function changePeriod(next){
    setPeriod(next);savePeriod(next);
    if(next!=='custom')load({period:next});
  }
  function applyCustomPeriod(){
    const days=customDays(customStart,customEnd);
    if(!days||days>90){setError('O período personalizado deve ter entre 1 e 90 dias.');return;}
    savePeriod('custom',customStart,customEnd);
    load({period:'custom',customStart,customEnd});
  }

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
          canDisable:!['invalid','unsupported'].includes(ps),
          updatedAt:protection?.last_confirmed_at||protection?.last_action_at||protection?.updated_at||null
        };
      });
  },[campaigns,protectionStates,products]);

  const best=useMemo(()=>rows.filter(r=>num(r.roas)!=null).sort((a,b)=>num(b.roas)-num(a.roas))[0]||null,[rows]);
  const worst=useMemo(()=>rows.filter(r=>num(r.roas)!=null).sort((a,b)=>num(a.roas)-num(b.roas))[0]||null,[rows]);
  const activeProtection=rows.filter(r=>r.protectionStatus==='valid').length;
  const protectionPct=rows.length?Math.round(activeProtection/rows.length*100):0;
  const busy=phase==='loading'||phase==='refreshing';
  const stateCoverage=campaigns.length===0||campaigns.every(c=>String(c?.state||'').trim());
  const dataKnown=hasResolved&&stateCoverage;

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return rows.filter(r=>{
      if(!q)return true;
      return [r.name,r.campaignId,r.itemId].some(v=>String(v??'').toLowerCase().includes(q));
    });
  },[rows,query]);

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
  function openFor(){
    if(running||!selectedRows.length)return;
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
        const data=await fetchJsonWithTimeout('/api/shopee/ads-action',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            campaignId:Number(c.campaignId),
            action:'protection_reset',
            mode:c.controlMode==='gms'?'gms':'manual',
            confirmed:true
          })
        },20000);
        if(data?.ok===false)throw new Error(data?.error||'A Shopee recusou a ação.');
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

  const periodLabel=period==='custom'
    ?`${customStart.split('-').reverse().join('/')} até ${customEnd.split('-').reverse().join('/')}`
    :period==='1'?'Hoje':`Últimos ${period} dias`;

  return <div className={styles.screen}>
    <main className={styles.main}>
      <header className={styles.header}>
        <div><span className={styles.spark}>✦</span><div><h1>Central de Proteção ROAS</h1><p>Monitore campanhas ativas, encontre os extremos de ROAS e gerencie a proteção dos anúncios selecionados. ROAS: <b>{periodLabel}</b> (GMT-3).</p></div></div>
        <div className={styles.headerActions}>
          <div className={styles.periodPicker}>
            <label htmlFor="roas-period">Período do ROAS</label>
            <select id="roas-period" value={period} onChange={e=>changePeriod(e.target.value)} disabled={busy}>
              {PERIOD_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {period==='custom'&&<div className={styles.customPeriod}>
            <input type="date" value={customStart} max={customEnd||today} onChange={e=>setCustomStart(e.target.value)} disabled={busy}/>
            <span>até</span>
            <input type="date" value={customEnd} min={customStart} max={today} onChange={e=>setCustomEnd(e.target.value)} disabled={busy}/>
            <button type="button" onClick={applyCustomPeriod} disabled={busy}>Aplicar</button>
          </div>}
          <button onClick={()=>load()} disabled={busy}>{busy?'Atualizando…':'↻ Atualizar dados'}</button>
        </div>
      </header>

      {error&&<div className={styles.error}>{error}<button onClick={load} disabled={busy}>Tentar novamente</button></div>}
      {notice&&<div className={styles.notice}>{notice}<button onClick={()=>setNotice('')}>×</button></div>}

      <section className={styles.kpis}>
        <KpiCard kind="best" title="Melhor ROAS" subtitle="Anúncio ativo com maior retorno" row={best} value={best?roas(best.roas):'—'}/>
        <KpiCard kind="worst" title="Pior ROAS" subtitle="Anúncio ativo com menor retorno" row={worst} value={worst?roas(worst.roas):'—'}/>
        <KpiCard kind="active" title="Anúncios Ativos" subtitle="Total em veiculação"><div className={styles.bigNumber}><b>{dataKnown?rows.length:'—'}</b><span>{dataKnown?'anúncios ativos':'aguardando fonte'}</span><small>{dataKnown?'Campanhas em andamento encontradas no Shopee Ads.':'Nenhum zero é assumido enquanto a fonte/status das campanhas não concluir.'}</small></div></KpiCard>
        <KpiCard kind="protection" title="Proteção ROAS Ativa" subtitle="Estado interno confirmado"><div className={styles.protectionKpi}><div><b>{dataKnown?activeProtection:'—'}</b><span>{dataKnown?`de ${rows.length} ativos`:'aguardando fonte'}</span></div><div className={styles.bar}><i style={{width:`${dataKnown?protectionPct:0}%`}}/></div><small>{dataKnown?`${protectionPct}% com proteção confirmada como ativa.`:'O valor só aparece depois de uma resposta real.'}</small></div></KpiCard>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>☷ Anúncios ativos</h2><p>Selecione apenas os anúncios desejados e execute a desativação em lote.</p></div><span>{busy?(phase==='refreshing'?'Atualizando dados…':'Carregando…'):phase==='empty'?'Fonte concluída: nenhuma campanha ativa':dataKnown?`${rows.length} campanhas ativas`:'Dados indisponíveis'}</span></div>

        <div className={styles.toolbar}>
          <div className={styles.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, ID da campanha ou produto…"/></div>
          <div className={styles.statusSummary} aria-label="Resumo do status da Proteção ROAS">
            <span>Todos <b>{rows.length}</b></span>
            <span className={styles.summaryOn}>Ativa <b>{activeProtection}</b></span>
            <span>Desativada <b>{rows.filter(r=>r.protectionStatus==='invalid').length}</b></span>
            <span>Sem suporte <b>{rows.filter(r=>r.protectionStatus==='unsupported').length}</b></span>
            <span className={styles.summaryPending}>A confirmar <b>{rows.filter(r=>['suspended_assumed','unknown'].includes(r.protectionStatus)).length}</b></span>
          </div>
        </div>

        <div className={styles.selectionBar}>
          <div><span>{selectedRows.length?'✓':'☐'}</span><b>{selectedRows.length} anúncio{selectedRows.length===1?'':'s'} selecionado{selectedRows.length===1?'':'s'}</b><small>Você pode selecionar campanhas com proteção ativa ou ainda não confirmada. Campanhas já desativadas/sem suporte ficam bloqueadas.</small></div>
          <button className={styles.danger} disabled={running||!selectedRows.length} onClick={openFor}>⏻ Desativar Proteção de ROAS</button>
        </div>

        {running&&<div className={styles.runBar}><div><b>Processando {progress.current}/{progress.total}</b><span>{progress.name}</span></div><div><i style={{width:`${progress.total?Math.round(progress.current/progress.total*100):0}%`}}/></div><small>Cada campanha passa pela sequência pausar → retomar → pausar → retomar e termina retomada.</small></div>}

        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th><input type="checkbox" checked={allPageSelected} onChange={togglePage} disabled={!selectablePage.length} title="Selecionar anúncios desta página"/></th><th>Anúncio</th><th>Status</th><th>Investimento</th><th>Vendas</th><th>ROAS atual</th><th>Impressões</th><th>CTR</th><th>Adicionar ao carrinho</th><th>Porcentagem de adições ao carrinho</th><th>Custo por Conversão</th><th>ROAS alvo</th><th>Proteção ROAS</th><th>Última verificação</th></tr></thead>
            <tbody>
              {!busy&&dataKnown&&paged.length===0&&<tr><td colSpan="15" className={styles.empty}>{phase==='empty'?'A fonte respondeu, mas não retornou campanhas ativas.':'Nenhum anúncio encontrado com este filtro.'}</td></tr>}
              {!busy&&!dataKnown&&<tr><td colSpan="15" className={styles.empty}>Não foi possível confirmar os anúncios ativos. Use “Tentar novamente”.</td></tr>}
              {paged.map(r=><tr key={r.campaignId} className={selectedSet.has(String(r.campaignId))?styles.rowSelected:''}>
                <td><input type="checkbox" checked={selectedSet.has(String(r.campaignId))} onChange={e=>{e.stopPropagation();toggle(r.campaignId)}} onClick={e=>e.stopPropagation()} disabled={!r.canDisable||running} title={r.canDisable?'Selecionar campanha':'Campanha já desativada ou sem suporte para esta ação.'}/></td>
                <td><div className={styles.adCell}>{r.image?<img src={r.image} alt=""/>:<div className={styles.noImage}/>}<div><b>{r.name}</b><small>Campanha {r.campaignId}{r.itemId?` · Produto ${r.itemId}`:''}</small></div></div></td>
                <td><span className={styles.live}><i/>Ativo</span></td>
                <td>{money(r.spend)}</td>
                <td>{money(r.gmv)}</td>
                <td><b className={num(r.roas)!=null&&num(r.roas)<3?styles.badRoas:styles.goodRoas}>{roas(r.roas)}</b></td>
                <td>{integer(r.impressions)}</td>
                <td>{percent(r.ctr)}</td>
                <td>{integer(r.cartAdds)}</td>
                <td>{percent(r.cartRate)}</td>
                <td>{money(r.costPerOrder)}</td>
                <td>{roas(r.targetRoas)}</td>
                <td><ProtectionBadge status={r.protectionStatus}/></td>
                <td><span className={styles.updated}>{when(r.updatedAt)}</span></td>
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
