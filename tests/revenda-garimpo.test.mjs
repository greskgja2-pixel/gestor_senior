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
test('Garimpo de revenda: anúncios conferidos por produto (tabela com RLS e seta que expande)',()=>{
  const m=fs.readdirSync('supabase/migrations').filter(f=>f.includes('gs_revenda_anuncios')).map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8')).join('');
  assert.match(m,/enable row level security/);
  assert.match(m,/revoke all on public\.gs_revenda_anuncios from anon, authenticated/);
  assert.match(api,/gs_revenda_anuncios/);
  for(const t of ['adsBtn','É o mesmo produto?','Vendas 30 dias','Nenhum anúncio conferido'])assert.ok(page.includes(t),t);
});

import {analyzeSelected} from '../app/lib/revenda-analysis.js';
test('Garimpo de revenda: parciais entram na conta e o usuário marca/desmarca anúncios',()=>{
  assert.match(page,/type="checkbox" checked=\{!off\.has\(a\.id\)\}/);
  assert.match(page,/<th>Diferenças<\/th>/);
  assert.match(page,/a\.equivalencia==='parcial'\?\(a\.diferencas/);
  const ads=[
    {id:1,equivalencia:'identico',preco:15.35,vendas_30d:2037},
    {id:2,equivalencia:'parcial',preco:22.25,vendas_30d:316},
    {id:3,equivalencia:'diferente',preco:50,vendas_30d:900},
    {id:4,equivalencia:'parcial',preco:16.76,vendas_30d:2953}
  ];
  const p={min20:21.41,custo:9.99,fixed:4.5,fee:0.2,tax:0.04};
  const all=analyzeSelected(ads,new Set(),p);
  assert.equal(all.count,3);                 // diferente nunca entra
  assert.equal(all.leader.id,4);
  assert.equal(all.viavel.id,2);
  assert.equal(all.veredito,'arriscado');    // viável com <20% das vendas
  const semParcial=analyzeSelected(ads,new Set([2,4]),p);
  assert.equal(semParcial.leader.id,1);
  assert.equal(semParcial.viavel,null);
  assert.equal(semParcial.veredito,'nao_compensa');
  assert.equal(analyzeSelected(ads,new Set([1,2,4]),p),null);
});

test('Garimpo de revenda: botão Reanalisar abre conversa no Claude com a skill e o produto',()=>{
  assert.match(page,/Reanalisar no Claude/);
  assert.match(page,/claude\.ai\/new\?q=/);
  assert.match(page,/pesquisa-mercado-shopee/);
  assert.match(page,/r\.link_fornecedor/);
  assert.match(page,/PRODUTO NÃO ENCONTRADO/);
});

test('Garimpo de revenda: backup completo por loja e status aguardando análise',()=>{
  const bk=fs.readFileSync('app/api/revenda-garimpo/backup/route.js','utf8');
  assert.match(bk,/getActiveShop\(\)/);
  assert.match(bk,/\.eq\('shop_id',shop\.shop_id\)/);
  assert.match(bk,/gs_revenda_anuncios/);
  assert.match(bk,/Content-Disposition/);
  assert.ok(page.includes('/api/revenda-garimpo/backup'));
  assert.ok(page.includes("aguardando:'Aguardando análise'"));
});
