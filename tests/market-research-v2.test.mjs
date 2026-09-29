import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('app/pesquisa-produtos/MarketResearch.js','utf8');
const css=fs.readFileSync('app/pesquisa-produtos/pesquisa-produtos.module.css','utf8');

test('Pesquisa v2 mede cobertura sem transformar ausência em zero',()=>{
  assert.match(page,/function coverage\(rows,key\)/);
  assert.match(page,/bench\.coverage\.monthly/);
  assert.match(page,/Não coletado/);
  assert.match(page,/suspiciousSales/);
  assert.match(page,/não assume que isso significa ausência de demanda/);
});

test('Pesquisa v2 tem profundidade, confiança e paginação',()=>{
  assert.match(page,/quick:1,standard:3,deep:5/);
  assert.match(page,/function confidence\(r\)/);
  assert.match(page,/PAGE_SIZE=20/);
  assert.match(page,/Mostrando/);
  assert.match(css,/\.confidence/);
  assert.match(css,/\.pagination/);
});

test('Pesquisa v2 cria inteligência determinística de mercado',()=>{
  assert.match(page,/function keywordInsights\(rows\)/);
  assert.match(page,/function sellerConcentration\(rows\)/);
  assert.match(page,/Palavras-chave/);
  assert.match(page,/Concorrência/);
  assert.match(page,/Insights/);
  assert.doesNotMatch(page,/Próximas camadas/);
});

test('Pesquisa v2 preserva busca pelo Motor Senior',()=>{
  assert.match(page,/motorData\('marketplaceSearch'/);
  assert.match(page,/sort:'relevance'/);
});


test('Pesquisa compara diagnóstico do Motor com o normalizador do Gestor',()=>{
  assert.match(page,/row\?\.reviewCount/);
  assert.match(page,/row\?\.shopLocation/);
  assert.match(page,/payload\?\.diagnostics/);
  assert.match(page,/Motor Sênior × Gestor/);
  assert.match(page,/normalização/);
  assert.match(page,/COBERTURA DOS DADOS/);
  assert.match(css,/\.diagnosticGrid/);
});


test('Pesquisa exporta diagnóstico técnico da extensão',()=>{
  assert.match(page,/function downloadDiagnostics\(\)/);
  assert.match(page,/Baixar diagnóstico técnico/);
  assert.match(page,/diagnostics\?\.mode==='diagnostic-only'/);
  assert.match(css,/\.diagnosticActions/);
});
