import test from 'node:test';
import assert from 'node:assert/strict';
import {applySavedCosts} from '../app/lib/product-costs-merge.js';

const variantReport={
  item_id:22392859916,
  metrics:{price:null},
  product_snapshot:{variations:[{modelId:1,name:'Encadernado',price:20},{modelId:2,name:'Folhas soltas',price:18}]},
  finance_snapshot:{},
};
const variantRows=[
  {item_id:22392859916,model_id:1,cost:5.35,packaging_cost:0},
  {item_id:22392859916,model_id:2,cost:4.85,packaging_cost:0},
];

test('produto com variações lê o custo de cada variação de product_costs', () => {
  const out=applySavedCosts(variantReport,variantRows);
  const vars=out.product_snapshot.variations;
  assert.equal(vars[0].cost,5.35);
  assert.equal(vars[1].cost,4.85);
  assert.equal(out.product_snapshot.variationCosts.length,2);
  assert.equal(out.finance_snapshot.marginStatus,'ok');
  assert.ok(out.finance_snapshot.marginPct<out.finance_snapshot.marginMaxPct);
});

test('custo da variação sem linha salva continua ausente (não vira zero)', () => {
  const out=applySavedCosts(variantReport,[variantRows[0]]);
  assert.equal(out.product_snapshot.variations[1].cost,null);
  assert.equal(out.finance_snapshot.marginStatus,'incomplete');
  assert.equal(out.finance_snapshot.marginPct,null);
});

test('produto sem variações usa o custo único (model_id 0)', () => {
  const report={item_id:111,metrics:{price:30},product_snapshot:{price:30},finance_snapshot:{}};
  const out=applySavedCosts(report,[{item_id:111,model_id:0,cost:10,packaging_cost:1}]);
  assert.equal(out.finance_snapshot.productCost,11);
  assert.equal(out.finance_snapshot.marginCalculationMode,'single');
  assert.equal(out.finance_snapshot.marginStatus,'ok');
});

test('sem nenhuma linha de custo do item devolve o relatório original', () => {
  const report={item_id:5,product_snapshot:{},finance_snapshot:{productCost:7}};
  assert.equal(applySavedCosts(report,[{item_id:999,model_id:0,cost:1}]),report);
});
