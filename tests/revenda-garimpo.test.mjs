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
  assert.match(page,/\(custo\+taxa fixa\)|\(cost\+fixed\)\/\(1-FEE-TAX-m\)/);
});
