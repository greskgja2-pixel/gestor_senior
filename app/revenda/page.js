'use client';
import {Fragment,useEffect,useMemo,useRef,useState} from 'react';
import s from './revenda.module.css';
import {analyzeSelected,isComparable} from '../lib/revenda-analysis';

const VER={vale_testar:'Vale testar',teste_pequeno:'Teste pequeno',arriscado:'Arriscado',so_se_baixar_custo:'Só se baixar o custo',nao_compensa:'Não compensa',aguardando:'Aguardando análise'};
const VER_LABEL={...VER,sem_selecao:'Sem anúncios marcados'};
const num=v=>v===null||v===undefined||v===''?null:Number(v);
const brl=v=>v===null?'—':'R$ '+Number(v).toFixed(2).replace('.',',');
const sales=v=>v===null?'—':Number(v).toLocaleString('pt-BR');
// preço mínimo para margem alvo m: (custo total + taxa fixa) / (1 - comissão - imposto - m)
const minPrice=(cost,fixed,m,FEE,TAX)=>(cost+fixed)/(1-FEE-TAX-m);
const profit=(p,cost,fixed,FEE,TAX)=>(1-FEE-TAX)*p-fixed-cost;
const margin=(p,cost,fixed,FEE,TAX)=>p>0?profit(p,cost,fixed,FEE,TAX)/p:null;
const brlS=v=>v===null?'—':(v<0?'−':'')+'R$ '+Math.abs(v).toFixed(2).replace('.',',');
const pct=v=>v===null?'—':(v*100).toFixed(0)+'%';
const COLS=[
  {key:'fornecedor',label:'Fornecedor'},
  {key:'custo',label:'Custo total'},
  {key:'min20',label:'Preço mín. p/ 20%'},
  {key:'lider_preco',label:'Líder de vendas'},
  {key:'lider_margem',label:'Margem no líder'},
  {key:'lucro_un',label:'Lucro por venda'},
  {key:'lucro_mes',label:'Potencial / mês'},
  {key:'menor_preco',label:'Menor preço que ainda vende'},
  {key:'viavel_preco',label:'Anúncio de preço mais alto que vende'},
  {key:'veredito',label:'Veredito'}
];
const EQ={identico:'Idêntico',muito_parecido:'Muito parecido',parcial:'Parcial',diferente:'Diferente',nao_confirmado:'Não confirmado'};
const ALL_KEYS=COLS.map(c=>c.key);
const DEFAULT_KEYS=ALL_KEYS.filter(k=>!['fornecedor','menor_preco','viavel_preco'].includes(k));
const LS={fixed:'gs_revenda_fixed',frete:'gs_revenda_frete',emb:'gs_revenda_emb',fee:'gs_revenda_fee',tax:'gs_revenda_tax',qtd:'gs_revenda_qtd',cols:'gs_revenda_cols'};
const save=(k,v)=>{try{localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v))}catch{}};

function Link({url,children}){return url?<a href={url} target="_blank" rel="noopener noreferrer" className={s.link}>{children}</a>:<span className={s.muted}>{children} <small>(link não capturado)</small></span>}

function Field({label,value,onChange,step,min,hint}){
  return <label className={s.field}><span>{label}</span><input type="number" step={step} min={min} value={value} onChange={e=>onChange(e.target.value)}/>{hint&&<small className={s.muted}>{hint}</small>}</label>;
}


// Pedido pronto para refazer a análise de um produto com a skill de pesquisa de mercado.
function reanalysisPrompt(r){
  const money=v=>v===null||v===undefined?'não informado':'R$ '+Number(v).toFixed(2).replace('.',',');
  return ['Refaça a análise de revenda do produto abaixo seguindo TODAS as regras da skill pesquisa-mercado-shopee (análise de revenda de fornecedor).',
    '',
    'Produto: '+r.produto+' (id '+r.id+' na tabela gs_revenda_garimpo)',
    'Fornecedor: '+(r.fornecedor||'—'),
    'Link do fornecedor (abrir SÓ este link, nunca pesquisar no site): '+(r.link_fornecedor||'sem link: registrar PRODUTO NÃO ENCONTRADO'),
    'Custo do fornecedor: '+money(r.custo_base)+' · preço mínimo para 20% hoje na tela: '+money(r.min20),
    '',
    'Como fazer: ler o produto no link do fornecedor; buscar na Shopee só por nome e modelo, 1ª página inteira (rolar até o fim), no Chrome em aba separada, usando os dados do Gestor Pro (Últimos 30 dias); ignorar internacionais; abrir um a um todos os anúncios nacionais com 40 ou mais vendas/30d e título relacionado; classificar em identico, muito_parecido, parcial (preencher diferencas), diferente ou nao_confirmado; só a cor diferente conta como comparável.',
    'Gravar no Supabase (projeto raxhdrlnqkbqjpsbtgwf): trocar os anúncios antigos deste garimpo_id em gs_revenda_anuncios pelos novos e atualizar gs_revenda_garimpo (busca_total, busca_nacionais, busca_internacionais, líder, menor, viável, veredito e observacao dizendo quantos anúncios foram realmente abertos). Veredito definitivo só com 5 ou mais anúncios idênticos ou muito parecidos; senão PRELIMINAR.'
  ].join('\n');
}
function reanalyze(r){
  const text=reanalysisPrompt(r);
  try{navigator.clipboard&&navigator.clipboard.writeText(text)}catch(e){}
  window.open('https://claude.ai/new?q='+encodeURIComponent(text),'_blank','noopener');
}
function searchSummary(r){
  const list=r.anuncios||[];
  const same=list.filter(a=>a.equivalencia==='identico'||a.equivalencia==='muito_parecido').length;
  const partial=list.filter(a=>a.equivalencia==='parcial').length;
  const diff=list.filter(a=>a.equivalencia==='diferente').length;
  const known=r.busca_total!==null&&r.busca_total!==undefined;
  return <div className={s.searchSummary}>
    <span><b>{known?r.busca_total:'—'}</b> anúncios na 1ª página</span>
    <span><b>{known&&r.busca_nacionais!==null?r.busca_nacionais:'—'}</b> nacionais</span>
    <span><b>{known&&r.busca_internacionais!==null?r.busca_internacionais:'—'}</b> internacionais</span>
    <span><b>{list.length}</b> conferidos</span>
    <span className={s.eq_identico}><b>{same}</b> iguais (comparados)</span>
    <span className={s.eq_parcial}><b>{partial}</b> parecidos em parte</span>
    <span className={s.eq_diferente}><b>{diff}</b> diferentes</span>
  </div>;
}

export default function RevendaPage(){
  const [items,setItems]=useState(null);
  const [error,setError]=useState('');
  const [fixed,setFixed]=useState(4.5);
  const [frete,setFrete]=useState(1.5);
  const [emb,setEmb]=useState(1);
  const [feePct,setFeePct]=useState(20);
  const [taxPct,setTaxPct]=useState(4);
  const [qtd,setQtd]=useState(30);
  const [visible,setVisible]=useState(DEFAULT_KEYS);
  const [open,setOpen]=useState('');
  const [actionId,setActionId]=useState(null);
  const actionDialog=useRef(null);
  useEffect(()=>{
    const dialog=actionDialog.current;
    if(actionId!==null&&dialog&&!dialog.open)dialog.showModal();
    if(actionId===null&&dialog?.open)dialog.close();
  },[actionId]);
  const [obsId,setObsId]=useState(null);
  const [adsId,setAdsId]=useState(null);
  const [off,setOff]=useState(()=>new Set());
  const [ver,setVer]=useState('todos');
  const [q,setQ]=useState('');
  const [sort,setSort]=useState({key:'produto',dir:1});
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(25);
  useEffect(()=>{
    try{
      const g=k=>localStorage.getItem(k);
      const n=(k,set,min)=>{const v=g(k);if(v!==null&&v!==''&&Number(v)>=min)set(Number(v))};
      n(LS.fixed,setFixed,0);n(LS.frete,setFrete,0);n(LS.emb,setEmb,0);n(LS.fee,setFeePct,0);n(LS.tax,setTaxPct,0);n(LS.qtd,setQtd,1);
      const c=JSON.parse(g(LS.cols)||'null');
      if(Array.isArray(c))setVisible(c.filter(k=>ALL_KEYS.includes(k)));
    }catch{}
    (async()=>{
      try{
        const r=await fetch('/api/revenda-garimpo',{cache:'no-store'});
        const j=await r.json();
        if(!r.ok)throw new Error(j.error||'Falha ao carregar');
        setItems(j.items||[]);
      }catch(e){setError(String(e.message||e));setItems([])}
    })();
  },[]);
  useEffect(()=>{
    if(!open)return;
    const h=e=>{if(e.key==='Escape')setOpen('')};
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[open]);
  const setNum=(set,key,min=0)=>v=>{const x=Math.max(min,Number(v)||0);set(x);save(key,String(x))};
  const FEE=Math.min(feePct,90)/100,TAX=Math.min(taxPct,90)/100;
  const rows=useMemo(()=>(items||[]).map(it=>{
    const base=num(it.custo);
    const custo=base===null?null:base+frete+emb;
    const min20=custo===null?null:minPrice(custo,fixed,0.2,FEE,TAX);
    const an=analyzeSelected(it.anuncios,off,{min20,custo,fixed,fee:FEE,tax:TAX});
    const hasEligible=(it.anuncios||[]).some(isComparable);
    // Com anúncios comparáveis: tudo vem dos anúncios marcados. Sem eles: valores salvos.
    const dyn=hasEligible;
    const lp=dyn?(an?num(an.leader.preco):null):num(it.lider_preco);
    return{...it,custo_base:base,custo,min20,lider_preco:lp,
      lider_vendas:dyn?(an?num(an.leader.vendas_30d):null):it.lider_vendas,
      lider_url:dyn?(an?an.leader.url:null):it.lider_url,
      lider_margem:lp!==null&&custo!==null?margin(lp,custo,fixed,FEE,TAX):null,
      lucro_un:lp!==null&&custo!==null?profit(lp,custo,fixed,FEE,TAX):null,
      lucro_mes:lp!==null&&custo!==null?profit(lp,custo,fixed,FEE,TAX)*qtd:null,
      menor_preco:dyn?(an&&an.menor?num(an.menor.preco):null):num(it.menor_preco),
      menor_vendas:dyn?(an&&an.menor?num(an.menor.vendas_30d):null):it.menor_vendas,
      menor_url:dyn?(an&&an.menor?an.menor.url:null):it.menor_url,
      viavel_preco:dyn?(an&&an.viavel?num(an.viavel.preco):null):num(it.viavel_preco),
      viavel_vendas:dyn?(an&&an.viavel?num(an.viavel.vendas_30d):null):it.viavel_vendas,
      viavel_url:dyn?(an&&an.viavel?an.viavel.url:null):it.viavel_url,
      veredito:dyn?(an?an.veredito:'sem_selecao'):it.veredito,
      selecionados:dyn&&an?an.count:null};
  }),[items,fixed,qtd,frete,emb,FEE,TAX,off]);
  const shown=useMemo(()=>{
    const t=q.trim().toLowerCase();
    const f=rows.filter(r=>(ver==='todos'||r.veredito===ver)&&(!t||(r.produto+' '+r.fornecedor).toLowerCase().includes(t)));
    const k=sort.key;
    return[...f].sort((a,b)=>{
      const x=a[k],y=b[k];
      if(x===null||x===undefined)return 1;
      if(y===null||y===undefined)return -1;
      return (typeof x==='string'?x.localeCompare(y,'pt-BR'):x-y)*sort.dir;
    });
  },[rows,ver,q,sort]);
  useEffect(()=>{setPage(1)},[ver,q,sort,pageSize]);
  const totalPages=Math.max(1,Math.ceil(shown.length/pageSize));
  const curPage=Math.min(page,totalPages);
  const paged=useMemo(()=>shown.slice((curPage-1)*pageSize,curPage*pageSize),[shown,curPage,pageSize]);
  const pager=!!shown.length&&<nav className={s.pager} aria-label="Paginação">
    <span className={s.muted}>{(curPage-1)*pageSize+1}–{Math.min(curPage*pageSize,shown.length)} de {shown.length} produtos</span>
    <button type="button" className={s.chip} disabled={curPage<=1} onClick={()=>setPage(1)} aria-label="Primeira página">«</button>
    <button type="button" className={s.chip} disabled={curPage<=1} onClick={()=>setPage(curPage-1)}>‹ Anterior</button>
    <span>Página {curPage} de {totalPages}</span>
    <button type="button" className={s.chip} disabled={curPage>=totalPages} onClick={()=>setPage(curPage+1)}>Próxima ›</button>
    <button type="button" className={s.chip} disabled={curPage>=totalPages} onClick={()=>setPage(totalPages)} aria-label="Última página">»</button>
    <label className={s.muted}>Por página <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  </nav>;
  const on=k=>visible.includes(k);
  const th=(key,label)=><th key={key} onClick={()=>setSort(p=>({key,dir:p.key===key?-p.dir:1}))} className={[s.sortable,key==='produto'?s.productCol:key==='fornecedor'?s.supplierCol:key==='veredito'?s.verdictCol:s.numberCol].join(' ')} aria-sort={sort.key===key?(sort.dir===1?'ascending':'descending'):'none'}><button type="button" className={s.sortButton} onClick={e=>{e.stopPropagation();setSort(p=>({key,dir:p.key===key?-p.dir:1}))}}>{label}<span aria-hidden="true">{sort.key===key?(sort.dir===1?' ↑':' ↓'):' ↕'}</span></button></th>;
  const counts=useMemo(()=>{const c={todos:rows.length};rows.forEach(r=>{c[r.veredito]=(c[r.veredito]||0)+1});return c},[rows]);
  const toggleCol=k=>{const next=on(k)?visible.filter(x=>x!==k):[...visible,k];setVisible(next);save(LS.cols,next)};
  const hidden=ALL_KEYS.length-visible.length;
  const actionRow=rows.find(r=>r.id===actionId);
  return <section className={s.page} aria-labelledby="revenda-title">
    <div className={s.head}>
      <div><h1 id="revenda-title">Garimpo de revenda</h1><p className={s.sub}>Compare custos, concorrência e potencial de lucro.</p></div>
      <div className={s.tools}>
        <a className={s.iconBtn} href="/api/revenda-garimpo/backup" download title="Baixa um arquivo com todos os produtos e anúncios analisados">↓ Backup</a>
        <button type="button" className={s.iconBtn} onClick={()=>setOpen(open==='cols'?'':'cols')} aria-label="Filtro de colunas" aria-haspopup="dialog" aria-expanded={open==='cols'}>▥ Colunas{hidden>0?` (${hidden} ocultas)`:''}</button>
        <button type="button" className={s.iconBtn} onClick={()=>setOpen('cfg')} aria-label="Configurar taxas e custos" title="Configurar taxas e custos" aria-haspopup="dialog">⚙️</button>
      </div>
    </div>
    <div className={s.summary} aria-label="Resumo do garimpo">
      {[{key:'todos',icon:'▣',label:'Produtos no garimpo',tone:'blue'},{key:'vale_testar',icon:'✓',label:'Vale testar',tone:'green'},{key:'teste_pequeno',icon:'⚗',label:'Teste pequeno',tone:'blue'},{key:'aguardando',icon:'◷',label:'Aguardando análise',tone:'amber'}].map(card=><button key={card.key} type="button" className={s.summaryCard} aria-pressed={ver===card.key} onClick={()=>setVer(card.key)}><span className={s.summaryIcon} data-tone={card.tone} aria-hidden="true">{card.icon}</span><span><strong>{items===null||error?'—':sales(counts[card.key]||0)}</strong><span>{card.label}</span></span></button>)}
    </div>
    {open==='cols'&&<div className={s.pop} role="dialog" aria-label="Escolher colunas">
      <b>Colunas exibidas</b>
      <div className={s.colList}>{COLS.map(c=><label key={c.key}><input type="checkbox" checked={on(c.key)} onChange={()=>toggleCol(c.key)}/> {c.label}</label>)}</div>
      <div className={s.popBtns}><button type="button" className={s.chip} onClick={()=>{setVisible(ALL_KEYS);save(LS.cols,ALL_KEYS)}}>Mostrar todas</button><button type="button" className={s.chipOn} onClick={()=>setOpen('')}>Fechar</button></div>
      <small className={s.muted}>A coluna Produto fica sempre visível.</small>
    </div>}
    {open==='cfg'&&<div className={s.overlay} onClick={()=>setOpen('')}><div className={s.modal} role="dialog" aria-modal="true" aria-label="Configurar taxas" onClick={e=>e.stopPropagation()}>
      <h2>⚙️ Taxas e custos</h2>
      <div className={s.fields}>
        <Field label="Comissão da Shopee (%)" value={feePct} onChange={setNum(setFeePct,LS.fee)} step="0.5" min="0"/>
        <Field label="Imposto (%)" value={taxPct} onChange={setNum(setTaxPct,LS.tax)} step="0.5" min="0"/>
        <Field label="Taxa fixa por item (R$)" value={fixed} onChange={setNum(setFixed,LS.fixed)} step="0.5" min="0" hint="Padrão R$ 4,50 (itens de R$ 8 a R$ 79,99). Abaixo de R$ 8 a regra é outra."/>
        <Field label="Frete do fornecedor por unidade (R$)" value={frete} onChange={setNum(setFrete,LS.frete)} step="0.1" min="0"/>
        <Field label="Embalagem por envio (R$)" value={emb} onChange={setNum(setEmb,LS.emb)} step="0.1" min="0"/>
        <Field label="Vendas/mês que quero testar" value={qtd} onChange={setNum(setQtd,LS.qtd,1)} step="5" min="1" hint="Usado só no Retorno/mês. Não é previsão."/>
      </div>
      <div className={s.popBtns}><button type="button" className={s.chipOn} onClick={()=>setOpen('')}>Pronto</button></div>
      <small className={s.muted}>Salvo neste navegador. As contas da tabela se atualizam na hora.</small>
    </div></div>}
    <div className={s.controls}>
      <label className={s.search}><span aria-hidden="true">⌕</span><input aria-label="Buscar produto ou fornecedor" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar produto ou fornecedor"/>{q&&<button type="button" aria-label="Limpar busca" onClick={()=>setQ('')}>×</button>}</label>
      <button type="button" className={s.iconBtn} onClick={()=>setOpen('cfg')}>⚙️ Taxas e custos</button>
      <details className={s.calculation}><summary>ⓘ Como calculamos</summary><div><p>Produtos de fornecedores comparados com o que realmente vende na Shopee. Preço mínimo = (custo + frete + embalagem + taxa fixa) ÷ (1 − comissão {feePct}% − imposto {taxPct}% − margem). Lucro por venda = preço do anúncio líder − comissão e imposto − taxa fixa ({brl(fixed)}) − custo total (produto + frete {brl(frete)} + embalagem {brl(emb)}). Retorno/mês = lucro por venda × {qtd} vendas (não é previsão de vendas). Não inclui Ads, cupons nem devoluções.</p></div></details>
    </div>
    <div className={s.chips} role="group" aria-label="Filtrar por veredito">
      {['todos',...Object.keys(VER)].map(k=><button key={k} type="button" className={ver===k?s.chipOn:s.chip} aria-pressed={ver===k} onClick={()=>setVer(k)}>{k==='todos'?'Todos':VER[k]} ({items===null||error?'—':counts[k]||0})</button>)}
    </div>
    {error&&<p className={s.err}>Não foi possível carregar: {error}</p>}
    {items===null&&<p>Carregando…</p>}
    {items!==null&&!shown.length&&!error&&<p className={s.muted}>Nenhum produto neste filtro.</p>}
    {!!shown.length&&<div className={s.wrap} role="region" aria-label="Comparação de produtos para revenda" tabIndex={0}><table className={s.table} aria-label="Produtos para revenda">
      <thead><tr>{th('produto','Produto')}{COLS.filter(c=>on(c.key)).map(c=>th(c.key,c.label))}<th className={s.actionsCol}><span className={s.srOnly}>Ações</span></th></tr></thead>
      <tbody>{paged.map(r=><Fragment key={r.id}><tr>
        <td className={s.productCol}>
          <div className={s.productName}><b title={r.produto}>{r.produto}</b>{r.preco_caixa&&<span className={s.tag}>preço de caixa</span>}</div>
          {!on('fornecedor')&&<div className={s.supplier}>{r.fornecedor||'Fornecedor não informado'}{r.link_fornecedor&&<> · <a href={r.link_fornecedor} target="_blank" rel="noopener noreferrer" className={s.link}>Ver no fornecedor ↗</a></>}</div>}
          <small className={s.muted}>{r.pesquisado_em?'Pesquisado em '+String(r.pesquisado_em).split('-').reverse().join('/'):'Aguardando análise'}</small>
          <button type="button" className={s.adsBtn} aria-expanded={adsId===r.id} aria-label={'Anúncios conferidos de '+r.produto} onClick={()=>setAdsId(adsId===r.id?null:r.id)}><span className={adsId===r.id?s.arrowUp:s.arrow}>▼</span> {r.anuncios&&r.anuncios.length?r.anuncios.length+' anúncio'+(r.anuncios.length>1?'s':'')+' conferido'+(r.anuncios.length>1?'s':''):'Nenhum anúncio conferido'}</button>
        </td>
        {on('fornecedor')&&<td className={s.supplierCol}>{r.fornecedor||'—'}<br/>{r.link_fornecedor&&<a href={r.link_fornecedor} target="_blank" rel="noopener noreferrer" className={s.link}>Ver no fornecedor ↗</a>}</td>}
        {on('custo')&&<td><b>{brl(r.custo)}</b><br/><small className={s.costBreakdown} title={'Produto '+brl(r.custo_base)+' + frete '+brl(frete)+' + embalagem '+brl(emb)}>Produto {brl(r.custo_base)}<br/>Frete + emb. {brl(frete+emb)}</small></td>}
        {on('min20')&&<td>{brl(r.min20)}</td>}
        {on('lider_preco')&&<td><b>{brl(r.lider_preco)}</b><small className={s.sales}>{sales(r.lider_vendas)} vendas/mês</small>{r.lider_preco!==null&&<Link url={r.lider_url}>Ver anúncio ↗</Link>}</td>}
        {on('lider_margem')&&<td className={r.lider_margem!==null&&r.lider_margem<0.1?s.bad:s.ok}>{pct(r.lider_margem)}</td>}
        {on('lucro_un')&&<td className={r.lucro_un!==null&&r.lucro_un<0?s.bad:s.ok}>{brlS(r.lucro_un)}</td>}
        {on('lucro_mes')&&<td className={r.lucro_mes!==null&&r.lucro_mes<0?s.bad:s.ok}><b>{brlS(r.lucro_mes)}</b><br/><small className={s.muted}>{qtd} vendas</small></td>}
        {on('menor_preco')&&<td>{brl(r.menor_preco)} · {sales(r.menor_vendas)}/mês{r.menor_preco!==null&&<><br/><Link url={r.menor_url}>Ver anúncio ↗</Link></>}</td>}
        {on('viavel_preco')&&<td>{brl(r.viavel_preco)} · {sales(r.viavel_vendas)}/mês{r.viavel_preco!==null&&<><br/><Link url={r.viavel_url}>Ver anúncio ↗</Link></>}</td>}
        {on('veredito')&&<td className={s.verdictCol}><span className={s['v_'+r.veredito]}>{VER_LABEL[r.veredito]||r.veredito}</span>{r.selecionados!==null&&<><br/><small className={s.muted}>{r.selecionados} anúncio{r.selecionados>1?'s':''} marcado{r.selecionados>1?'s':''}</small></>}</td>}
        <td className={s.actionsCol}><button type="button" className={s.moreBtn} aria-haspopup="dialog" aria-label={'Ações de '+r.produto} title="Ações do produto" onClick={()=>setActionId(r.id)}>⋮</button></td>
      </tr>{adsId===r.id&&<tr className={s.adsRow}><td colSpan={2+COLS.filter(c=>on(c.key)).length}>{searchSummary(r)}<p className={s.muted} style={{margin:'0 0 8px',fontSize:12}}>Os anúncios marcados em “Usar” entram na conta. Ao marcar ou desmarcar, o preço mínimo de comparação, o líder, a margem, o lucro e o veredito mudam na hora.</p>{r.anuncios&&r.anuncios.length?<table className={s.adsTable}><thead><tr><th title="Marque ou desmarque para recalcular">Usar</th><th>Anúncio</th><th>Preço</th><th>Vendas 30 dias</th><th>Vendas totais</th><th>Idade</th><th>Anunciante</th><th>É o mesmo produto?</th><th>Diferenças</th></tr></thead><tbody>{r.anuncios.map(a=><tr key={a.id}><td>{isComparable(a)?<input type="checkbox" checked={!off.has(a.id)} aria-label={'Usar na análise: '+a.titulo} onChange={()=>setOff(p=>{const n=new Set(p);n.has(a.id)?n.delete(a.id):n.add(a.id);return n})}/>:<span className={s.muted} title="Anúncio diferente: não entra na análise">—</span>}</td><td><a href={a.url} target="_blank" rel="noopener noreferrer" className={s.link}>{a.titulo} ↗</a>{a.motivo&&<><br/><small className={s.muted}>{a.motivo}</small></>}</td><td>{brl(num(a.preco))}</td><td>{sales(num(a.vendas_30d))}</td><td>{sales(num(a.vendas_total))}</td><td>{a.idade_dias===null||a.idade_dias===undefined?'—':a.idade_dias+' dias'}</td><td>{a.anunciante||'—'}{a.marca?<><br/><small className={s.muted}>{a.marca}</small></>:null}</td><td><span className={s['eq_'+a.equivalencia]}>{EQ[a.equivalencia]||a.equivalencia}</span></td><td>{a.equivalencia==='parcial'?(a.diferencas||'—'):'—'}</td></tr>)}</tbody></table>:<span className={s.muted}>Ainda não há anúncios da Shopee abertos e conferidos para este produto.</span>}</td></tr>}{obsId===r.id&&r.observacao&&<tr className={s.obsRow}><td colSpan={2+COLS.filter(c=>on(c.key)).length}><b>Observação:</b> {r.observacao}</td></tr>}</Fragment>)}</tbody></table></div>}
    {pager}
    <p className={s.footerNote}>ⓘ Potencial mensal: lucro por venda × {qtd} unidades. Não é previsão de vendas. Não inclui Ads, cupons nem devoluções.</p>
    <dialog ref={actionDialog} className={s.actionDialog} onClose={()=>setActionId(null)} onClick={e=>{if(e.target===e.currentTarget)setActionId(null)}} aria-labelledby="revenda-actions-title">
      <div className={s.dialogHead}><h2 id="revenda-actions-title">Ações do produto</h2><button type="button" className={s.moreBtn} aria-label="Fechar ações" onClick={()=>setActionId(null)}>×</button></div>
      {actionRow&&<><p>{actionRow.produto}</p><div className={s.actionList}>
        <button type="button" onClick={()=>{setAdsId(actionRow.id);setActionId(null)}}>Ver anúncios conferidos</button>
        {actionRow.observacao&&<button type="button" onClick={()=>{setObsId(obsId===actionRow.id?null:actionRow.id);setActionId(null)}}>Ver observação da análise</button>}
        {actionRow.link_fornecedor&&<a href={actionRow.link_fornecedor} target="_blank" rel="noopener noreferrer">Ver no fornecedor ↗</a>}
        <button type="button" className={s.reanBtn} title="Abre uma conversa nova no Claude com o pedido pronto (também copia o texto)" onClick={()=>{reanalyze(actionRow);setActionId(null)}}>Reanalisar no Claude ↗</button>
      </div></>}
    </dialog>
  </section>;
}
