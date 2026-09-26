const STATE_KEY='gsAutoMapperStateV1';
const SCREEN_KEY='gsAutoMapperScreensV1';
const CAPTURE_KEY='gsAutoMapperCapturesV1';
const SETTINGS_KEY='gsAutoMapperSettingsV1';
const DEFAULTS={maxDepth:2,maxActions:120,settleMs:1400,captureScreens:true};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function now(){return new Date().toISOString();}
function allowedUrl(url=''){
  try{const u=new URL(url);return u.protocol==='https:'&&/(^|\.)shopee\.com\.br$/i.test(u.hostname)||u.protocol==='https:'&&/(^|\.)seller\.shopee\.com\.br$/i.test(u.hostname);}catch{return false;}
}
async function readState(){return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY]||null;}
async function writeState(state){
  state.updatedAt=now();
  state.lastHeartbeat=now();
  state.lastCheckpointAt=now();
  state.checkpointCount=(state.checkpointCount||0)+1;
  state.percent=calcPercent(state);
  await chrome.storage.local.set({[STATE_KEY]:state});
  try{state.storedBytes=await chrome.storage.local.getBytesInUse([STATE_KEY,SCREEN_KEY,CAPTURE_KEY]);}catch{}
  return state;
}
function calcPercent(s){const total=(s.processed||0)+(s.queue?.length||0);if(!total)return s.status==='completed'?100:0;return Math.max(0,Math.min(99,Math.round((s.processed/total)*100)));}
async function apiCount(){const x=await chrome.storage.local.get(CAPTURE_KEY);return Array.isArray(x[CAPTURE_KEY])?x[CAPTURE_KEY].length:0;}
async function waitTab(tabId,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){const tab=await chrome.tabs.get(tabId).catch(()=>null);if(!tab)return null;if(tab.status==='complete')return tab;await sleep(250);}return chrome.tabs.get(tabId).catch(()=>null);}
async function activate(tabId){const tab=await chrome.tabs.get(tabId);await chrome.tabs.update(tabId,{active:true}).catch(()=>{});await chrome.windows.update(tab.windowId,{focused:true}).catch(()=>{});await sleep(120);return tab;}
async function capture(tabId,state,label){if(!state.settings.captureScreens)return null;try{const tab=await activate(tabId);const dataUrl=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});const screens=(await chrome.storage.local.get(SCREEN_KEY))[SCREEN_KEY]||[];const index=screens.length+1;const name=`screenshots/${String(index).padStart(4,'0')}-${label}.png`;screens.push({name,dataUrl,url:tab.url,title:tab.title||'',at:now(),label});await chrome.storage.local.set({[SCREEN_KEY]:screens});state.screenshots=screens.length;return name;}catch(e){state.errors.push({at:now(),stage:'screenshot',error:String(e)});return null;}}

async function scan(tabId){
  const [{result}]=await chrome.scripting.executeScript({target:{tabId},world:'ISOLATED',func:()=>{
    const destructive=/(excluir|apagar|deletar|remover|cancelar\s+(pedido|venda|campanha|oferta)|encerrar\s+conta|banir|suspender)/i;
    const transactional=/(comprar|pagar|pagamento|finalizar|publicar|confirmar|salvar|aplicar|enviar|cadastrar|criar\s+(campanha|oferta|promo[cç][aã]o)|recarga|adicionar\s+saldo)/i;
    const toggles=/(ativar|desativar|ligar|desligar|habilitar|desabilitar|pausar|retomar|impulsionar|prote[cç][aã]o\s+de\s+roas)/i;
    const moneyRisk=/(or[cç]amento|meta\s+de\s+roas|roas\s+alvo|pre[cç]o|desconto|estoque|lance|budget|saldo|ads\s+credit)/i;
    const accountRisk=/(desconectar|sair\s+da\s+conta|logout|alterar\s+senha|trocar\s+senha)/i;
    const nodes=[...document.querySelectorAll('a[href],button,[role="button"],[role="tab"],[role="menuitem"],input[type="button"],input[type="submit"],[onclick]')];
    const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>2&&r.height>2&&s.visibility!=='hidden'&&s.display!=='none'&&!el.disabled;};
    const clean=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,180);
    const selector=el=>{if(el.id)return '#'+(CSS.escape?CSS.escape(el.id):el.id.replace(/[^\w-]/g,'\\$&'));const test=el.getAttribute('data-testid');if(test)return `[data-testid="${test.replace(/"/g,'\\"')}"]`;const aria=el.getAttribute('aria-label');if(aria&&aria.length<100)return `${el.tagName.toLowerCase()}[aria-label="${aria.replace(/"/g,'\\"')}"]`;let path=[],cur=el;while(cur&&cur.nodeType===1&&path.length<5){let part=cur.tagName.toLowerCase();const cls=[...cur.classList].filter(x=>x&&x.length<60).slice(0,2);if(cls.length)part+='.'+cls.map(x=>(CSS.escape?CSS.escape(x):x.replace(/[^\w-]/g,'\\$&'))).join('.');const parent=cur.parentElement;if(parent){const same=[...parent.children].filter(x=>x.tagName===cur.tagName);if(same.length>1)part+=`:nth-of-type(${same.indexOf(cur)+1})`;}path.unshift(part);cur=parent;}return path.join(' > ');};
    const seen=new Set(),elements=[];
    for(const el of nodes){if(elements.length>=160||!visible(el))continue;const text=clean(el.innerText||el.value||el.getAttribute('aria-label')||el.title);const href=el.href||null;const sel=selector(el);if(!sel||seen.has(sel))continue;seen.add(sel);const blob=`${text} ${href||''}`;
    const type=String(el.getAttribute('type')||'').toLowerCase();
    const role=String(el.getAttribute('role')||'').toLowerCase();
    const form=el.closest('form');
    const formMethod=String(form?.getAttribute('method')||'get').toLowerCase();
    let riskReason=null;
    if(destructive.test(blob))riskReason='ação destrutiva';
    else if(accountRisk.test(blob))riskReason='conta/sessão';
    else if(toggles.test(blob))riskReason='ativação/desativação';
    else if(transactional.test(blob))riskReason='ação transacional';
    else if(moneyRisk.test(blob)&&(/button|submit|switch/.test(`${el.tagName.toLowerCase()} ${type} ${role}`)||el.getAttribute('aria-pressed')!==null))riskReason='configuração financeira/comercial';
    else if(type==='submit'||role==='switch'||role==='checkbox'||role==='radio'||el.getAttribute('aria-pressed')!==null)riskReason='controle mutável';
    else if(form&&formMethod!=='get'&&el.tagName.toLowerCase()==='button')riskReason='envio de formulário';
    const dangerous=!!riskReason;
    elements.push({selector:sel,text,tag:el.tagName.toLowerCase(),role:el.getAttribute('role')||null,href,dangerous,riskReason,rect:(()=>{const r=el.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}})()});}
    return{url:location.href,title:document.title,elements};
  }});
  return result||{url:'',title:'',elements:[]};
}

function taskKey(t){return `${t.pageUrl}::${t.selector}`;}
function pageKey(url){try{const u=new URL(url);u.hash='';return u.toString();}catch{return url;}}
function enqueueFromScan(state,page,depth,parent=null){const pkey=pageKey(page.url);if(!state.pages.some(p=>p.url===pkey))state.pages.push({url:pkey,title:page.title,depth,firstSeenAt:now(),elements:page.elements.length});for(const el of page.elements){const task={pageUrl:pkey,pageTitle:page.title,selector:el.selector,label:el.text||el.role||el.tag,tag:el.tag,role:el.role,href:el.href,dangerous:!!el.dangerous,riskReason:el.riskReason||null,depth,parent};const key=taskKey(task);if(state.visited[key]||state.queued[key])continue;state.queued[key]=true;state.queue.push(task);state.discovered++;}}

async function clickElement(tabId,task){
  const [{result}]=await chrome.scripting.executeScript({target:{tabId},world:'ISOLATED',args:[task.selector],func:(selector)=>{const el=document.querySelector(selector);if(!el)return{ok:false,error:'Elemento não encontrado'};try{el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});}catch{}const text=(el.innerText||el.value||el.getAttribute('aria-label')||'').trim();const href=el.href||null;el.click();return{ok:true,text,href};}});
  return result||{ok:false,error:'Sem retorno do clique'};
}

async function processTask(state,task){
  state.currentAction={label:task.label,pageUrl:task.pageUrl,selector:task.selector,at:now()};
  if(task.dangerous){state.skipped++;state.protectedSkipped=(state.protectedSkipped||0)+1;state.logs.push({at:now(),type:'skip-protected',reason:task.riskReason||'ação potencialmente mutável',task});return;}
  if(task.href&&!allowedUrl(task.href)){state.skipped++;state.logs.push({at:now(),type:'skip-external',task});return;}
  let tab=await chrome.tabs.get(state.rootTabId).catch(()=>null);if(!tab)throw new Error('A aba principal foi fechada.');
  if(pageKey(tab.url||'')!==pageKey(task.pageUrl)){await chrome.tabs.update(tab.id,{url:task.pageUrl});tab=await waitTab(tab.id);await sleep(500);}
  if(!tab||!allowedUrl(tab.url||task.pageUrl)){state.skipped++;return;}
  await capture(tab.id,state,'antes');
  const beforeTabs=await chrome.tabs.query({windowId:tab.windowId});const beforeIds=new Set(beforeTabs.map(t=>t.id));
  const click=await clickElement(tab.id,task).catch(e=>({ok:false,error:String(e)}));
  if(!click.ok){state.errors.push({at:now(),stage:'click',task,error:click.error});return;}
  await sleep(state.settings.settleMs);
  const afterTabs=await chrome.tabs.query({windowId:tab.windowId});
  const child=afterTabs.find(t=>!beforeIds.has(t.id)&&t.openerTabId===tab.id);
  let target=child||await chrome.tabs.get(tab.id).catch(()=>null);
  if(target){target=await waitTab(target.id,9000)||target;await capture(target.id,state,'depois');if(allowedUrl(target.url||'')){const page=await scan(target.id).catch(()=>null);if(page&&task.depth<state.settings.maxDepth)enqueueFromScan(state,page,task.depth+1,taskKey(task));}}
  state.logs.push({at:now(),type:'click',task,result:{url:target?.url||null,newTab:!!child}});
  if(child){await chrome.tabs.remove(child.id).catch(()=>{});await activate(tab.id).catch(()=>{});}else{const current=await chrome.tabs.get(tab.id).catch(()=>null);if(current&&pageKey(current.url||'')!==pageKey(task.pageUrl)){await chrome.tabs.update(tab.id,{url:task.pageUrl});await waitTab(tab.id);await sleep(350);}else if(current){await chrome.tabs.reload(tab.id).catch(()=>{});await waitTab(tab.id,8000).catch(()=>{});await sleep(250);}}
}

async function finish(state,status='completed',error=null){state.status=status;state.currentAction=null;state.apiCount=await apiCount();if(error)state.errors.push({at:now(),stage:'run',error:String(error)});if(status==='completed')state.percent=100;const captureRestore=state.previousResearchCapture===true;await chrome.storage.local.set({gsResearchCapture:captureRestore});return writeState(state);}

async function runLoop(){
  let state=await readState();if(!state||state.status!=='running')return;
  try{
    while(true){state=await readState();if(!state)return;if(state.status==='paused'){await sleep(500);continue;}if(state.status==='stopping'){await finish(state,'stopped');return;}if(state.status!=='running')return;
      if(state.processed>=state.settings.maxActions||state.queue.length===0){await finish(state,'completed');return;}
      const task=state.queue.shift();delete state.queued[taskKey(task)];const key=taskKey(task);if(state.visited[key])continue;state.visited[key]=true;
      await processTask(state,task).catch(e=>state.errors.push({at:now(),stage:'task',task,error:String(e)}));state.processed++;state.apiCount=await apiCount();await writeState(state);
    }
  }catch(e){state=await readState()||state;await finish(state,'error',e);}
}

async function startMapper(options={}){
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});if(!tab?.id)throw new Error('Nenhuma aba ativa.');if(!allowedUrl(tab.url||''))throw new Error('Abra uma página da Shopee ou Seller Center antes de iniciar.');
  const prev=(await chrome.storage.local.get('gsResearchCapture')).gsResearchCapture===true;await chrome.storage.local.set({gsResearchCapture:true,[SCREEN_KEY]:[],[CAPTURE_KEY]:[]});
  const settings={...DEFAULTS,...options};const state={sessionId:`map-${Date.now()}`,status:'running',startedAt:now(),updatedAt:now(),rootTabId:tab.id,rootWindowId:tab.windowId,rootUrl:tab.url,settings,previousResearchCapture:prev,queue:[],queued:{},visited:{},pages:[],logs:[],errors:[],discovered:0,processed:0,skipped:0,protectedSkipped:0,screenshots:0,apiCount:0,currentAction:null,percent:0,lastHeartbeat:now(),lastCheckpointAt:now(),checkpointCount:0,storedBytes:0};
  const page=await scan(tab.id);enqueueFromScan(state,page,0,null);await capture(tab.id,state,'inicio');await writeState(state);runLoop();return state;
}

async function exportData(){const state=await readState();const all=await chrome.storage.local.get([SCREEN_KEY,CAPTURE_KEY]);return{state,screens:all[SCREEN_KEY]||[],apis:all[CAPTURE_KEY]||[]};}

chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(!message?.type?.startsWith('GS_MAPPER_'))return;
  (async()=>{
    try{
      if(message.type==='GS_MAPPER_START')return{ok:true,state:await startMapper(message.options||{})};
      const state=await readState();
      if(message.type==='GS_MAPPER_STATUS'){
        if(state?.status==='running'&&state?.lastHeartbeat&&Date.now()-new Date(state.lastHeartbeat).getTime()>90000){
          state.status='interrupted';state.currentAction=null;await writeState(state);
        }
        return{ok:true,state};
      }
      if(message.type==='GS_MAPPER_PAUSE'&&state){state.status='paused';return{ok:true,state:await writeState(state)};}
      if(message.type==='GS_MAPPER_RESUME'&&state&&['paused','interrupted','stopped','error'].includes(state.status)){state.status='running';await writeState(state);runLoop();return{ok:true,state};}
      if(message.type==='GS_MAPPER_STOP'&&state){state.status='stopping';return{ok:true,state:await writeState(state)};}
      if(message.type==='GS_MAPPER_EXPORT')return{ok:true,data:await exportData()};
      if(message.type==='GS_MAPPER_CLEAR'){await chrome.storage.local.remove([STATE_KEY,SCREEN_KEY,CAPTURE_KEY,SETTINGS_KEY]);return{ok:true};}
      return{ok:false,error:'Ação desconhecida'};
    }catch(e){return{ok:false,error:String(e?.message||e)};}
  })().then(sendResponse);return true;
});
