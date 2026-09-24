'use client';
import {useState} from 'react';
import styles from './reminder-button.module.css';

export default function ReminderButton({itemId,title,description='',taskType='other',actionUrl='',label='🔔 Lembrar depois',priority='medium',className=''}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function saveDays(days){
    setBusy(true);setMessage('');
    try{
      const res=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        item_id:itemId||null,title,description,task_type:taskType,action_url:actionUrl,priority,source:'manual',delay_days:days
      })});
      const json=await res.json();
      if(!res.ok)throw new Error(json?.error||'Não foi possível criar o lembrete.');
      setMessage('Lembrete criado.');setTimeout(()=>setOpen(false),700);
    }catch(e){setMessage(String(e?.message||e))}finally{setBusy(false)}
  }
  async function saveDate(value){
    if(!value)return;
    const d=new Date(value+'T09:00:00');
    setBusy(true);setMessage('');
    try{
      const res=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        item_id:itemId||null,title,description,task_type:taskType,action_url:actionUrl,priority,source:'manual',due_at:d.toISOString()
      })});
      const json=await res.json();
      if(!res.ok)throw new Error(json?.error||'Não foi possível criar o lembrete.');
      setMessage('Lembrete criado.');setTimeout(()=>setOpen(false),700);
    }catch(e){setMessage(String(e?.message||e))}finally{setBusy(false)}
  }
  return <span className={styles.wrap}>
    <button type="button" className={className||styles.trigger} onClick={()=>{setOpen(v=>!v);setMessage('')}}>{label}</button>
    {open&&<span className={styles.popover}>
      <b>Quando você quer ser lembrado?</b>
      <small>A tarefa aparecerá na Central de Prioridades e no resumo do dia.</small>
      <span className={styles.options}>
        <button disabled={busy} onClick={()=>saveDays(1)}>Amanhã</button>
        <button disabled={busy} onClick={()=>saveDays(3)}>3 dias</button>
        <button disabled={busy} onClick={()=>saveDays(7)}>7 dias</button>
      </span>
      <label>Data personalizada<input type="date" disabled={busy} onChange={e=>saveDate(e.target.value)}/></label>
      {message&&<em>{message}</em>}
      <button type="button" className={styles.close} onClick={()=>setOpen(false)}>Fechar</button>
    </span>}
  </span>;
}
