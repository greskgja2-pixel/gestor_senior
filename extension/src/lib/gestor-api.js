const DEFAULT_BASE='https://shopeeos-real.vercel.app';
export async function getSettings(){const {gsSettings={}}=await chrome.storage.local.get('gsSettings');return {gestorBaseUrl:DEFAULT_BASE,...gsSettings};}
async function request(path,opt={}){const s=await getSettings();const base=String(s.gestorBaseUrl||DEFAULT_BASE).replace(/\/$/,'');const r=await fetch(base+path,{cache:'no-store',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let j={};try{j=await r.json()}catch{}if(!r.ok||j?.error)throw new Error(j?.error||`HTTP ${r.status}`);return j;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitTabComplete(tabId,timeout=10000){const start=Date.now();while(Date.now()-start<timeout){const t=await chrome.tabs.get(tabId).catch(()=>null);if(!t)return false;if(t.status==='complete')return true;await sleep(250);}return false;}
async function browserCompetitors(itemId,title){
  if(!title)return[];
  const tab=await chrome.tabs.create({url:`https://shopee.com.br/search?keyword=${encodeURIComponent(title)}`,active:false});
  try{
    await waitTabComplete(tab.id);await sleep(500);
    for(let i=0;i<3;i++){
      try{
        const r=await chrome.tabs.sendMessage(tab.id,{type:'GS_COLLECT_SEARCH',options:{max:40,scrollSteps:6,delayMs:350}});
        if(r?.ok&&Array.isArray(r.items)&&r.items.length)return r.items.filter(x=>String(x.itemId)!==String(itemId)).map(x=>({...x,url:x.url||x.link,image:x.image||x.imageUrl,source:'browser-shopee-search'})).slice(0,20);
      }catch{}
      await sleep(550);
    }
    return[];
  }finally{if(tab?.id)chrome.tabs.remove(tab.id).catch(()=>{});}
}
async function competitors(itemId){
  let server=null;
  try{server=await request(`/api/shopee/competitors?item_id=${encodeURIComponent(itemId)}`);}catch(e){server={competitors:[],attempts:[{query:'Gestor API',ok:false,error:String(e?.message||e)}]};}
  if((server?.competitors||[]).length)return server;
  let title='';
  try{const p=await request('/api/shopee/products');title=(p.items||[]).find(x=>String(x.item_id)===String(itemId))?.item_name||'';}catch{}
  const live=await browserCompetitors(itemId,title).catch(()=>[]);
  return {...server,query:title||server?.query||'',competitors:live,source:live.length?'browser-shopee-search':server?.source,attempts:[...(server?.attempts||[]),{query:title||'título completo',ok:live.length>0,count:live.length,source:'browser-session'}]};
}
export const gestorApi={
  products:()=>request('/api/shopee/products'),
  connection:()=>request('/api/shopee/connection'),
  ads:(days=7)=>request(`/api/shopee/ads?days=${encodeURIComponent(days)}`),
  analytics:(from,to)=>request(`/api/shopee/ads-analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  competitors,
  protection:()=>request('/api/shopee/ads-protection'),
  syncProtection:payload=>request('/api/shopee/ads-protection',{method:'POST',body:JSON.stringify(payload)}),
  adsAction:payload=>request('/api/shopee/ads-action',{method:'POST',body:JSON.stringify(payload)}),
  recommendation:itemId=>request(`/api/shopee/ads-recommendation?item_id=${encodeURIComponent(itemId)}`),
  publicProduct:itemId=>request(`/api/shopee/product-public?item_ids=${encodeURIComponent(itemId)}`),
  categories:()=>request('/api/shopee/catalog?resource=categories'),
  models:itemId=>request(`/api/shopee/catalog?resource=models&item_id=${encodeURIComponent(itemId)}`),
  productCosts:()=>request('/api/shopee/product-costs'),
  saveProductCost:payload=>request('/api/shopee/product-costs',{method:'POST',body:JSON.stringify(payload)}),
  analysisReports:(itemId=null)=>request(`/api/extension-intelligence/reports${itemId?`?item_id=${encodeURIComponent(itemId)}`:''}`),
  saveAnalysisReport:payload=>request('/api/extension-intelligence/reports',{method:'POST',body:JSON.stringify(payload)}),
  schedules:()=>request('/api/extension-intelligence/schedules'),
  saveSchedule:payload=>request('/api/extension-intelligence/schedules',{method:'POST',body:JSON.stringify(payload)})
};
