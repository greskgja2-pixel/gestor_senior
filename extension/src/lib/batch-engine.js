import {analyze,buildRoasStrategy} from './super-anuncio-engine.js';
import {findCollectedCompetitors} from './collector-index.js';
import {financialGuard,DEFAULT_FINANCE} from './profit-engine.js';
import {createPeriodicJob} from './job-engine.js';
import {gestorApi} from './gestor-api.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const n=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function adContextsForItem(settings,itemId){
  const key=String(itemId);
  return Object.values(settings||{}).filter(meta=>{
    const ids=Array.isArray(meta?.itemIds)&&meta.itemIds.length?meta.itemIds:[meta?.itemId];
    return ids.some(id=>String(id)===key);
  });
}

export function buildSafeRoasProposal({row,settings,finance={},maxChangePct=10}){
  const contexts=adContextsForItem(settings,row?.itemId);
  if(contexts.length!==1)return{ok:false,reason:contexts.length?'Produto ligado a mais de uma campanha; ajuste em massa bloqueado.':'Campanha Ads não encontrada.'};
  const meta=contexts[0],ids=Array.isArray(meta.itemIds)&&meta.itemIds.length?meta.itemIds:[meta.itemId];
  if(ids.filter(Boolean).length!==1)return{ok:false,reason:'Campanha compartilhada com vários produtos; ajuste em massa bloqueado.'};
  const price=n(row?.price),cost=n(row?.cost),roas=n(row?.cur?.roas),target=n(meta?.targetRoas),spend=n(row?.cur?.spend)||0;
  if(!(price>0))return{ok:false,reason:'Preço do produto não confirmado.'};
  if(cost==null||cost<0)return{ok:false,reason:'Custo do produto não informado.'};
  if(!(roas>=0)||!(target>0))return{ok:false,reason:'ROAS atual ou Meta de ROAS não disponível.'};
  const cfg={...DEFAULT_FINANCE,...finance};
  const guard=financialGuard({price,productCost:cost,weeklyAdsSpend:spend,dailyAdsSpend:spend/7,finance:cfg});
  if(!guard.ok)return{ok:false,reason:`Proteção financeira: ${guard.reasons.join('; ')}`,guard};
  const advice=buildRoasStrategy({price,productCost:cost,roas7d:roas,roasTarget:target},cfg);
  if(!Number.isFinite(Number(advice.suggestedTarget)))return{ok:false,reason:advice.title||'Sem ajuste recomendado.',advice,guard};
  const maxDelta=Math.abs(target)*Math.max(1,Math.min(15,Number(maxChangePct)||10))/100;
  const proposed=Number(clamp(Number(advice.suggestedTarget),target-maxDelta,target+maxDelta).toFixed(2));
  if(Math.abs(proposed-target)<0.01)return{ok:false,reason:'A sugestão ficou igual à meta atual após aplicar os limites de segurança.',advice,guard};
  return{ok:true,itemId:String(row.itemId),campaignId:Number(meta.campaignId),mode:meta.controlMode||'manual',currentTarget:target,target:proposed,reason:advice.title,advice,guard};
}

async function waitForProduct(tabId,expectedItemId){
  for(let i=0;i<36;i++){
    await sleep(i?450:650);
    try{
      const r=await chrome.tabs.sendMessage(tabId,{type:'GS_PARSE_CURRENT_PRODUCT'});
      const p=r?.product;
      if(r?.ok&&p?.title&&String(p.title).trim().length>=4){
        if(!expectedItemId||!p.itemId||String(p.itemId)===String(expectedItemId))return p;
      }
    }catch{}
  }
  throw new Error('Tempo esgotado ao ler o anúncio na Shopee.');
}

async function liveSearchCompetitors(title,ownItemId,max=12){
  const query=String(title||'').replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ ]/g,' ').split(/\s+/).filter(w=>w.length>=3).slice(0,10).join(' ');
  if(!query)return[];
  const tab=await chrome.tabs.create({url:'https://shopee.com.br/search?keyword='+encodeURIComponent(query),active:false});
  try{
    for(let i=0;i<32;i++){
      await sleep(450);
      try{
        const res=await chrome.tabs.sendMessage(tab.id,{type:'GS_COLLECT_SEARCH',options:{max,scrollSteps:7,delayMs:500}});
        if(res?.ok&&res.items?.length)return res.items.filter(x=>String(x.itemId)!==String(ownItemId)).slice(0,max).map(x=>({...x,source:'live-search'}));
      }catch{}
    }
    return[];
  }finally{if(tab?.id)chrome.tabs.remove(tab.id).catch(()=>{});}
}

async function competitorSet(title,ownItemId,{allowLive=true}={}){
  let list=await findCollectedCompetitors(title,ownItemId,{max:20,minScore:.22});
  const indexed=list.length;
  if(allowLive&&list.length<5){
    const live=await liveSearchCompetitors(title,ownItemId,12),seen=new Set(list.map(x=>String(x.itemId)));
    for(const item of live){if(!seen.has(String(item.itemId))){seen.add(String(item.itemId));list.push(item);}}
  }
  return{items:list.slice(0,20),indexed,live:Math.max(0,list.length-indexed)};
}

async function saveAnalysis(itemId,product,campaign,result){
  const keys=['gsSmartHistoryV1','gsSnapshotsV1'];
  const local=await chrome.storage.local.get(keys),history=local.gsSmartHistoryV1&&typeof local.gsSmartHistoryV1==='object'?local.gsSmartHistoryV1:{},snapshots=local.gsSnapshotsV1&&typeof local.gsSnapshotsV1==='object'?local.gsSnapshotsV1:{};
  const key=String(itemId),at=new Date().toISOString(),entry={at,itemId:key,score:result.score,price:n(product.price),sold:n(product.sold),rating:n(product.rating),roas:n(campaign?.roas),targetRoas:n(campaign?.targetRoas),spend:n(campaign?.spend),orders:n(campaign?.orders),gmv:n(campaign?.gmv),clicks:n(campaign?.clicks),impressions:n(campaign?.impressions)};
  const list=Array.isArray(history[key])?history[key]:[];history[key]=[...list,entry].slice(-40);snapshots[key]={at,product,ads:campaign||null,result};
  await chrome.storage.local.set({gsSmartHistoryV1:history,gsSnapshotsV1:snapshots});
}

export async function analyzeBatchRows(rows,{settings={},allowLive=true,maxItems=25,onProgress}={}){
  const selected=(rows||[]).slice(0,Math.max(1,Math.min(50,Number(maxItems)||25))),results=[];
  for(let i=0;i<selected.length;i++){
    const row=selected[i];onProgress?.({index:i,total:selected.length,itemId:row.itemId,title:row.title,phase:'opening'});
    let tab=null;
    try{
      if(!row.url)throw new Error('URL pública do anúncio indisponível.');
      tab=await chrome.tabs.create({url:row.url,active:false});
      const product=await waitForProduct(tab.id,row.itemId),comp=await competitorSet(product.title||row.title,row.itemId,{allowLive});
      const contexts=adContextsForItem(settings,row.itemId),meta=contexts.length===1?contexts[0]:null,campaign=meta?{campaignId:meta.campaignId,targetRoas:meta.targetRoas,controlMode:meta.controlMode,roas:row.cur?.roas,spend:row.cur?.spend,orders:row.cur?.orders,gmv:row.cur?.gmv,clicks:row.cur?.clicks,impressions:row.cur?.impressions}:null;
      const result=analyze({url:product.url,title:product.title||row.title,description:product.description,category:product.category,price:product.price??row.price,adsActive:!!campaign,roas7d:campaign?.roas,roasTarget:campaign?.targetRoas,adsSpend7d:campaign?.spend,productCost:row.cost,product,competitors:comp.items});
      await saveAnalysis(row.itemId,product,campaign,result);
      results.push({itemId:row.itemId,ok:true,score:result.score,competitors:comp.items.length,source:{indexed:comp.indexed,live:comp.live}});
    }catch(error){results.push({itemId:row.itemId,ok:false,error:String(error?.message||error)});}
    finally{if(tab?.id)chrome.tabs.remove(tab.id).catch(()=>{});}
    onProgress?.({index:i+1,total:selected.length,itemId:row.itemId,title:row.title,phase:'done'});
    await sleep(250);
  }
  return results;
}

async function recordAction(itemId,action,result){
  const key='gsActionLogV1',local=await chrome.storage.local.get(key),map=local[key]&&typeof local[key]==='object'?local[key]:{},id=String(itemId),list=Array.isArray(map[id])?map[id]:[];map[id]=[...list,{at:new Date().toISOString(),action,result}].slice(-80);await chrome.storage.local.set({[key]:map});
}

export async function applySafeRoasBatch(rows,{settings={},finance={},maxChangePct=10,onProgress}={}){
  const uniqueCampaigns=new Set(),results=[];
  for(let i=0;i<(rows||[]).length;i++){
    const row=rows[i],proposal=buildSafeRoasProposal({row,settings,finance,maxChangePct});
    onProgress?.({index:i,total:rows.length,itemId:row.itemId,title:row.title,phase:'checking'});
    if(!proposal.ok){results.push({itemId:row.itemId,ok:false,skipped:true,reason:proposal.reason});continue;}
    if(uniqueCampaigns.has(proposal.campaignId)){results.push({itemId:row.itemId,ok:false,skipped:true,reason:'Campanha já processada neste lote.'});continue;}
    uniqueCampaigns.add(proposal.campaignId);
    try{
      const result=await gestorApi.adsAction({campaignId:proposal.campaignId,action:'change_roas_target',mode:proposal.mode,roasTarget:proposal.target});
      await recordAction(row.itemId,{type:'roas',previousTarget:proposal.currentTarget,target:proposal.target,campaignId:proposal.campaignId,source:'bulk-analytics'},result);
      results.push({itemId:row.itemId,ok:true,proposal,result});
    }catch(error){results.push({itemId:row.itemId,ok:false,error:String(error?.message||error),proposal});}
    onProgress?.({index:i+1,total:rows.length,itemId:row.itemId,title:row.title,phase:'done'});
    await sleep(300);
  }
  return results;
}

export async function scheduleWeeklyBatch(rows,{finance={},maxRoasChangePct=10,onProgress}={}){
  const results=[];
  for(let i=0;i<(rows||[]).length;i++){
    const row=rows[i];
    try{
      const job=await createPeriodicJob({itemId:row.itemId,title:row.title,url:row.url,frequencyDays:7,policy:{enabled:true,mode:'approve',maxRoasChangePct,allowRoas:true,allowBudget:true,allowProtectionReset:false,allowPrice:true,allowTitle:true,allowDescription:true,scheduledLiveCompetitors:true,rollbackOnWorsePerformance:true,finance:{...DEFAULT_FINANCE,...finance}}});
      results.push({itemId:row.itemId,ok:true,job});
    }catch(error){results.push({itemId:row.itemId,ok:false,error:String(error?.message||error)});}
    onProgress?.({index:i+1,total:rows.length,itemId:row.itemId,title:row.title,phase:'done'});
  }
  return results;
}
