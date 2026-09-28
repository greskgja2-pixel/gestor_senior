'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import shell from '../extensao-shopee-intelligence/page.module.css';
import styles from './products.module.css';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';

const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const money=v=>valid(v)?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const pct=v=>valid(v)?`${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`:'—';
const decimal=v=>{if(v===null||v===undefined||v==='')return null;const s=String(v).trim().replace(/\s/g,'');const x=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return Number.isFinite(x)?x:null};
const decimalInput=v=>String(v??'').replace(/[^0-9,.]/g,'').replace(/([,.].*)[,.]/g,'$1');
const todayUsesNewLowFee=()=>Date.now()>=new Date('2026-10-01T00:00:00-03:00').getTime();
const DEFAULT_FEES={
  lowCommissionPct:20,
  lowFixedFee:todayUsesNewLowFee()?4.5:4,
  microFixedPct:50,
  highCommissionPct:14,
  fixed80:16,
  fixed100:20,
  fixed200:26,
  campaignExtraPct:0
};
const DEFAULT_COLUMNS={status:true,price:true,cost:true,margin:true,stock:true};

function feeForPrice(price,fees,hasCampaign=false){
  const p=decimal(price);if(!(p>0))return null;
  let commissionPct, fixedFee;
  if(p<8){commissionPct=fees.lowCommissionPct;fixedFee=p*(Number(fees.microFixedPct||0)/100);}
  else if(p<80){commissionPct=fees.lowCommissionPct;fixedFee=Number(fees.lowFixedFee||0);}
  else if(p<100){commissionPct=fees.highCommissionPct;fixedFee=Number(fees.fixed80||0);}
  else if(p<200){commissionPct=fees.highCommissionPct;fixedFee=Number(fees.fixed100||0);}
  else{commissionPct=fees.highCommissionPct;fixedFee=Number(fees.fixed200||0);}
  const campaignExtraPct=hasCampaign?Number(fees.campaignExtraPct||0):0;
  return{commissionPct,fixedFee,campaignExtraPct,totalRatePct:Number(commissionPct||0)+campaignExtraPct};
}
function marginCalc(price,cost,fees,hasCampaign=false){
  const p=decimal(price),c=decimal(cost),f=feeForPrice(p,fees,hasCampaign);
  if(!(p>0)||c==null||!f)return null;
  const commission=p*(f.commissionPct/100),campaignExtra=p*(f.campaignExtraPct/100),profit=p-c-commission-campaignExtra-f.fixedFee;
  return{profit,marginPct:(profit/p)*100,...f};
}
function statusLabel(value){
  const s=String(value||'').toUpperCase();
  if(s==='NORMAL')return'ATIVO';
  if(s.includes('BANNED'))return'BLOQUEADO';
  if(s.includes('UNLIST'))return'DESATIVADO';
  if(s.includes('DELETED'))return'EXCLUÍDO';
  return value||'—';
}
async function patchManage(body){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
  try{
    const response=await fetch('/api/products/manage',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctrl.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data?.error)throw new Error(data?.error||('HTTP '+response.status));
    return data;
  }finally{clearTimeout(timer)}
}

function CostReminder({count,onClose,onShowCosts}){
  if(!count)return null;
  return <div className={styles.reminderBackdrop} role="dialog" aria-modal="true" aria-label="Lembrete de custo dos produtos">
    <section className={styles.costReminder}>
      <span className={styles.reminderIcon}>$</span>
      <div><small>ANTES DE USAR O FUNIL</small><h2>Cadastre o custo dos produtos</h2><p>O Gestor precisa do custo para calcular margem, preço sugerido e recomendações do Funil com segurança. Hoje há <b>{count} produto{count===1?'':'s'} sem custo cadastrado</b>.</p></div>
      <div className={styles.reminderActions}><button type="button" onClick={onClose}>Agora não</button><button type="button" className={styles.primaryBlue} onClick={onShowCosts}>Cadastrar custos agora</button></div>
    </section>
  </div>
}

function FeeModal({open,value,onChange,onClose}){
  if(!open)return null;
  const field=(key,label,suffix='')=><label><span>{label}</span><div><input inputMode="decimal" value={value[key]} onChange={e=>onChange({...value,[key]:decimalInput(e.target.value)})}/>{suffix&&<em>{suffix}</em>}</div></label>;
  return <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Configurar taxas da Shopee">
    <section className={styles.feeModal}>
      <header><div><h2>⚙ Configurar taxas da Shopee</h2><p>Valores padrão pesquisados para o Brasil em 28/09/2026. Você pode ajustar conforme as regras da sua conta.</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className={styles.feeGrid}>
        <article><b>Até R$ 7,99</b>{field('lowCommissionPct','Comissão','%')}{field('microFixedPct','Tarifa fixa (% do preço)','%')}</article>
        <article><b>R$ 8,00 a R$ 79,99</b>{field('lowCommissionPct','Comissão','%')}{field('lowFixedFee','Tarifa fixa','R$')}</article>
        <article><b>R$ 80,00 a R$ 99,99</b>{field('highCommissionPct','Comissão','%')}{field('fixed80','Tarifa fixa','R$')}</article>
        <article><b>R$ 100,00 a R$ 199,99</b>{field('highCommissionPct','Comissão','%')}{field('fixed100','Tarifa fixa','R$')}</article>
        <article><b>R$ 200,00 ou mais</b>{field('highCommissionPct','Comissão','%')}{field('fixed200','Tarifa fixa','R$')}</article>
        <article><b>Campanha de marketing</b>{field('campaignExtraPct','Adicional da campanha','%')}<small>Deixe 0% se a sua campanha não tiver cobrança adicional.</small></article>
      </div>
      <div className={styles.feeNotice}>Até 30/09/2026, o padrão usado para R$ 8–79,99 é 20% + R$ 4,00. A partir de 01/10/2026, o padrão desta configuração sobe automaticamente para R$ 4,50; você pode alterar manualmente.</div>
      <footer><button type="button" onClick={()=>onChange(DEFAULT_FEES)}>Restaurar padrão</button><button type="button" className={styles.primaryBlue} onClick={onClose}>Salvar configuração</button></footer>
    </section>
  </div>
}

function ColumnModal({open,columns,onChange,onClose}){
  if(!open)return null;
  const labels={status:'Status do anúncio',price:'Preço / oferta',cost:'Custo do produto',margin:'Margem',stock:'Estoque'};
  return <div className={styles.columnPopover}>
    <div className={styles.columnPopoverHead}><b>Opções de exibição</b><button type="button" onClick={onClose}>×</button></div>
    {Object.keys(labels).map(key=><label key={key}><input type="checkbox" checked={columns[key]!==false} onChange={e=>onChange({...columns,[key]:e.target.checked})}/><span>{labels[key]}</span></label>)}
  </div>
}

function ProductEditorModal({item,onClose,onSaved}){
  const [state,setState]=useState({loading:true,error:'',models:[]});
  const [draft,setDraft]=useState({});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    let alive=true;
    fetchJsonWithTimeout('/api/products/manage?item_id='+encodeURIComponent(item.itemId),{cache:'no-store'},25000)
      .then(data=>{if(!alive)return;const models=Array.isArray(data?.models)?data.models:[];setState({loading:false,error:'',models});setDraft(Object.fromEntries(models.map(m=>[String(m.model_id),{cost:m.cost==null?'':String(m.cost).replace('.',','),stock:m.stock==null?'':String(m.stock)}])));})
      .catch(e=>alive&&setState({loading:false,error:String(e?.message||e),models:[]}));
    return()=>{alive=false};
  },[item.itemId]);

  const change=(id,key,value)=>setDraft(d=>({...d,[id]:{...(d[id]||{}),[key]:value}}));
  const save=async()=>{
    const costs=[],stocks=[];
    for(const model of state.models){
      const id=String(model.model_id),row=draft[id]||{};
      const cost=decimal(row.cost),stock=decimal(row.stock);
      if(cost!=null)costs.push({model_id:model.model_id,cost});
      if(stock!=null)stocks.push({model_id:model.model_id,stock:Math.max(0,Math.round(stock))});
    }
    if(!costs.length&&!stocks.length){setState(s=>({...s,error:'Preencha pelo menos um custo ou estoque.'}));return}
    setSaving(true);setState(s=>({...s,error:''}));
    try{await patchManage({item_id:item.itemId,costs,stocks});onSaved?.({costs,stocks});onClose();}
    catch(e){setState(s=>({...s,error:String(e?.message||e)}));}
    finally{setSaving(false)}
  };
  return <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Editar custos e estoque">
    <section className={styles.productEditorModal}>
      <header><div><h2>Editar custos e estoque</h2><p>{item.title}</p></div><button type="button" onClick={onClose}>×</button></header>
      {state.loading?<div className={styles.editorLoading}>Carregando variações…</div>:<>
        {state.error&&<div className={styles.error}>{state.error}</div>}
        <div className={styles.editorTable}><div><b>Variação</b><b>Preço</b><b>Custo</b><b>Estoque</b></div>{state.models.map(model=>{const id=String(model.model_id),row=draft[id]||{};return <div key={id}><span><b>{model.name}</b>{model.sku&&<small>SKU {model.sku}</small>}</span><span>{money(model.price)}</span><label><input inputMode="decimal" value={row.cost??''} onChange={e=>change(id,'cost',decimalInput(e.target.value))}/></label><label><input type="number" min="0" step="1" value={row.stock??''} onChange={e=>change(id,'stock',e.target.value)}/></label></div>})}</div>
        <footer><button type="button" onClick={onClose}>Cancelar</button><button type="button" className={styles.primaryBlue} disabled={saving} onClick={save}>{saving?'Salvando…':'Salvar alterações'}</button></footer>
      </>}
    </section>
  </div>
}

export default function ProductsDashboard({items=[],source='cache',syncedAt=null,shopId=null,loadError=null,embedded=false}){
  const router=useRouter();
  const [rows,setRows]=useState(items);
  const [query,setQuery]=useState('');
  const [pageSize,setPageSize]=useState(25);
  const [page,setPage]=useState(1);
  const [sort,setSort]=useState('name');
  const [refreshing,setRefreshing]=useState(false);
  const [refreshError,setRefreshError]=useState('');
  const [refreshState,setRefreshState]=useState('idle');
  const [offers,setOffers]=useState({});
  const [offerLoading,setOfferLoading]=useState(false);
  const [columns,setColumns]=useState(DEFAULT_COLUMNS);
  const [fees,setFees]=useState(DEFAULT_FEES);
  const [showColumns,setShowColumns]=useState(false);
  const [showFees,setShowFees]=useState(false);
  const [showReminder,setShowReminder]=useState(false);
  const [editorItem,setEditorItem]=useState(null);
  const [cellDraft,setCellDraft]=useState({});
  const [savingCell,setSavingCell]=useState('');
  const [cellMessage,setCellMessage]=useState('');

  useEffect(()=>setRows(items),[items]);
  useEffect(()=>{
    try{
      const savedCols=JSON.parse(localStorage.getItem('gs_product_columns_v1')||'null');if(savedCols)setColumns({...DEFAULT_COLUMNS,...savedCols});
      const savedFees=JSON.parse(localStorage.getItem('gs_shopee_fee_config_v1')||'null');if(savedFees)setFees({...DEFAULT_FEES,...savedFees});
      const key='gs_cost_reminder_'+new Date().toISOString().slice(0,10);
      const missing=items.filter(x=>x.hasModel?(Number(x.variationCostCount||0)===0):x.cost==null).length;
      if(missing>0&&!localStorage.getItem(key))setShowReminder(true);
    }catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem('gs_product_columns_v1',JSON.stringify(columns))}catch{}},[columns]);
  useEffect(()=>{try{localStorage.setItem('gs_shopee_fee_config_v1',JSON.stringify(fees))}catch{}},[fees]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const list=rows.filter(x=>!q||String(x.title||'').toLowerCase().includes(q)||String(x.itemId||'').includes(q)||String(x.status||'').toLowerCase().includes(q));
    return [...list].sort((a,b)=>{
      if(sort==='price-asc')return (a.price??Infinity)-(b.price??Infinity);
      if(sort==='price-desc')return (b.price??-Infinity)-(a.price??-Infinity);
      if(sort==='stock-desc')return (b.stock??-Infinity)-(a.stock??-Infinity);
      if(sort==='margin-desc'){
        const ma=marginFor(a)?.marginPct??-Infinity,mb=marginFor(b)?.marginPct??-Infinity;return mb-ma;
      }
      return String(a.title||'').localeCompare(String(b.title||''),'pt-BR');
    });
  },[rows,query,sort,offers,fees]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,totalPages),start=(currentPage-1)*pageSize,visible=filtered.slice(start,start+pageSize);
  useEffect(()=>{setPage(1);},[query,pageSize,sort]);

  useEffect(()=>{
    const ids=visible.map(x=>x.itemId).filter(Boolean);
    if(!ids.length){setOffers({});return}
    let alive=true;setOfferLoading(true);
    fetchJsonWithTimeout('/api/shopee/marketing-discounts?item_ids='+encodeURIComponent(ids.join(',')),{cache:'no-store'},45000)
      .then(data=>alive&&setOffers(prev=>({...prev,...(data?.items||{})})))
      .catch(e=>console.warn('[Produtos] ofertas de marketing indisponíveis',e))
      .finally(()=>alive&&setOfferLoading(false));
    return()=>{alive=false};
  },[visible.map(x=>x.itemId).join('|')]);

  function offerFor(item){return offers[String(item.itemId)]||null}
  function finalPriceFor(item){const offer=offerFor(item);return decimal(offer?.offer_price??item.price??item.fullPrice)}
  function costForMargin(item){return item.hasModel?null:decimal(item.cost)}
  function marginFor(item){const offer=offerFor(item);return marginCalc(finalPriceFor(item),costForMargin(item),fees,Boolean(offer))}
  function closeReminder(){try{localStorage.setItem('gs_cost_reminder_'+new Date().toISOString().slice(0,10),'1')}catch{}setShowReminder(false)}
  function showCostsNow(){setColumns(c=>({...c,cost:true}));closeReminder();setTimeout(()=>document.getElementById('products-table')?.scrollIntoView({behavior:'smooth',block:'start'}),50)}

  async function refresh(){
    setRefreshing(true);setRefreshError('');setRefreshState('loading');
    try{await fetchJsonWithTimeout('/api/shopee/products?refresh=1',{cache:'no-store'},25000);setRefreshState('success');router.refresh();}
    catch(e){const kind=classifyAsyncError(e);setRefreshState(kind);setRefreshError(kind==='timeout'?'A atualização excedeu 25 segundos. Tente novamente.':String(e?.message||e));}
    finally{setRefreshing(false)}
  }
  function sendToAnalysis(item){
    const shopeeUrl=`https://shopee.com.br/product/${shopId}/${item.itemId}`;
    const q=new URLSearchParams({start_url:shopeeUrl,start_item_id:String(item.itemId||''),start_title:String(item.title||''),start_image:String(item.image||'')});
    router.push(`/super-analise?${q.toString()}`);
  }
  function draftValue(item,field){const key=item.itemId+':'+field;if(cellDraft[key]!==undefined)return cellDraft[key];const value=item[field];return value==null?'':String(value).replace('.',',')}
  function setDraftValue(item,field,value){setCellDraft(d=>({...d,[item.itemId+':'+field]:value}))}
  async function saveSimple(item,field){
    const key=item.itemId+':'+field,value=decimal(draftValue(item,field));
    if(value==null||value<0){setCellMessage('Informe um valor válido.');return}
    setSavingCell(key);setCellMessage('');
    try{
      const body={item_id:item.itemId};
      if(field==='cost')body.costs=[{model_id:0,cost:value}];
      else body.stocks=[{model_id:0,stock:Math.round(value)}];
      await patchManage(body);
      setRows(list=>list.map(row=>row.itemId!==item.itemId?row:{...row,[field]:field==='stock'?Math.round(value):value,costSource:field==='cost'?'custo cadastrado':row.costSource}));
      setCellMessage((field==='cost'?'Custo':'Estoque')+' salvo.');
    }catch(e){setCellMessage(String(e?.message||e))}
    finally{setSavingCell('')}
  }
  function editorSaved(result){
    if(!editorItem)return;
    const costs=result?.costs||[],stocks=result?.stocks||[];
    setRows(list=>list.map(row=>{
      if(row.itemId!==editorItem.itemId)return row;
      const costVals=costs.map(x=>decimal(x.cost)).filter(x=>x!=null),stockVals=stocks.map(x=>decimal(x.stock)).filter(x=>x!=null);
      return{...row,variationCostCount:costVals.length||row.variationCostCount,variationCostMin:costVals.length?Math.min(...costVals):row.variationCostMin,variationCostMax:costVals.length?Math.max(...costVals):row.variationCostMax,stock:stockVals.length?stockVals.reduce((a,b)=>a+b,0):row.stock};
    }));
  }

  const missingCostCount=rows.filter(x=>x.hasModel?(Number(x.variationCostCount||0)===0):x.cost==null).length;
  const from=filtered.length?start+1:0,to=Math.min(start+pageSize,filtered.length);
  return <div className={embedded?'':shell.shell}>
    {showReminder&&<CostReminder count={missingCostCount} onClose={closeReminder} onShowCosts={showCostsNow}/>}
    <FeeModal open={showFees} value={fees} onChange={setFees} onClose={()=>setShowFees(false)}/>
    {editorItem&&<ProductEditorModal item={editorItem} onClose={()=>setEditorItem(null)} onSaved={editorSaved}/>}
    <main className={embedded?styles.embeddedPage:shell.page}>
      {!embedded&&<header className={shell.top}><div className={shell.brand}><div className={shell.logo}>▱</div><div><h1>Produtos</h1><p>Escolha o anúncio que seguirá para a Super Análise guiada</p></div></div></header>}

      {!embedded&&<section className={styles.summaryRow}><div><small>Produtos</small><b>{rows.length}</b></div><div><small>Com preço</small><b>{rows.filter(x=>x.price!=null).length}</b></div><div><small>Com custo</small><b>{rows.length-missingCostCount}</b></div><div><small>Sem custo</small><b>{missingCostCount}</b></div></section>}

      <section className={styles.card} id="products-table">
        <div className={styles.cardHead}>
          <div><h2>Produtos da loja</h2><p>{source==='cache'&&syncedAt?`Servido do cache · sincronizado em ${new Date(syncedAt).toLocaleString('pt-BR')}`:'Dados buscados da Shopee'} · {filtered.length} resultado(s){offerLoading?' · lendo ofertas…':''}</p></div>
          <div className={styles.controls}>
            {embedded&&<label className={styles.inlineSearch}>Buscar<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, ID ou status..."/></label>}
            <button className={styles.refreshButton} type="button" onClick={refresh} disabled={refreshing}>{refreshing?'Atualizando…':'↻ Atualizar da Shopee'}</button>
            <button className={styles.toolButton} type="button" onClick={()=>setShowFees(true)}>⚙ Configurar taxas</button>
            <div className={styles.columnControl}><button className={styles.toolButton} type="button" onClick={()=>setShowColumns(v=>!v)}>▤ Opções de exibição</button><ColumnModal open={showColumns} columns={columns} onChange={setColumns} onClose={()=>setShowColumns(false)}/></div>
            <label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Nome</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="stock-desc">Maior estoque</option><option value="margin-desc">Maior margem</option></select></label>
            <label>Por página<select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
          </div>
        </div>
        {refreshError&&<div className={styles.error}>{refreshError} <button type="button" onClick={refresh}>Tentar novamente</button></div>}
        {refreshState==='success'&&!refreshError&&<div className={styles.success}>Dados atualizados com sucesso.</div>}
        {cellMessage&&<div className={styles.success}>{cellMessage}</div>}
        {loadError&&<div className={styles.error}>{loadError}</div>}
        {visible.length===0?<div className={styles.empty}>Nenhum produto encontrado.</div>:<div className={styles.tableWrap}><table className={styles.table}><thead><tr>
          <th>Produto</th>
          {columns.status&&<th>Status</th>}
          {columns.price&&<th>Preço / oferta</th>}
          {columns.cost&&<th>Custo produto</th>}
          {columns.margin&&<th>Margem</th>}
          {columns.stock&&<th>Estoque</th>}
          <th>Ações</th>
        </tr></thead><tbody>{visible.map(item=>{
          const offer=offerFor(item),full=decimal(offer?.full_price??item.fullPrice??item.price),final=finalPriceFor(item),margin=marginFor(item);
          return <tr key={item.itemId}>
            <td><div className={styles.product}><div className={styles.thumb}>{item.image?<img src={item.image} alt=""/>:<span>▱</span>}</div><div><b>{item.title}</b><small>ID {item.itemId}{item.hasModel?' · com variações':''}</small></div></div></td>
            {columns.status&&<td><span className={`${styles.status} ${String(item.status).toUpperCase()==='NORMAL'?styles.statusOk:styles.statusWarn}`}>{statusLabel(item.status)}</span></td>}
            {columns.price&&<td><div className={styles.priceCell}><span><small>Cheio</small><b>{money(full)}</b></span><span data-offer={offer?'true':'false'}><small>Oferta</small><b>{offer?money(final):'—'}</b>{offer&&<em>{offer.discount_name}</em>}</span></div></td>}
            {columns.cost&&<td>{item.hasModel?<button className={styles.inlineEditButton} type="button" onClick={()=>setEditorItem(item)}><b>{item.variationCostCount?item.variationCostMin===item.variationCostMax?money(item.variationCostMin):`${money(item.variationCostMin)}–${money(item.variationCostMax)}`:'Cadastrar'}</b><small>Editar variações</small></button>:<div className={styles.inlineEditor}><input inputMode="decimal" value={draftValue(item,'cost')} onChange={e=>setDraftValue(item,'cost',decimalInput(e.target.value))} placeholder="R$ 0,00"/><button type="button" onClick={()=>saveSimple(item,'cost')} disabled={savingCell===item.itemId+':cost'}>{savingCell===item.itemId+':cost'?'…':'✓'}</button></div>}</td>}
            {columns.margin&&<td>{item.hasModel?<button className={styles.inlineEditButton} type="button" onClick={()=>setEditorItem(item)}><b>Por variação</b><small>Abra custos para calcular</small></button>:margin?<div className={styles.margin}><b className={margin.marginPct<0?styles.negative:styles.positive}>{pct(margin.marginPct)}</b><span>{money(margin.profit)}</span><small>{margin.totalRatePct.toLocaleString('pt-BR',{maximumFractionDigits:1})}% + {money(margin.fixedFee)} de taxas</small></div>:<span className={styles.muted}>Cadastre o custo</span>}</td>}
            {columns.stock&&<td>{item.hasModel?<button className={styles.inlineEditButton} type="button" onClick={()=>setEditorItem(item)}><b>{item.stock??'—'}</b><small>Editar variações</small></button>:<div className={styles.inlineEditor}><input type="number" min="0" step="1" value={draftValue(item,'stock')} onChange={e=>setDraftValue(item,'stock',e.target.value)}/><button type="button" onClick={()=>saveSimple(item,'stock')} disabled={savingCell===item.itemId+':stock'}>{savingCell===item.itemId+':stock'?'…':'✓'}</button></div>}</td>}
            <td><button className={styles.analysisButton} type="button" onClick={()=>sendToAnalysis(item)}>🧠 Enviar para Super Análise</button></td>
          </tr>})}</tbody></table></div>}
        <div className={styles.pagination}><span>{from}–{to} de {filtered.length} produtos</span><div><button type="button" onClick={()=>setPage(1)} disabled={currentPage===1}>«</button><button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={currentPage===1}>‹</button><span>Página {currentPage} de {totalPages}</span><button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}>›</button><button type="button" onClick={()=>setPage(totalPages)} disabled={currentPage===totalPages}>»</button></div></div>
      </section>
    </main>
  </div>;
}