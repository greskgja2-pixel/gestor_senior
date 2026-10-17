import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractMarketplaceRows,marketplaceItemEvidence} from '../app/lib/marketplace-evidence.js';

test('coletor compartilhado aceita formato nativo da busca e dados do Motor',()=>{
  const example={data:{items:[{item_basic:{itemid:123,shopid:456,name:'Produto real',price:1290000,historical_sold:0,monthly_sold:7,item_rating:{rating_star:4.8,rating_count:[9,0,0,0,0,9]},shop_location:'São Paulo'}}]}};
  const rows=extractMarketplaceRows(example);
  assert.equal(rows.length,1);
  const observed=marketplaceItemEvidence(rows[0],{source:'motor-natural-search',collectedAt:'2026-10-13T12:00:00Z'});
  assert.equal(observed.itemId,'123');
  assert.equal(observed.shopId,'456');
  assert.equal(observed.price,12.9);
  assert.equal(observed.sold,0);
  assert.equal(observed.monthlySold,7);
  assert.equal(observed.reviewCount,9);
  assert.equal(observed.location,'São Paulo');
  assert.equal(observed.provenance.fields.sold.kind,'observed');
  assert.equal(observed.provenance.source,'motor-natural-search');
});

test('ausência de vendas permanece null, nunca zero',()=>{
  const observed=marketplaceItemEvidence({itemId:'42',price:790000});
  assert.equal(observed.sold,null);
  assert.equal(observed.monthlySold,null);
  assert.equal(observed.rating,null);
  assert.equal(observed.provenance.fields.monthlySold.kind,'unavailable');
});

test('venda mensal calculada é excluída da métrica real',()=>{
  const observed=marketplaceItemEvidence({itemId:42,sold:120,monthlySold:20,monthlySoldSource:'estimated'});
  assert.equal(observed.monthlySold,null);
  assert.equal(observed.estimatedMonthlySold,20);
  assert.equal(observed.provenance.fields.monthlySold.kind,'estimated-excluded');
});

test('ads_id isolado e selo Indicado não viram anúncio patrocinado',()=>{
  const fromId=marketplaceItemEvidence({itemId:1,adsid:4939,is_preferred_shop:true});
  assert.equal(fromId.ads.status,'unknown');
  assert.equal(fromId.preferred,true);
  const explicit=marketplaceItemEvidence({itemId:2,item_basic:{itemid:2,is_ads:true}});
  assert.equal(explicit.ads.status,'detected');
  const negative=marketplaceItemEvidence({itemId:3,is_ads:false});
  assert.equal(negative.ads.status,'not_detected');
});

test('normalização mantém pesquisa e checagem dos concorrentes ligadas ao mesmo contrato',()=>{
  const research=fs.readFileSync(new URL('../app/pesquisa-produtos/MarketResearch.js',import.meta.url),'utf8');
  const competitors=fs.readFileSync(new URL('../app/api/competitor-background-check/route.js',import.meta.url),'utf8');
  assert.match(research,/extractMarketplaceRows\(payload\)/);
  assert.match(research,/marketplaceItemEvidence\(row/);
  assert.match(research,/motorData\('marketplaceSearch'/);
  assert.match(competitors,/marketplaceItemEvidence\(raw/);
  assert.doesNotMatch(competitors,/ads_id\s*\?\?/);
  assert.match(competitors,/getPublicItemInfo/);
});

test('buscas vazias e discovery antigo continuam sem inventar resultados',()=>{
  assert.deepEqual(extractMarketplaceRows({data:{items:[]}}),[]);
  assert.deepEqual(extractMarketplaceRows({discovery:{candidates:{x:{itemid:1}}}}),[{itemid:1}]);
  assert.equal(marketplaceItemEvidence({title:'sem identificação'}),null);
});

test('radar usa Motor de busca natural e tenta servidor apenas para concorrentes restantes',()=>{
  const radar=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/IntelligenceSections.js',import.meta.url),'utf8');
  assert.match(radar,/collectNaturalCompetitorGroup\(list,keyword,maxPages\)/);
  assert.match(radar,/motorData\('marketplaceSearch'/);
  assert.match(radar,/extractMarketplaceRows\(response\)/);
  assert.match(radar,/marketplaceItemEvidence\(raw/);
  assert.match(radar,/if\(!raw\)continue/);
  assert.match(radar,/watch_ids:unresolved\.map\(r=>r\.watch\.id\)/);
  assert.match(radar,/fallbackError/);
  assert.match(radar,/source==='server-background-search'/);
});
test('formato atual item_data: 30 dias reais, preço, 5 estrelas, vídeo, marca e selo',()=>{
  const example={items:[{item_basic:null,itemid:111,shopid:222,adsid:null,item_data:{
    ctime:1700000000,shopee_verified:true,shop_data:{shop_name:'Loja Teste'},
    global_brand:{display_name:'Marca Teste'},
    item_rating:{rating_star:4.8,rating_count:[120,1,2,3,14,100]},
    item_card_display_price:{price:12990000,strikethrough_price:19990000,discount:35},
    item_card_display_sold_count:{historical_sold_count:218,monthly_sold_count:171}},
    item_card_displayed_asset:{name:'Ventilador',image:'hashimagem',
      shop_location:'São Paulo',seller_flag:{name:'PREFERRED'},icon_in_image:{icon_type:2,ads_text:'Ad'}}}]};
  const row=marketplaceItemEvidence(extractMarketplaceRows(example)[0],{source:'shopee-search-api'});
  assert.equal(row.itemId,'111');assert.equal(row.shopId,'222');
  assert.equal(row.price,129.9);assert.equal(row.originalPrice,199.9);
  assert.equal(row.sold,218);assert.equal(row.monthlySold,171);
  assert.equal(row.fiveStarReviews,100);assert.equal(row.reviewCount,120);
  assert.equal(row.rating,4.8);assert.equal(row.location,'São Paulo');
  assert.equal(row.preferred,true);assert.equal(row.official,false);
  assert.equal(row.brand,'Marca Teste');assert.equal(row.hasVideo,true);
  assert.equal(row.stock,null);assert.equal(row.sellerName,'Loja Teste');
  assert.equal(row.ads.status,'unknown');
  assert.equal(row.createdAt,new Date(1700000000*1000).toISOString());
  assert.equal(row.provenance.shape,'item_data');
  assert.equal(row.provenance.fields.monthlySold.kind,'observed');
  assert.equal(row.provenance.fields.monthlySold.path,'item_data.item_card_display_sold_count.monthly_sold_count');
});

test('item_basic.sold mensal não substitui historical_sold acumulado',()=>{
  const x=marketplaceItemEvidence({item_basic:{itemid:9,shopid:2,historical_sold:360,sold:17,
    item_rating:{rating_star:0,rating_count:[0,0,0,0,0,0]},video_info_list:[],is_official_shop:true}});
  assert.equal(x.sold,360);assert.equal(x.monthlySold,17);
  assert.equal(x.reviewCount,0);assert.equal(x.hasVideo,false);
  assert.equal(x.official,true);assert.equal(x.preferred,null);
});

test('campo ausente não vira zero; anúncios sem dado de patrocinado são unknown',()=>{
  const x=marketplaceItemEvidence({itemid:3,adsid:1790,item_data:{
    item_card_display_sold_count:{historical_sold_count:0,monthly_sold_count:0}},
    item_card_displayed_asset:{icon_in_image:{ads_text:'Ad'}}});
  assert.equal(x.sold,0);assert.equal(x.monthlySold,0);
  assert.equal(x.stock,null);assert.equal(x.brand,null);assert.equal(x.ads.status,'unknown');
  assert.equal(x.ads.hint,'adsid-unconfirmed');
});

test('Pesquisa e Radar reaproveitam item_data pelo adaptador compartilhado',()=>{
  const research=fs.readFileSync(new URL('../app/pesquisa-produtos/MarketResearch.js',import.meta.url),'utf8');
  const radar=fs.readFileSync(new URL('../app/extensao-shopee-intelligence/IntelligenceSections.js',import.meta.url),'utf8');
  assert.match(research,/const price=observed\.price,original=observed\.originalPrice,sold=observed\.sold/);
  assert.match(research,/filter\(Boolean\)/);
  assert.match(radar,/function searchMarketData\(row\)\{\s*const observed=marketplaceItemEvidence/);
  assert.match(radar,/price:observed\?\.price/);
});
