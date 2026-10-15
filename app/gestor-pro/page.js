'use client';
import {useMemo,useState} from 'react';
import {GESTOR_PRO_TASKS} from './tasks';
const COLORS={pendente:'#64748b',investigando:'#2563eb',implementado:'#7c3aed','em teste':'#d97706',bloqueado:'#dc2626',validado:'#16a34a'};
export default function GestorProPage(){
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState('todos');
 const [category,setCategory]=useState('todas');
 const [expanded,setExpanded]=useState(null);
 const categories=[...new Set(GESTOR_PRO_TASKS.map(t=>t.category))];
 const rows=useMemo(()=>GESTOR_PRO_TASKS.filter(t=>(status==='todos'||t.status===status)&&(category==='todas'||t.category===category)&&[t.id,t.title,t.description,t.notes].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))),[query,status,category]);
 const completed=GESTOR_PRO_TASKS.filter(t=>t.labValidated&&t.gestorIntegrated&&t.status==='validado').length;
 return <main style={{padding:'clamp(16px,3vw,36px)',maxWidth:1250,margin:'auto',color:'var(--gs-text,#e2e8f0)'}}>
 <header style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:12,alignItems:'center',marginBottom:20}}>
  <div><div style={{fontSize:12,opacity:.7,letterSpacing:1}}>LABORATÓRIO INDEPENDENTE · GESTOR PRO</div><h1 style={{margin:'4px 0',fontSize:'clamp(24px,3vw,34px)'}}>Plano de desenvolvimento</h1><p style={{opacity:.75,maxWidth:730,margin:0}}>35 tarefas inspiradas no estudo da Avant Pro. O Motor Sênior atual permanece isolado. Status oficial controlado pelo repositório e diário técnico.</p></div>
  <a href="https://github.com/greskgja2-pixel/gestor_senior/blob/main/docs/GESTOR_PRO_DIARIO.md" target="_blank" rel="noreferrer" style={{padding:'10px 14px',border:'1px solid #64748b',borderRadius:10,color:'inherit',textDecoration:'none'}}>Ver diário ↗</a>
 </header>
 <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,marginBottom:20}}>
 {[['Total',GESTOR_PRO_TASKS.length],['Validadas no laboratório',GESTOR_PRO_TASKS.filter(t=>t.labValidated).length],['Integradas e validadas',completed],['Pendentes',GESTOR_PRO_TASKS.filter(t=>t.status==='pendente').length]].map(([label,value])=><div key={label} style={{padding:16,borderRadius:14,background:'var(--gs-card-bg,rgba(125,125,125,.08))',border:'1px solid rgba(128,128,128,.23)'}}><div style={{opacity:.7,fontSize:13}}>{label}</div><strong style={{fontSize:28}}>{value}</strong></div>)}
 </section>
 <div role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={35} aria-label="Tarefas integradas e validadas" style={{height:9,background:'rgba(128,128,128,.2)',borderRadius:20,overflow:'hidden',marginBottom:20}}><div style={{height:'100%',width:(completed/35*100)+'%',background:'#16a34a'}}/></div>
 <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
 <input aria-label="Pesquisar tarefas" placeholder="Pesquisar tarefa, ID ou resumo..." value={query} onChange={e=>setQuery(e.target.value)} style={{flex:'1 1 250px',padding:12,borderRadius:10,border:'1px solid #64748b',background:'transparent',color:'inherit'}}/>
 <select aria-label="Filtrar categoria" value={category} onChange={e=>setCategory(e.target.value)} style={{padding:12,borderRadius:10,background:'var(--gs-shell-bg,#1e293b)',color:'inherit'}}><option value="todas">Todas as áreas</option>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select>
 <select aria-label="Filtrar status" value={status} onChange={e=>setStatus(e.target.value)} style={{padding:12,borderRadius:10,background:'var(--gs-shell-bg,#1e293b)',color:'inherit'}}><option value="todos">Todos os status</option>{Object.keys(COLORS).map(x=><option key={x} value={x}>{x}</option>)}</select>
 </div>
 <div style={{display:'grid',gap:9}}>{rows.map(t=><article key={t.id} style={{border:'1px solid rgba(128,128,128,.24)',borderRadius:12,overflow:'hidden',background:'var(--gs-card-bg,rgba(128,128,128,.06))'}}>
 <button onClick={()=>setExpanded(expanded===t.id?null:t.id)} aria-expanded={expanded===t.id} style={{display:'flex',width:'100%',gap:12,alignItems:'center',textAlign:'left',padding:14,border:0,background:'transparent',color:'inherit',cursor:'pointer'}}>
 <strong style={{fontVariantNumeric:'tabular-nums',minWidth:36}}>{t.id}</strong><span style={{flex:1}}><strong>{t.title}</strong><span style={{display:'block',fontSize:12,opacity:.65,marginTop:3}}>{t.category}</span></span><span style={{border:'1px solid '+COLORS[t.status],color:COLORS[t.status],borderRadius:20,fontSize:12,padding:'4px 9px'}}>{t.status}</span><span aria-hidden="true">{expanded===t.id?'−':'+'}</span>
 </button>{expanded===t.id&&<div style={{padding:'0 16px 16px 62px',lineHeight:1.55}}><p style={{marginTop:0}}>{t.description}</p><div style={{fontSize:13,opacity:.8}}>Laboratório: {t.labValidated?'validado':'não validado'} · Gestor: {t.gestorIntegrated?'integrado':'não integrado'} · Tentativas com erro: {t.attempts}/4</div>{t.notes&&<p>{t.notes}</p>}<p style={{fontSize:12,opacity:.7}}>100% somente após coleta real, visualização na extensão, integração ao Gestor e validação.</p></div>}
 </article>)}{!rows.length&&<div style={{padding:24,textAlign:'center',opacity:.7}}>Nenhuma tarefa corresponde aos filtros.</div>}</div>
 <p style={{opacity:.65,fontSize:12,marginTop:18}}>Fonte oficial: tasks.js versionado no GitHub. A página é somente leitura para evitar marcações locais divergentes. Atualizações serão registradas no diário e publicadas em lotes controlados.</p>
 </main>;
}
