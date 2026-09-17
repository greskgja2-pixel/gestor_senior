(() => {
  'use strict';
  const RESULT_KEY='gsCompetitorPickerResultV1';
  const DEEP_KEY='gsCompetitorDeepProfilesV1';
  const originalSend=chrome.runtime.sendMessage.bind(chrome.runtime);
  let activeRequest=null;
  let autoContinue=false;

  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  function idsFromValidation(){
    const text=document.querySelector('#productValidation')?.textContent||'';
    const m=text.match(/\bID\s+(\d{6,})\b/i);
    return m?.[1]||null;
  }
  function titleFromValidation(){
    return document.querySelector('#productValidation .product-check-head strong')?.textContent?.trim()||'';
  }
  function setStatus(text){const el=document.querySelector('#competitorStatus');if(el)el.textContent=text;}
  async function waitForResult(requestId,pickerTabId,timeout=15*60*1000){
    return new Promise((resolve,reject)=>{
      let settled=false;
      const cleanup=()=>{clearTimeout(timer);chrome.storage.onChanged.removeListener(onStorage);chrome.tabs.onRemoved.removeListener(onRemoved);};
      const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value);};
      const check=value=>{if(value?.requestId!==requestId)return;if(value.cancelled)finish(reject,new Error('Seleção de concorrentes cancelada.'));else finish(resolve,value);};
      const onStorage=(changes,area)=>{if(area==='local'&&changes[RESULT_KEY]?.newValue)check(changes[RESULT_KEY].newValue);};
      const onRemoved=tabId=>{if(tabId===pickerTabId)finish(reject,new Error('A aba de seleção de concorrentes foi fechada antes da confirmação.'));};
      const timer=setTimeout(()=>finish(reject,new Error('Tempo esgotado aguardando a escolha dos concorrentes.')),timeout);
      chrome.storage.onChanged.addListener(onStorage);chrome.tabs.onRemoved.addListener(onRemoved);
      chrome.storage.local.get(RESULT_KEY).then(x=>check(x[RESULT_KEY])).catch(()=>{});
    });
  }
  async function waitTab(tabId,timeout=22000){
    const start=Date.now();
    while(Date.now()-start<timeout){
      const tab=await chrome.tabs.get(tabId).catch(()=>null);if(!tab)throw new Error('A aba do concorrente foi fechada.');
      if(tab.status==='complete')return tab;await wait(350);
    }
    throw new Error('O concorrente demorou demais para carregar.');
  }
  async function readDeep(tabId,item){
    let last=null;
    for(let i=0;i<18;i++){
      try{
        const r=await chrome.tabs.sendMessage(tabId,{type:'GS_PARSE_COMPETITOR_DEEP',itemId:item.itemId,shopId:item.shopId});
        if(r?.ok)return r;last=new Error(r?.error||'Dados ainda indisponíveis.');
      }catch(e){last=e;}
      await wait(450);
    }
    throw last||new Error('Não consegui ler os detalhes do concorrente.');
  }
  async function enrichOne(item,index,total){
    setStatus(`Analisando concorrente ${index+1}/${total}: descrição, imagens, vídeo, variações e oferta…`);
    const tab=await chrome.tabs.create({url:item.link,active:false});
    try{
      await waitTab(tab.id);await wait(500);
      const deep=await readDeep(tab.id,item);
      return{...item,...deep,link:item.link||deep.url,deepCollected:true,deepCollectedAt:new Date().toISOString()};
    }catch(e){
      return{...item,deepCollected:false,deepError:String(e?.message||e)};
    }finally{await chrome.tabs.remove(tab.id).catch(()=>{});}
  }
  async function enrichCompetitors(items,requestId){
    const out=[];
    for(let i=0;i<items.length;i++)out.push(await enrichOne(items[i],i,items.length));
    await chrome.storage.local.set({[DEEP_KEY]:{requestId,createdAt:Date.now(),items:out}}).catch(()=>{});
    const ok=out.filter(x=>x.deepCollected).length;
    setStatus(`Análise profunda concluída: ${ok}/${out.length} concorrente(s) lido(s). Gerando Raio-X…`);
    return out;
  }
  async function manualPicker(message){
    if(activeRequest)throw new Error('Já existe uma seleção de concorrentes em andamento.');
    const title=String(message?.title||titleFromValidation()).trim();
    const ownItemId=String(message?.ownItemId||idsFromValidation()||'');
    if(!title)throw new Error('Não consegui identificar o título para abrir a pesquisa da Shopee.');
    const requestId=crypto.randomUUID();
    const [returnTab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    await chrome.storage.local.remove([RESULT_KEY,DEEP_KEY]).catch(()=>{});
    const hash=new URLSearchParams({gs_competitor_picker:requestId,gs_own_item:ownItemId}).toString();
    const url=`https://shopee.com.br/search?keyword=${encodeURIComponent(title)}#${hash}`;
    const picker=await chrome.tabs.create({url,active:true});
    activeRequest={requestId,pickerTabId:picker.id,returnTabId:returnTab?.id||null};
    try{
      const result=await waitForResult(requestId,picker.id);
      let items=Array.isArray(result?.items)?result.items.slice(0,3):[];
      if(items.length!==3)throw new Error(`Selecione exatamente 3 concorrentes. Foram recebidos ${items.length}.`);
      items=await enrichCompetitors(items,requestId);
      autoContinue=true;
      return{ok:true,items,source:{indexed:0,live:0,manual:items.length,deep:items.filter(x=>x.deepCollected).length}};
    }finally{
      if(activeRequest?.returnTabId)await chrome.tabs.update(activeRequest.returnTabId,{active:true}).catch(()=>{});
      if(activeRequest?.pickerTabId)await chrome.tabs.remove(activeRequest.pickerTabId).catch(()=>{});
      await chrome.storage.local.remove(RESULT_KEY).catch(()=>{});
      activeRequest=null;
    }
  }

  const patched=function(message,...rest){
    if(message?.type==='GS_SEARCH_COMPETITORS')return manualPicker(message);
    return originalSend(message,...rest);
  };
  try{chrome.runtime.sendMessage=patched;}catch{try{Object.defineProperty(chrome.runtime,'sendMessage',{value:patched,configurable:true});}catch{}}

  async function continueWhenRendered(){
    if(!autoContinue)return;
    const list=document.querySelector('#competitorList');
    const inputs=[...(list?.querySelectorAll('input[type="checkbox"]')||[])];
    if(inputs.length<3)return;
    autoContinue=false;
    for(const input of inputs.slice(0,3)){if(!input.checked){input.click();await wait(30);}}
    await wait(120);
    const next=document.querySelector('#step3Next');if(next&&!next.disabled)next.click();
  }
  new MutationObserver(()=>continueWhenRendered().catch(()=>{})).observe(document.documentElement,{subtree:true,childList:true});
})();
