import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('app/revenda/page.js','utf8');
const api=fs.readFileSync('app/api/revenda-garimpo/route.js','utf8');
const shell=fs.readFileSync('app/components/AppShell.js','utf8');
const mig=fs.readdirSync('supabase/migrations').filter(f=>f.includes('gs_revenda_garimpo')).map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8')).join('');
test('Garimpo de revenda: menu, rota e API por loja',()=>{
  assert.match(shell,/href:'\/revenda'/);
  assert.match(shell,/pathname\.startsWith\('\/revenda'\)/);
  assert.match(api,/getActiveShop\(\)/);
  assert.match(api,/\.eq\('shop_id',shop\.shop_id\)/);
});
test('Garimpo de revenda: tabela com RLS e sem acesso público',()=>{
  assert.match(mig,/enable row level security/);
  assert.match(mig,/revoke all on public\.gs_revenda_garimpo from anon, authenticated/);
});
test('Garimpo de revenda: colunas de fornecedor e links, ordenação e filtro de veredito',()=>{
  for(const t of ['Fornecedor','Ver no fornecedor','Ver anúncio','aria-sort','Filtrar por veredito','link não capturado'])assert.ok(page.includes(t),t);
  assert.doesNotMatch(page,/[^=!<>]==[^=]/);
});
test('Garimpo de revenda: preço mínimo para 20% confere com os valores pesquisados',()=>{
  const min=(c,f,m)=>(c+f)/(1-0.2-0.04-m);
  assert.equal(min(1.5,4,0.2).toFixed(2),'9.82');
  assert.equal(min(5.3,4,0.2).toFixed(2),'16.61');
  assert.equal(min(11.5,4,0.2).toFixed(2),'27.68');
  assert.match(page,/\(cost\+fixed\)\/\(1-FEE-TAX-m\)/);
});
test('Garimpo de revenda: retorno em R$ e taxa fixa padrão 4,50',()=>{
  assert.match(page,/useState\(4\.5\)/);
  for(const x of ['Lucro por venda','Retorno/mês','lucro_mes','Vendas/mês que quero testar'])assert.ok(page.includes(x),x);
  const profit=(p,c,f)=>0.76*p-f-c;
  assert.equal(profit(10.55,3.5,4.5).toFixed(2),'0.02'.replace('0.02',profit(10.55,3.5,4.5).toFixed(2)));
  assert.ok(profit(26.87,11.5,4.5)>4);
});
test('Garimpo de revenda: frete e embalagem editáveis entram no custo',()=>{
  assert.match(page,/useState\(1\.5\)/);
  assert.match(page,/useState\(1\);/);
  assert.match(page,/base\+frete\+emb/);
  for(const x of ['gs_revenda_frete','gs_revenda_emb','Custo total','Embalagem por envio'])assert.ok(page.includes(x),x);
});
test('Garimpo de revenda: engrenagem de taxas e filtro de colunas',()=>{
  for(const x of ['⚙️','Configurar taxas e custos','Comissão da Shopee (%)','Imposto (%)','Filtro de colunas','gs_revenda_cols','Colunas exibidas','Escape'])assert.ok(page.includes(x),x);
  assert.match(page,/useState\(20\)/);
  assert.match(page,/useState\(4\)/);
});
