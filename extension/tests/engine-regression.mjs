import assert from 'node:assert/strict';
import {analyze, buildRoasStrategy} from '../src/lib/super-anuncio-engine.js';
import {computeProfit} from '../src/lib/profit-engine.js';

const title='Cadeira Gamer Ergonômica Profissional Reclinável com Apoio para Pés e Altura Ajustável para Escritório e Casa';
const product={imageCount:9,hasVideo:true,rating:4.9,reviewCount:601,attributesCount:5,variationCount:3,stock:19855};
const competitors=[
  {title:'Cadeira Gamer Profissional Escritório Ergonômica Reclinável Confortável Com Rodinha E Apoio Para Pés',price:386.90},
  {title:'Cadeira de Escritório Ergonômica Com Apoio Lombar e Apoio de Cabeça Suporte Lombar Tela Mesh 150kg',price:429.99},
  {title:'Cadeira Gamer Stillus Ergonômica com Apoio para os Pés Oficial Webshop',price:541.07}
];
const result=analyze({title,description:'x'.repeat(600),category:'Casa e Construção > Móveis > Bancos, Cadeiras e Banquetas',price:429.99,product,competitors,adsActive:true,roas7d:15,roasTarget:24,adsSpend7d:98,productCost:100});
assert.equal(result.score,99);
const dims=Object.fromEntries(result.dimensions.map(d=>[d.name,d.score]));
assert.deepEqual(dims,{'Título':11,'Descrição':12,'Imagens':15,'Vídeo':8,'Categoria':8,'Preço e concorrência':15,'Prova social':10,'Atributos, estoque e variações':8,'Ads e eficiência':12});
const finance=computeProfit({price:429.99,productCost:100});
assert.ok(Math.abs(finance.contributionMargin*100-55.8134)<0.01);
assert.ok(Math.abs(finance.breakEvenRoas-1.79168)<0.001);
const roas=buildRoasStrategy({price:429.99,productCost:100,roas7d:15,roasTarget:24});
assert.equal(roas.title,'A meta pode estar restritiva');
assert.ok(Math.abs(roas.suggestedTarget-21.6)<0.001);
console.log('engine-regression: OK');
