# Fase 3 — notificações externas

## Resend (e-mail)

Variáveis de ambiente necessárias:

- `RESEND_API_KEY`
- `RESEND_FROM` — exemplo: `Gestor Senior <alertas@seudominio.com>`

Opcional, mas recomendado:

- `NEXT_PUBLIC_APP_URL` — URL pública do Gestor Senior.

O sistema envia e-mails para tarefas automáticas relevantes e permite teste manual em Configurações.

## WhatsApp Cloud API (Meta)

O WhatsApp fica reservado para o alerta crítico de aceleração forte de vendas de concorrentes.

Variáveis de ambiente necessárias:

- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_TEMPLATE_NAME`
- `META_GRAPH_VERSION`
- `META_WHATSAPP_TEMPLATE_LANGUAGE` — opcional; padrão `pt_BR`

O template configurado em `META_WHATSAPP_TEMPLATE_NAME` deve aceitar cinco parâmetros de corpo, nesta ordem:

1. Nome do usuário
2. Nome do concorrente
3. Ritmo atual de vendas, por exemplo `12,4 vendas/dia`
4. Percentual de aceleração, por exemplo `125%`
5. Link do Gestor Senior

Exemplo de texto do template:

`Olá {{1}}. O concorrente {{2}} acelerou para {{3}}, uma alta de {{4}} no ritmo de vendas. Veja os detalhes: {{5}}`

A interface do Gestor permite configurar o percentual mínimo de aceleração e o mínimo de vendas/dia para que o WhatsApp seja usado. Mudanças menores permanecem na Central de Prioridades e podem ser enviadas por e-mail.

## Segurança

As chaves ficam somente nas variáveis de ambiente do servidor. A tela de Configurações recebe apenas o estado `configured: true/false`, nunca os segredos.
