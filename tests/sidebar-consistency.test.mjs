import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const layout=read('app/layout.js');
const css=read('app/sidebar-standard.css');

test('layout global carrega o padrao oficial do menu lateral',()=>{
  assert.match(layout,/import\s+["']\.\/sidebar-standard\.css["']/);
});

test('menu lateral oficial permanece branco e com largura fixa de 218px',()=>{
  assert.match(css,/--gs-sidebar-width:218px/);
  assert.match(css,/background:#fbfdff!important/);
  assert.match(css,/border-right:1px solid #e2e9f2!important/);
  assert.match(css,/font-size:12px!important/);
  assert.match(css,/background:#e8f2ff!important/);
  assert.match(css,/color:#1265d8!important/);
});

test('Super Analise nao pode voltar para sidebar azul ou largura 210\/185',()=>{
  assert.match(css,/web-audit_screen__/);
  assert.match(css,/page_screen__/);
  assert.match(css,/grid-template-columns:var\(--gs-sidebar-width\) minmax\(0,1fr\)!important/);
});
