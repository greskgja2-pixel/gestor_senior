'use client';

import {useEffect,useRef,useState} from 'react';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';

const MAX_ATTEMPTS=3;
const RETRY_SECONDS=10;

export default function AutoGeminiAnalysis({reportId,itemId}){
  const started=useRef(false);
  const retryTimer=useRef(null);
  const retryInterval=useRef(null);
  const attemptRef=useRef(0);
  const [state,setState]=useState('loading');
  const [message,setMessage]=useState('Preparando a análise com IA…');
  const [progress,setProgress]=useState(6);
  const [attempt,setAttempt]=useState(0);
  const [countdown,setCountdown]=useState(null);
  const [laterBusy,setLaterBusy]=useState(false);

  function clearRetryTimers(){
    clearTimeout(retryTimer.current);
    clearInterval(retryInterval.current);
    retryTimer.current=null;
    retryInterval.current=null;
  }

  function scheduleRetry(){
    clearRetryTimers();
    let left=RETRY_SECONDS;
    setCountdown(left);
    retryInterval.current=setInterval(()=>{
      left-=1;
      setCountdown(Math.max(0,left));
      if(left<=0)clearInterval(retryInterval.current);
    },1000);
    retryTimer.current=setTimeout(()=>{
      clearRetryTimers();
      setCountdown(null);
      run();
    },RETRY_SECONDS*1000);
  }

  async function run({manual=false}={}){
    if(!reportId)return;
    clearRetryTimers();
    if(manual&&attemptRef.current>=MAX_ATTEMPTS)attemptRef.current=0;
    const nextAttempt=attemptRef.current+1;
    attemptRef.current=nextAttempt;
    setAttempt(nextAttempt);
    setCountdown(null);
    setState('loading');
    setProgress(6);
    setMessage('Analisando pela I.A. O sistema está processando o anúncio, os concorrentes e as informações coletadas.');
    try{
      const data=await fetchJsonWithTimeout('/api/ai/super-analysis',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({report_id:reportId})
      },120000);
      const targetItem=String(itemId||data?.itemId||'').trim();
      clearRetryTimers();
      setState('done');
      setProgress(100);
      setMessage(`A I.A. concluiu a análise${data?.visualImages?` · ${data.visualImages} imagens avaliadas`:''}. Abrindo o Super Anúncio…`);
      setTimeout(()=>{
        const q=new URLSearchParams();
        if(targetItem)q.set('item_id',targetItem);
        q.set('tab','analysis');
        location.href=`/extensao-shopee-intelligence?${q.toString()}`;
      },850);
    }catch(error){
      console.error('[AutoGeminiAnalysis] análise falhou',error);
      const kind=classifyAsyncError(error);
      setState(kind==='timeout'?'timeout':'error');
      setProgress(100);
      if(nextAttempt<MAX_ATTEMPTS){
        setMessage(`A análise de I.A. não pôde ser concluída agora. O Gestor vai tentar novamente automaticamente em ${RETRY_SECONDS} segundos.`);
        scheduleRetry();
      }else{
        setCountdown(null);
        setMessage('A análise de I.A. não pôde ser concluída após 3 tentativas. Você pode tentar novamente agora ou deixar para analisar mais tarde.');
      }
    }
  }

  async function analyzeLater(){
    if(laterBusy)return;
    setLaterBusy(true);
    try{
      await fetchJsonWithTimeout('/api/tasks',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          item_id:Number(itemId)||null,
          task_type:'reanalysis',
          title:'Concluir análise de I.A.',
          description:'A análise de I.A. não concluiu após 3 tentativas. Retome esta Super Análise quando quiser.',
          priority:'medium',
          delay_days:1,
          source:'ai-analysis-later',
          action_url:`/super-analise?report_id=${encodeURIComponent(reportId)}`,
          metadata:{report_id:reportId,reason:'ai_failed_after_3_attempts'}
        })
      },12000);
      const q=new URLSearchParams();
      if(itemId)q.set('item_id',String(itemId));
      setMessage('Análise salva para mais tarde. Criamos uma pendência para você retomar.');
      setTimeout(()=>{location.href=`/extensao-shopee-intelligence?${q.toString()}`;},550);
    }catch(error){
      setMessage('Não foi possível criar a pendência agora. Você pode sair desta tela sem perder a análise já coletada.');
      setLaterBusy(false);
    }
  }

  useEffect(()=>{
    if(started.current||!reportId)return;
    started.current=true;
    run();
    return clearRetryTimers;
  },[reportId]);

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
        <b className={state==='error'||state==='timeout'?'gs-theme-error':''}>{state==='error'||state==='timeout'?'⚠ A análise de I.A. não concluiu':state==='done'?'✓ I.A. concluiu':'✦ Analisando pela I.A.…'}</b>
        <strong>{Math.round(progress)}%</strong>
      </div>
      <p className="gs-theme-muted">{message}</p>
      <div className="gs-ai-progress-track" aria-label="Progresso da análise" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)} role="progressbar">
        <span style={{width:`${progress}%`}}/>
      </div>
      {state==='loading'&&<small className="gs-theme-muted gs-ai-progress-note">Tentativa {Math.min(attempt||1,MAX_ATTEMPTS)} de {MAX_ATTEMPTS}. A barra continua avançando enquanto o servidor processa o anúncio e os concorrentes.</small>}
      {(state==='error'||state==='timeout')&&attempt<MAX_ATTEMPTS&&<div style={{display:'grid',gap:8,marginTop:10}}>
        <small className="gs-theme-muted">Tentativa {attempt} de {MAX_ATTEMPTS} · nova tentativa automática em <b>{countdown??RETRY_SECONDS}s</b>.</small>
        <button className="gs-theme-control" type="button" onClick={()=>run()}>Tentar agora</button>
      </div>}
      {(state==='error'||state==='timeout')&&attempt>=MAX_ATTEMPTS&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
        <button className="gs-theme-control" type="button" onClick={()=>run({manual:true})}>Tentar novamente</button>
        <button className="gs-theme-control" type="button" onClick={analyzeLater} disabled={laterBusy}>{laterBusy?'Salvando…':'Analisar mais tarde'}</button>
      </div>}
    </div>
  </div>;
}
