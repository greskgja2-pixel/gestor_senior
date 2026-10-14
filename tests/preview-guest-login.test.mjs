import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const mid=read('middleware.js');
const dash=read('app/DashboardNative.js');
const intelligence=read('app/extensao-shopee-intelligence/page.js');
const analysis=read('app/super-analise/page.js');
const guest=read('app/components/PreviewGuestPanel.js');

test('loginless preview is strictly non-production and branch scoped',()=>{
  assert.match(mid,/process\.env\.VERCEL_ENV==='preview'/);
  assert.match(mid,/PREVIEW_BRANCH='feature\/collector-evidence-pilot-20261013'/);
  assert.match(mid,/PREVIEW_PAGES\.has\(path\)/);
  assert.match(mid,/request\.method==='GET'/);
  assert.match(mid,/validAccountToken/);
});
test('private API routes and shop data remain protected',()=>{
  assert.match(mid,/if\(path\.startsWith\('\/api\/'\)\)return NextResponse\.json\(\{error:'Faça login/);
  assert.doesNotMatch(mid,/PREVIEW_PAGES=.*\/api\//);
  assert.match(intelligence,/if\(!shop&&process\.env\.VERCEL_ENV==='preview'\)/);
  assert.match(analysis,/if\(!shop&&process\.env\.VERCEL_ENV==='preview'\)/);
  assert.match(dash,/if\(!shop&&process\.env\.VERCEL_ENV==='preview'\)/);
  assert.match(guest,/não utiliza produtos, vendas, anúncios ou credenciais/);
});
test('preview guest can access safe user interface but not privileged routes',()=>{
  for(const path of ['/', '/pesquisa-produtos', '/extensao-shopee-intelligence', '/super-analise']){
    assert.ok(mid.includes("'"+path+"'"),'missing '+path);
  }
  assert.ok(!mid.includes("'\/api\/shopee\/authorize'"));
  assert.match(mid,/if\(path==='\/login'\)return NextResponse\.redirect\(new URL\('\/',request\.url\)\)/);
});
