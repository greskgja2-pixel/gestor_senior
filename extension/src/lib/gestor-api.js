import {computeProfit,DEFAULT_FINANCE} from './profit-engine.js';
import {buildCompetitorInsights} from './super-anuncio-engine.js';

const DEFAULT_BASE='https://shopeeos-real.vercel.app';
const EXTENSION_BUILD='0.12.0';
export async function getSettings(){const {gsSettings={}}=await chrome.storage.local.get('gsSettings');return {gestorBaseUrl:DEFAULT_BASE,...gsSettings};}
async function request(path,opt={}){const s=await getSettings();const base=String(s.gestorBaseUrl||DEFAULT_BASE).replace(/\/$/,'');const r=await fetch(base+path,{cache:'no-store',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let j={};try{j=await r.json()}catch{}if(!r.ok||j?.error)throw new Error(j?.error||`HTTP ${r.status}`);return j;}
async function competitors(itemId){return{itemId:String(itemId),query:null,competitors:[],source:'manual-shopee-picker',attempts:[]};}
const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
function normalizeModels(raw){const list=raw?.response?.model||raw?.response?.model_list||raw?.model||raw?.models||[];return(Array.isArray(list)?list:[]).map((m,i)=>({modelId:n(m.model_id??m.id),name:m.model_name||m.name||m.model_sku||`Variação ${i+1}`,sku:m.model_sku||'',price:n(m.price_info?.current_price??m.price),stock:n(m.stock_info_v2?.summary_info?.total_available_stock??m.stock_info?.normal_stock??m.stock)})).filter(x=>x.modelId!=null);}
async function enrichAnalysisPayload(payload={}){
  const itemId=n(payload.item_id??payload.itemId),product={...(payload.product_snapshot||payload.product||{})},metrics={...(payload.metrics||{})},report={...(payload.report||{})};
  let variations=Array.isArray(product.variations)?product.variations.filter(Boolean):[];
  if(itemId&&(!variations.length||variations.some(v=>n(v.price)==null))){
    try{
      const [modelRaw,costRaw]=await Promise.all([request(`/api/shopee/catalog?resource=models&item_id=${encodeURIComponent(itemId)}`),request('/api/shopee/product-costs')]);
      const models=normalizeModels(modelRaw),costs=Array.isArray(costRaw?.costs)?costRaw.costs:[],base=costs.find(x=>String(x.item_id)===String(itemId)&&Number(x.model_id)===0),sales=n(metrics.sales),spend=n(metrics.spend),adsCostPerSale=sales&&spend!=null?spend/sales:0;
      variations=models.map(m=>{const specific=costs.find(x=>String(x.item_id)===String(itemId)&&String(x.model_id)===String(m.modelId)),cost=n(specific?.cost??base?.cost),calc=m.price!=null&&cost!=null?computeProfit({price:m.price,productCost:cost,adsCostPerSale,...DEFAULT_FINANCE}):null;return{...m,cost,profit:calc?.valid?calc.profit:null,marginPct:calc?.valid?calc.marginPct:null};});
    }catch{}
  }
  if(variations.length){product.variations=variations;product.variationCount=variations.length;const prices=variations.map(v=>n(v.price)).filter(v=>v!=null);if(prices.length){product.priceMin=Math.min(...prices);product.priceMax=Math.max(...prices);}}
  if(!report.competitorInsights){try{report.competitorInsights=buildCompetitorInsights({title:product.title||product.item_name,price:n(metrics.price??product.price),product},Array.isArray(payload.competitors)?payload.competitors:[]);}catch{}}
  return {...payload,extension_version:EXTENSION_BUILD,product_snapshot:product,report};
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
  saveAnalysisReport:async payload=>request('/api/extension-intelligence/reports',{method:'POST',body:JSON.stringify(await enrichAnalysisPayload(payload))}),
  schedules:()=>request('/api/extension-intelligence/schedules'),
  saveSchedule:payload=>request('/api/extension-intelligence/schedules',{method:'POST',body:JSON.stringify(payload)})
};