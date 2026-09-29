# Protocolo Motor Sênior — Messenger Shopee

## Objetivo
O Gestor Sênior não deve armazenar nem transportar cookies privados do Seller Center pela Vercel. As chamadas de WebChat devem ser executadas pela extensão, no navegador autenticado do vendedor.

## Evidência confirmada no mapeamento 2026-09-29
- lista de conversas: POST `/webchat/api/v1.2/conversations`
- lista segmentada: POST `/webchat/api/v1.2/conversation/serving/list`
- não lidas: GET `/webchat/api/v1.2/conversation/unread-count`
- abrir conversa: POST `/webchat/api/v1.2/conversation/open`
- entrar na conversa: POST `/webchat/api/v1.2/conversation/enter`
- histórico: GET `/webchat/api/v1.2/conversations/{conversation_id}/messages`
- comprador: GET `/webchat/api/v1.2/users/{buyer_id}`
- pedido: GET `/webchat/api/v1.2/order/{order_id}`
- produto: GET `/webchat/api/v1.2/products/{item_id}`
- atalhos: GET `/webchat/api/v1.2/message_shortcuts/all_groups`
- endpoint de envio: POST `/webchat/api/v1.2/messages`

O único payload de envio integral capturado nessa sessão foi do tipo `sticker`. O log contém a métrica `action_send_text_message`, mas não contém um POST de texto integral suficiente para inferir o payload com segurança. Portanto o Motor não deve converter o payload de sticker em texto por suposição.

## Ações esperadas pela página /messenger

### shopeeMessengerList
Entrada:
```json
{"bizIds":[0,11,12],"limit":40}
```
Saída normalizada:
```json
{"conversations":[{"conversation_id":"...","buyer_id":123,"buyer_shop_id":456,"buyer_name":"...","last_message":"...","unread_count":1,"timestamp":0,"biz_id":0}]}
```

### shopeeMessengerHistory
Entrada:
```json
{"conversationId":"...","buyerId":123,"buyerShopId":456,"bizId":0,"limit":30}
```
Saída normalizada:
```json
{"messages":[{"id":"...","type":"text","text":"...","mine":false,"timestamp":0}],"buyer":{},"order":null,"product":null}
```

### shopeeMessengerSendText
Só habilitar depois de capturar uma mensagem de texto normal enviada manualmente no WebChat e confirmar o body real.
Entrada futura:
```json
{"conversationId":"...","buyerId":123,"buyerShopId":456,"bizId":0,"text":"Olá"}
```

## Automações
- Pagamento aprovado: viável como gatilho quando houver evento de pedido + destinatário de chat válido + envio de texto confirmado. Implementar idempotência para não mandar mensagem duplicada.
- Carrinho abandonado: NÃO implementar como automação enquanto a Shopee não fornecer, por fonte confirmada, a identidade do comprador associada ao carrinho. O filtro `to_pay` é conversa/pedido a pagar e não prova carrinho abandonado.
