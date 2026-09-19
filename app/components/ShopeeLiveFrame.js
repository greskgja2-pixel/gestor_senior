"use client";
import {useCallback,useEffect,useRef,useState} from "react";

const VERSION="20260919-02";
const frameSrc=section=>`/shopeeos-live.html?v=full-live-${VERSION}${section?`&section=${encodeURIComponent(section)}`:''}`;
const STYLES=[["shell-enhancements-css","/shell-enhancements.css"],["legacy-themes-css","/legacy-themes.css"],["runtime-restoration-css","/runtime-restoration.css"],["live-modules-css","/live-modules.css"],["advanced-modules-css","/advanced-modules.css"],["editor-ai-css","/editor-ai.css"],["editor-variations-css","/editor-variations.css"],["editor-images-css","/editor-images.css"],["editor-shipping-css","/editor-shipping.css"],["editor-other-css","/editor-other.css"],["products-profit-enhancements-css","/products-profit-enhancements.css"],["product-trends-css","/product-trends.css"],["home-encyclopedia-css","/home-encyclopedia.css"],["product-encyclopedia-v6-css","/product-encyclopedia-v6.css"],["ads-shopee-replica-v11-css","/ads-shopee-replica-v11.css"],["layout-wide-v2-css","/layout-wide-v2.css"]];
const CORE_SCRIPTS=[["runtime-restoration-js","/runtime-restoration.js"],["live-modules-js","/live-modules.js"],["shell-enhancements-js","/shell-enhancements.js"]];
const OPTIONAL_SCRIPTS=[["advanced-modules-js","/advanced-modules.js"],["remaining-modules-js","/remaining-modules.js"],["editor-ai-js","/editor-ai.js"],["editor-variations-js","/editor-variations.js"],["editor-images-js","/editor-images.js"],["editor-shipping-js","/editor-shipping.js"],["editor-other-js","/editor-other.js"],["products-profit-enhancements-js","/products-profit-enhancements.js"],["product-trends-js","/product-trends.js"],["home-encyclopedia-js","/home-encyclopedia.js"],["product-encyclopedia-v6-js","/product-encyclopedia-v6.js"],["product-encyclopedia-v6-grid-js","/product-encyclopedia-v6-grid.js"],["persistence-fix-v8-js","/persistence-fix-v8.js"],["ads-shopee-replica-v11-js","/ads-shopee-replica-v11.js"],["extension-intelligence-integration-js","/extension-intelligence-integration.js"]];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function loadStyle(doc,key,href){
  if(!doc?.head)return Promise.reject(new Error("iframe sem <head>"));
  const selector=`link[data-${key}]`,existing=doc.querySelector(selector);
  if(existing?.dataset.gsLoaded==="1")return Promise.resolve();
  return new Promise(resolve=>{
    const link=existing||doc.createElement("link");let settled=false;
    const done=()=>{if(settled)return;settled=true;link.dataset.gsLoaded="1";resolve()};
    link.addEventListener("load",done,{once:true});link.addEventListener("error",done,{once:true});
    if(!existing){link.rel="stylesheet";link.href=`${href}?v=${VERSION}`;link.setAttribute(`data-${key}`,"1");doc.head.appendChild(link)}
    setTimeout(done,5000);
  });
}

function loadScript(doc,key,src,attempt=0){
  if(!doc?.body)return Promise.reject(new Error("iframe sem <body>"));
  const selector=`script[data-${key}]`,existing=doc.querySelector(selector);
  if(existing?.dataset.gsLoaded==="1")return Promise.resolve();
  if(existing)existing.remove();
  return new Promise((resolve,reject)=>{
    const script=doc.createElement("script");
    const timeout=setTimeout(()=>{script.remove();reject(new Error(`timeout ao carregar ${src}`))},8000);
    script.async=false;script.src=`${src}?v=${VERSION}${attempt?`&retry=${attempt}`:""}`;script.setAttribute(`data-${key}`,"1");
    script.onload=()=>{clearTimeout(timeout);script.dataset.gsLoaded="1";resolve()};
    script.onerror=()=>{clearTimeout(timeout);script.remove();reject(new Error(`falha ao carregar ${src}`))};
    doc.body.appendChild(script);
  });
}
async function loadRequiredScript(doc,key,src){
  try{await loadScript(doc,key,src,0)}
  catch(firstError){await sleep(250);await loadScript(doc,key,src,1).catch(()=>{throw firstError})}
}

function installHostedLayout(doc){
  if(!doc?.head)return;
  let style=doc.getElementById("gs-hosted-layout");
  if(!style){style=doc.createElement("style");style.id="gs-hosted-layout";doc.head.appendChild(style)}
  style.textContent=`
    :root{--gs-host-sidebar-width:218px}
    html,body{margin:0!important;min-height:100%!important;background:#f4f7fb!important;background-image:none!important}
    .app{display:block!important;grid-template-columns:1fr!important;min-height:100vh!important;width:100%!important}
    .sidebar{display:none!important}
    .main{min-width:0!important;width:100%!important;margin:0!important}
    .topbar{display:none!important}
    .content{max-width:none!important;width:100%!important;margin:0!important;padding:16px 18px 30px!important}
    @media(max-width:900px){.content{padding:12px!important}}
  `;
}

async function waitForModernHome(doc){
  const win=doc?.defaultView;
  for(let i=0;i<90;i++){
    const liveReady=!!win?.GestorLiveModules?.supports?.("dashboard");
    const modernContent=!!doc?.querySelector("#content .lm-wrap");
    if(liveReady&&modernContent)return true;
    await sleep(100);
  }
  throw new Error("O Dashboard LIVE não concluiu a inicialização.");
}

async function installEnhancements(frame){
  const doc=frame?.contentDocument,win=doc?.defaultView;
  if(!doc?.head||!doc?.body||!win)throw new Error("iframe ainda não está pronto");
  installHostedLayout(doc);
  if(doc.documentElement.dataset.gestorReady===VERSION)return true;
  if(win.__GESTOR_INSTALL_PROMISE__)return win.__GESTOR_INSTALL_PROMISE__;
  win.__GESTOR_INSTALL_PROMISE__=(async()=>{
    doc.documentElement.dataset.gestorEnhancements=VERSION;
    const stylePromises=new Map();
    for(const[key,href]of STYLES)stylePromises.set(key,loadStyle(doc,key,href));
    await Promise.allSettled([stylePromises.get("shell-enhancements-css"),stylePromises.get("runtime-restoration-css"),stylePromises.get("live-modules-css"),stylePromises.get("layout-wide-v2-css")]);
    for(const[key,src]of CORE_SCRIPTS)await loadRequiredScript(doc,key,src);
    installHostedLayout(doc);
    await waitForModernHome(doc);
    doc.documentElement.dataset.gestorReady=VERSION;
    (async()=>{for(const[key,src]of OPTIONAL_SCRIPTS){try{await loadRequiredScript(doc,key,src)}catch(error){console.warn("[Dashboard LIVE] optional enhancement failed",src,error)}}})();
    return true;
  })();
  try{return await win.__GESTOR_INSTALL_PROMISE__}
  catch(error){win.__GESTOR_INSTALL_PROMISE__=null;throw error}
}

function withBootTimeout(promise,ms=30000){
  return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>{const e=new Error("O Dashboard excedeu o tempo máximo de carregamento.");e.code="timeout";reject(e)},ms))]);
}

export default function ShopeeLiveFrame({initialSection=""}){
  const FRAME_SRC=frameSrc(initialSection);
  const frameRef=useRef(null),bootingRef=useRef(false),autoRetryRef=useRef(0);
  const[phase,setPhase]=useState("loading");
  const[message,setMessage]=useState("Preparando seu painel…");

  const boot=useCallback(async()=>{
    if(bootingRef.current)return;
    bootingRef.current=true;setPhase("loading");setMessage(autoRetryRef.current?"Recarregando o Dashboard LIVE…":"Preparando seu painel…");
    try{
      await withBootTimeout(installEnhancements(frameRef.current),30000);
      autoRetryRef.current=0;setPhase("success");
    }catch(error){
      console.error("[Dashboard LIVE] boot failed",error);
      if(autoRetryRef.current<1&&frameRef.current){
        autoRetryRef.current+=1;
        setMessage("O primeiro carregamento falhou. Fazendo uma nova tentativa…");
        frameRef.current.src=`${FRAME_SRC}&recovery=${Date.now()}`;
      }else{
        setPhase(error?.code==="timeout"?"timeout":"error");
        setMessage(error?.code==="timeout"?"O Dashboard demorou demais para responder.":"Não foi possível preparar o Dashboard LIVE.");
      }
    }finally{bootingRef.current=false}
  },[FRAME_SRC]);

  const retry=useCallback(()=>{
    autoRetryRef.current=0;setPhase("loading");setMessage("Tentando novamente…");
    if(frameRef.current)frameRef.current.src=`${FRAME_SRC}&manual_retry=${Date.now()}`;
  },[FRAME_SRC]);

  useEffect(()=>{
    const timer=setTimeout(()=>{
      if(phase!=="success"&&frameRef.current?.contentDocument?.readyState==="complete")boot();
    },700);
    return()=>clearTimeout(timer);
  },[boot,phase]);

  return <div style={{minHeight:"100vh",background:"var(--gs-shell-bg,#f4f7fb)"}}>
    <iframe ref={frameRef} src={FRAME_SRC} title="Gestor Senior Shopee LIVE" onLoad={boot}
      style={{display:phase==="success"?"block":"none",width:"100%",height:"100vh",border:"none",background:"transparent"}}/>
    {phase!=="success"&&<div role="status" aria-live="polite" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,color:"var(--gs-shell-text,#294664)"}}>
      <div className="gs-panel" style={{width:"min(430px,100%)",textAlign:"center"}}>
        <div className="gs-logo-mark" style={{margin:"0 auto 14px"}}>GS</div>
        <strong style={{display:"block",fontSize:18}}>Gestor Sênior</strong>
        <span style={{display:"block",marginTop:7,color:"var(--gs-shell-muted,#71839a)",fontSize:12,lineHeight:1.5}}>{message}</span>
        {phase==="loading"?<div style={{height:4,margin:"16px auto 0",borderRadius:99,overflow:"hidden",background:"#dce6f0"}}><div style={{width:"55%",height:"100%",background:"var(--gs-shell-accent,#1769e8)",animation:"gsLoaderPulse 1s ease-in-out infinite alternate"}}/></div>:<button className="gs-action" style={{marginTop:16}} onClick={retry}>Tentar novamente</button>}
        <style>{`@keyframes gsLoaderPulse{from{transform:translateX(-55%)}to{transform:translateX(115%)}}`}</style>
      </div>
    </div>}
  </div>;
}
