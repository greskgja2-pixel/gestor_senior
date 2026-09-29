import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('app/messenger/page.js','utf8');
const shell=fs.readFileSync('app/components/AppShell.js','utf8');
test('Messenger aparece na navegação',()=>{assert.match(shell,/label:'Messenger'/);assert.match(shell,/href:'\/messenger'/)});
test('Messenger usa o Motor Sênior para WebChat',()=>{assert.match(page,/shopeeMessengerList/);assert.match(page,/shopeeMessengerHistory/);assert.match(page,/shopeeMessengerSendText/)});
test('Messenger não envia cookies da Shopee ao servidor',()=>{assert.doesNotMatch(page,/SPC_CDS|csrf_token/);assert.match(page,/Cookies do Seller Center não são enviados para a Vercel/)});
test('Automação distingue pagamento de carrinho abandonado',()=>{assert.match(page,/Pagamento aprovado/);assert.match(page,/Carrinho abandonado/);assert.match(page,/sem comprador identificável/)});
