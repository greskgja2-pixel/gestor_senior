import assert from 'node:assert/strict';
import {evaluateCampaign} from '../src/lib/rules-engine.js';

const campaign={clicks:100,impressions:2000,spend:20,roas:5,targetRoas:10,protection:'invalid'};
const policy={enabled:true,mode:'automatic',minClicks:30,minImpressions:500,maxRoasChangePct:10,cooldownDays:7,allowRoas:true,finance:{minMarginPct:20,minProfit:8,maxWeeklyAdsSpend:300}};

const noCost=evaluateCampaign({campaign,product:{price:100,productCost:null},policy});
assert.equal(noCost.eligible,false);
assert.match(noCost.reasons.join(' | '),/Custo do produto não informado/);

const safe=evaluateCampaign({campaign,product:{price:100,productCost:20},policy});
assert.equal(safe.eligible,true);
assert.equal(safe.proposals[0].type,'change_roas_target');
assert.equal(safe.proposals[0].current,10);
assert.equal(safe.proposals[0].target,9);

const cooldown=evaluateCampaign({campaign,product:{price:100,productCost:20},policy,lastChangeAt:new Date().toISOString()});
assert.equal(cooldown.eligible,false);
assert.match(cooldown.reasons.join(' | '),/Cooldown ativo/);
console.log('automation-safety-regression: OK');
