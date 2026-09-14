import {gestorApi} from './lib/gestor-api.js';
import {analyze} from './lib/super-anuncio-engine.js';
import {DEFAULT_AUTOMATION,evaluateCampaign} from './lib/rules-engine.js';
import {createPeriodicJob,loadJobs,markRun,cancelJob} from './lib/job-engine.js';

const SNAPSHOT_KEY='gsSnapshotsV1';
const COST_KEY='gsProductCostsV1';
const CAPTURE_KEY='gsAutoMapperCapturesV1';
const MAX_CAPTURE_RECORDS=120;

chrome.runtime.onInstalled.addListener(async()=>{
  await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
  const cur=await chrome.storage.local.get(['gsSettings','gsDefaultAutomation']);
  if(!cur.gsSettings)await chrome.storage.local.set({gsSettings:{gestorBaseUrl:'https://shopeeos-real.vercel.app'}});
  if(!cur.gsDefaultAutomation)await chrome.storage.local.set({gsDefaultAutomation:DEFAULT_AUTOMATION});
});
async function activeTab(){const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});return tab;}
async function openPanel(sender){const tabId=sender?.tab?.id||(await activeTab())?.id;if(tabId)await chrome.sidePanel.open({tabId}).catch(()=>{});}
async function getMap(key){const x=await chrome.storage.local.get(key);return x[key]&&typeof x[key]==='object'?x[key]:{};}
async function setMap(key,map){await chrome.storage.local.set({[key]:map});}
function parseJson(text){try{return JSON.parse(text)}catch{return null}}

async function handleProtectionCapture(c){
  if(!/\/api\/pas\/v1\/rebate\/campaign_get\//i.test(c.url||''))return;
  const j=parseJson(c.rawText);const d=j?.data;if(!d)return;
  const campaignId=Number(c.request?.body?.campaign_id);const status=String(d.rebate_campaign_status||'');
  if(!Number.isSafeInteger(campaignId)||!['valid','invalid','unsupported'].includes(status))return;
  try{await gestorApi.syncProtection({campaignId,status,invalidReason:d.invalid_reason||null,totalAmount:d.total_amount??null});}catch(e){console.warn('GS protection sync',e);}
}
async function storeResearchCapture(c){
  const enabled=(await chrome.storage.local.get('gsResearchCapture')).gsResearchCapture===true;if(!enabled)return;
  const x=await chrome.storage.local.get(CAPTURE_KEY),list=Array.isArray(x[CAPTURE_KEY])?x[CAPTURE_KEY]:[];
  list.push({captureId:c.captureId,url:c.url,method:c.method,status:c.status,pageUrl:c.pageUrl,pageTitle:c.pageTitle,timestamp:c.timestamp,request:c.request,responseChars:c.responseChars,oversized:!!c.oversized,rawText:c.rawText?.slice(0,250000)||null});
  await chrome.storage.local.set({[CAPTURE_KEY]:list.slice(-MAX_CAPTURE_RECORDS)});
}
async function searchCompetitors(title,ownItemId){
  const query=String(title||'').replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ ]/g,' ').split(/\s+/).filter(w=>w.length>=3).slice(0,10).join(' ');if(!query)return[];
  const tab=await chrome.tabs.create({url:'https://shopee.com.br/search?keyword='+encodeURIComponent(query),active:false});
  try{for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,400));try{const res=await chrome.tabs.sendMessage(tab.id,{type:'GS_COLLECT_SEARCH',options:{max:20,scrollSteps:8,delayMs:600}});if(res?.ok&&res.items?.length)return res.items.filter(x=>String(x.itemId)!==String(ownItemId)).slice(0,20);}catch{}}return[];}finally{if(tab.id)chrome.tabs.remove(tab.id).catch(()=>{});}
}
async function analyzeCurrent(tabId){
  const parsed=await chrome.tabs.sendMessage(tabId,{type:'GS_PARSE_CURRENT_PRODUCT'}).catch(e=>({ok:false,error:String(e)}));if(!parsed?.ok)throw new Error(parsed?.error||'Não consegui ler o anúncio atual.');
  const product=parsed.product;let competitors=[];if(product?.title)competitors=await searchCompetitors(product.title,product.itemId);let ads=null;
  try{const a=await gestorApi.ads(7),v=a.v7||a.v5||{};ads=(v.campaigns||[]).find(c=>String(c.itemId)===String(product.itemId));}catch{}
  const costs=await getMap(COST_KEY),productCost=Number(costs[String(product.itemId)]?.cost);
  const result=analyze({url:product.url,title:product.title,description:product.description,category:product.category,price:product.price,adsActive:!!ads,roas7d:ads?.roas,roasTarget:ads?.targetRoas,adsSpend7d:ads?.spend,productCost:Number.isFinite(productCost)?productCost:null,product,competitors});
  const snapshots=await getMap(SNAPSHOT_KEY);snapshots[String(product.itemId||product.url)]={at:new Date().toISOString(),product,ads,result};await setMap(SNAPSHOT_KEY,snapshots);return{product,competitors,ads,result};
}
async function runJob(job){
  const products=await gestorApi.products(),ads=await gestorApi.ads(7),v=ads.v7||ads.v5||{},product=(products.items||[]).find(p=>String(p.item_id)===String(job.itemId)),campaign=(v.campaigns||[]).find(c=>String(c.itemId)===String(job.itemId));
  if(!product)return{ok:false,status:'skipped',reason:'Produto não encontrado na loja conectada'};
  const costs=await getMap(COST_KEY),costRec=costs[String(job.itemId)]||{},policy={...DEFAULT_AUTOMATION,...job.policy,finance:{...DEFAULT_AUTOMATION.finance,...job.policy?.finance}},safeProduct={...product,productCost:Number(costRec.cost)};
  const proposals=campaign?evaluateCampaign({campaign,product:safeProduct,policy,lastChangeAt:job.lastChangeAt}):{eligible:false,reasons:['Sem campanha Ads vinculada'],proposals:[]};
  const audit={at:new Date().toISOString(),itemId:job.itemId,campaign:campaign?{campaignId:campaign.campaignId,roas:campaign.roas,targetRoas:campaign.targetRoas,spend:campaign.spend,orders:campaign.orders,clicks:campaign.clicks,impressions:campaign.impressions}:null,decision:proposals,executed:[]};
  if(policy.mode==='automatic'&&proposals.eligible){for(const p of proposals.proposals){if(p.type==='change_roas_target'){const r=await gestorApi.adsAction({campaignId:campaign.campaignId,action:'change_roas_target',mode:campaign.controlMode||'manual',roasTarget:p.target});audit.executed.push({proposal:p,result:r});}if(p.type==='protection_reset'){const r=await gestorApi.adsAction({campaignId:campaign.campaignId,action:'protection_reset',mode:campaign.controlMode||'manual',confirmed:true});audit.executed.push({proposal:p,result:r});}}}
  return{ok:true,status:policy.mode==='automatic'?'executed':'review',audit};
}
chrome.alarms.onAlarm.addListener(async alarm=>{if(!alarm.name.startsWith('gs:listing:'))return;const id=alarm.name.slice(3),jobs=await loadJobs(),job=jobs.find(j=>j.id===id);if(!job||job.status==='cancelled')return;try{const result=await runJob(job);await markRun(job.id,result);await chrome.notifications.create({type:'basic',iconUrl:chrome.runtime.getURL('icon.svg'),title:'Gestor Sênior',message:result.status==='executed'?'Manutenção automática concluída.':'Revisão periódica concluída; confira as sugestões.'}).catch(()=>{});}catch(e){await markRun(job.id,{ok:false,error:String(e)});}});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{(async()=>{switch(msg?.type){case'GS_OPEN_SIDE_PANEL':await openPanel(sender);return{ok:true};case'GS_NETWORK_CAPTURE':await handleProtectionCapture(msg.capture);await storeResearchCapture(msg.capture);return{ok:true};case'GS_ANALYZE_CURRENT':{const tab=await activeTab();if(!tab?.id)throw new Error('Nenhuma aba ativa.');return{ok:true,data:await analyzeCurrent(tab.id)}}case'GS_SEARCH_COMPETITORS':return{ok:true,items:await searchCompetitors(msg.title,msg.ownItemId)};case'GS_SAVE_COST':{const map=await getMap(COST_KEY);map[String(msg.itemId)]={cost:Number(msg.cost),updatedAt:new Date().toISOString()};await setMap(COST_KEY,map);return{ok:true}}case'GS_CREATE_JOB':return{ok:true,job:await createPeriodicJob(msg.job)};case'GS_CANCEL_JOB':return{ok:true,job:await cancelJob(msg.id)};case'GS_LIST_JOBS':return{ok:true,jobs:await loadJobs()};case'GS_RUN_JOB_NOW':{const jobs=await loadJobs(),job=jobs.find(j=>j.id===msg.id);if(!job)throw new Error('Tarefa não encontrada.');const result=await runJob(job);await markRun(job.id,result);return{ok:true,result}}case'GS_SET_RESEARCH_CAPTURE':await chrome.storage.local.set({gsResearchCapture:!!msg.enabled});{const tabs=await chrome.tabs.query({url:['https://seller.shopee.com.br/*']});for(const t of tabs)chrome.tabs.sendMessage(t.id,{type:'GS_SET_RESEARCH_CAPTURE',enabled:!!msg.enabled}).catch(()=>{});}return{ok:true};case'GS_GET_STATE':{const s=await chrome.storage.local.get(['gsSettings','gsDefaultAutomation','gsResearchCapture',COST_KEY,SNAPSHOT_KEY]);return{ok:true,state:s,jobs:await loadJobs()}}case'GS_ADS_ACTION':return{ok:true,data:await gestorApi.adsAction(msg.payload)};default:return{ok:false,error:'Mensagem desconhecida'}}})().then(reply).catch(e=>reply({ok:false,error:String(e?.message||e)}));return true;});
