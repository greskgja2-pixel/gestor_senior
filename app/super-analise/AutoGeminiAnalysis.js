'use client';

import {useEffect,useRef,useState} from 'react';

export default function AutoGeminiAnalysis({reportId}){
  const started=useRef(false);
  const [state,setState]=useState('loading');
  const [message,setMessage]=useState('Gemini analisando anúncio e os 3 concorrentes…');

  async function run(){
    if(!reportId)return;
    setState('loading');
    setMessage('Gemini analisando anúncio, contexto, Ads, custos, margens, variações e os 3 concorrentes…');
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

  return <div style={{position:'fixed',right:18,bottom:18,zIndex:2147483600,width:'min(430px,calc(100vw - 36px))',padding:14,borderRadius:12,border:`1px solid ${state==='error'?'#f3b8b8':'#bcd7fb'}`,background:state==='error'?'#fff5f5':'#f4f9ff',boxShadow:'0 12px 36px rgba(28,57,95,.18)',fontFamily:'Inter,system-ui,sans-serif',color:'#254364'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><b style={{fontSize:12}}>{state==='error'?'⚠ Gemini não concluiu':'✦ Gemini'}</b>{state==='loading'&&<span style={{fontSize:10,color:'#507399'}}>analisando…</span>}</div>
    <p style={{margin:'6px 0 0',fontSize:10,lineHeight:1.45}}>{message}</p>
    {state==='error'&&<button type="button" onClick={run} style={{marginTop:9,border:0,borderRadius:8,background:'#1769e8',color:'#fff',padding:'8px 11px',fontSize:10,fontWeight:800,cursor:'pointer'}}>Tentar novamente</button>}
  </div>;
}