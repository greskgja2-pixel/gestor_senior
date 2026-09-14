import {financialGuard, DEFAULT_FINANCE} from './profit-engine.js';

const n=v=>Number.isFinite(Number(v))?Number(v):null;
const optionalNumber=v=>v===null||v===undefined||v===''?null:n(v);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function buildPriceProposal({currentPrice,competitorMedian,productCost,policy={}}){
  const current=n(currentPrice),median=n(competitorMedian),cost=optionalNumber(productCost);
  const cfg={maxPriceChangePct:5,finance:{...DEFAULT_FINANCE},...policy,finance:{...DEFAULT_FINANCE,...policy.finance}};
  if(!(current>0)||!(median>0))return null;
  const gap=(current-median)/median;
  if(Math.abs(gap)<0.10)return null;
  const maxDelta=current*Math.max(1,Math.min(15,Number(cfg.maxPriceChangePct)||5))/100;
  let target=gap>0?Math.max(median,current-maxDelta):Math.min(median,current+maxDelta);
  if(cfg.finance.priceFloor>0)target=Math.max(target,Number(cfg.finance.priceFloor));
  target=Number(target.toFixed(2));
  if(Math.abs(target-current)<0.01)return null;
  const guard=cost==null?{ok:false,reasons:['Custo do produto não informado']}:
    financialGuard({price:current,proposedPrice:target,productCost:cost,finance:cfg.finance});
  return {
    type:'change_price',
    current,
    target,
    requiresApproval:true,
    autoEligible:false,
    safe:guard.ok,
    guard,
    reason:gap>0
      ?`Preço ${Math.abs(gap*100).toFixed(1)}% acima da mediana dos concorrentes.`
      :`Preço ${Math.abs(gap*100).toFixed(1)}% abaixo da mediana dos concorrentes.`
  };
}

export function summarizeCycle({analysis,campaign,listingProposals=[],adsDecision=null,rollback=null}){
  const recommendations=[];
  if(rollback)recommendations.push({type:'rollback_roas',priority:0,title:'Reverter último ajuste de ROAS',...rollback});
  if(adsDecision?.proposals?.length)recommendations.push(...adsDecision.proposals.map((x,i)=>({priority:1+i,title:x.type==='change_roas_target'?'Ajustar Meta de ROAS':'Ação de Ads',...x})));
  recommendations.push(...listingProposals.map((x,i)=>({priority:10+i,title:x.type==='change_title'?'Melhorar título':x.type==='change_description'?'Melhorar descrição':x.type==='change_price'?'Revisar preço':'Melhoria do anúncio',...x})));
  return {
    score:n(analysis?.score),
    roas:n(campaign?.roas),
    targetRoas:n(campaign?.targetRoas),
    recommendations,
    executable:recommendations.filter(x=>x.autoEligible!==false&&!x.requiresApproval).length,
    approval:recommendations.filter(x=>x.requiresApproval||x.autoEligible===false).length
  };
}

export function shouldOpenDeepAudit(job){
  if(!job?.url)return false;
  try{
    const u=new URL(job.url),host=u.hostname.toLowerCase();
    return u.protocol==='https:'&&(host==='shopee.com.br'||host==='www.shopee.com.br');
  }catch{return false;}
}

export function evaluateRollback({before,current,minDays=5,daysSinceChange}){
  if(!before||!current||!(Number(daysSinceChange)>=Number(minDays)))return null;
  const beforeRoas=n(before.roas),currentRoas=n(current.roas),beforeOrders=n(before.orders)||0,currentOrders=n(current.orders)||0;
  if(!(beforeRoas>0)||currentRoas==null)return null;
  const roasDrop=(beforeRoas-currentRoas)/beforeRoas;
  if(roasDrop<0.20||currentOrders>beforeOrders)return null;
  const previousTarget=n(before.targetRoas);
  if(!(previousTarget>0))return null;
  return {type:'rollback_roas',target:previousTarget,reason:`ROAS caiu ${(roasDrop*100).toFixed(1)}% sem ganho de pedidos após a última mudança.`};
}
