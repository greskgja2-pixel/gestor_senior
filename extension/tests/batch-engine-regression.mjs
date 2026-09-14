import assert from 'node:assert/strict';
import {adContextsForItem,buildSafeRoasProposal} from '../src/lib/batch-engine.js';

const settings={
  '101':{campaignId:101,itemId:11,itemIds:[11],targetRoas:10,controlMode:'manual'},
  '202':{campaignId:202,itemIds:[22,23],targetRoas:8,controlMode:'gms'}
};
assert.equal(adContextsForItem(settings,11).length,1);
assert.equal(adContextsForItem(settings,999).length,0);

const safe=buildSafeRoasProposal({row:{itemId:'11',price:100,cost:40,cur:{roas:5,spend:20}},settings,finance:{minMarginPct:20,minProfit:8},maxChangePct:10});
assert.equal(safe.ok,true);
assert.equal(safe.currentTarget,10);
assert.equal(safe.target,9,'redução deve respeitar o limite de 10% por ciclo');

const noCost=buildSafeRoasProposal({row:{itemId:'11',price:100,cost:null,cur:{roas:5,spend:20}},settings});
assert.equal(noCost.ok,false);
assert.match(noCost.reason,/Custo do produto não informado/i);

const shared=buildSafeRoasProposal({row:{itemId:'22',price:100,cost:40,cur:{roas:4,spend:20}},settings});
assert.equal(shared.ok,false);
assert.match(shared.reason,/compartilhada/i);

console.log('batch-engine-regression: OK');
