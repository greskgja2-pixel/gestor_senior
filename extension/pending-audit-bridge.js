import './src/analysis-handoff-flow.js';
import './src/analysis-handoff-guard.js';

(() => {
  'use strict';
  const KEY='gsPendingGuidedAuditV1';
  let busy=false;
  let lastSignature='';

  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  async function consume(pending){
    if(busy||!pending?.url)return;
    const age=Date.now()-Number(pending.createdAt||0);
    if(!Number.isFinite(age)||age>180000){
      await chrome.storage.local.remove(KEY).catch(()=>{});
      return;
    }
    const signature=`${pending.url}|${pending.createdAt}`;
    if(signature===lastSignature)return;
    lastSignature=signature;
    busy=true;
    try{
      await chrome.storage.local.remove(KEY).catch(()=>{});
      document.querySelector('nav button[data-tab="analyze"]')?.click();
      document.querySelector('#resetWizard')?.click();
      const input=document.querySelector('#auditUrl');
      const start=document.querySelector('#startAudit');
      if(!input||!start)return;
      input.value=String(pending.url);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      await wait(80);
      start.click();
    }finally{
      busy=false;
    }
  }

  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local'||!changes[KEY]?.newValue)return;
    consume(changes[KEY].newValue).catch(()=>{});
  });

  setTimeout(()=>{
    chrome.storage.local.get(KEY).then(x=>consume(x[KEY])).catch(()=>{});
  },400);
})();
