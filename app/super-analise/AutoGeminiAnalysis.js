'use client';

import {useEffect,useRef,useState} from 'react';

export default function AutoGeminiAnalysis({reportId}){
  const started=useRef(false);
  const [state,setState]=useState('loading');
  const [message,setMessage]=useState('Gemini analisando anúncio e concorrentes…');

  async function run(){
    if(!reportId)return;
    setState('loading');
    setMessage('Gemini analisando anúncio, contexto, Ads, custos, margens, variações e concorrentes selecionados…');
    try{
      const response=await fetch('/api/ai/super-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_id:reportId})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||`Falha no Gemini (HTTP ${response.status})`);
      setState('done');
      setMessage(`Análise concluída${data?.visualImages?` · ${data.visualImages} imagens comparadas visualmente`:''}. Abrindo o resultado…`);
      setTimeout(()=>location.reload(),500);
    }catch(error){
      setState('error');
      setMessage(String(error?.message||error));
    }
  }

  useEffect(()=>{if(started.current||!reportId)return;started.current=true;run();},[reportId]);

  return <div className="gs-theme-floating-card" data-state={state} style={{position:'fixed',right:18,bottom:18,zIndex:2147483600,width:'min(430px,calc(100vw - 36px))',padding:14,borderRadius:12,fontFamily:'Inter,system-ui,sans-serif'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
      <b className={state==='error'?'gs-theme-error':''} style={{fontSize:12}}>{state==='error'?'⚠ Gemini não concluiu':'✦ Gemini'}</b>
      {state==='loading'&&<span className="gs-theme-muted" style={{fontSize:10}}>analisando…</span>}
    </div>
    <p className="gs-theme-muted" style={{margin:'6px 0 0',fontSize:10,lineHeight:1.45}}>{message}</p>
    {state==='error'&&<button className="gs-theme-control" type="button" onClick={run} style={{marginTop:9,borderRadius:8,padding:'8px 11px',fontSize:10,fontWeight:800,cursor:'pointer'}}>Tentar novamente</button>}
  </div>;
}
