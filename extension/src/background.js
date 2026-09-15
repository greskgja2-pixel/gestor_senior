import {gestorApi} from './lib/gestor-api.js';
import {analyze} from './lib/super-anuncio-engine.js';
import {DEFAULT_AUTOMATION,evaluateCampaign,evaluateListing} from './lib/rules-engine.js';
import {createPeriodicJob,loadJobs,markRun,cancelJob} from './lib/job-engine.js';
import {financialGuard,DEFAULT_FINANCE} from './lib/profit-engine.js';
import {indexSearchBody,findCollectedCompetitors,getCollectorStats,clearCollectorIndex} from './lib/collector-index.js';
import {summarizeCycle,shouldOpenDeepAudit,evaluateRollback} from './lib/continuous-engine.js';

const SNAPSHOT_KEY='gsSnapshotsV1';
const SMART_HISTORY='gsSmartHistoryV1';
const ACTION_LOG='gsActionLogV1';
const COST_KEY='gsProductCostsV1';
const CAPTURE_KEY='gsAutoMapperCapturesV1';
const MAX_CAPTURE_RECORDS=120;
const activeDownloads=new Map();

const n=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const productPrice=p=>n(p?.price_min??p?.price??p?.price_info?.[0]?.current_price??p?.price_info?.[0]?.original_price);

chrome.runtime.onInstalled.addListener(async()=>{
  await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
  const cur=await chrome.storage.local.get(['gsSettings','gsDefaultAutomation']);
  if(!cur.gsSettings)await chrome.storage.local.set({gsSettings:{gestorBaseUrl:'https://shopeeos-real.vercel.app'}});
  if(!cur.gsDefaultAutomation)await chrome.storage.local.set({gsDefaultAutomation:DEFAULT_AUTOMATION});
  await chrome.alarms.create('gs:dataset-health',{periodInMinutes:720});
});

chrome.downloads.onChanged.addListener(delta=>{
  if(!delta.state||!activeDownloads.has(delta.id))return;
  if(delta.state.current==='complete'||delta.state.current==='interrupted')activeDownloads.delete(delta.id);
});

async function activeTab(){const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});return tab;}
async function openPanel(sender){const tabId=sender?.tab?.id||(await activeTab())?.id;if(tabId)await chrome.sidePanel.open({tabId}).catch(()=>{});}
async function getMap(key){const x=await chrome.storage.local.get(key);return x[key]&&typeof x[key]==='object'?x[key]:{};}
async function setMap(key,map){await chrome.storage.local.set({[key]:map});}
function parseJson(text){try{return JSON.parse(text)}catch{return null}}

async function getCost(itemId){const costs=await getMap(COST_KEY);return n(costs[String(itemId)]?.cost);}
async function saveCost(itemId,cost){const map=await getMap(COST_KEY);map[String(itemId)]={cost:Number(cost),updatedAt:new Date().toISOString()};await setMap(COST_KEY,map);return map[String(itemId)];}

async function handleProtectionCapture(c){
  if(!/\/api\/pas\/v1\/rebate\/campaign_get\//i.test(c.url||''))return;
  const j=parseJson(c.rawText),d=j?.data;if(!d)return;
  const campaignId=Number(c.request?.body?.campaign_id),status=String(d.rebate_campaign_status||'');
  if(!Number.isSafeInteger(campaignId)||!['valid','invalid','unsupported'].includes(status))return;
  try{await gestorApi.syncProtection({campaignId,status,invalidReason:d.invalid_reason||null,totalAmount:d.total_amount??null});}catch(e){console.warn('GS protection sync',e);}
}

async function storeResearchCapture(c){
  const enabled=(await chrome.storage.local.get('gsResearchCapture')).gsResearchCapture===true;if(!enabled)return;
  const x=await chrome.storage.local.get(CAPTURE_KEY),list=Array.isArray(x[CAPTURE_KEY])?x[CAPTURE_KEY]:[];
  list.push({captureId:c.captureId,url:c.url,method:c.method,status:c.status,pageUrl:c.pageUrl,pageTitle:c.pageTitle,timestamp:c.timestamp,request:c.request,responseChars:c.responseChars,oversized:!!c.oversized,rawText:c.rawText?.slice(0,250000)||null});
  await chrome.storage.local.set({[CAPTURE_KEY]:list.slice(-MAX_CAPTURE_RECORDS)});
}

function extractQueryFromFilename(filename=''){
  const m=String(filename).match(/pesquisa_([^/]+?)(?:_pg\d+)?\.json$/i);
  return m?m[1].replace(/_/g,' '):null;
}

async function indexCollectorJson(message){
  if(!message?.json||/manifesto_da_coleta\.json$/i.test(message.filename||''))return;
  try{
    const body=JSON.parse(message.json);if(!Array.isArray(body?.items))return;
    await indexSearchBody(body,{filename:message.filename,query:extractQueryFromFilename(message.filename),source:'coletor-3.1'});
  }catch{}
}

function competitorQueries(title){
  const cleaned=String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  if(!cleaned)return[];
  const firstBlock=(cleaned.split(/[|,;–—]/)[0]||cleaned).trim();
  const noise=new Set(['tema','folha','folhas','a4','melhor','shopee','oficial','original','promocao','promoção','frete','gratis','grátis']);
  const compact=(text,limit=6)=>text.replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ ]/g,' ').split(/\s+/).filter(Boolean).filter((w,i)=>{const low=w.toLowerCase();if(noise.has(low))return false;if(/^\d$/.test(w)&&i>2)return false;return w.length>=2||/^\d+$/.test(w);}).slice(0,limit).join(' ');
  const primary=compact(firstBlock,6)||compact(cleaned,6);
  const connectors=new Set(['para','com','sem','por','uma','uns','das','dos','de','em','do','da','e','o','a']);
  const secondary=primary.split(/\s+/).filter(w=>!connectors.has(w.toLowerCase())).slice(0,5).join(' ');
  return [...new Set([primary,secondary].filter(q=>q&&q.length>=3))];
}

async function waitSearchTab(tabId,timeout=8000){
  const started=Date.now();
  while(Date.now()-started<timeout){const tab=await chrome.tabs.get(tabId).catch(()=>null);if(!tab)return false;if(tab.status==='complete')return true;await sleep(250);}
  return false;
}

async function liveSearchCompetitors(title,ownItemId){
  const queries=competitorQueries(title);if(!queries.length)return[];
  const found=[],seen=new Set();
  for(const query of queries.slice(0,2)){
    const tab=await chrome.tabs.create({url:'https://shopee.com.br/search?keyword='+encodeURIComponent(query),active:false});
    try{
      await waitSearchTab(tab.id);await sleep(350);
      for(let attempt=0;attempt<2;attempt++){
        try{
          const res=await chrome.tabs.sendMessage(tab.id,{type:'GS_COLLECT_SEARCH',options:{max:30,scrollSteps:5,delayMs:350}});
          if(res?.ok&&Array.isArray(res.items))for(const x of res.items){const id=String(x.itemId||'');if(!id||id===String(ownItemId)||seen.has(id))continue;seen.add(id);found.push({...x,source:'live-search',query});}
          if(found.length>=8)break;
        }catch{}
        await sleep(500);
      }
    }finally{if(tab.id)chrome.tabs.remove(tab.id).catch(()=>{});}
    if(found.length>=8)break;
  }
  return found.slice(0,20);
}

async function smartCompetitors(title,ownItemId,{allowLive=true}={}){
  let list=await findCollectedCompetitors(title,ownItemId,{max:20,minScore:.22});const indexed=list.length;
  if(allowLive&&list.length<5){const live=await liveSearchCompetitors(title,ownItemId),seen=new Set(list.map(x=>String(x.itemId)));for(const x of live){if(!seen.has(String(x.itemId))){seen.add(String(x.itemId));list.push(x);}}}
  return {items:list.slice(0,20),indexed,live:Math.max(0,list.length-indexed)};
}

async function currentProduct(tabId){const r=await chrome.tabs.sendMessage(tabId,{type:'GS_PARSE_CURRENT_PRODUCT'}).catch(e=>({ok:false,error:String(e)}));if(!r?.ok)throw new Error(r?.error||'Não consegui ler o anúncio atual.');return r.product;}
function campaignForItem(ads,itemId){const v=ads?.v7||ads?.v5||ads||{};return (v.campaigns||[]).find(c=>String(c.itemId??c.item_id)===String(itemId));}
async function mergeProtection(campaign){if(!campaign)return null;try{const p=await gestorApi.protection(),row=(p.states||[]).find(x=>String(x.campaign_id)===String(campaign.campaignId));return row?{...campaign,protection:row.status,protectionDue:row.due}:campaign;}catch{return campaign;}}

function metricSnapshot(product,campaign,analysis){return{at:new Date().toISOString(),itemId:String(product.itemId||product.item_id||''),score:analysis.score,price:n(product.price??productPrice(product)),sold:n(product.sold),views:n(product.views??product.viewCount??product.view_count),rating:n(product.rating),roas:n(campaign?.roas),targetRoas:n(campaign?.targetRoas),spend:n(campaign?.spend),orders:n(campaign?.orders),gmv:n(campaign?.gmv),clicks:n(campaign?.clicks),impressions:n(campaign?.impressions),ctr:n(campaign?.ctr)}}
function compareSnapshots(prev,cur){if(!prev)return null;const diff=k=>Number.isFinite(prev[k])&&Number.isFinite(cur[k])?cur[k]-prev[k]:null,pct=k=>Number.isFinite(prev[k])&&prev[k]!==0&&Number.isFinite(cur[k])?(cur[k]-prev[k])/Math.abs(prev[k])*100:null;return{days:(new Date(cur.at)-new Date(prev.at))/86400000,score:diff('score'),roas:diff('roas'),spendPct:pct('spend'),orders:diff('orders'),gmvPct:pct('gmv'),clicks:diff('clicks'),impressions:diff('impressions'),sold:diff('sold'),views:diff('views')}}
async function pushSmartHistory(itemId,snapshot,action=null){const h=await getMap(SMART_HISTORY),k=String(itemId),list=Array.isArray(h[k])?h[k]:[],previous=list.at(-1)||null,entry={...snapshot,compare:compareSnapshots(previous,snapshot),action};h[k]=[...list,entry].slice(-40);await setMap(SMART_HISTORY,h);return{previous,entry,history:h[k]};}
async function attachActionToLatest(itemId,action){const h=await getMap(SMART_HISTORY),k=String(itemId),list=Array.isArray(h[k])?h[k]:[];if(list.length){list[list.length-1]={...list[list.length-1],action};h[k]=list;await setMap(SMART_HISTORY,h);}}
async function logAction(itemId,action,result){const m=await getMap(ACTION_LOG),k=String(itemId),l=Array.isArray(m[k])?m[k]:[];m[k]=[...l,{at:new Date().toISOString(),action,result}].slice(-80);await setMap(ACTION_LOG,m);}

function improvementPlan({analysis,product,campaign,cost,history,policy={}}){
  const dims=Object.fromEntries((analysis.dimensions||[]).map(d=>[d.name,d])),tasks=[];
  const add=(priority,type,title,reason,actionable=true,details={})=>tasks.push({priority,type,title,reason,actionable,...details});
  const listing=evaluateListing({analysis,product:{...product,productCost:cost},policy:{...DEFAULT_AUTOMATION,...policy,enabled:true,allowTitle:true,allowDescription:true,allowPrice:true,finance:{...DEFAULT_FINANCE,...policy.finance}}});
  for(const p of listing.proposals||[]){
    if(p.type==='change_title')add(2,'title','Melhorar título',p.reason,false,{suggested:p.target,proposal:p});
    if(p.type==='change_description')add(3,'description','Melhorar descrição',p.reason,false,{suggested:p.target,proposal:p});
    if(p.type==='change_price')add(6,'price','Revisar preço',p.reason,false,{current:p.current,target:p.target,safe:p.safe,guard:p.guard,competitorMedian:analysis.competitorMedian,proposal:p});
  }
  if((dims['Imagens']?.score||99)<12)add(4,'images','Melhorar imagens',dims['Imagens'].reason,false);
  if((dims['Vídeo']?.score||99)<8)add(5,'video','Adicionar/melhorar vídeo',dims['Vídeo'].reason,false);
  if((dims['Preço e concorrência']?.score||99)<12&&!tasks.some(x=>x.type==='price'))add(6,'price','Revisar preço',analysis.priceInsight,false,{competitorMedian:analysis.competitorMedian});
  const roas=analysis.roasStrategy;
  if(campaign&&Number.isFinite(Number(roas?.suggestedTarget))){
    const guard=Number.isFinite(cost)?financialGuard({price:Number(product.price??productPrice(product)),productCost:cost,weeklyAdsSpend:Number(campaign.spend)||0,dailyAdsSpend:(Number(campaign.spend)||0)/7,finance:{...DEFAULT_FINANCE,...policy.finance}}):{ok:false,reasons:['Custo do produto não informado']};
    add(1,'roas','Ajustar Meta de ROAS',roas.title,guard.ok,{current:Number(campaign.targetRoas),target:Number(roas.suggestedTarget),campaignId:campaign.campaignId,guard});
  }
  if(campaign?.protection==='valid')add(7,'protection','Revisar Proteção de ROAS','A campanha aparece com Proteção de ROAS ativa.',true,{campaignId:campaign.campaignId});
  const lastAction=[...(history||[])].reverse().find(x=>x.action?.type==='roas');
  if(lastAction?.compare&&lastAction.compare.days>=5&&Number(lastAction.compare.roas)<-0.5&&Number(lastAction.compare.orders)<=0&&Number.isFinite(Number(lastAction.action.previousTarget))){add(0,'rollback_roas','Possível reversão de ROAS','A última alteração foi seguida de piora do ROAS sem ganho de pedidos.',true,{target:lastAction.action.previousTarget,current:Number(campaign?.targetRoas),campaignId:campaign?.campaignId});}
  return tasks.sort((a,b)=>a.priority-b.priority);
}

async function smartAnalyze(){
  const tab=await activeTab();if(!tab?.id)throw new Error('Nenhuma aba ativa.');const product=await currentProduct(tab.id);
  const comp=await smartCompetitors(product.title,product.itemId);let campaign=null;
  try{campaign=await mergeProtection(campaignForItem(await gestorApi.ads(7),product.itemId));}catch{}
  const cost=await getCost(product.itemId);
  const analysis=analyze({url:product.url,title:product.title,description:product.description,category:product.category,price:product.price,adsActive:!!campaign,roas7d:campaign?.roas,roasTarget:campaign?.targetRoas,adsSpend7d:campaign?.spend,productCost:cost,product,competitors:comp.items});
  const histMap=await getMap(SMART_HISTORY),history=histMap[String(product.itemId)]||[],plan=improvementPlan({analysis,product,campaign,cost,history});
  const saved=await pushSmartHistory(product.itemId,metricSnapshot(product,campaign,analysis),null);
  return{product,competitors:comp.items,campaign,analysis,plan,cost,source:{indexed:comp.indexed,live:comp.live},trend:saved.entry.compare,collectorStats:await getCollectorStats()};
}

async function analyzeCurrent(tabId){const product=await currentProduct(tabId),comp=await smartCompetitors(product.title,product.itemId);let campaign=null;try{campaign=await mergeProtection(campaignForItem(await gestorApi.ads(7),product.itemId));}catch{}const cost=await getCost(product.itemId),result=analyze({url:product.url,title:product.title,description:product.description,category:product.category,price:product.price,adsActive:!!campaign,roas7d:campaign?.roas,roasTarget:campaign?.targetRoas,adsSpend7d:campaign?.spend,productCost:cost,product,competitors:comp.items});const snapshots=await getMap(SNAPSHOT_KEY);snapshots[String(product.itemId||product.url)]={at:new Date().toISOString(),product,ads:campaign,result};await setMap(SNAPSHOT_KEY,snapshots);return{product,competitors:comp.items,ads:campaign,result,source:{indexed:comp.indexed,live:comp.live}};}

async function waitTabComplete(tabId,timeout=18000){const started=Date.now();while(Date.now()-started<timeout){const tab=await chrome.tabs.get(tabId).catch(()=>null);if(!tab)throw new Error('A aba de auditoria foi fechada.');if(tab.status==='complete')return tab;await sleep(350);}throw new Error('Tempo excedido carregando o anúncio para auditoria.');}
async function readProductWithRetry(tabId,expectedItemId){let lastErr=null;for(let i=0;i<18;i++){try{const p=await currentProduct(tabId);if(p?.title&&(!expectedItemId||!p.itemId||String(p.itemId)===String(expectedItemId)))return p;if(expectedItemId&&p?.itemId&&String(p.itemId)!==String(expectedItemId))throw new Error('O anúncio aberto não corresponde ao item agendado.');}catch(e){lastErr=e;}await sleep(450);}throw lastErr||new Error('Não consegui ler o anúncio durante a manutenção.');}

async function deepAuditJob(job,campaign,cost,policy){
  if(!shouldOpenDeepAudit(job))return null;
  const tab=await chrome.tabs.create({url:job.url,active:false});
  try{
    await waitTabComplete(tab.id);await sleep(650);
    const product=await readProductWithRetry(tab.id,job.itemId),comp=await smartCompetitors(product.title,job.itemId,{allowLive:policy.scheduledLiveCompetitors!==false});
    const analysis=analyze({url:product.url,title:product.title,description:product.description,category:product.category,price:product.price,adsActive:!!campaign,roas7d:campaign?.roas,roasTarget:campaign?.targetRoas,adsSpend7d:campaign?.spend,productCost:cost,product,competitors:comp.items});
    const listingDecision=evaluateListing({analysis,product:{...product,productCost:cost},policy:{...policy,enabled:true,allowTitle:true,allowDescription:true,allowPrice:true}});
    const histMap=await getMap(SMART_HISTORY),history=histMap[String(job.itemId)]||[],plan=improvementPlan({analysis,product,campaign,cost,history,policy});
    const saved=await pushSmartHistory(job.itemId,metricSnapshot(product,campaign,analysis),null);
    return{product:{itemId:product.itemId,title:product.title,url:product.url,price:product.price,sold:product.sold,views:product.views??product.viewCount??product.view_count??null},analysis,listingDecision,plan,source:{indexed:comp.indexed,live:comp.live},trend:saved.entry.compare};
  }finally{if(tab.id)chrome.tabs.remove(tab.id).catch(()=>{});}
}

function lastExecutedRoasChange(job){for(const h of [...(job.history||[])].reverse()){const audit=h?.result?.audit,ex=(audit?.executed||[]).find(x=>x?.proposal?.type==='change_roas_target');if(ex)return{at:h.at,proposal:ex.proposal,before:audit.campaign};}return null;}
async function runJob(job){
  const [products,ads]=await Promise.all([gestorApi.products(),gestorApi.ads(7)]),productRaw=(products.items||[]).find(p=>String(p.item_id)===String(job.itemId)),campaignRaw=campaignForItem(ads,job.itemId);
  if(!productRaw)return{ok:false,status:'skipped',reason:'Produto não encontrado na loja conectada'};
  const campaign=await mergeProtection(campaignRaw),cost=await getCost(job.itemId),price=productPrice(productRaw),policy={...DEFAULT_AUTOMATION,...job.policy,finance:{...DEFAULT_AUTOMATION.finance,...job.policy?.finance}},product={...productRaw,price,productCost:cost};
  const lastChange=lastExecutedRoasChange(job),daysSinceChange=lastChange?(Date.now()-new Date(lastChange.at).getTime())/86400000:null;
  const rollback=lastChange&&policy.rollbackOnWorsePerformance?evaluateRollback({before:{...lastChange.before,targetRoas:lastChange.proposal.current},current:campaign,minDays:Math.max(5,policy.cooldownDays||7),daysSinceChange}):null;
  const decision=campaign?evaluateCampaign({campaign,product,policy,lastChangeAt:lastChange?.at||null}):{eligible:false,reasons:['Sem campanha Ads vinculada'],proposals:[]};
  let listingAudit=null;try{listingAudit=await deepAuditJob(job,campaign,cost,policy);}catch(e){listingAudit={error:String(e?.message||e),plan:[],listingDecision:{proposals:[],reasons:[String(e?.message||e)]}};}
  const summary=summarizeCycle({analysis:listingAudit?.analysis,campaign,listingProposals:listingAudit?.listingDecision?.proposals||[],adsDecision:decision,rollback});
  const audit={at:new Date().toISOString(),itemId:job.itemId,campaign:campaign?{campaignId:campaign.campaignId,roas:campaign.roas,targetRoas:campaign.targetRoas,spend:campaign.spend,gmv:campaign.gmv,orders:campaign.orders,clicks:campaign.clicks,impressions:campaign.impressions,protection:campaign.protection,controlMode:campaign.controlMode}:null,decision,rollback,listingAudit,summary,executed:[]};
  if(policy.mode==='automatic'&&campaign){
    if(rollback){const r=await gestorApi.adsAction({campaignId:campaign.campaignId,action:'change_roas_target',mode:campaign.controlMode||'manual',roasTarget:rollback.target});const proposal={type:'change_roas_target',current:campaign.targetRoas,target:rollback.target,reason:rollback.reason,rollback:true};audit.executed.push({proposal,result:r});await logAction(job.itemId,{type:'roas',previousTarget:campaign.targetRoas,target:rollback.target,campaignId:campaign.campaignId,rollback:true},r);await attachActionToLatest(job.itemId,{type:'roas',previousTarget:campaign.targetRoas,target:rollback.target,campaignId:campaign.campaignId,rollback:true});}
    else if(decision.eligible){for(const p of decision.proposals){if(p.type==='change_roas_target'){const r=await gestorApi.adsAction({campaignId:campaign.campaignId,action:'change_roas_target',mode:campaign.controlMode||'manual',roasTarget:p.target});audit.executed.push({proposal:p,result:r});await logAction(job.itemId,{type:'roas',previousTarget:p.current,target:p.target,campaignId:campaign.campaignId},r);await attachActionToLatest(job.itemId,{type:'roas',previousTarget:p.current,target:p.target,campaignId:campaign.campaignId});break;}if(p.type==='protection_reset'){const r=await gestorApi.adsAction({campaignId:campaign.campaignId,action:'protection_reset',mode:campaign.controlMode||'manual',confirmed:true});audit.executed.push({proposal:p,result:r});await logAction(job.itemId,{type:'protection_reset',campaignId:campaign.campaignId},r);break;}}}
  }
  return{ok:true,status:audit.executed.length?'executed':'review',audit};
}

async function applyRoas({itemId,campaignId,currentTarget,target,mode='manual'}){
  const targetN=Number(target),currentN=Number(currentTarget);if(!Number.isFinite(targetN)||targetN<=0)throw new Error('Meta de ROAS inválida.');if(Number.isFinite(currentN)&&currentN>0&&Math.abs(targetN-currentN)/currentN>.15)throw new Error('Alteração maior que 15% bloqueada pelo limite de segurança.');
  const cost=await getCost(itemId);if(!Number.isFinite(cost))throw new Error('Informe o custo do produto antes de alterar ROAS pelo modo inteligente.');
  const products=await gestorApi.products(),p=(products.items||[]).find(x=>String(x.item_id)===String(itemId)),price=p?productPrice(p):null;if(!Number.isFinite(price))throw new Error('Não consegui confirmar o preço do produto para validar a margem.');
  const guard=financialGuard({price,productCost:cost,finance:DEFAULT_FINANCE});if(!guard.ok)throw new Error(`Proteção financeira bloqueou a alteração: ${guard.reasons.join('; ')}`);
  const result=await gestorApi.adsAction({campaignId,action:'change_roas_target',mode,roasTarget:targetN}),action={type:'roas',previousTarget:Number.isFinite(currentN)?currentN:null,target:targetN,campaignId};await logAction(itemId,action,result);await attachActionToLatest(itemId,action);return result;
}

async function applySafePlan(payload={}){
  const plan=Array.isArray(payload.plan)?payload.plan:[],itemId=payload.itemId,campaign=payload.campaign||{};
  const executed=[],pending=[];
  const candidate=plan.find(x=>x.type==='rollback_roas'&&x.actionable!==false)||plan.find(x=>x.type==='roas'&&x.actionable!==false);
  if(candidate){const result=await applyRoas({itemId,campaignId:candidate.campaignId||campaign.campaignId,currentTarget:candidate.current??campaign.targetRoas,target:candidate.target,mode:campaign.controlMode||'manual'});executed.push({type:candidate.type,target:candidate.target,result});}
  for(const x of plan){if(x===candidate)continue;pending.push({type:x.type,title:x.title,reason:x.reason,actionable:x.actionable!==false});}
  return{executed,pending,message:executed.length?'Melhoria financeira segura aplicada; demais itens ficaram para aprovação.':'Nenhuma alteração financeira segura estava pronta para execução.'};
}

chrome.alarms.onAlarm.addListener(async alarm=>{
  if(alarm.name==='gs:dataset-health'){const stats=await getCollectorStats();await chrome.storage.local.set({gsDatasetHealth:{...stats,checkedAt:new Date().toISOString()}});return;}
  if(!alarm.name.startsWith('gs:listing:'))return;const id=alarm.name.slice(3),jobs=await loadJobs(),job=jobs.find(j=>j.id===id);if(!job||job.status==='cancelled')return;
  try{const result=await runJob(job);await markRun(job.id,result);const recommendations=result.audit?.summary?.recommendations?.length||0;await chrome.notifications.create({type:'basic',iconUrl:chrome.runtime.getURL('icons/icon128.png'),title:'Gestor Sênior',message:result.status==='executed'?`Manutenção concluída. ${result.audit.executed.length} ação(ões) executada(s).`:`Revisão concluída. ${recommendations} recomendação(ões) para conferir.`}).catch(()=>{});}catch(e){await markRun(job.id,{ok:false,error:String(e)});}
});

chrome.runtime.onMessage.addListener((msg,sender,reply)=>{(async()=>{switch(msg?.type){
  case'COLLECTOR_STATUS':await chrome.storage.local.set({collectorStatus:msg});return{ok:true};
  case'DOWNLOAD_JSON':{indexCollectorJson(msg).catch(()=>{});const dataUrl=`data:application/json;charset=utf-8,${encodeURIComponent(String(msg.json||''))}`,downloadId=await chrome.downloads.download({url:dataUrl,filename:String(msg.filename||'Gestor Senior/coleta.json'),conflictAction:'uniquify',saveAs:false});activeDownloads.set(downloadId,sender.tab?.id||null);return{ok:true,downloadId};}
  case'GS_OPEN_SIDE_PANEL':await openPanel(sender);return{ok:true};
  case'GS_NETWORK_CAPTURE':await handleProtectionCapture(msg.capture);await storeResearchCapture(msg.capture);return{ok:true};
  case'GS_ANALYZE_CURRENT':{const tab=await activeTab();if(!tab?.id)throw new Error('Nenhuma aba ativa.');return{ok:true,data:await analyzeCurrent(tab.id)}}
  case'GS_SMART_ANALYZE':return{ok:true,data:await smartAnalyze()};
  case'GS_SEARCH_COMPETITORS':{const c=await smartCompetitors(msg.title,msg.ownItemId);return{ok:true,items:c.items,source:{indexed:c.indexed,live:c.live}};}
  case'GS_SAVE_COST':if(!Number.isFinite(Number(msg.cost))||Number(msg.cost)<0)throw new Error('Custo inválido.');return{ok:true,data:await saveCost(msg.itemId,msg.cost)};
  case'GS_CREATE_JOB':return{ok:true,job:await createPeriodicJob(msg.job)};
  case'GS_CANCEL_JOB':return{ok:true,job:await cancelJob(msg.id)};
  case'GS_LIST_JOBS':return{ok:true,jobs:await loadJobs()};
  case'GS_RUN_JOB_NOW':{const jobs=await loadJobs(),job=jobs.find(j=>j.id===msg.id);if(!job)throw new Error('Tarefa não encontrada.');const result=await runJob(job);await markRun(job.id,result);return{ok:true,result};}
  case'GS_APPLY_ROAS':return{ok:true,data:await applyRoas(msg.payload||{})};
  case'GS_APPLY_SAFE_PLAN':return{ok:true,data:await applySafePlan(msg.payload||{})};
  case'GS_COLLECTOR_STATS':return{ok:true,stats:await getCollectorStats()};
  case'GS_CLEAR_COLLECTOR_INDEX':await clearCollectorIndex();return{ok:true};
  case'GS_GET_SMART_HISTORY':{const h=await getMap(SMART_HISTORY);return{ok:true,history:h[String(msg.itemId)]||[]};}
  case'GS_GET_ACTION_LOG':{const h=await getMap(ACTION_LOG);return{ok:true,actions:h[String(msg.itemId)]||[]};}
  case'GS_SET_RESEARCH_CAPTURE':await chrome.storage.local.set({gsResearchCapture:!!msg.enabled});{const tabs=await chrome.tabs.query({url:['https://seller.shopee.com.br/*','https://shopee.com.br/*']});for(const t of tabs)chrome.tabs.sendMessage(t.id,{type:'GS_SET_RESEARCH_CAPTURE',enabled:!!msg.enabled}).catch(()=>{});}return{ok:true};
  case'GS_GET_STATE':{const s=await chrome.storage.local.get(['gsSettings','gsDefaultAutomation','gsResearchCapture','collectorStatus',COST_KEY,SNAPSHOT_KEY]);return{ok:true,state:s,jobs:await loadJobs()};}
  case'GS_ADS_ACTION':return{ok:true,data:await gestorApi.adsAction(msg.payload)};
  default:return{ok:false,error:'Mensagem desconhecida'};
}})().then(reply).catch(e=>reply({ok:false,error:String(e?.message||e)}));return true;});
