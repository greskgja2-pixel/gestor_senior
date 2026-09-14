const DEFAULT_BASE='https://shopeeos-real.vercel.app';
export async function getSettings(){const {gsSettings={}}=await chrome.storage.local.get('gsSettings');return {gestorBaseUrl:DEFAULT_BASE,...gsSettings};}
async function request(path,opt={}){const s=await getSettings();const base=String(s.gestorBaseUrl||DEFAULT_BASE).replace(/\/$/,'');const r=await fetch(base+path,{cache:'no-store',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let j={};try{j=await r.json()}catch{}if(!r.ok||j?.error)throw new Error(j?.error||`HTTP ${r.status}`);return j;}
export const gestorApi={
  products:()=>request('/api/shopee/products'),
  ads:(days=7)=>request(`/api/shopee/ads?days=${encodeURIComponent(days)}`),
  protection:()=>request('/api/shopee/ads-protection'),
  syncProtection:payload=>request('/api/shopee/ads-protection',{method:'POST',body:JSON.stringify(payload)}),
  adsAction:payload=>request('/api/shopee/ads-action',{method:'POST',body:JSON.stringify(payload)}),
  recommendation:itemId=>request(`/api/shopee/ads-recommendation?item_id=${encodeURIComponent(itemId)}`)
};
