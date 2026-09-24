'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import styles from './daily-briefing-popup.module.css';

const when=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};

export default function DailyBriefingPopup(){
  const [phase,setPhase]=useState('idle'),[tasks,setTasks]=useState([]),[open,setOpen]=useState(false);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      setPhase('loading');
      try{
        const res=await fetch('/api/tasks?briefing=1',{cache:'no-store'});
        const json=await res.json();
        if(!res.ok)throw new Error(json?.error||'Falha ao carregar prioridades.');
        if(!alive)return;
        const rows=Array.isArray(json?.tasks)?json.tasks:[];
        setTasks(rows);setPhase('success');
        if(rows.length){
          const key='gs-briefing-'+new Date().toISOString().slice(0,10);
          let seen=false;try{seen=localStorage.getItem(key)==='1'}catch{}
          if(!seen){setOpen(true);try{localStorage.setItem(key,'1')}catch{}}
        }
      }catch(e){if(alive)setPhase('error')}
    })();
    return()=>{alive=false};
  },[]);

  async function act(id,action,hours){
    try{
      const res=await fetch('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,hours})});
      if(!res.ok)return;
      setTasks(rows=>rows.filter(x=>x.id!==id));
    }catch{}
  }

  if(!tasks.length)return null;
  return <>
    <button type="button" className={styles.reopen} onClick={()=>setOpen(true)}>🔔 {tasks.length} prioridade{tasks.length===1?'':'s'} hoje</button>
    {open&&<div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Resumo urgente do dia" onClick={()=>setOpen(false)}>
      <section className={styles.modal} onClick={e=>e.stopPropagation()}>
        <header><div><small>RESUMO DO DIA</small><h2>Comece por aqui</h2><p>Estas são as tarefas que merecem atenção agora.</p></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>
        <div className={styles.summary}><b>{tasks.filter(x=>x.priority==='urgent').length}</b><span>urgentes</span><b>{tasks.length}</b><span>para hoje</span></div>
        <div className={styles.list}>{tasks.slice(0,6).map(t=><article key={t.id} data-priority={t.priority}>
          <span className={styles.dot}/>
          <div><b>{t.title}</b><p>{t.description||'Tarefa pendente no Gestor Sênior.'}</p><small>{t.due_at?'Prazo: '+when(t.due_at):'Sem prazo definido'}</small></div>
          <div className={styles.actions}>
            {t.action_url&&<Link href={t.action_url} onClick={()=>setOpen(false)}>Resolver agora</Link>}
            <button onClick={()=>act(t.id,'snooze',24)}>Amanhã</button>
            <button onClick={()=>act(t.id,'done')}>Concluir</button>
          </div>
        </article>)}</div>
        <footer><Link href="/extensao-shopee-intelligence?section=prioridades" onClick={()=>setOpen(false)}>Ver todas as prioridades →</Link></footer>
      </section>
    </div>}
  </>;
}
