'use client';
import {useEffect,useMemo,useState} from 'react';
import s from './revenda.module.css';

const VER={vale_testar:'Vale testar',teste_pequeno:'Teste pequeno',arriscado:'Arriscado',so_se_baixar_custo:'Só se baixar o custo',nao_compensa:'Não compensa'};
const num=v=>v===null||v===undefined||v===''?null:Number(v);
const brl=v=>v===null?'—':'R$ '+Number(v).toFixed(2).replace('.',',');
const sales=v=>v===null?'—':Number(v).toLocaleString('pt-BR');
const FEE=0.20,TAX=0.04;
// preço mínimo para margem alvo: (custo + taxa fixa) / (1 - comissão - imposto - margem)
const minPrice=(cost,fixed,m)=>(cost+fixed)/(1-FEE-TAX-m);
const margin=(p,cost,fixed)=>p>0?((1-FEE-TAX)*p-fixed-cost)/p:null;
const pct=v=>v===null?'—':(v*100).toFixed(0)+'%';

function Link({url,children}){return url?<a href={url} target="_blank" rel="noopener noreferrer" className={s.link}>{children}</a>:<span className={s.muted}>{children} <small>(link não capturado)</small></span>}

export default function RevendaPage(){
  const [items,setItems]=useState(null);
  const [error,setError]=useState('');
  const [fixed,setFixed]=useState(4);
  const [ver,setVer]=useState('todos');
  const [q,setQ]=useState('');
  const [sort,setSort]=useState({key:'produto',dir:1});
  useEffect(()=>{
    try{const v=Number(localStorage.getItem('gs_revenda_fixed'));if(v>0)setFixed(v)}catch{}
    (async()=>{
      try{
        const r=await fetch('/api/revenda-garimpo',{cache:'no-store'});
        const j=await r.json();
        if(!r.ok)throw new Error(j.error||'Falha ao carregar');
        setItems(j.items||[]);
      }catch(e){setError(String(e.message||e));setItems([])}
    })();
  },[]);
  const rows=useMemo(()=>(items||[]).map(it=>{
    const custo=num(it.custo),lp=num(it.lider_preco);
    return{...it,custo,min20:custo===null?null:minPrice(custo,fixed,0.2),lider_preco:lp,
      lider_margem:lp!==null&&custo!==null?margin(lp,custo,fixed):null,
      menor_preco:num(it.menor_preco),viavel_preco:num(it.viavel_preco)};
  }),[items,fixed]);
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
  const th=(key,label)=><th onClick={()=>setSort(p=>({key,dir:p.key===key?-p.dir:1}))} className={s.sortable} aria-sort={sort.key===key?(sort.dir===1?'ascending':'descending'):'none'}>{label}{sort.key===key?(sort.dir===1?' ▲':' ▼'):' ↕'}</th>;
  const counts=useMemo(()=>{const c={todos:rows.length};rows.forEach(r=>{c[r.veredito]=(c[r.veredito]||0)+1});return c},[rows]);
  return <main className={s.page}>
    <h1>Garimpo de revenda</h1>
    <p className={s.sub}>Produtos de fornecedores comparados com o que realmente vende na Shopee. Preço mínimo = (custo + taxa fixa) ÷ (1 − 20% comissão − 4% imposto − margem). Não inclui Ads, frete do fornecedor, embalagem, cupons nem devoluções.</p>
    <div className={s.controls}>
      <label>Taxa fixa por item (R$) <input type="number" step="0.5" min="0" value={fixed} onChange={e=>{const v=Number(e.target.value);setFixed(v);try{localStorage.setItem('gs_revenda_fixed',String(v))}catch{}}}/></label>
      <label>Buscar <input value={q} onChange={e=>setQ(e.target.value)} placeholder="produto ou fornecedor"/></label>
    </div>
    <div className={s.chips} role="group" aria-label="Filtrar por veredito">
      {['todos',...Object.keys(VER)].map(k=><button key={k} type="button" className={ver===k?s.chipOn:s.chip} onClick={()=>setVer(k)}>{k==='todos'?'Todos':VER[k]} ({counts[k]||0})</button>)}
    </div>
    {error&&<p className={s.err}>Não foi possível carregar: {error}</p>}
    {items===null&&<p>Carregando…</p>}
    {items!==null&&!shown.length&&!error&&<p className={s.muted}>Nenhum produto neste filtro.</p>}
    {!!shown.length&&<div className={s.wrap}><table className={s.table}>
      <thead><tr>{th('produto','Produto')}{th('fornecedor','Fornecedor')}{th('custo','Custo')}{th('min20','Preço mín. p/ 20%')}{th('lider_preco','Anúncio que mais vende')}{th('lider_margem','Margem se igualar')}{th('menor_preco','Menor preço que ainda vende')}{th('viavel_preco','Anúncio que paga 20%')}{th('veredito','Veredito')}<th>Observação</th></tr></thead>
      <tbody>{shown.map(r=><tr key={r.id}>
        <td><b>{r.produto}</b>{r.preco_caixa&&<span className={s.tag}>preço de caixa</span>}<br/><small className={s.muted}>pesquisado em {r.pesquisado_em?String(r.pesquisado_em).split('-').reverse().join('/'):'—'}</small></td>
        <td>{r.fornecedor||'—'}<br/>{r.link_fornecedor&&<a href={r.link_fornecedor} target="_blank" rel="noopener noreferrer" className={s.link}>Ver no fornecedor ↗</a>}</td>
        <td>{brl(r.custo)}</td>
        <td>{brl(r.min20)}</td>
        <td>{brl(r.lider_preco)} · {sales(r.lider_vendas)}/mês<br/>{r.lider_preco!==null&&<Link url={r.lider_url}>Ver anúncio ↗</Link>}</td>
        <td className={r.lider_margem!==null&&r.lider_margem<0.1?s.bad:s.ok}>{pct(r.lider_margem)}</td>
        <td>{brl(r.menor_preco)} · {sales(r.menor_vendas)}/mês{r.menor_preco!==null&&<><br/><Link url={r.menor_url}>Ver anúncio ↗</Link></>}</td>
        <td>{brl(r.viavel_preco)} · {sales(r.viavel_vendas)}/mês{r.viavel_preco!==null&&<><br/><Link url={r.viavel_url}>Ver anúncio ↗</Link></>}</td>
        <td><span className={s['v_'+r.veredito]}>{VER[r.veredito]}</span></td>
        <td>{r.observacao||'—'}</td>
      </tr>)}</tbody></table></div>}
  </main>;
}
