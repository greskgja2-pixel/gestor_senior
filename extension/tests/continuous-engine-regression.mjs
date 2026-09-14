import assert from 'node:assert/strict';
import {buildPriceProposal,evaluateRollback,shouldOpenDeepAudit,summarizeCycle} from '../src/lib/continuous-engine.js';

const price=buildPriceProposal({currentPrice:100,competitorMedian:80,productCost:40,policy:{maxPriceChangePct:5,finance:{minMarginPct:20,minProfit:8}}});
assert.ok(price,'deve sugerir preço quando diferença para a mediana é relevante');
assert.equal(price.target,95,'mudança deve respeitar limite de 5% por ciclo');
assert.equal(price.requiresApproval,true,'preço nunca deve ser escrito automaticamente');
assert.equal(price.autoEligible,false);
assert.equal(price.safe,true,'proposta com margem suficiente deve ser marcada segura');

const noCost=buildPriceProposal({currentPrice:100,competitorMedian:80,productCost:null,policy:{maxPriceChangePct:5}});
assert.equal(noCost.safe,false,'sem custo a proposta financeira deve ficar bloqueada');
assert.match(noCost.guard.reasons.join(' '),/Custo do produto não informado/i);

assert.equal(evaluateRollback({before:{roas:10,orders:4,targetRoas:20},current:{roas:7,orders:4},daysSinceChange:7,minDays:5})?.target,20,'queda >=20% sem ganho de pedidos deve sugerir reversão');
assert.equal(evaluateRollback({before:{roas:10,orders:4,targetRoas:20},current:{roas:7,orders:5},daysSinceChange:7,minDays:5}),null,'ganho de pedidos deve impedir reversão automática');
assert.equal(evaluateRollback({before:{roas:10,orders:4,targetRoas:20},current:{roas:7,orders:4},daysSinceChange:2,minDays:5}),null,'não deve julgar a mudança cedo demais');

assert.equal(shouldOpenDeepAudit({url:'https://shopee.com.br/produto-i.1.2'}),true);
assert.equal(shouldOpenDeepAudit({url:'https://seller.shopee.com.br/portal/product'}),false);
assert.equal(shouldOpenDeepAudit({url:'javascript:alert(1)'}),false);

const summary=summarizeCycle({analysis:{score:82},campaign:{roas:8,targetRoas:10},listingProposals:[{type:'change_title',requiresApproval:true,autoEligible:false}],adsDecision:{proposals:[{type:'change_roas_target',target:9,autoEligible:true}]}});
assert.equal(summary.recommendations.length,2);
assert.equal(summary.executable,1);
assert.equal(summary.approval,1);
console.log('continuous-engine-regression: OK');
