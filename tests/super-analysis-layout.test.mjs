import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const page=read('app/super-analise/page.js');
const bodyMode=read('app/super-analise/SuperAnaliseBodyMode.js');
const globals=read('app/globals.css');
const moduleCss=read('app/super-analise/page.module.css');

test('Super Analise ativa o modo visual exclusivo da rota',()=>{
  assert.match(page,/import\s+SuperAnaliseBodyMode\s+from\s+['"]\.\/SuperAnaliseBodyMode['"]/);
  assert.match(page,/<SuperAnaliseBodyMode\s*\/>/);
  assert.match(bodyMode,/document\.body\.classList\.add\(['"]super-analise-page['"]\)/);
  assert.match(bodyMode,/document\.body\.classList\.remove\(['"]super-analise-page['"]\)/);
});

test('Super Analise nunca volta para o shell legado estreito',()=>{
  assert.match(globals,/body\.super-analise-page\s*>\s*\.shell[\s\S]*?max-width:\s*none[\s\S]*?width:\s*100%[\s\S]*?margin:\s*0[\s\S]*?padding:\s*0/);
  assert.match(globals,/body\.super-analise-page\s*>\s*\.shell\s*>\s*\.topbar[\s\S]*?display:\s*none/);
  assert.match(globals,/body\.super-analise-page[\s\S]*?background-image:\s*none/);
});

test('Layout proprio da Super Analise continua horizontal no desktop',()=>{
  assert.match(moduleCss,/\.shell\{[^}]*display:grid[^}]*grid-template-columns:220px\s+1fr/);
  assert.match(moduleCss,/\.workspace\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\)\s+275px/);
  assert.match(moduleCss,/\.compare\{[^}]*display:grid[^}]*grid-template-columns:minmax\(0,1fr\)\s+50px\s+minmax\(0,1fr\)/);
  assert.doesNotMatch(moduleCss,/\.shell\{[^}]*max-width\s*:/);
});
