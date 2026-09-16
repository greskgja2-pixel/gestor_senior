(() => {
  'use strict';
  const RESULT_KEY='gsCompetitorPickerResultV1';
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
  async function manualPicker(message){
    if(activeRequest)throw new Error('Já existe uma seleção de concorrentes em andamento.');
    const title=String(message?.title||titleFromValidation()).trim();
    const ownItemId=String(message?.ownItemId||idsFromValidation()||'');
    if(!title)throw new Error('Não consegui identificar o título para abrir a pesquisa da Shopee.');
    const requestId=crypto.randomUUID();
    const [returnTab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    await chrome.storage.local.remove(RESULT_KEY).catch(()=>{});
    const hash=new URLSearchParams({gs_competitor_picker:requestId,gs_own_item:ownItemId}).toString();
    const url=`https://shopee.com.br/search?keyword=${encodeURIComponent(title)}#${hash}`;
    const picker=await chrome.tabs.create({url,active:true});
    activeRequest={requestId,pickerTabId:picker.id,returnTabId:returnTab?.id||null};
    try{
      const result=await waitForResult(requestId,picker.id);
      const items=Array.isArray(result?.items)?result.items.slice(0,3):[];
      if(items.length!==3)throw new Error(`Selecione exatamente 3 concorrentes. Foram recebidos ${items.length}.`);
      autoContinue=true;
      return{ok:true,items,source:{indexed:0,live:0,manual:items.length}};
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
    await wait(100);
    const next=document.querySelector('#step3Next');if(next&&!next.disabled)next.click();
  }
  new MutationObserver(()=>continueWhenRendered().catch(()=>{})).observe(document.documentElement,{subtree:true,childList:true});
})();

(() => {
  'use strict';
  let manualReviewCount=null,currentItemId=null;
  const originalFetch=window.fetch.bind(window);

  function parseCount(raw){
    const text=String(raw??'').trim().toLowerCase();if(!text)return null;
    const mult=/\b(mil|k)\b/.test(text)?1000:1;
    const cleaned=text.replace(/\b(mil|k)\b/g,'').replace(/\+/g,'').replace(/[^\d.,]/g,'');if(!cleaned)return null;
    const value=mult===1000?Number(cleaned.includes(',')?cleaned.replace(/\./g,'').replace(',','.'):cleaned):Number(cleaned.replace(/\./g,'').replace(',','.'));
    return Number.isFinite(value)&&value>=0?Math.round(value*mult):null;
  }
  function itemIdFromBox(box){return String(box?.innerText||'').match(/\bID\s+(\d{6,})\b/i)?.[1]||null;}
  function enhanceReviewCount(){
    const version=document.querySelector('.version');if(version)version.textContent='v0.12.2';
    const wizardInfo=document.querySelector('#tab-analyze .wizard-head .muted');if(wizardInfo)wizardInfo.textContent=wizardInfo.textContent.replace(/v\d+\.\d+\.\d+/,'v0.12.2');
    const box=document.getElementById('productValidation');if(!box||box.hidden)return;
    const itemId=itemIdFromBox(box);if(itemId&&itemId!==currentItemId){currentItemId=itemId;manualReviewCount=null;}
    const cell=[...box.querySelectorAll('.validation-grid > div')].find(x=>String(x.querySelector('span')?.textContent||'').trim().toLowerCase()==='qtd. avaliações');
    if(!cell)return;const value=cell.querySelector('b');if(!value)return;
    const rawText=String(value.textContent||'').trim();if(manualReviewCount==null&&!rawText.startsWith('N/A'))return;
    let pencil=value.querySelector('[data-review-pencil]');
    if(manualReviewCount!=null){const textNode=[...value.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(textNode)textNode.nodeValue=String(manualReviewCount);else value.prepend(document.createTextNode(String(manualReviewCount)));}
    if(pencil)return;
    pencil=document.createElement('button');pencil.type='button';pencil.dataset.reviewPencil='1';pencil.textContent='✎';pencil.title='Informar quantidade de avaliações manualmente';
    Object.assign(pencil.style,{marginLeft:'7px',width:'24px',height:'24px',borderRadius:'7px',border:'1px solid #496b8d',background:'#10263b',color:'#f4ce45',cursor:'pointer',fontWeight:'900',lineHeight:'1',padding:'0'});
    pencil.addEventListener('click',()=>{const raw=window.prompt('Quantidade de avaliações deste anúncio:',manualReviewCount==null?'':String(manualReviewCount));if(raw===null)return;const parsed=parseCount(raw);if(parsed==null){window.alert('Digite uma quantidade válida. Ex.: 23, 1000 ou 1mil+.');return;}manualReviewCount=parsed;const textNode=[...value.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(textNode)textNode.nodeValue=String(parsed);else value.prepend(document.createTextNode(String(parsed)));});
    value.appendChild(pencil);
  }

  window.fetch=async(input,init={})=>{
    try{
      const url=typeof input==='string'?input:input?.url||'',method=String(init?.method||(typeof input!=='string'?input?.method:'')||'GET').toUpperCase();
      if(manualReviewCount!=null&&method==='POST'&&/\/api\/extension-intelligence\/reports(?:\?|$)/.test(url)&&typeof init?.body==='string'){
        const body=JSON.parse(init.body);if(body?.product_snapshot&&(!currentItemId||String(body.item_id??body.itemId)===String(currentItemId))){body.product_snapshot.reviewCount=manualReviewCount;init={...init,body:JSON.stringify(body)};}
      }
    }catch{}
    return originalFetch(input,init);
  };
  const observer=new MutationObserver(enhanceReviewCount);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceReviewCount,{once:true});else enhanceReviewCount();
})();
