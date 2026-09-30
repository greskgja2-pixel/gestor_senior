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


test('Pesquisa integra Assistente de Criação com abas e controles de visibilidade',()=>{
  for(const expected of [
    'ASSISTENTE DE CRIAÇÃO DO ANÚNCIO','overviewVisible','assistantVisible','assistantTab',
    'Ocultar visão geral','Mostrar visão geral','Ocultar assistente','Mostrar assistente',
    'Categoria / NCM','Referências','Checklist'
  ]) assert.ok(page.includes(expected),expected);
  for(const expected of ['.creationAssistant','.assistantTabs','.sectionToggle'])
    assert.ok(css.includes(expected),expected);
});

test('Assistente preserva honestidade de dados em categoria e NCM',()=>{
  for(const expected of [
    'A busca pública atual não devolve, de forma confiável',
    'Não confirmado pela pesquisa',
    'O Gestor não vai inventar esse campo'
  ]) assert.ok(page.includes(expected),expected);
});


test('Histórico de pesquisas é recolhível, persistente e acessível',()=>{
  for(const expected of [
    'historico_aberto','historyOpen','Histórico de pesquisas','Ocultar histórico',
    'aria-expanded={historyOpen}','aria-controls="pesquisas-anteriores"','id="pesquisas-anteriores"',
    'Pesquisas anteriores','Filtrar por termo','Ver todas'
  ]) assert.ok(page.includes(expected),expected);
  for(const expected of ['.historyCard','.historyGrid','.historyToggleOpen','.historyDetails'])
    assert.ok(css.includes(expected),expected);
});

test('Histórico preserva snapshots e ações sem inventar dados',()=>{
  for(const expected of [
    'slice(0,50)','compactRows','Abrir pesquisa','Repetir e comparar','Excluir',
    'Não coletado','Sem dados comparáveis','versão antiga'
  ]) assert.ok(page.includes(expected),expected);
  assert.match(page,/localStorage\.setItem\('gs_market_saved'/);
});

test('UX para leigos: fluxo em 3 passos, estado vazio e detalhes técnicos recolhidos',()=>{
  for(const expected of [
    'Pesquisar automaticamente','Rápida','Padrão','Profunda','role="radiogroup"',
    'Nenhuma pesquisa aberta','Selecione uma pesquisa no histórico ou faça uma nova busca para ver a análise completa.',
    'Abrir pesquisa selecionada','Qualidade dos dados','Ver detalhes técnicos',
    'Resumo da oportunidade','Margem saudável','Poucos dados disponíveis','Concorrência'
  ]) assert.ok(page.includes(expected),expected);
  for(const expected of ['.resultCards','.keywordList','.decisionCard','.tone','.primaryBtn'])
    assert.ok(css.includes(expected),expected);
  assert.ok(!page.includes('dangerouslySetInnerHTML'));
});
