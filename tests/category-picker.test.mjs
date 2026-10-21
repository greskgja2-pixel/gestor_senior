import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const editor=read('app/super-analise/SuperAnaliseInteligente.js');
const route=read('app/api/shopee/product-update/route.js');
const catalog=read('app/api/shopee/catalog/route.js');
const lib=read('app/lib/shopee-categories.js');
const panel=read('app/extensao-shopee-intelligence/SuperAnuncioMockup.js');

test('Editar categoria abre a aba pedida e mostra o seletor de categorias oficiais da Shopee',()=>{
  // Antes o editor embutido sempre voltava para a primeira aba pendente (Título), mostrando "Título aprovado" no lugar da categoria.
  assert.match(editor,/setTab\(embedded&&allowedTabs\.has\(initialTab\)\?initialTab:firstPending\)/);
  assert.match(editor,/function CategoryPicker/);
  assert.match(editor,/Escolher a categoria oficial da Shopee/);
  assert.match(editor,/<CategoryPicker /);
  assert.match(editor,/\/api\/shopee\/catalog|loadCategoryTree/);
  assert.match(editor,/Selecionar/);
});

test('escolher categoria só marca alteração pendente; salvar pede confirmação e envia categoryId',()=>{
  assert.match(editor,/onChoose=\{id=>mutate\(\(\)=>setChosenCategory\(String\(id\)\)\)\}/);
  assert.match(editor,/changes\.categoryId!=null&&typeof window!=='undefined'&&!window\.confirm/);
  assert.match(editor,/changes\.categoryId=Number\(chosenCategory\)/);
});

test('a rota publica categoria somente se for categoria final da lista oficial e confere depois',()=>{
  assert.match(route,/new Set\(\['title','description','categoryId'\]\)/);
  assert.match(route,/getCategories\(shop\)/);
  assert.match(route,/Essa categoria não existe na lista oficial da Shopee/);
  assert.match(route,/found\.has_children/);
  assert.match(route,/itemFields\.category_id=categoryId/);
  assert.match(route,/Number\(item\?\.category_id\)===Number\(itemFields\.category_id\)/);
  assert.match(route,/applied\.push\('categoryId'\)/);
});

test('lista de categorias fica em cache e o comparativo usa o nome oficial pelo ID',()=>{
  assert.match(catalog,/categoryCache/);
  assert.match(lib,/\/api\/shopee\/catalog\?resource=categories/);
  assert.match(lib,/hasChildren/);
  assert.match(lib,/export function sameCategory/);
  assert.ok(lib.includes("a.startsWith(b)||b.startsWith(a)"));
  assert.match(panel,/categoryPath\(tree,myId\)/);
  assert.match(panel,/Categoria não identificada/);
});
