'use client';
import {useEffect,useMemo,useState} from 'react';
import s from './revenda.module.css';

const VER={vale_testar:'Vale testar',teste_pequeno:'Teste pequeno',arriscado:'Arriscado',so_se_baixar_custo:'Só se baixar o custo',nao_compensa:'Não compensa'};
const num=v=>v===null||v===undefined||v===''?null:Number(v);
const brl=v=>v===null?'—':'R$ '+Number(v).toFixed(2).replace('.',',');
const sales=v=>v===null?'—':Number(v).toLocaleString('pt-BR');
const FEE=0.20,TAX=0.04;
// preço mínimo para margem alvo: (custo + frete + embalagem + taxa fixa) / (1 - comissão - imposto - margem)
const minPrice=(cost,fixed,m)=>(cost+fixed)/(1-FEE-TAX-m);
const profit=(p,cost,fixed)=>(1-FEE-TAX)*p-fixed-cost;
const margin=(p,cost,fixed)=>p>0?profit(p,cost,fixed)/p:null;
const brlS=v=>v===null?'—':(v<0?'−':'')+'R$ '+Math.abs(v).toFixed(2).replace('.',',');
const pct=v=>v===null?'—':(v*100).toFixed(0)+'%';

function Link({url,children}){return url?<a href={url} target="_blank" rel="noopener noreferrer" className={s.link}>{children}</a>:<span className={s.muted}>{children} <small>(link não capturado)</small></span>}

export default function RevendaPage(){
  const [items,setItems]=useState(null);
  const [error,setError]=useState('');
  const [fixed,setFixed]=useState(4.5);
  const [frete,setFrete]=useState(1.5);
  const [emb,setEmb]=useState(1);
  const [qtd,setQtd]=useState(30);
  const [ver,setVer]=useState('todos');
  const [q,setQ]=useState('');
  const [sort,setSort]=useState({key:'produto',dir:1});
  useEffect(()=>{
    try{const v=Number(localStorage.getItem('gs_revenda_fixed'));if(v>0)setFixed(v);const f=localStorage.getItem('gs_revenda_frete'),e=localStorage.getItem('gs_revenda_emb');if(f!==null&&f!==''&&Number(f)>=0)setFrete(Number(f));if(e!==null&&e!==''&&Number(e)>=0)setEmb(Number(e))}catch{}
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
    const base=num(it.custo),lp=num(it.lider_preco);
    const custo=base===null?null:base+frete+emb;
    return{...it,custo_base:base,custo,min20:custo===null?null:minPrice(custo,fixed,0.2),lider_preco:lp,
      lider_margem:lp!==null&&custo!==null?margin(lp,custo,fixed):null,
      lucro_un:lp!==null&&custo!==null?profit(lp,custo,fixed):null,
      lucro_mes:lp!==null&&custo!==null?profit(lp,custo,fixed)*qtd:null,
      menor_preco:num(it.menor_preco),viavel_preco:num(it.viavel_preco)};
  }),[items,fixed,qtd,frete,emb]);
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
    <p className={s.sub}>Produtos de fornecedores comparados com o que realmente vende na Shopee. Preço mínimo = (custo + taxa fixa) ÷ (1 − 20% comissão − 4% imposto − margem). Lucro por venda = preço do anúncio líder − 24% (comissão+imposto) − taxa fixa − custo total (produto + frete + embalagem); Retorno/mês = lucro por venda × as vendas/mês que você quer testar (não é previsão de vendas). Não inclui Ads, cupons nem devoluções.</p>
    <div className={s.controls}>
      <label>Taxa fixa por item (R$) <input type="number" step="0.5" min="0" value={fixed} onChange={e=>{const v=Number(e.target.value);setFixed(v);try{localStorage.setItem('gs_revenda_fixed',String(v))}catch{}}}/></label>
      <label>Frete do fornecedor por unidade (R$) <input type="number" step="0.1" min="0" value={frete} onChange={e=>{const v=Math.max(0,Number(e.target.value)||0);setFrete(v);try{localStorage.setItem('gs_revenda_frete',String(v))}catch{}}}/></label>
      <label>Embalagem por envio (R$) <input type="number" step="0.1" min="0" value={emb} onChange={e=>{const v=Math.max(0,Number(e.target.value)||0);setEmb(v);try{localStorage.setItem('gs_revenda_emb',String(v))}catch{}}}/></label>
      <label>Vendas/mês que quero testar <input type="number" min="1" step="5" value={qtd} onChange={e=>setQtd(Math.max(1,Number(e.target.value)||1))}/></label>
      <label>Buscar <input value={q} onChange={e=>setQ(e.target.value)} placeholder="produto ou fornecedor"/></label>
    </div>
    <div className={s.chips} role="group" aria-label="Filtrar por veredito">
      {['todos',...Object.keys(VER)].map(k=><button key={k} type="button" className={ver===k?s.chipOn:s.chip} onClick={()=>setVer(k)}>{k==='todos'?'Todos':VER[k]} ({counts[k]||0})</button>)}
    </div>
    {error&&<p className={s.err}>Não foi possível carregar: {error}</p>}
    {items===null&&<p>Carregando…</p>}
    {items!==null&&!shown.length&&!error&&<p className={s.muted}>Nenhum produto neste filtro.</p>}
    {!!shown.length&&<div className={s.wrap}><table className={s.table}>
      <thead><tr>{th('produto','Produto')}{th('fornecedor','Fornecedor')}{th('custo','Custo total')}{th('min20','Preço mín. p/ 20%')}{th('lider_preco','Anúncio que mais vende')}{th('lider_margem','Margem se igualar')}{th('lucro_un','Lucro por venda (R$)')}{th('lucro_mes','Retorno/mês (R$)')}{th('menor_preco','Menor preço que ainda vende')}{th('viavel_preco','Anúncio que paga 20%')}{th('veredito','Veredito')}<th>Observação</th></tr></thead>
      <tbody>{shown.map(r=><tr key={r.id}>
        <td><b>{r.produto}</b>{r.preco_caixa&&<span className={s.tag}>preço de caixa</span>}<br/><small className={s.muted}>pesquisado em {r.pesquisado_em?String(r.pesquisado_em).split('-').reverse().join('/'):'—'}</small></td>
        <td>{r.fornecedor||'—'}<br/>{r.link_fornecedor&&<a href={r.link_fornecedor} target="_blank" rel="noopener noreferrer" className={s.link}>Ver no fornecedor ↗</a>}</td>
        <td><b>{brl(r.custo)}</b><br/><small className={s.muted}>produto {brl(r.custo_base)} + frete {brl(frete)} + emb. {brl(emb)}</small></td>
        <td>{brl(r.min20)}</td>
        <td>{brl(r.lider_preco)} · {sales(r.lider_vendas)}/mês<br/>{r.lider_preco!==null&&<Link url={r.lider_url}>Ver anúncio ↗</Link>}</td>
        <td className={r.lider_margem!==null&&r.lider_margem<0.1?s.bad:s.ok}>{pct(r.lider_margem)}</td>
        <td className={r.lucro_un!==null&&r.lucro_un<0?s.bad:s.ok}>{brlS(r.lucro_un)}</td>
        <td className={r.lucro_mes!==null&&r.lucro_mes<0?s.bad:s.ok}><b>{brlS(r.lucro_mes)}</b><br/><small className={s.muted}>{qtd} vendas</small></td>
        <td>{brl(r.menor_preco)} · {sales(r.menor_vendas)}/mês{r.menor_preco!==null&&<><br/><Link url={r.menor_url}>Ver anúncio ↗</Link></>}</td>
        <td>{brl(r.viavel_preco)} · {sales(r.viavel_vendas)}/mês{r.viavel_preco!==null&&<><br/><Link url={r.viavel_url}>Ver anúncio ↗</Link></>}</td>
        <td><span className={s['v_'+r.veredito]}>{VER[r.veredito]}</span></td>
        <td>{r.observacao||'—'}</td>
      </tr>)}</tbody></table></div>}
  </main>;
}
