import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Fase 3 possui provedores externos protegidos por configuração',()=>{
  const source=read('lib/notifications.js');
  assert.match(source,/RESEND_API_KEY/);
  assert.match(source,/RESEND_FROM/);
  assert.match(source,/api\.resend\.com\/emails/);
  assert.match(source,/META_WHATSAPP_ACCESS_TOKEN/);
  assert.match(source,/META_WHATSAPP_PHONE_NUMBER_ID/);
  assert.match(source,/META_WHATSAPP_TEMPLATE_NAME/);
  assert.match(source,/graph\.facebook\.com/);
  assert.match(source,/provider_not_configured/);
});

test('WhatsApp fica restrito ao alerta crítico de aceleração',()=>{
  const source=read('app/api/competitor-monitor/route.js');
  assert.match(source,/whatsappVelocityRule/);
  assert.match(source,/criticalWhatsApp=rule\.enabled/);
  assert.match(source,/allowWhatsApp:criticalWhatsApp/);
  assert.match(source,/allowWhatsApp:false/);
});

test('Configurações expõem limites e testes dos canais',()=>{
  const source=read('app/UtilityNative.js');
  assert.match(source,/competitor_velocity_whatsapp_pct/);
  assert.match(source,/competitor_velocity_whatsapp_min_sales_per_day/);
  assert.match(source,/Testar e-mail/);
  assert.match(source,/Testar WhatsApp/);
  assert.match(source,/Resend conectado/);
  assert.match(source,/Meta Cloud API conectada/);
});

test('Tarefas automáticas relevantes podem notificar por email',()=>{
  const source=read('app/api/tasks/route.js');
  assert.match(source,/notifyTaskByEmail/);
  assert.match(source,/sendTaskNotification/);
});
