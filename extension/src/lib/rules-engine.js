import {financialGuard, DEFAULT_FINANCE} from './profit-engine.js';
import {buildRoasStrategy} from './super-anuncio-engine.js';

export const DEFAULT_AUTOMATION = Object.freeze({
  enabled:false,
  mode:'approve',
  frequencyDays:7,
  minDataDays:7,
  minClicks:30,
  minImpressions:500,
  minOrdersForAggressiveChange:3,
  cooldownDays:7,
  maxRoasChangePct:10,
  maxPriceChangePct:5,
  maxChangesPerCycle:3,
  allowRoas:true,
  allowBudget:true,
  allowProtectionReset:false,
  allowPrice:false,
  allowTitle:false,
  allowDescription:false,
  rollbackOnWorsePerformance:true,
  finance:{...DEFAULT_FINANCE}
});

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function evaluateCampaign({campaign, product, policy={}, lastChangeAt=null}){
  const cfg={...DEFAULT_AUTOMATION,...policy,finance:{...DEFAULT_FINANCE,...policy.finance}};
  const reasons=[],proposals=[];
  if(!cfg.enabled)return {eligible:false,reasons:['Automação desativada'],proposals};
  if(n(campaign.clicks)<cfg.minClicks)reasons.push(`Cliques insuficientes (${n(campaign.clicks)}/${cfg.minClicks})`);
  if(n(campaign.impressions)<cfg.minImpressions)reasons.push(`Impressões insuficientes (${n(campaign.impressions)}/${cfg.minImpressions})`);
  if(lastChangeAt){const age=(Date.now()-new Date(lastChangeAt).getTime())/86400000;if(age<cfg.cooldownDays)reasons.push(`Cooldown ativo (${age.toFixed(1)}/${cfg.cooldownDays} dias)`);}
  const guard=financialGuard({price:product?.price||product?.price_min||0,productCost:product?.productCost,weeklyAdsSpend:n(campaign.spend),dailyAdsSpend:n(campaign.spend)/Math.max(1,cfg.minDataDays),finance:cfg.finance});
  if(!guard.ok)reasons.push(...guard.reasons);
  if(reasons.length)return {eligible:false,reasons,proposals,guard};
  if(cfg.allowRoas&&Number.isFinite(Number(campaign.targetRoas))&&Number.isFinite(Number(campaign.roas))){
    const advice=buildRoasStrategy({price:product?.price||product?.price_min,productCost:product?.productCost,roas7d:campaign.roas,roasTarget:campaign.targetRoas},cfg.finance);
    if(Number.isFinite(Number(advice.suggestedTarget))){
      const current=Number(campaign.targetRoas),maxDelta=Math.abs(current)*cfg.maxRoasChangePct/100;
      const target=clamp(Number(advice.suggestedTarget),current-maxDelta,current+maxDelta);
      if(Math.abs(target-current)>=0.01)proposals.push({type:'change_roas_target',current,target:Number(target.toFixed(2)),reason:advice.title,details:advice});
    }
  }
  if(cfg.allowProtectionReset&&campaign.protection==='valid')proposals.push({type:'protection_reset',reason:'Proteção de ROAS ativa e política permite rotina experimental'});
  return {eligible:true,reasons,proposals:proposals.slice(0,cfg.maxChangesPerCycle),guard};
}

export function evaluateListing({analysis, product, policy={}}){
  const cfg={...DEFAULT_AUTOMATION,...policy,finance:{...DEFAULT_FINANCE,...policy.finance}}, proposals=[];
  const byName=new Map((analysis.dimensions||[]).map(d=>[d.name,d]));
  if(cfg.allowTitle&&(byName.get('Título')?.score||99)<10&&analysis.optimizedTitle&&analysis.optimizedTitle!==product.title)proposals.push({type:'change_title',current:product.title,target:analysis.optimizedTitle,requiresApproval:true,reason:'Título abaixo do nível desejado'});
  if(cfg.allowDescription&&(byName.get('Descrição')?.score||99)<10&&analysis.optimizedDescription)proposals.push({type:'change_description',target:analysis.optimizedDescription,requiresApproval:true,reason:'Descrição abaixo do nível desejado'});
  return {proposals};
}
