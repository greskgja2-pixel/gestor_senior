'use client';
import {Fragment,useEffect,useMemo,useState} from 'react';
import s from './revenda.module.css';

const VER={vale_testar:'Vale testar',teste_pequeno:'Teste pequeno',arriscado:'Arriscado',so_se_baixar_custo:'Só se baixar o custo',nao_compensa:'Não compensa'};
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
  {key:'lider_preco',label:'Anúncio que mais vende'},
  {key:'lider_margem',label:'Margem se igualar'},
  {key:'lucro_un',label:'Lucro por venda (R$)'},
  {key:'lucro_mes',label:'Retorno/mês (R$)'},
  {key:'menor_preco',label:'Menor preço que ainda vende'},
  {key:'viavel_preco',label:'Anúncio de preço mais alto que vende'},
  {key:'veredito',label:'Veredito'}
];
const ALL_KEYS=COLS.map(c=>c.key);
const LS={fixed:'gs_revenda_fixed',frete:'gs_revenda_frete',emb:'gs_revenda_emb',fee:'gs_revenda_fee',tax:'gs_revenda_tax',qtd:'gs_revenda_qtd',cols:'gs_revenda_cols'};
const save=(k,v)=>{try{localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v))}catch{}};

function Link({url,children}){return url?<a href={url} target="_blank" rel="noopener noreferrer" className={s.link}>{children}</a>:<span className={s.muted}>{children} <small>(link não capturado)</small></span>}

function Field({label,value,onChange,step,min,hint}){
  return <label className={s.field}><span>{label}</span><input type="number" step={step} min={min} value={value} onChange={e=>onChange(e.target.value)}/>{hint&&<small className={s.muted}>{hint}</small>}</label>;
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
  const [visible,setVisible]=useState(ALL_KEYS);
  const [open,setOpen]=useState('');
  const [obsId,setObsId]=useState(null);
  const [ver,setVer]=useState('todos');
  const [q,setQ]=useState('');
  const [sort,setSort]=useState({key:'produto',dir:1});
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
    const base=num(it.custo),lp=num(it.lider_preco);
    const custo=base===null?null:base+frete+emb;
    return{...it,custo_base:base,custo,min20:custo===null?null:minPrice(custo,fixed,0.2,FEE,TAX),lider_preco:lp,
      lider_margem:lp!==null&&custo!==null?margin(lp,custo,fixed,FEE,TAX):null,
      lucro_un:lp!==null&&custo!==null?profit(lp,custo,fixed,FEE,TAX):null,
      lucro_mes:lp!==null&&custo!==null?profit(lp,custo,fixed,FEE,TAX)*qtd:null,
      menor_preco:num(it.menor_preco),viavel_preco:num(it.viavel_preco)};
  }),[items,fixed,qtd,frete,emb,FEE,TAX]);
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
  const on=k=>visible.includes(k);
  const th=(key,label)=><th key={key} onClick={()=>setSort(p=>({key,dir:p.key===key?-p.dir:1}))} className={s.sortable} aria-sort={sort.key===key?(sort.dir===1?'ascending':'descending'):'none'}>{label}{sort.key===key?(sort.dir===1?' ▲':' ▼'):' ↕'}</th>;
  const counts=useMemo(()=>{const c={todos:rows.length};rows.forEach(r=>{c[r.veredito]=(c[r.veredito]||0)+1});return c},[rows]);
  const toggleCol=k=>{const next=on(k)?visible.filter(x=>x!==k):[...visible,k];setVisible(next);save(LS.cols,next)};
  const hidden=ALL_KEYS.length-visible.length;
  return <main className={s.page}>
    <div className={s.head}>
      <h1>Garimpo de revenda</h1>
      <div className={s.tools}>
        <button type="button" className={s.iconBtn} onClick={()=>setOpen(open==='cols'?'':'cols')} aria-haspopup="dialog" aria-expanded={open==='cols'}>Filtro de colunas{hidden>0?` (${hidden} ocultas)`:''}</button>
        <button type="button" className={s.iconBtn} onClick={()=>setOpen('cfg')} aria-label="Configurar taxas e custos" title="Configurar taxas e custos" aria-haspopup="dialog">⚙️</button>
      </div>
    </div>
    <p className={s.sub}>Produtos de fornecedores comparados com o que realmente vende na Shopee. Preço mínimo = (custo + frete + embalagem + taxa fixa) ÷ (1 − comissão {feePct}% − imposto {taxPct}% − margem). Lucro por venda = preço do anúncio líder − comissão e imposto − taxa fixa ({brl(fixed)}) − custo total (produto + frete {brl(frete)} + embalagem {brl(emb)}). Retorno/mês = lucro por venda × {qtd} vendas (não é previsão de vendas). Não inclui Ads, cupons nem devoluções.</p>
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
      <label className={s.field}><span>Buscar</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="produto ou fornecedor"/></label>
    </div>
    <div className={s.chips} role="group" aria-label="Filtrar por veredito">
      {['todos',...Object.keys(VER)].map(k=><button key={k} type="button" className={ver===k?s.chipOn:s.chip} onClick={()=>setVer(k)}>{k==='todos'?'Todos':VER[k]} ({counts[k]||0})</button>)}
    </div>
    {error&&<p className={s.err}>Não foi possível carregar: {error}</p>}
    {items===null&&<p>Carregando…</p>}
    {items!==null&&!shown.length&&!error&&<p className={s.muted}>Nenhum produto neste filtro.</p>}
    {!!shown.length&&<div className={s.wrap}><table className={s.table}>
      <thead><tr>{th('produto','Produto')}{COLS.filter(c=>on(c.key)).map(c=>th(c.key,c.label))}</tr></thead>
      <tbody>{shown.map(r=><Fragment key={r.id}><tr>
        <td><b>{r.produto}</b>{r.preco_caixa&&<span className={s.tag}>preço de caixa</span>}{r.observacao&&<button type="button" className={s.obsBtn} aria-expanded={obsId===r.id} aria-label={'Observação de '+r.produto} title="Ver observação" onClick={()=>setObsId(obsId===r.id?null:r.id)}>ℹ️</button>}<br/><small className={s.muted}>pesquisado em {r.pesquisado_em?String(r.pesquisado_em).split('-').reverse().join('/'):'—'}</small></td>
        {on('fornecedor')&&<td>{r.fornecedor||'—'}<br/>{r.link_fornecedor&&<a href={r.link_fornecedor} target="_blank" rel="noopener noreferrer" className={s.link}>Ver no fornecedor ↗</a>}</td>}
        {on('custo')&&<td><b>{brl(r.custo)}</b><br/><small className={s.muted}>produto {brl(r.custo_base)} + frete {brl(frete)} + emb. {brl(emb)}</small></td>}
        {on('min20')&&<td>{brl(r.min20)}</td>}
        {on('lider_preco')&&<td>{brl(r.lider_preco)} · {sales(r.lider_vendas)}/mês<br/>{r.lider_preco!==null&&<Link url={r.lider_url}>Ver anúncio ↗</Link>}</td>}
        {on('lider_margem')&&<td className={r.lider_margem!==null&&r.lider_margem<0.1?s.bad:s.ok}>{pct(r.lider_margem)}</td>}
        {on('lucro_un')&&<td className={r.lucro_un!==null&&r.lucro_un<0?s.bad:s.ok}>{brlS(r.lucro_un)}</td>}
        {on('lucro_mes')&&<td className={r.lucro_mes!==null&&r.lucro_mes<0?s.bad:s.ok}><b>{brlS(r.lucro_mes)}</b><br/><small className={s.muted}>{qtd} vendas</small></td>}
        {on('menor_preco')&&<td>{brl(r.menor_preco)} · {sales(r.menor_vendas)}/mês{r.menor_preco!==null&&<><br/><Link url={r.menor_url}>Ver anúncio ↗</Link></>}</td>}
        {on('viavel_preco')&&<td>{brl(r.viavel_preco)} · {sales(r.viavel_vendas)}/mês{r.viavel_preco!==null&&<><br/><Link url={r.viavel_url}>Ver anúncio ↗</Link></>}</td>}
        {on('veredito')&&<td><span className={s['v_'+r.veredito]}>{VER[r.veredito]}</span></td>}
      </tr>{obsId===r.id&&r.observacao&&<tr className={s.obsRow}><td colSpan={1+COLS.filter(c=>on(c.key)).length}><b>Observação:</b> {r.observacao}</td></tr>}</Fragment>)}</tbody></table></div>}
  </main>;
}
