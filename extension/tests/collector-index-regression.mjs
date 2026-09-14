import assert from 'node:assert/strict';
import {normalizeSearchBody, computeDatasetStats} from '../src/lib/collector-index.js';

const sample={items:[
  {item_basic:{itemid:101,shopid:10,name:'Caderno de Colorir Infantil Dragões A4',price:1999000,historical_sold:320,item_rating:{rating_star:4.9},image:'abc'}},
  {item_basic:{itemid:102,shopid:11,name:'Livro para Colorir Infantil Dragões A4',price:2599000,historical_sold:140,item_rating:{rating_star:4.8},image:'def'}},
  {item_basic:{itemid:103,shopid:12,name:'Kit Colorir Infantil Dinossauros',price:1499000,historical_sold:80,item_rating:{rating_star:4.7},image:'ghi'}}
]};
const rows=normalizeSearchBody(sample,{query:'caderno colorir dragões'});
assert.equal(rows.length,3);
assert.equal(rows[0].price,19.99);
assert.equal(rows[0].itemId,'101');
assert.match(rows[0].imageUrl,/down-br\.img\.susercontent\.com/);
const stats=computeDatasetStats(rows);
assert.equal(stats.total,3);
assert.equal(stats.shops,3);
assert.equal(stats.medianPrice,19.99);
assert.equal(stats.totalHistoricalSold,540);
assert.equal(stats.top[0].itemId,'101');
console.log('collector-index-regression: OK');
