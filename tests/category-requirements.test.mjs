import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCategoryPayload,normalizeAttributeTree} from '../lib/category-attributes.js';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const attributes=[
  {attribute_id:1,original_attribute_name:'Item Code',is_mandatory:true,attribute_value_list:[]},
  {attribute_id:2,original_attribute_name:'Tipo',is_mandatory:true,attribute_value_list:[{value_id:20,original_value_name:'Líquido'}]},
  {attribute_id:3,original_attribute_name:'Opcional',is_mandatory:false,attribute_value_list:[]}
];

test('atributo obrigatório sem valor bloqueia o envio e diz qual falta', () => {
  const r=buildCategoryPayload({attributes,brandInfo:{is_mandatory:false},input:{attributeList:[{attributeId:2,valueId:20}]}});
  assert.match(r.error,/Item Code/);
});
test('monta attribute_list: texto livre com value_id 0 e lista com value_id oficial', () => {
  const r=buildCategoryPayload({attributes,brandInfo:{is_mandatory:false},input:{attributeList:[{attributeId:1,name:'ABC-1'},{attributeId:2,valueId:20}]}});
  assert.deepEqual(r.attribute_list,[
    {attribute_id:1,attribute_value_list:[{value_id:0,original_value_name:'ABC-1'}]},
    {attribute_id:2,attribute_value_list:[{value_id:20,original_value_name:'Líquido'}]}
  ]);
  assert.equal(r.brand,undefined);
});
test('valor de lista que não existe na categoria é recusado', () => {
  const r=buildCategoryPayload({attributes,brandInfo:null,input:{attributeList:[{attributeId:1,name:'x'},{attributeId:2,valueId:99}]}});
  assert.match(r.error,/inválido/);
});
test('marca obrigatória sem escolha é recusada; com escolha vai no formato da Shopee', () => {
  const base={attributes:[],input:{attributeList:[]}};
  assert.match(buildCategoryPayload({...base,brandInfo:{is_mandatory:true}}).error,/marca/i);
  const ok=buildCategoryPayload({attributes:[],brandInfo:{is_mandatory:true},input:{attributeList:[],brand:{brandId:5,name:'Marca X'}}});
  assert.deepEqual(ok.brand,{brand_id:5,original_brand_name:'Marca X'});
});
test('normalizeAttributeTree mantém o campo mandatory', () => {
  const n=normalizeAttributeTree({response:{list:[{category_id:7,attribute_tree:[{attribute_id:1,name:'Item Code',mandatory:true}]}]}},7);
  assert.equal(n.response.attribute_list[0].is_mandatory,true);
});
test('rota e editor usam os campos obrigatórios antes de trocar a categoria', () => {
  const route=read('app/api/shopee/product-update/route.js');
  assert.match(route,/buildCategoryPayload/);
  assert.match(route,/itemFields\.attribute_list=payload\.attribute_list/);
  const editor=read('app/super-analise/SuperAnaliseInteligente.js');
  assert.match(editor,/<CategoryRequirements/);
  assert.match(editor,/changes\.attributeList=r\.attributeList/);
});
