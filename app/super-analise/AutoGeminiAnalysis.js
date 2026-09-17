'use client';

import {useEffect,useRef,useState} from 'react';

export default function AutoGeminiAnalysis({reportId,itemId}){
  const started=useRef(false);
  const [state,setState]=useState('loading');
  const [message,setMessage]=useState('Preparando a análise com IA…');
  const [provider,setProvider]=useState('');
  const [progress,setProgress]=useState(6);

  async function run(){
    if(!reportId)return;
    setState('loading');
    setProvider('');
    setProgress(6);
    setMessage('Analisando pela IA. Primeiro tentamos Gemini; se houver limite ou indisponibilidade, a Groq assume automaticamente.');
    try{
      const response=await fetch('/api/ai/super-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_id:reportId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||`Falha na análise de IA (HTTP ${response.status})`);
      const used=data?.provider==='groq'?'Groq':'Gemini';
      const targetItem=String(itemId||data?.itemId||'').trim();
      setProvider(used);
      setState('done');
      setProgress(100);
      setMessage(`${data?.fallbackFrom==='gemini'?'Gemini indisponível; ':''}${used} concluiu a análise${data?.visualImages?` · ${data.visualImages} imagens avaliadas`:''}. Abrindo o Super Anúncio…`);
      setTimeout(()=>{
        const q=new URLSearchParams();
        if(targetItem)q.set('item_id',targetItem);
        q.set('tab','analysis');
        location.href=`/extensao-shopee-intelligence?${q.toString()}`;
      },850);
    }catch(error){
      setState('error');
      setProgress(100);
      setMessage(String(error?.message||error));
    }
  }

  useEffect(()=>{if(started.current||!reportId)return;started.current=true;run();},[reportId]);

  useEffect(()=>{
    if(state!=='loading')return;
    const id=setInterval(()=>setProgress(p=>{
      if(p>=92)return p;
      if(p<35)return Math.min(92,p+4);
      if(p<70)return Math.min(92,p+2);
      return Math.min(92,p+1);
    }),650);
    return()=>clearInterval(id);
  },[state,reportId]);

  return <div className="gs-ai-progress-overlay" role="status" aria-live="polite">
    <div className="gs-theme-floating-card gs-ai-progress-card" data-state={state}>
      <div className="gs-ai-progress-head">
        <b className={state==='error'?'gs-theme-error':''}>{state==='error'?'⚠ A análise de IA não concluiu':state==='done'?`✓ ${provider||'IA'} concluiu`:'✦ Analisando pela IA…'}</b>
        <strong>{Math.round(progress)}%</strong>
      </div>
      <p className="gs-theme-muted">{message}</p>
      <div className="gs-ai-progress-track" aria-label="Progresso da análise" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)} role="progressbar">
        <span style={{width:`${progress}%`}}/>
      </div>
      {state==='loading'&&<small className="gs-theme-muted gs-ai-progress-note">A barra continua avançando enquanto o servidor processa o anúncio e os concorrentes. Pode levar alguns instantes.</small>}
      {state==='error'&&<button className="gs-theme-control" type="button" onClick={run}>Tentar novamente</button>}
    </div>
  </div>;
}
