'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';

export default function ExtensionConnectionDock(){
  const [connected,setConnected]=useState(false);
  useEffect(()=>{
    const check=()=>setConnected(document.documentElement?.dataset?.gsExtensionBridge==='ready');
    check();const id=setInterval(check,900);return()=>clearInterval(id);
  },[]);
  return <div style={{position:'fixed',left:14,bottom:16,width:126,zIndex:50,background:'#16375e',border:'1px solid #31577e',borderRadius:12,padding:10,color:'#fff',boxShadow:'0 10px 30px rgba(11,34,60,.2)',fontFamily:'system-ui'}}>
    <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,fontWeight:800}}><span style={{width:8,height:8,borderRadius:99,background:connected?'#20ca78':'#ef5a5a',boxShadow:`0 0 0 3px ${connected?'rgba(32,202,120,.15)':'rgba(239,90,90,.15)'}`}}/>Extensão</div>
    <div style={{fontSize:9,color:'#c6d7e9',margin:'5px 0 8px'}}>{connected?'Conectada':'Não detectada'}</div>
    <button data-gs-super-analysis type="button" style={{width:'100%',border:0,borderRadius:7,padding:'7px 6px',background:'#1f6fec',color:'#fff',fontSize:9,fontWeight:800,cursor:'pointer'}}>Abrir extensão</button>
    <Link href="/super-analise" style={{display:'block',marginTop:6,textAlign:'center',textDecoration:'none',color:'#dceaff',fontSize:9,fontWeight:700}}>Super Análise →</Link>
  </div>;
}
