import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const guard=read('app/components/SidebarOrderGuard.js');
const dashboard=read('public/shell-enhancements.js');
const page=read('app/extensao-shopee-intelligence/page.js');
const superAnuncio=read('app/extensao-shopee-intelligence/SuperAnuncioMockup.js');
const sections=read('app/extensao-shopee-intelligence/IntelligenceSections.js');
const roas=read('app/protecao-roas/ProtectionRoasDashboard.js');
const live=read('public/live-modules.js');
const frame=read('app/components/ShopeeLiveFrame.js');
const shellCss=read('public/shell-enhancements.css');

const routes=[
  '/extensao-shopee-intelligence?section=super-anuncio',
  '/extensao-shopee-intelligence?section=concorrentes',
  '/extensao-shopee-intelligence?section=shopee-ads',
  '/protecao-roas',
  '/extensao-shopee-intelligence?section=reanalises',
  '/extensao-shopee-intelligence?section=prioridades',
  '/extensao-shopee-intelligence?section=relatorios'
];

test('menu usa rotas reais e nao depende de hash para abrir paginas',()=>{
  for(const route of routes){
    assert.ok(guard.includes(route),`rota ausente no menu global: ${route}`);
    assert.ok(dashboard.includes(route),`rota ausente no dashboard: ${route}`);
  }
  for(const source of [guard,dashboard,superAnuncio,roas]){
    assert.doesNotMatch(source,/extensao-shopee-intelligence#(?:concorrentes|shopee-ads|reanálises|prioridades|relatorios)/);
  }
});

test('rota intelligence renderiza uma pagina funcional por secao',()=>{
  assert.match(page,/import IntelligenceSections/);
  assert.match(page,/initialSection/);
  assert.match(page,/if\(initialSection!==['"]super-anuncio['"]\)return <IntelligenceSections/);
  for(const token of ['Concorrentes','Shopee Ads','Reanálises','Prioridades','Relatórios','/api/shopee/ads?days=30']){
    assert.ok(sections.includes(token),`secao funcional ausente: ${token}`);
  }
});

test('Protecao ROAS faz parte do mesmo menu canonico',()=>{
  assert.match(guard,/label:'Proteção ROAS'/);
  assert.match(dashboard,/label:'Proteção ROAS'/);
  assert.match(superAnuncio,/Proteção ROAS/);
  assert.match(roas,/Proteção ROAS/);
  assert.match(guard,/label:'Temas'/);
  assert.match(guard,/label:'Configurações'/);
  assert.match(guard,/\/?section=temas/);
  assert.match(guard,/\/?section=config/);
  assert.match(dashboard,/id:'temas'/);
  assert.match(dashboard,/id:'config'/);
});


test('Temas e Configuracoes atualizam a URL real e compartilham o mesmo seletor',()=>{
  assert.match(dashboard,/id:'temas'[^\n]*href:'\/\?section=temas'/);
  assert.match(dashboard,/id:'config'[^\n]*href:'\/\?section=config'/);
  assert.match(live,/const GS_THEMES=/);
  assert.match(live,/window\.parent\.location\.href='\/\?section=temas'/);
});

test('Dashboard e cache do shell usam a versao corrigida',()=>{
  assert.match(live,/const name='Dashboard'/);
  assert.doesNotMatch(live,/const name='Início'/);
  assert.match(frame,/VERSION="20260919-01"/);
  assert.match(shellCss,/\.topbar \.status\{display:none!important\}/);
});
