(() => {
  'use strict';
  const SOURCE='GESTOR_SENIOR_EXTENSION';
  if(window.__GS_CONTENT_V1__)return;window.__GS_CONTENT_V1__=true;
  function send(type,payload={}){try{return chrome.runtime.sendMessage({type,...payload});}catch{return Promise.resolve(null)}}
  function hookState(enabled){window.postMessage({source:SOURCE,type:'HOOK_STATE',enabled:!!enabled},'*');}
  window.addEventListener('message',event=>{if(event.source!==window)return;const m=event.data;if(!m||m.source!==SOURCE||m.type!=='NETWORK_CAPTURE'||!m.detail)return;send('GS_NETWORK_CAPTURE',{capture:m.detail});});
  chrome.runtime.onMessage.addListener((msg,_sender,reply)=>{
    if(msg?.type==='GS_SET_RESEARCH_CAPTURE'){hookState(msg.enabled);reply({ok:true});return;}
    if(msg?.type==='GS_PARSE_CURRENT_PRODUCT'){import(chrome.runtime.getURL('src/lib/shopee-parser.js')).then(m=>reply({ok:true,product:m.parseCurrentProduct()})).catch(e=>reply({ok:false,error:String(e)}));return true;}
    if(msg?.type==='GS_COLLECT_SEARCH'){import(chrome.runtime.getURL('src/lib/shopee-parser.js')).then(m=>m.collectSearchResults(msg.options||{})).then(items=>reply({ok:true,items})).catch(e=>reply({ok:false,error:String(e)}));return true;}
  });
  function installButton(){if(document.getElementById('gs-senior-fab')||!document.body)return;const b=document.createElement('button');b.id='gs-senior-fab';b.type='button';b.title='Abrir Gestor Sênior';b.textContent='GS';Object.assign(b.style,{position:'fixed',right:'18px',bottom:'82px',zIndex:'2147483000',width:'48px',height:'48px',borderRadius:'50%',border:'1px solid #c9a227',background:'#0d1b2a',color:'#d4af37',fontWeight:'900',boxShadow:'0 8px 24px #0005',cursor:'pointer'});b.addEventListener('click',()=>send('GS_OPEN_SIDE_PANEL'));document.body.appendChild(b);}
  async function consumeGestorSuperAnalysisLink(){
    try{
      const u=new URL(location.href);if(u.searchParams.get('gs_super_analise')!=='1')return;
      const onceKey=`gs-super-analysis:${u.pathname}`;if(sessionStorage.getItem(onceKey)==='1')return;sessionStorage.setItem(onceKey,'1');
      u.searchParams.delete('gs_super_analise');u.searchParams.delete('gs_source');const clean=u.toString();
      await chrome.storage.local.set({gsPendingGuidedAuditV1:{url:clean,createdAt:Date.now(),source:'gestor-web'}});
      history.replaceState(history.state,'',clean);
      await send('GS_OPEN_SIDE_PANEL');
    }catch(e){console.warn('GS auto Super Analysis',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installButton();consumeGestorSuperAnalysisLink();},{once:true});else{installButton();consumeGestorSuperAnalysisLink();}
  new MutationObserver(()=>{if(!document.getElementById('gs-senior-fab'))installButton();}).observe(document.documentElement,{childList:true,subtree:true});
  chrome.storage.local.get('gsResearchCapture').then(x=>hookState(x.gsResearchCapture===true)).catch(()=>{});
})();
