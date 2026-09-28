# Enciclopédia Shopee Seller Center → Gestor Sênior

**Versão:** 12.0 (v11 + períodos históricos de 7/30 dias e séries MyData confirmadas em 27/09/2026)  
**Origem:** consolidação das sessões do Shopee Seller Auto Mapper + validações visuais + mapeamentos do Seller Center e Marketplace público até 27/09/2026, incluindo as capturas manuais Motor Sênior de 7 e 30 dias.  
**Uso:** referência técnica para ChatGPT, Claude e desenvolvimento do Gestor Sênior.

## Regra principal

A extensão coleta **evidências**. Esta enciclopédia registra apenas o que já foi interpretado e classificado.  
Um dado deve passar por estágios:

`capturado → candidato → validado → confirmado`

Nunca confiar apenas porque um número do DOM apareceu igual em algum ponto de um JSON.

---

## Estratégia recomendada

### O que deve acontecer dentro da extensão

- Capturar respostas JSON relevantes.
- Registrar endpoint, método, query string e corpo/operationName quando não houver dados sensíveis.
- Criar fingerprint da estrutura do JSON.
- Deduplicar respostas repetidas.
- Guardar uma amostra por endpoint/estrutura relevante por página.
- Registrar contexto DOM: label, valor, card/linha e rota atual.
- Fazer apenas mapeamento **candidato**, sem considerar automaticamente como verdade.
- Ignorar telemetria, traduções, manifests, remote config e AB tests sem valor de negócio.
- Não exportar dados pessoais desnecessários.

### O que deve ser feito depois da exportação

- Cruzar DOM ↔ JSON com mais contexto.
- Detectar escalas e transformações.
- Eliminar falsos positivos.
- Consolidar caminhos genéricos.
- Dar nome de negócio aos campos.
- Atribuir confiança real.
- Atualizar esta enciclopédia.

**Conclusão:** o melhor modelo é híbrido. A extensão adianta a coleta e a classificação; ChatGPT/Claude fazem a curadoria final.

---

## Regras de normalização já descobertas

### Escala monetária / numérica ×100000

Alguns valores chegam multiplicados por `100000`.

```text
valor_exibido = valor_json / 100000
```

Exemplos confirmados:

| Contexto | JSON | Tela |
|---|---:|---:|
| Saldo Shopee Ads | 1.286.976 | R$ 12,87 |
| Vendas Afiliados | 12.432.000 | R$ 124,32 |
| Recarga estimada | 1.500.000 | R$ 15,00 |
| Meta ROAS | 1.780.000 | 17,8 |

**Importante:** não tratar essa escala como global. Ela deve ser associada ao campo/endpoint.

---

# Catálogo de APIs e dados

## 1. Home — Pendências operacionais

**Endpoint**

```text
/api/miscellaneous/homepage/get_to_do_list_summary
```

**Status:** CONFIRMADO

Dados observados:

```text
Envios a processar      = 1
Envios processados      = 3
Devolução/cancelamento  = 2
Produtos banidos        = 0
Ir para Melhor Oferta   = 1
```

### Aplicações no Gestor Sênior

- Cards de pendências.
- Alertas operacionais.
- Lista de ações do dia.
- Priorização automática.

---

## 2. Shopee Ads — Saldo

Campo confirmado:

```text
$.data.ads_credit.total
```

Exemplo:

```text
JSON: 1286976
Transformação: / 100000
Tela: R$ 12,87
```

### Aplicações

- Saldo atual de Ads.
- Alerta de saldo baixo.
- Estimativa de recarga.

---

## 3. Afiliados do Vendedor

**Tipo:** GraphQL  
**Status:** CONFIRMADO

Campos encontrados:

```text
sales
newBuyers
roi
```

Exemplo real:

```text
sales = 12432000
→ R$ 124,32

newBuyers = 4
→ 4

roi = 18.811851...
→ 18,8
```

### Aplicações

- Vendas por afiliados.
- Novos compradores.
- ROI.
- Comparação por período.

---

## 4. Gestão de Produtos

**Endpoint**

```text
/api/v3/opt/mpsku/list/v2/get_product_list
```

**Status:** CONFIRMADO

Resumo observado:

```text
Total de produtos = 33
Ativos = 26
Não publicados = 7
Estoque baixo = 1
Banidos = 0
Em análise = 0
```

### Dados disponíveis por produto

- ID do produto.
- Nome.
- Imagem.
- SKU.
- Status.
- Preço mínimo/máximo.
- Preço promocional.
- Desconto.
- Estoque.
- Estoque por variação.
- Visualizações.
- Curtidas.
- Vendidos.
- Variações.
- IDs das variações.
- Preço por variação.
- Estoque por variação.
- Promoções.
- Datas de campanha.
- Datas de criação/modificação.

### Aplicações

- Catálogo completo.
- Controle de estoque.
- Alertas de estoque baixo.
- Ranking de vendas.
- Ranking de visualizações.
- Produtos sem venda.
- Produtos mais curtidos.
- Controle de preço/promoção.
- Gestão por variação.

---

## 5. Meus Pedidos

**Endpoint**

```text
/api/v3/order/get_order_list_card_list
```

**Status:** CONFIRMADO

### Dados disponíveis

- Número do pedido.
- ID interno.
- Produto.
- Item ID.
- Variação.
- Model ID.
- Quantidade.
- Imagem.
- Valor total.
- Forma de pagamento.
- Status.
- Descrição do status.
- Canal de envio.
- Código de rastreio.
- Prazo para postagem.
- Status logístico.

### Aplicações

- Central de pedidos.
- Fila de postagem.
- Alertas de prazo.
- Rastreamento operacional.
- Resumo diário.

### Privacidade

Não exportar endereço, telefone ou outros dados pessoais se eles não forem necessários ao Gestor Sênior.

---

## 6. Devoluções e Reembolsos

**Família**

```text
/api/v4/seller_center/return/*
```

**Status:** FAMÍLIA CONFIRMADA

Dados encontrados:

- Produto.
- Pedido.
- ID da devolução.
- Motivo.
- Valor do reembolso.
- Valor de compensação.
- Status.
- Prazo para ação.
- Prazo para devolução.
- Transportadora.
- Rastreamento.
- Ações disponíveis.

Observação da sessão:

```text
Casos exigindo “Validar item” = 2
```

### Aplicações

- Painel de devoluções.
- Pendências que exigem ação.
- Alertas de prazo.
- Valores reembolsados.
- Acompanhamento logístico.

---

## 7. Ir para Melhor Oferta — Uplift

Campos confirmados:

```text
$.data.impression_uplift = 136.46
$.data.order_uplift      = 189.73
$.data.sale_uplift       = 1.05
```

Na tela:

```text
Impressão = 136,46x
Pedido    = 189,73x
Vendas    = 1,05x
```

### Aplicações

- Oportunidades da Shopee.
- Priorização de campanhas.
- Estimativa de ganho potencial.

---

## 8. Ir para Melhor Oferta — Produto recomendado

Dados encontrados:

- ID do produto.
- Nome.
- Estoque.
- Preço líquido.
- Preço recomendado.
- ID da variação.
- Nome da variação.
- Categoria Shopee.
- Preço original.
- Preço atual.
- Impressões.
- Vendas.

Exemplo observado:

```text
Estoque = 883
Preço líquido = R$ 19,99
Preço recomendado = R$ 18,90
Impressões = 6176
```

### Aplicações

- Página “Oportunidades Shopee”.
- Sugestão de ajuste de preço.
- Priorização por impressões/vendas.
- Monitoramento de campanhas recomendadas.

---

# Regras para futuros desenvolvimentos

Quando o usuário pedir uma função nova para o **Gestor Sênior**, ChatGPT/Claude devem consultar esta enciclopédia e responder:

1. Qual página da Shopee fornece o dado.
2. Qual endpoint/API fornece o dado.
3. Qual campo/caminho JSON é conhecido.
4. Qual transformação é necessária.
5. Qual o nível de confiança.
6. Se há algum dado ainda não confirmado.
7. Como implementar no Gestor Sênior.
8. Se há risco de privacidade.

---

# Pontos que a próxima versão da extensão precisa registrar

Para cada resposta:

```text
page_url
page_name
endpoint
method
query_params
graphql_operation_name
request_body_sem_dados_sensiveis
response_fingerprint
response_sample
timestamp
```

Para cada candidato de mapeamento:

```text
dom_label
dom_value
dom_context
json_path
json_value
transform
endpoint
page
confidence
validation_count
status = candidate | validated | confirmed
```

---

# Regra de qualidade

Números pequenos como `0`, `1`, `2`, `3`, `4` nunca devem gerar mapeamento forte sozinhos.

Um mapeamento deve ganhar confiança somente quando houver combinação de:

- valor compatível;
- label compatível;
- chave JSON semanticamente compatível;
- endpoint coerente;
- contexto da página;
- repetição em várias capturas;
- transformação conhecida;
- validação visual quando possível.



---

# Atualização v2 — Home carregada sem nenhum clique

Esta sessão foi especialmente útil porque mostrou o que o Seller Center entrega **somente ao abrir a Home**.

## Resultado da sessão v2.4

```text
Requisições observadas: 82
Respostas relevantes capturadas: 81
Grupos endpoint/estrutura únicos: 77
Mapeamentos candidatos: 7
Correspondências DOM↔JSON: 24
Mapeamentos validados automaticamente: 0
```

A coleta bruta funcionou muito bem. O auto-mapeamento foi conservador, mas ainda gerou falsos positivos; portanto a curadoria posterior continua necessária.

## Informações Gerenciais — CONFIRMADO

**GET**

```text
/api/mydata/v2/homepage/key-metrics/?order_type=paid
```

| Tela | JSON | Transformação |
|---|---|---|
| Vendas R$196 | `$.data.sales = 196.23` | arredondamento visual |
| Visitantes 148 | `$.data.hybrid_uv = 148` | nenhuma |
| Cliques no Produto 235 | `$.data.product_clicks = 235` | nenhuma |
| Pedidos 5 | `$.data.orders = 5` | nenhuma |
| Conversão 2,13% | `$.data.product_clicks_to_orders_rate = 0.021276...` | ×100 |

Variações:

```text
sales_pct_diff                         4.948166... → +494,82%
hybrid_uv_pct_diff                     0.057142... → +5,71%
product_clicks_pct_diff                 0.327683... → +32,77%
orders_pct_diff                         4            → +400,00%
product_clicks_to_orders_rate_pct_diff  0.015626... → +1,56%
```

**Descoberta importante:** `Visitantes` usa `hybrid_uv`, não `uv`.  
**Descoberta importante:** o card `Taxa de Conversão de Pedidos` usa `product_clicks_to_orders_rate`, não `conversion_rate`.

## Shopee Ads — saldo e desconto — CONFIRMADO

**POST**

```text
/api/pas/v1/sc_pc_homepage/get_meta/
```

```text
$.data.adopter.ads_credit = 1001767
/100000 = R$10,02

$.data.adopter.is_low_balance = false

$.data.adopter.topup_discount_percentage = 15000
/1000 = 15%
```

## Shopee Ads — desempenho — CONFIRMADO

**POST**

```text
/api/pas/v1/sc_pc_homepage/adopter/get_report/
```

```text
$.data.report.broad_gmv = 13624000
/100000 = R$136,24

$.data.report.broad_roi = 7.280601...
→ 7,28

$.data.report.cost = 1871274
/100000 = R$18,71
```

Variações:

```text
$.data.ratio.broad_gmv = 3.129736...
×100 = +312,97%

$.data.ratio.broad_roi = 1.883455...
×100 = +188,35%
```

O campo `cost` não aparece nesse card da Home, mas já está disponível para o Gestor Sênior.

## Desempenho da Loja — CONFIRMADO

**GET**

```text
/api/accounthealth/v1/sc/shops/overview
```

```text
performance_rating = "good" → "Bom"
failed_metric_count = 1
penalty_point = 1
appeal_count = 0
```

## Recarga automática / recomendações Ads

**POST**

```text
/api/pas/v1/topup/auto_escrow/get_estimated_topup_data/
```

Body observado:

```json
{
  "additional_fee_rate": 2000,
  "fixed_program_fee_rate": 0
}
```

Resposta:

```text
$.data.seven_day_topup_amount = 1500000
/100000 = R$15,00
```

A família `/api/pas/v1/sc_pc_homepage/adopter/list_todo_task/` também trouxe:

```text
recommended_roi_two_target = 1780000 → 17,8
additional_fee_value = 2000 → 2%
gmv_uplift_pct = 20000 → 20%
affected_count = 4
```

## Afiliados do Vendedor — CONFIRMADO

**POST GraphQL**

```text
/api/v3/affiliateplatform/gql
operationName: GetHomepageWidgetQuery
variables: { pageType: 1 }
```

```text
$.data.GetHomepageWidget.keyMetric.sales = "12432000"
→ R$124,32 (Home mostra R$124,3)

$.data.GetHomepageWidget.keyMetric.newBuyers = "4"
→ 4

$.data.GetHomepageWidget.keyMetric.roi = 18.811851...
→ 18,8
```

Também retorna listas de produtos e criadores sugeridos no próprio widget.

## Campanhas exibidas na Home

**GET**

```text
/api/mkt/cmt/get_landing_page_campaign_list
```

O JSON contém os cards que aparecem no print, incluindo:

```text
Melhor Oferta
Destaque seus produtos na liquidação 09.09
```

Além de:

```text
campaign id
descrição
data inicial/final
status
banner
URL de participação
estatísticas de indicação
```

**Correção para o auto-mapper:** um `name` dessa API representa `título da campanha`, não `productName`.

# Avaliação da extensão v2.4

### O que funcionou

O coletor encontrou as APIs importantes mesmo sem nenhum clique. Exemplos de candidatos corretos:

```text
Cliques no Produto → $.data.product_clicks
Pedidos → $.data.orders
Visitantes → $.data.hybrid_uv
```

### O que ainda precisa melhorar

Foram encontrados falsos positivos, por exemplo:

```text
R$15,00 → creatorList[].source = 15   (ERRADO)
20% → pagination.limit = 20           (ERRADO)
título de campanha → productName      (CLASSIFICAÇÃO ERRADA)
```

A próxima evolução do auto-mapper deve usar o **card/bloco DOM local**, a categoria do endpoint e transformações conhecidas antes de pontuar uma coincidência.



---

# Atualização v3 — Meus Pedidos / A Enviar

Sessão capturada apenas ao carregar a página. A curadoria adicionou 8 entradas técnicas principais e reforçou 2 entradas existentes.

## Contadores de abas

`POST /api/v3/order/get_order_list_meta_v2`

- A Enviar → `$.data.OrderListTabMeta[].to_ship_tab_meta.l1_meta`
- Enviado → `$.data.OrderListTabMeta[].shipping_tab_meta.l1_meta`
- Concluído → `$.data.OrderListTabMeta[].completed_tab_meta.l1_meta`
- A Enviar / total → `...to_ship_tab_meta.order.l2_all`
- Processados → `...to_ship_tab_meta.order.l2_processed`
- A processar → `...to_ship_tab_meta.order.l2_to_process`
- Pendentes → `...to_ship_tab_meta.order.l2_pending`

## Subfiltros A Enviar

`POST /api/v3/order/get_order_list_to_ship_meta`

- Status concluído (validado pelo valor 6) → `$.data.order_status["2"]`
- NF pendente → `$.data.invoice_status["1"]`
- NF recusada → `$.data.invoice_status["2"]`
- NF autorizada → `$.data.invoice_status["3"]`

## Busca/paginação

`POST /api/v3/order/search_order_list_index`

O corpo da requisição controla aba, filtros, paginação e ordenação. `$.data.pagination.total` correspondeu a `0 Pedidos` na tela.

## Canais de envio

`GET /api/v3/order/get_order_list_config`

`shipping_channel_configs[*].shipping_channels[]` fornece as opções do filtro, incluindo `Todos os canais`, método de envio, tipo de canal e estado habilitado.

**Correção do auto-mapper:** `Todos os canais` foi incorretamente classificado como `productName`; o significado correto é opção/nome de canal de envio.

## Ordenação

`GET /api/v3/order/get_sort_filter_options/`

Fornece opções e chaves de ordenação, incluindo data de confirmação, data de envio e data de criação.

## Histórico de relatórios

`GET /api/v3/settings/get_report_list/`

Com `parent_type=ps_reports_order`, lista os relatórios/exportações de pedidos.

## NF-e

Família validada:
- `/api/v3/order/get_invoice_meta_multi_shop`
- `/api/v3/shipment/get_shop_nfe_invoice_source`
- `/api/v4/invoice/seller/get_invoice_pop_up_by_scenario`

## Logística

Família validada:
- `/api/v3/logistics/get_optional_channel_list`
- `/api/v3/logistics/batch_get_channel_config`
- `/api/v3/logistics/get_channel_display_name`

## Retornos — reforço

`POST /api/v4/seller_center/return/return_list/seller_exceptional_get_to_do_count`

`$.data.unprocessed_num = 2` coincidiu com `Retornos e Pedidos cancelados (2)`.


---

# Atualização v4 — Navegação completa em Meus Pedidos + Detalhes + Retornos

Sessão: `shopee-auto-mapper-v2.4-1789353914542`

Resumo da curadoria:

```text
Entradas técnicas anteriores: 24
Novas entradas principais: 13
Entradas reforçadas/atualizadas: 10
Falsos positivos/reclassificações descartados: 4
Total principal atual: 37
```

## Novas áreas documentadas

### Detalhe completo do pedido

`GET /api/v3/order/get_one_order?order_id=...`

Fornece número e ID do pedido, status, preço total, frete, pagamento, transportadora, prazos, itens, item_id, model_id, variação, SKU, preço e quantidade.

### Financeiro por pedido

`POST /api/v4/accounting/pc/seller_income/income_detail/get_order_income_components`

Confirmado contra o print de detalhes:

```text
Subtotal dos Produtos      3299000 / 100000 = R$32,99
Taxas e Encargos          -1224000 / 100000 = -R$12,24
Comissão líquida           -594000 / 100000 = -R$5,94
Taxa de serviço            -581000 / 100000 = -R$5,81
Renda estimada do pedido   2075000 / 100000 = R$20,75
Pagamento total comprador  4415000 / 100000 = R$44,15
```

Isso permite calcular margem líquida e decompor taxas da Shopee por pedido.

### Rastreio e logística

Novos endpoints:
- `/api/v3/order/get_forder_logistics`
- `/api/v3/order/get_order_tracking_history/`
- `/api/v3/order/get_package`
- `/api/v3/shipment/get_order_arrange_shipment_info`
- família de waybill `/api/v3/logistics/*`

### Devoluções / Cancelamentos

Documentados:
- `/api/v4/seller_center/return/return_list/get_tab_options`
- `/api/v4/seller_center/return/return_list/get_filter_options`
- `/api/v4/seller_center/return/return_list/get_key_action_count`
- `/api/v4/seller_center/return/return_list/get_exceptional_case_list`

A lista detalhada contém produto, pedido, return_id, valor de reembolso, motivo, solução solicitada, status, prazos e logística reversa.

## Correções do auto-mapper

Foram descartadas/reclassificadas associações como:

```text
Shopee Xpress -> productName       ERRADO
Subtotal dos Produtos -> productName  ERRADO
Pagamento total do comprador -> productName ERRADO
```

Os valores estavam presentes corretamente nos JSONs, mas a classificação semântica estava errada.



---

# Atualização v5 — Curadoria Shopee Ads

**Sessão:** Shopee Seller Auto Mapper v2.4 `1789358242006`  
**Capturas observadas:** 424  
**Respostas relevantes:** 419  
**Estruturas únicas:** 208  
**Prints analisados:** 56  
**Novas entradas técnicas:** 18  
**Entradas reforçadas/atualizadas:** 3  
**Falsos positivos/reclassificações descartados do auto-mapper:** 24  
**Total da enciclopédia:** 55 entradas técnicas principais.

## Principais áreas documentadas

- Dashboard completo de Anúncios de Produtos.
- Lista de campanhas e métricas por campanha.
- Detalhes/configuração de campanha.
- Performance agregada e série temporal.
- Diagnóstico de anúncios.
- Sugestões de otimização.
- Meta de ROAS recomendada.
- Orçamento recomendado e estatísticas de gasto.
- Efeito da Impulsão Rápida.
- Anúncios de Loja: SOV, ACOS, conversão e métricas de produto.
- GMV Max por item.
- Histórico de operações.
- Carteira de Ads.
- Reembolsos de Ads.
- Configurações de recarga.
- Exportação oficial de relatórios.

## Métricas centrais confirmadas

No endpoint `/api/pas/v1/report/get_homepage_time_graph/`, o agregado de Anúncios de Produtos confirmou:

- `impression` → Impressões
- `click` → Cliques
- `ctr × 100` → CTR
- `broad_order` → Pedidos
- `broad_order_amount` → Itens vendidos
- `broad_gmv / 100000` → Vendas
- `cost / 100000` → Investimento
- `broad_roi` → ROAS
- `voucher_amount / 100000` → Valor de cupons
- `voucher_sales / 100000` → Vendas com cupom
- `atc` → Adicionar ao carrinho
- `atc_rate × 100` → Porcentagem de adições ao carrinho

O print de últimos 3 meses mostrou R$9.161,12 em vendas, R$919,45 de investimento e ROAS 9,96, exatamente compatíveis com os valores da API.

## Meta de ROAS

Endpoint:

`/api/pas/v1/setup_helper/get_recommended_roi_two_target/`

O modal exibiu opções 10,0 / 14,0 / 18,0 e a API retornou:

- `lower_bound.value = 1000000` → 10,0
- `exact.value = 1400000` → 14,0
- `upper_bound.value = 1800000` → 18,0

## Anúncio de Loja

A sessão confirmou métricas específicas de loja:

- `sov`
- `cr`
- `cpdc`
- `broad_cir` (ACOS)
- `product_impression`
- `product_click`
- `product_ctr`

Além das métricas comuns de Ads.

## Qualidade do Auto Mapper

Dos 27 candidatos produzidos pela extensão, somente poucos estavam semanticamente corretos sem reclassificação. Foram descartados/reclassificados 24 candidatos, incluindo coincidências numéricas sem contexto e nomes classificados incorretamente como produto.

A coleta bruta continua excelente; a curadoria pós-exportação permanece necessária.


---

# Atualização v6 — Gestão de Produtos, Novo Produto e Otimizador de IA

Sessão: Shopee Seller Auto Mapper v2.4 + 22 screenshots.

## Resumo

- Base anterior: 55 entradas técnicas principais
- Novas entradas: 18
- Reforçadas/atualizadas: 2
- Falsos positivos/reclassificações: 13
- Total após curadoria: 73

## Principais áreas enriquecidas

- Lista de produtos com caminhos exatos de preço, estoque, vendas, visualizações, curtidas e variações.
- Performance de 30 dias por item.
- Diagnóstico de qualidade e tarefas de conteúdo.
- Ligação direta item_id ↔ campaign_id / ads_id.
- Estado de impulsionamento por produto.
- Edição rápida de preço/estoque e endpoint de atualização.
- Estoque detalhado por model_id e localização.
- Fluxo de criação de produto: Produto Padronizado, atributos, variações, fiscal, qualidade e pré-QC.
- Otimizador de IA: contadores, tarefas e produtos a melhorar.

## Observação de segurança

O endpoint `update_product_info_for_quick_edit` altera dados reais da loja. Deve ser usado pelo Gestor Sênior somente quando houver uma ação explícita do usuário e após validação do payload.

---

# Atualização v7 — Controle de Shopee Ads e Proteção de ROAS

**Sessão-base:** `shopee-auto-mapper-v2.4-1789358242006.zip`

## Resumo

- Base anterior: 73 entradas técnicas principais
- Novas entradas: 9
- Reforçadas/atualizadas: 4
- Total após curadoria: 82

## Ações reais de Ads confirmadas

### Alterar Meta de ROAS — Seller Center interno

**POST**

```text
/api/pas/v1/product/edit/
```

Body observado:

```json
{
  "campaign_id": 85041892,
  "change_roi_two_target": {
    "log_key": "<uuid>",
    "target_value": 1000000
  },
  "reference_id": "<uuid>",
  "type": "change_roi_two_target"
}
```

Transformação:

```text
ROAS = target_value / 100000
1000000 -> 10,0
```

A resposta observada retornou `code = 0` e `msg = "OK"`.

### Alterar orçamento diário — Seller Center interno

A mesma família `/api/pas/v1/product/edit/` usa:

```json
{
  "campaign_id": 85041892,
  "change_budget": {
    "budget_log_key": "<uuid>",
    "daily_budget": 1000000,
    "total_budget": 0
  },
  "reference_id": "<uuid>",
  "type": "change_budget"
}
```

```text
daily_budget / 100000 = valor em reais
1000000 -> R$10,00
```

O histórico de operações confirmou visualmente a mudança `Orçamento diário: Ilimitado -> R$10.00`.

### Pausar e retomar campanha — Seller Center interno

**POST**

```text
/api/pas/v1/homepage/mass_edit/
```

Pausar:

```json
{
  "campaign_id_list": [106442506],
  "type": "pause"
}
```

Retomar:

```json
{
  "campaign_id_list": [106442506],
  "type": "resume"
}
```

Resposta observada:

```json
{
  "code": 0,
  "msg": "OK",
  "data": {
    "fail_list": []
  }
}
```

### Reiniciar/publicar campanha — Seller Center interno

**POST**

```text
/api/pas/v1/product/publish/
```

A captura mostrou uma configuração completa com `campaign_id`, `item_id`, `bidding_strategy`, `daily_budget`, `roi_two_target`, `rapid_boost`, datas, seleção e posicionamento de produto.

Essa ação é mais complexa do que `resume`; no Gestor Sênior deve-se preferir `start`/`resume` da Open Platform quando isso for suficiente.

## Proteção de ROAS — status confirmado

**POST**

```text
/api/pas/v1/rebate/campaign_get/
```

Body:

```json
{
  "campaign_id": 85041892
}
```

Estados realmente observados para a mesma campanha:

```text
valid
invalid
```

No estado inválido:

```text
invalid_reason = "set_to_inactive"
```

Outra campanha retornou:

```text
unsupported
```

Isso comprova que o Seller Center possui um estado de Proteção de ROAS por campanha e que a sessão capturada registrou a transição de `valid` para `invalid`.

## Procedimento confirmado como workaround observado — pausar/retomar 2× para invalidar Proteção de ROAS

Durante a sessão, o usuário executou pausas/retomadas repetidas e a campanha 85041892 passou de:

```text
rebate_campaign_status = valid
```

para:

```text
rebate_campaign_status = invalid
invalid_reason = set_to_inactive
```

Sequência operacional usada no Gestor Sênior:

```text
pause
resume
pause
resume
```

**Classificação v8:** CONFIRMADO COMO COMPORTAMENTO OBSERVADO / NÃO OFICIAL.

A sessão de 18/09/2026 repetiu o procedimento em **duas campanhas diferentes** (`80111537` e `112443168`). Nas duas, o estado funcional associado a `auto_rebate` começou como `valid` e terminou como `invalid`, com `rebate_invalid_reason = set_to_inactive`, enquanto a campanha voltou para `state = ongoing`.

Isso aumenta bastante a confiança de que a sequência funciona hoje, mas continua sendo um **workaround**, não uma API oficial de “desligar Proteção ROAS”.

Não é um botão oficial da Shopee para desligar a Proteção de ROAS. É um comportamento observado e pode mudar sem aviso.

Regras para o Gestor Sênior:

- somente executar após clique e confirmação explícita;
- informar que são quatro ações de campanha;
- registrar a última tentativa;
- se uma etapa falhar, tentar um `resume` final para deixar a campanha ativa;
- não afirmar que a Proteção está desativada se o status não puder ser confirmado por uma fonte autorizada;
- não rodar recorrência automática em segundo plano sem uma regra explicitamente aprovada.


## Validação v8 — nova sessão focada em Proteção de ROAS

**Fonte:** `shopee-auto-mapper-v2.4-1789778413070.zip` + 24 prints da Central do Vendedor, sessão local de 18/09/2026.

### 1. Estado da Proteção de ROAS diretamente em `/homepage/query/`

A listagem principal de campanhas passou a servir também como uma fonte secundária de confirmação do estado funcional da Proteção de ROAS.

**POST**

```text
/api/pas/v1/homepage/query/
```

Nas campanhas que exibiam o selo visual **Proteção ROAS**, a resposta continha:

```text
trait_list[] = "auto_rebate"
```

e, em `trait_data`:

```text
trait = "auto_rebate"
generic_data.string_field.rebate_campaign_status
generic_data.string_field.rebate_invalid_reason
```

Estados observados na nova sessão:

```text
antes da ação:
rebate_campaign_status = valid

durante a pausa:
rebate_campaign_status = invalid
rebate_invalid_reason = campaign_inactive

após retomar e concluir a sequência:
rebate_campaign_status = invalid
rebate_invalid_reason = set_to_inactive
state = ongoing
```

Isto ocorreu em **duas campanhas diferentes**:

```text
80111537 — Kit para Colorir Infantil 100 Desenhos Animes...
112443168 — Kit Festa K-Pop Demon Hunter...
```

### 2. O badge visual não é fonte de verdade

Os prints finais ainda exibiam o selo **Proteção ROAS** mesmo depois de `/homepage/query/` retornar:

```text
rebate_campaign_status = invalid
rebate_invalid_reason = set_to_inactive
```

Portanto, no Gestor Sênior:

- não considerar a presença do badge como prova de proteção ativa;
- preferir o estado retornado pelo backend;
- após executar “Desativar Proteção ROAS”, validar o resultado por status e motivo;
- só marcar a operação como concluída quando a campanha estiver novamente `ongoing` e a proteção funcional estiver `invalid/set_to_inactive`.

### 3. Flags de disponibilidade da Proteção de ROAS

**POST**

```text
/api/pas/v1/meta/get_non_ads_data/
```

Na sessão foram observadas como `true`:

```text
sz_app_roas_protection_toggle
sz_product_ads_roas_protection
sz_product_ads_gms_auto_rebate
sz_product_ads_mpd_auto_rebate
```

Essas flags devem ser tratadas como **capacidade/disponibilidade do recurso**, não como estado de uma campanha específica.

### 4. Checagem de sobreposição antes de retomar ROI-two

A Shopee consultou também:

```text
POST /api/pas/v1/product/list_overlapping_ads_for_roi_two/
```

Body observado:

```json
{
  "bidding_strategy": "roi_two",
  "end_time": 0,
  "item_id_list": [58205112334],
  "start_time": 1789700400
}
```

Resposta observada:

```json
{
  "data": {
    "overlapping_campaign_list": [],
    "combined_budget": 0
  }
}
```

Esta chamada funciona como uma checagem de conflito/sobreposição de anúncios ROI-two e deve ser considerada antes de uma retomada quando a implementação tiver acesso autorizado a uma fonte equivalente.

### 5. Comportamento da campanha pausada

Quando a campanha fica `paused`, a lista `editable_list` foi reduzida para:

```text
["status"]
```

Depois da retomada, voltou a permitir:

```text
["status", "budget", "time", "roi_two_target"]
```

Isso ajuda o Gestor Sênior a distinguir “campanha pausada” de uma falha de leitura dos campos de orçamento/ROAS.


## Escrita oficial via Shopee Open Platform

Para implementação no Gestor Sênior, preferir APIs oficiais:

```text
POST /api/v2/ads/edit_manual_product_ads
```

Ações documentadas incluem:

```text
start
pause
resume
stop
delete
change_budget
change_duration
change_smart_creative
change_location
change_enhanced_cpc
change_roas_target
```

E, para GMS/GMV Max:

```text
POST /api/v2/ads/edit_gms_product_campaign
```

Ações documentadas:

```text
change_budget
change_duration
pause
resume
start
change_roas_target
```

Para recomendação de ROAS:

```text
GET /api/v2/ads/get_product_recommended_roi_target
```

### Observação sobre ROAS +0,01

A API oficial de GMS normaliza a Meta de ROAS para uma casa decimal. Portanto, um ajuste como `20,00 -> 20,01` pode ser arredondado/normalizado e não é um método confiável pela Open Platform.

Por isso, o Gestor Sênior deve preferir a sequência experimental `pause -> resume -> pause -> resume` quando o usuário escolher explicitamente a ação de Proteção de ROAS.

## Limites e proteção operacional

A Shopee aplica limites diários de ações por item. Pausar, retomar, iniciar/reiniciar e editar orçamento/ROAS podem consumir esse limite.

Por isso o Gestor Sênior deve:

- mostrar confirmação antes de qualquer escrita;
- impedir cliques duplicados enquanto uma ação estiver em andamento;
- registrar horário da última ação;
- nunca executar loops agressivos;
- preservar a campanha em estado ativo após a sequência experimental, tentando `resume` final em caso de falha.


## Resumo da curadoria v8

- Base anterior: **82 entradas técnicas**.
- Entradas existentes diretamente confirmadas nesta sessão: **4**.
- Novas entradas técnicas: **3**.
- Entradas reforçadas/atualizadas: **4**.
- Falsos positivos promovidos por engano: **0**.
- Endpoints de fundo/rotina não promovidos nesta curadoria: **78**.
- Total da enciclopédia após a curadoria: **85 entradas técnicas**.

## Segurança

Nunca reutilizar `SPC_CDS`, cookies, tokens ou credenciais capturadas do navegador. Os endpoints internos documentam a semântica da Shopee, mas a implementação do Gestor Sênior deve usar a conexão autorizada da Open Platform sempre que possível.

---

# Atualização v9 — Marketplace público + consolidação técnica de 24/09/2026

Esta atualização incorpora as descobertas posteriores à v8 e amplia a enciclopédia para a camada pública do Marketplace, necessária para Pesquisa de Produto, Super Análise e análise de concorrentes.

## 1. Página pública do anúncio — dados estruturados do produto

**Endpoint público confirmado**

```text
GET /api/v4/pdp/get_pc
```

**Status:** CONFIRMADO

Esse endpoint fornece dados estruturados do anúncio público e deve ser priorizado em vez de scraping visual quando estiver disponível.

### Dados confirmados

- título do anúncio;
- `item_id`;
- `shop_id`;
- preço e faixa de preço;
- modelos/variações;
- categorias;
- atributos;
- descrição;
- ordem das imagens do vendedor;
- indicação/presença de vídeo do produto;
- avaliações agregadas;
- vendas exibidas;
- dados públicos da loja;
- informações de envio;
- informações de pré-venda.

### Aplicações no Gestor Sênior

- Super Análise;
- Pesquisa de Produto;
- comparação com concorrentes;
- análise de título;
- análise de atributos;
- análise de preço e variações;
- análise da mídia principal;
- identificação de sinais de prova social;
- comparação de estrutura do anúncio.

### Regra de implementação

Os campos estruturados da API devem ter prioridade sobre coletores genéricos do DOM.

---

## 2. Avaliações públicas do produto

**Endpoint público confirmado**

```text
GET /api/v2/item/get_ratings
```

**Status:** CONFIRMADO

### Dados confirmados

- nota;
- comentário;
- fotos da avaliação;
- vídeos da avaliação;
- variação comprada;
- tags;
- likes;
- resposta do vendedor;
- resumo das contagens por estrelas.

### Aplicações no Gestor Sênior

- mineração de objeções;
- identificação de reclamações recorrentes;
- análise de pontos fortes percebidos pelos compradores;
- levantamento de problemas de qualidade;
- geração de sugestões para descrição e imagens;
- comparação de reputação entre concorrentes.

### Regra para mineração de objeções

A coleta inicial de poucas avaliações não é suficiente.

O coletor deve paginar e buscar amostras por nota, com prioridade para:

```text
1 estrela
2 estrelas
3 estrelas
```

Avaliações de 4 e 5 estrelas também podem ser usadas para mapear benefícios percebidos.

---

## 3. Separação obrigatória de mídia

A coleta genérica:

```text
page.images
page.videos
```

foi classificada como **ruidosa** para análise de produto.

Ela pode misturar:

- imagens do vendedor;
- assets da interface;
- avatares/perfis;
- imagens de avaliações;
- vídeos de avaliações;
- outros elementos carregados pela página.

### Regra oficial do Gestor Sênior

Priorizar campos estruturados das APIs.

Normalizar a mídia em grupos separados:

```text
seller_images
seller_video
review_images
review_videos
ui_assets
```

Para análise de anúncio, `seller_images` e `seller_video` têm prioridade.

Para análise de objeções, usar `review_images` e `review_videos` separadamente.

---

## 4. Origem geográfica do vendedor na busca pública

**Status:** CONFIRMADO VISUALMENTE NA BUSCA PÚBLICA

Os cards de resultados de busca podem exibir a origem/localização do vendedor ou do envio.

Exemplos observados:

```text
Rio Grande do Sul
Rio de Janeiro
São Paulo
Minas Gerais
Paraná
```

A lateral de filtros da busca também contém a seção:

```text
Enviado De
```

com opções como:

```text
Nacional
Internacional
Estados/UFs
```

### Normalização recomendada

```text
seller_location_raw
seller_state
seller_city
location_source
location_confidence
```

### Aplicações

- comparar concorrentes da mesma região;
- identificar concentração geográfica;
- usar localização como sinal secundário em prazo/frete;
- segmentar Pesquisa de Produto.

### Regra

Preferir API, JSON ou DOM estruturado.

Evitar OCR quando a informação já estiver disponível de forma estruturada.

---

## 5. Selo “Indicado” / Vendedor Indicado

**Status:** SIGNIFICADO CONFIRMADO

O selo visual:

```text
Indicado
```

não deve ser tratado como prova de Shopee Ads ou produto patrocinado.

Ele está relacionado ao status/programa de:

```text
Vendedor Indicado
Preferred Seller
PS
```

### Normalização sugerida

Quando o campo correspondente for tecnicamente identificado:

```text
seller_preferred = true
```

ou:

```text
seller_badge = "indicado"
```

### Regra crítica

```text
Indicado != Ads
Indicado != patrocinado
```

Shopee Ads deve ser detectado por sinais específicos de publicidade.

---

## 6. Detecção de concorrente patrocinado na busca

**Status:** AINDA NÃO CONFIRMADO COM SEGURANÇA

Ainda não foi identificado um campo público suficientemente confiável para determinar, em todos os casos, que um card de busca está patrocinado.

### Regra

O campo:

```text
ads_id
```

isoladamente **não deve ser usado como prova suficiente** de que o resultado está patrocinado.

Também não usar:

```text
seller_badge = indicado
```

como sinal de Ads.

Até nova validação, registrar sinais candidatos separadamente e manter:

```text
sponsored_status = unknown
```

quando não houver evidência técnica suficiente.

---

## 7. Consolidação — Gestão de Produtos no Seller Center

As sessões mais recentes reforçaram que o Seller Center fornece dados suficientes para o Gestor Sênior trabalhar com:

- preço;
- estoque;
- vendas;
- visualizações;
- curtidas;
- variações/modelos;
- desempenho recente, incluindo janela de 30 dias quando disponibilizada;
- sinais e diagnósticos de qualidade do anúncio/produto;
- associação de `item_id` com identificadores de Ads como `campaign_id` e `ads_id` quando retornados;
- estado de impulsionamento quando disponibilizado;
- estoque por `model_id`;
- estoque por localização/armazém quando fornecido;
- edição rápida de preço e estoque;
- criação/edição de produto.

### Regra de dados

Manter separado:

```text
raw_data
normalized_data
```

Para cada mapeamento técnico registrar, quando conhecido:

```text
endpoint
method
query_params
request_body
json_path
transform
confidence
source_page
captured_at
```

---

## 8. Otimizador / IA da Shopee

Tarefas, diagnósticos, recomendações e sugestões produzidas pelo próprio Seller Center podem ser coletadas como evidência.

### Regra

Essas sugestões devem ser armazenadas separadamente dos fatos medidos.

Exemplo de separação:

```text
measured_metrics
shopee_recommendations
gestor_senior_analysis
```

Uma recomendação da IA/Otimizador da Shopee não deve ser promovida automaticamente a fato técnico.

---

## 9. Arquitetura aprovada para Pesquisa de Produto / Concorrentes

A arquitetura-base do Gestor Sênior deve seguir:

```text
Extensão Chrome
    ↓
coleta objetiva usando a sessão normal do navegador
    ↓
raw_data
    ↓
normalização determinística
    ↓
normalized_data
    ↓
cálculos sem IA
    ↓
analysis_package resumido
    ↓
IA para interpretação final
```

### Fazer sem IA

- deduplicação;
- ranking;
- palavras-chave;
- n-grams;
- preços;
- vendas;
- similaridade;
- filtros;
- agregações;
- mineração estrutural de reviews.

### IA

A IA deve receber apenas um pacote de evidências resumido quando possível.

Para mídia:

- preferir contact sheets para grupos de imagens;
- extrair frames representativos de vídeos;
- evitar enviar dezenas de arquivos isolados quando uma síntese determinística resolver.

### Modos aprovados

```text
Econômico
Padrão
Profundo
```

Evitar reprocessamento quando os dados-fonte não tiverem mudado.

---

# Fonte de verdade e prioridade de coleta — v9

Quando houver mais de uma fonte para o mesmo dado, usar esta ordem como referência geral:

```text
1. API oficial Shopee Open Platform, quando disponível e autorizada
2. endpoint estruturado do Seller Center / Marketplace observado e validado
3. JSON estruturado embutido na página
4. DOM estruturado
5. texto visível
6. OCR, apenas como último recurso
```

Endpoints internos do Seller Center documentados nesta enciclopédia servem para entender a semântica dos dados e para integrações feitas dentro do contexto autorizado da sessão do próprio usuário.

Nunca reutilizar cookies, tokens ou credenciais capturadas de outra sessão ou usuário.

---

# Local canônico da enciclopédia v9

A partir desta versão, o arquivo recomendado para agentes de desenvolvimento é:

```text
docs/ENCICLOPEDIA_SHOPEE_GESTOR_SENIOR.md
```

Quando ChatGPT, Claude ou outro agente trabalhar no projeto Gestor Sênior, deve consultar este arquivo antes de:

- inventar um endpoint;
- assumir o significado de um campo;
- implementar coleta da Shopee;
- criar cálculo baseado em dado do Seller Center;
- definir uma fonte para Super Análise;
- implementar Pesquisa de Produto ou Concorrentes;
- implementar leitura/escrita de Shopee Ads.

Se um dado não estiver confirmado, classificá-lo explicitamente como candidato ou pendente de validação.


---

# Atualização v10 — Curadoria Claude: Ads por anúncio, detalhe do anúncio, Meus Produtos e Performance do Produto

**Data:** 25/09/2026 · **Origem:** 4 sessões do Shopee Seller Auto Mapper v2.4 (`…1790384341663`, `…1790384799784`, `…1790385049956`, `…1790385270879`) + prints do usuário de cada tela.
**Status desta seção:** curadoria do Claude. Deve ser comparada com o DELTA do ChatGPT antes de ser tratada como oficial. Nenhum token, cookie, `SPC_CDS` ou `device_sz_fingerprint` foi registrado.
**Regra usada:** CONFIRMED só quando valor + rótulo + endpoint + tela batem. Valores zerados e números pequenos nunca confirmam sozinhos.

## 10.1 Shopee Ads — lista por anúncio (CONFIRMADO)

`POST /api/pas/v1/homepage/query/` → `$.data.entry_list[*]` (20 por página, `data.total` = 91; precisa paginar).

| Coluna da tela | Campo JSON | Transformação | Status |
|---|---|---|---|
| Investimento | `report.cost` | ÷100000 | CONFIRMED |
| Vendas | `report.broad_gmv` | ÷100000 | CONFIRMED |
| ROAS | `report.broad_roi` | nenhuma | CONFIRMED |
| Impressões | `report.impression` | nenhuma | CONFIRMED |
| Cliques | `report.click` | nenhuma | CONFIRMED |
| CTR | `report.ctr` | ×100 | CONFIRMED |
| Adicionar ao carrinho | `report.atc` | nenhuma | CONFIRMED |
| % adições ao carrinho | `report.atc_rate` | ×100 | CONFIRMED |
| Conversões | `report.broad_order` | nenhuma | CONFIRMED |
| Itens vendidos | `report.broad_order_amount` | nenhuma | CONFIRMED |
| Taxa de conversão | `report.cr` | ×100 (= pedidos ÷ cliques do anúncio) | CONFIRMED |
| Custo por conversão | `report.cpdc` | ÷100000 (= cost ÷ pedidos) | CONFIRMED |
| ACOS | `report.broad_cir` | ×100 | CONFIRMED |
| Colunas "Diretas" | `report.direct_*` | mesmas regras | VALIDATED |
| Meta de ROAS | `campaign.roi_two_target` | ÷100000 | CONFIRMED |
| Orçamento diário | `campaign.daily_budget` | ÷100000; 0 = "Ilimitado" | VALIDATED |
| Variação % (setas) | `ratio.<métrica>` | ×100 | CONFIRMED |

- Ligação com o catálogo: `manual_product_ads.item_id` ↔ `product.item_id`; `campaign.campaign_id` liga ao diagnóstico.
- **ARMADILHA:** `report.cpc` **não é custo por clique**. É igual a `cpdc` (custo por pedido). O CPC real é `cost ÷ click` (≈ R$0,05 no exemplo).
- `report.page_views` acompanha os cliques (249 x 248) e não tem rótulo na tela. `report.unique_visitors` vem 0 mesmo com centenas de cliques: tratar como **sem dados**, nunca como 0 visitantes.
- Valor 0 em qualquer campo sem fonte confirmada deve ser exibido como "sem dados".

## 10.2 Shopee Ads — diagnóstico e sugestões (CONFIRMADO)

- `POST /api/pas/v1/diagnosis/homepage_batch_list_verdict/` (lote; body `campaign_id_list` + `reference_id`): `summary.result`/`main_issue` → `good/na` = "Bom"; `light/no_order` = "Sem pedidos"; `severe/over_cost` = "Baixo retorno sobre o investimento".
- `POST /api/pas/v1/diagnosis/list_verdict/` (por campanha): `verdict_list[].type` = `budget_v3`, `bidding_v3`, `competitiveness_v3`, `negative_action_v3`, cada um com `result`/`issue`.
- `POST /api/pas/v1/diagnosis/get_suggestion/`: `recommended_roi_two_target` (÷100000) e `estimated_uplift.gmv_pct` (÷1000; 6000 = "+6%"). Ex.: campanha 80111537, meta 24,3 → 17,0. Guardar como **recomendação da Shopee**, separada dos dados medidos.

## 10.3 Shopee Ads — detalhe do anúncio

| Dado | Endpoint | Campo | Status |
|---|---|---|---|
| Cabeçalho (duração, estado, orçamento, lance, Impulsão Rápida) | `POST /api/pas/v1/product/get/` | `campaign.{start_time,end_time,state,daily_budget,rapid_boost,roi_two.target}` | CONFIRMED |
| "GMV +R$7,80 vs sem Impulso" | `POST /api/pas/v1/report/get_rapid_boost_effect/` | `report_aggregate.cumulative_boosted_broad_gmv − cumulative_non_boosted_broad_gmv`, ÷100000 | CONFIRMED |
| "Proteção ROAS Suspensa" / reembolso | `POST /api/pas/v1/rebate/campaign_get/` | `rebate_campaign_status=invalid` + `invalid_reason=set_to_inactive`; `total_amount` | CONFIRMED |
| Performance do anúncio | `POST /api/pas/v1/report/get/` | `data[0].metrics/ratio` (body: `agg_type=campaign_id`, `need_ratio=true`, período em epoch) | CONFIRMED |
| Série temporal | `POST /api/pas/v1/report/get_time_graph/` | `report_by_time[]` de 3 em 3 h | VALIDATED |
| Mínimo/recomendado de orçamento | `POST /api/pas/v1/setup_helper/get_budget_data_for_edit/` | `daily_budget.{recommended,min}` ÷100000 (R$15 / R$10) | VALIDATED |
| Gasto hoje / máx e média 7 dias | `POST /api/pas/v1/setup_helper/get_campaign_expense_statistics/` | `today_expense`, `max_seven_day_expense`, `avg_seven_day_expense` | CANDIDATE |
| Fase de aprendizagem | `get_time_graph` | `roi_target_setting.is_cold_start` | CANDIDATE (só `false` observado) |

- **CONFLITO ABERTO:** em `get_time_graph`, `roi_target_setting.value` = 4000000 (40,0) nos 56 pontos, mas a meta atual é 22,0. Não usar esse campo como meta atual nem como histórico até validar (tooltip da linha tracejada "Meta de ROAS").
- O body de `get_time_graph` carrega `device_sz_fingerprint`: nunca registrar nem reutilizar.

## 10.4 Meus Produtos

`GET /api/v3/opt/mpsku/list/v2/get_product_list?list_type=live_all&page_number=1&page_size=12` → `$.data.products[*]` (CONFIRMED, 12 de 12 cartões iguais).

- Preço: `price_detail.selling_price_min/max` (strings **já em reais**, sem ÷100000); desconto `max_discount_percentage`.
- Estoque exibido: `stock_detail.total_seller_stock` (não `total_available_stock`).
- Ícones do cartão: `statistics.view_count` (olho), `liked_count` (coração), `sold_count` (caixa). Valores CONFIRMED; **janela de `view_count` desconhecida**: não é acumulado vitalício (202 views x 151 vendidos; 0 views x 10 vendidos) e é bem maior que 1 dia (1587 vs `pv` de hoje = 47). Não dividir vendas por `view_count`.
- Contadores das abas: `GET …/v2/get_list_count` → `live_all`=Ativo, `delisted`=Não publicado, `banned`=Violação, `reviewing`=Sob Análise, `restock`=Repor, `review_listing_detail`=Para revisar detalhes, `all`=Todos (CONFIRMED, 6 de 6).
- Produto ↔ Ads: `POST /api/v3/opt/product/get_campaign_info_by_item_list/` → `campaign_info[item_id].ads_status[].campaign_id` (VALIDATED: 10 de 11 bateram).
- CANDIDATOS: `GET …/v2/get_product_performance_info` (`l30d_sales`, `l30d_impression`, `l30d_conversion`; não aparecem na tela; testar `need_growth_rate=true` e `need_trend=true`) e `GET …/v2/get_smart_diagnosis_info` (qualidade do anúncio: `quality_level` 2 ou 3 e 10 tarefas de imagem/título/descrição, todas `finished=true`; ainda não separa anúncio bom de ruim; 2 produtos vêm sem diagnóstico).

## 10.5 Dados > Produto > Performance do Produto

`GET /api/mydata/v4/product/performance/` → `$.result.items[*]` (query: `category_id=-1`, `category_type=shopee`, `order_by=paid_sales.desc`, `order_type=paid`, `page_num`, `page_size=10`, `period=real_time`, `start_time`/`end_time` em epoch UTC-3).

- CONFIRMED (10 de 10 linhas): `product_card_impressions` = Impressões; `product_card_clicks` = Cliques por Produto; `ctr` (×100) = CTR.
- **Visitas por produto (CANDIDATO forte):** `uv` (visitantes únicos), `pv` (visualizações da página), `bounce_visitors`/`bounce_rate`, `add_to_cart_units`/`add_to_cart_buyers`/`uv_to_add_to_cart_rate`. Não têm coluna na tela padrão; confirmar marcando as métricas em "Selecionar Métricas". `uv` não é igual a cliques (visitas de outras origens).
- CANDIDATO: `paid_sales`, `paid_orders`, `paid_units`, `paid_order_conversion_rate`. Todos os valores observados eram 0; escala de `paid_sales` desconhecida. Repetir com período de 7/30 dias.
- Em aberto: `result.total` = 23 nesta tela x 25 produtos ativos em Meus Produtos.

## 10.6 Regras para implementação no Gestor Sênior (v10)

1. **Painel de decisão do anúncio** = custo, preço, margem (`get_order_income_components` v4) + ROAS, CTR, conversão, carrinho (10.1) + `uv`/`pv` (10.5, após confirmar) + diagnóstico da Shopee (10.2).
2. Conversão por produto só é confiável com volume: 1 pedido em 4 cliques mostra 25%. Exibir a amostra ao lado.
3. Cada endpoint tem a sua escala (`/100000`, `x100`, reais). Registrar a escala por campo, nunca global.
4. Recomendações da Shopee (diagnóstico, ROAS sugerido, Otimizador) vão em `shopee_recommendations`, separadas de `measured_metrics`.
5. Ações que alteram a loja (mudar ROAS, orçamento, pausar) continuam exigindo confirmação explícita do usuário (v7/v8).

## 10.7 Pendências para a próxima curadoria

- Confirmar visitantes: marcar Visitantes/Visualizações/Rejeição/Carrinho em "Selecionar Métricas" em Performance do Produto e exportar de novo.
- Repetir a captura com período de 7 ou 30 dias para validar vendas, pedidos, unidades e escala de `paid_sales`.
- Descobrir a janela de `view_count` (tooltip do ícone do olho).
- Resolver `roi_target_setting.value` = 40,0 em `get_time_graph`.
- Entender os 2 produtos a menos (23 x 25) e o 1 anúncio cujo `campaign_id` não bateu.
- Validar `is_cold_start=true` em um anúncio novo.


---

# Atualização v11 — Informações Gerenciais, Funil completo e Fontes de Tráfego

**Data:** 27/09/2026  
**Origem:** captura real da página `Seller Center → Dados → Informações Gerenciais → Visão Geral`, com o Motor Sênior, mais validação visual da tela enviada pelo usuário.  
**Status:** CONFIRMADO para os endpoints/estruturas abaixo. Nenhum cookie, `SPC_CDS`, token de chat ou credencial deve ser persistido no Gestor.

## 11.1 Métricas principais da loja — tempo real

**Endpoint**

```text
GET /api/mydata/v3/dashboard/key-metrics/
```

**Query observada**

```text
start_time=<epoch>
end_time=<epoch>
period=real_time
fetag=fetag
```

**Campos estruturados confirmados em `result`**

```text
shop_pv
shop_uv
product_clicks
hybrid_uv
paid_gmv
place_gmv
paid_orders
place_orders
paid_sales_per_order
place_sales_per_order
shop_uv_to_paid_buyers_rate
shop_uv_to_placed_buyers_rate
confirmed_gmv
confirmed_orders
confirmed_sales_per_order
shop_uv_to_confirmed_buyers_rate
product_clicks_to_placed_orders_rate
product_clicks_to_paid_orders_rate
product_clicks_to_confirmed_orders_rate
paid_gmv_without_shopee_rebate
place_gmv_without_shopee_rebate
confirmed_gmv_without_shopee_rebate
```

Cada métrica observada tem a estrutura:

```text
{
  value,
  chain_ratio,
  points:[{timestamp,value}]
}
```

### Semântica para o Gestor

- `shop_pv` = visualizações da loja/páginas no período.
- `shop_uv` = visitantes únicos da loja no período.
- `product_clicks` = cliques nos produtos.
- `place_orders` = pedidos criados.
- `paid_orders` = pedidos pagos.
- `confirmed_orders` = pedidos confirmados.
- `place_gmv`, `paid_gmv`, `confirmed_gmv` = valores correspondentes às fases do pedido.
- taxas `*_rate` são razões decimais e devem ser exibidas em porcentagem apenas na camada de apresentação.

### Aplicações

- Funil da loja;
- série temporal;
- comparação período a período;
- taxa visitante → pedido;
- separação pedido criado / pago / confirmado.

---

## 11.2 Painel em tempo real — resumo de hoje

**Endpoint**

```text
GET /api/mydata/v2/campaign_board/realtime_metrics/
```

**Query observada**

```text
event=paid
```

**Campos confirmados**

```text
data.key_metrics.uv
data.key_metrics.hybrid_uv
data.key_metrics.pv
data.key_metrics.product_clicks
data.key_metrics.orders
data.key_metrics.uv_to_buyers_rate
data.key_metrics.product_clicks_to_orders_rate
data.key_metrics.units
data.key_metrics.buyers
data.key_metrics.sales
data.top_sales_items[]
data.sales_hourly[]
data.time
```

### Regra

Usar como camada de tempo real/resumo. Não substituir automaticamente as métricas detalhadas de `key-metrics` quando ambas estiverem disponíveis; manter a origem de cada número.

---

## 11.3 Funil completo por produto — descoberta principal

**Endpoint confirmado**

```text
GET /api/mydata/v3/dashboard/product-rankings/
```

**Query observada**

```text
start_time=<epoch>
end_time=<epoch>
period=real_time
category_type=shopee
category_id=-1
page_size=5
page_num=<n>
order_type=paid
order_by=paid_sales.desc
```

**Paginação:** `result.total` + `result.items[]`.

### Identificação do produto

```text
id
name
image
status
display_tag_label
models
```

### Aquisição / descoberta

```text
product_card_impressions
unique_product_card_impressions
product_card_clicks
unique_product_card_clicks
ctr
search_clicks
```

### Visita / interesse

```text
uv
pv
likes
bounce_visitors
bounce_rate
```

### Carrinho

```text
add_to_cart_units
add_to_cart_buyers
uv_to_add_to_cart_rate
```

### Pedido criado

```text
placed_sales
placed_units
placed_buyers
placed_orders
placed_sales_per_order
placed_order_conversion_rate
uv_to_placed_buyers_rate
```

### Pedido pago

```text
paid_sales
paid_units
paid_buyers
paid_orders
paid_sales_per_order
paid_order_conversion_rate
uv_to_paid_buyers_rate
placed_to_paid_buyers_rate
```

### Pedido confirmado

```text
confirmed_sales
confirmed_units
confirmed_buyers
confirmed_orders
confirmed_sales_per_order
confirmed_order_conversion_rate
uv_to_confirmed_buyers_rate
placed_buyers_to_confirmed_buyers_rate
```

### Recompra / recorrência

```text
repeat_placed_order_rate
average_days_to_repeat_placed_order
repeat_paid_order_rate
average_days_to_repeat_paid_order
repeat_confirmed_order_rate
average_days_to_repeat_confirmed_order
```

### Funil oficial recomendado no Gestor

```text
Impressões
→ Cliques no produto
→ Visitantes únicos (UV)
→ Adicionaram ao carrinho
→ Pedido criado
→ Pedido pago
→ Pedido confirmado
```

**Não foi encontrado um estágio explícito equivalente a “iniciou checkout”.** Não inventar essa etapa.

### Regras de diagnóstico

- comparar CTR, `uv_to_add_to_cart_rate`, `uv_to_placed_buyers_rate`, `uv_to_paid_buyers_rate` e `uv_to_confirmed_buyers_rate`;
- preferir comparação com a mediana da própria loja quando não houver benchmark oficial da Shopee;
- mostrar tamanho da amostra junto de taxas com baixo volume;
- não tratar zero como “ruim” quando o campo estiver ausente ou a fonte tiver falhado;
- para análise por produto, usar `id` como chave do anúncio e preservar o período exato.

### Correção da seção v10.5

A antiga entrada `GET /api/mydata/v4/product/performance/` continua registrada como mapeamento anterior. A coleta de 27/09 confirmou que a tela atual também usa `GET /api/mydata/v3/dashboard/product-rankings/` com um conjunto mais completo de campos de funil. Para a implementação atual do Gestor, priorizar o endpoint v3 observado nesta sessão e manter v4 apenas como fonte histórica/candidata até nova reconfirmação.

---

## 11.4 Fontes de Tráfego

**Endpoint**

```text
GET /api/mydata/v1/dashboard/traffic-sources/
```

**Query observada**

```text
start_time=<epoch>
end_time=<epoch>
period=real_time
order_type=paid
need_paid_ads_data=false
```

**Estrutura principal**

```text
result.overview
result.product_card
result.live
result.video
result.affiliate
result.paid_ads
```

Cada fonte pode conter `total` e `breakdown`.

### Métricas observadas nas fontes orgânicas/conteúdo

```text
sales
orders
units
buyers
product_clicks
unique_product_clicks
product_impressions
unique_product_impressions
sales_per_order
ctr
product_clicks_to_orders_rate
*_pct_diff
```

Campos específicos também aparecem conforme a fonte:

```text
live_views
live_viewers
video_views
video_viewers
content_views
content_viewers
```

### Shopee Ads dentro de Fontes de Tráfego

`result.paid_ads.total` contém:

```text
sales
orders
units
product_impressions
product_clicks
ads_expense
ads_roas
live_views
video_views
ctr
conversion
*_pct_diff
```

### Aplicações

- participação de Ads versus tráfego não pago;
- contribuição de busca/card de produto;
- contribuição de Live;
- contribuição de Vídeo;
- contribuição de Afiliados;
- diagnóstico “este produto depende de Ads”;
- análise de diversificação de aquisição.

---

## 11.5 Contribuição por produto e por origem

**Endpoint**

```text
GET /api/mydata/v1/dashboard/traffic-sources/product-contribution/
```

**Campos em `result.item[]`**

```text
id
name
image
status
display_tag_label
show_boost_traffic
view_ads
campaign_id
is_boost_with_ads
sales_ratio
sales
orders
units
buyers
product_clicks
unique_product_clicks
product_impressions
unique_product_impressions
sales_per_order
ctr
product_clicks_to_orders_rate
*_pct_diff
```

Esse endpoint permite ligar contribuição comercial, tráfego e presença de Ads ao produto.

---

## 11.6 Tendência de uma fonte específica

**Endpoint**

```text
GET /api/mydata/v1/dashboard/traffic-sources/contribution-trend/
```

**Exemplo observado**

```text
l1_source=psd_label_product_card
l2_source=psd_label_search
```

**Campos de `result.time_series[]`**

```text
t
source
sales_ratio
orders_ratio
product_clicks_ratio
product_impressions_ratio
sales
orders
units
buyers
product_clicks
unique_product_clicks
sales_per_order
ctr
product_clicks_to_orders_rate
product_impressions
unique_product_impressions
```

### Aplicação

Usar para gráfico temporal da contribuição da Busca ou outra subfonte quando a UI exigir análise de tendência.

---

## 11.7 Arquitetura de coleta para o Funil no Gestor Sênior

Como esses endpoints são internos do Seller Center e dependem da sessão normal do navegador, a implementação aprovada é:

```text
Gestor Sênior
→ solicita "sellerFunnel" ao Motor Sênior
→ extensão usa a sessão já autenticada do usuário no Seller Center
→ fetch ocorre dentro da própria página seller.shopee.com.br
→ extensão devolve apenas JSON de negócio normalizado
→ nenhum cookie/token/SPC_CDS é salvo no Gestor
```

### Regra de segurança

- nunca enviar cookies, `SPC_CDS`, CSRF ou tokens para o backend do Gestor;
- nunca persistir credenciais no ZIP/enciclopédia;
- abrir a página oficial do Seller Center se não houver aba já aberta;
- somente leitura;
- falhas de endpoint devem virar `sem dados`, nunca zero inventado.

### Regra de período

Nesta sessão, `period=real_time` foi confirmado. Períodos históricos de 7/14/30 dias nesses endpoints internos ainda devem ser reconfirmados antes de automatizar parâmetros diferentes. Enquanto isso, o Gestor pode combinar:
- funil completo de **Hoje / tempo real** pelo Seller Center;
- histórico de **Shopee Ads** pelas APIs já mapeadas e autorizadas.

---

## 11.8 Impacto direto na página Análise de Funil

A tela do Gestor deve ter quatro blocos:

1. **Funil da Loja** — Impressões → Cliques → Visitantes → Carrinho → Pedido criado → Pago → Confirmado.
2. **Por Produto** — o mesmo funil por `item_id`, com diagnóstico relativo à mediana da própria loja.
3. **Fontes de Tráfego** — Card/Busca, Live, Vídeo, Afiliados e Shopee Ads.
4. **Histórico Ads** — visão complementar de 7/14/30 dias usando a integração de Ads já existente.

### O que não fazer

- não criar “checkout iniciado” sem fonte;
- não misturar pedidos Ads com pedidos totais sem rotular;
- não usar benchmark externo como regra universal;
- não somar UV de produtos e chamar de UV da loja sem identificar a diferença de escopo;
- não substituir `null` por zero;
- não inferir causalidade apenas de correlação entre queda de taxa e algum atributo do anúncio.

---

## Resumo da curadoria v11

- Endpoints de negócio novos/promovidos: **6**.
- Principal nova capacidade: **funil completo por produto**.
- Etapas novas utilizáveis no Gestor: **UV, PV, carrinho, pedido criado, pago e confirmado**.
- Fontes de tráfego estruturadas: **Card/Busca, Live, Vídeo, Afiliados e Shopee Ads**.
- Pendência principal: confirmar parâmetros históricos dos endpoints MyData além de `period=real_time`.
- Etapa não encontrada: **início de checkout**.


## 11.9 Camada de orientação — Plano de Destrave

**Status:** regra determinística do Gestor Sênior construída sobre métricas confirmadas; não é diagnóstico oficial da Shopee.

A página de Análise de Funil deve traduzir o gargalo em uma ordem prática de revisão, sempre mostrando a evidência que acionou a recomendação.

### Regras atuais

- **Poucos dados:** menos de 100 impressões ou menos de 10 visitantes → não concluir gargalo; pedir mais volume.
- **Antes do clique:** CTR < 60% da mediana da própria loja, com pelo menos 100 impressões → revisar primeiro capa, início do título, preço percebido e competitividade na busca.
- **Visita → carrinho:** `uv_to_add_to_cart_rate` < 60% da mediana, com pelo menos 10 UV → revisar imagens secundárias, oferta, variações, frete, reviews e descrição.
- **Carrinho → pedido:** razão `placed_buyers / add_to_cart_buyers` < 60% da mediana e pelo menos 5 compradores no carrinho → revisar preço final, concorrência, frete, prazo, cupom e estoque.
- **Pedido → pago:** razão `paid_buyers / placed_buyers` < 60% da mediana e pelo menos 5 pedidos → investigar fechamento/pagamento, preço final, cupom, frete/prazo e cancelamentos; não priorizar capa.
- **Pago → confirmado:** razão `confirmed_buyers / paid_buyers` < 60% da mediana e pelo menos 5 pagos → priorizar operação, ruptura, cancelamento e expedição; não priorizar título/capa.
- **Saudável:** nenhuma condição forte acima → manter e usar como referência interna.

### Guardrails

- comparação sempre com a mediana da própria loja, não benchmark universal;
- limiar de 60% é heurística interna ajustável, não regra da Shopee;
- cada card deve exibir a amostra que disparou a orientação;
- recomendações são ações para verificar/revisar, não garantias de resultado;
- não sugerir mudança de título/capa quando o gargalo ocorre depois do pedido;
- não transformar ausência de dado em zero.


## 11.10 Modos de orientação do Funil

A Análise de Funil oferece dois níveis de orientação:

- **Padrão:** mostra o gargalo e a lista de pontos a revisar.
- **Específico — me diga o que fazer:** cruza o gargalo com a última Super Análise disponível, concorrentes vinculados, preço, custo e margem cadastrada.

### Contexto específico

O Gestor lê o contexto mais recente de `extension_analysis_reports` por `item_id`, incluindo:
- `product_snapshot`;
- `finance_snapshot.productCost`;
- `finance_snapshot.marginPct`;
- até 3 `competitors`;
- sugestões previamente registradas pela Super Análise.

O endpoint interno do Gestor é:

```text
GET /api/funnel/context?item_ids=<ids>
```

Ele não busca concorrentes novos nem altera a Shopee; somente reaproveita dados já coletados para a loja autenticada.

### Regras do modo específico

1. Nunca inventar preço, margem, concorrente ou recomendação visual.
2. Se não houver Super Análise/concorrentes, avisar que a orientação específica está limitada.
3. Preço de teste só pode ser sugerido quando houver preço próprio e preços reais de concorrentes vinculados; a mediana desses concorrentes deve aparecer como evidência.
4. Se o preço sugerido puder comprometer a margem ou a margem não estiver disponível, apresentar o valor apenas como **alvo de mercado a validar**, não como alteração segura.
5. Concorrentes usados na recomendação devem aparecer com link quando o link real estiver disponível.
6. Sugestões específicas são testes controlados; nenhuma alteração é aplicada automaticamente.
7. Gargalos pós-pedido/pós-pagamento não devem recomendar capa/título como primeira ação.


## 11.11 Histórico confirmado — 7 e 30 dias

**Status:** CONFIRMADO por captura manual do Seller Center em 27/09/2026.

A mesma família MyData usada pelo funil aceita períodos históricos reais. Não é necessário projetar o valor de hoje para estimar 7/30 dias.

### Períodos observados

```text
period=past7days
period=past30days
period=yesterday
period=real_time
```

Janelas confirmadas na captura da loja em GMT-03:

```text
past7days
start_time=1789873200
end_time=1790478000

past30days
start_time=1787886000
end_time=1790478000
```

A regra observada para períodos fechados é usar meia-noite local como `end_time` e recuar 7 ou 30 dias para `start_time`. O Gestor não deve inventar `past14days` enquanto ele não for capturado ou testado com sucesso.

### 11.11.1 Métricas gerais históricas

**Endpoint**

```text
GET /api/mydata/v3/dashboard/key-metrics/
```

**Confirmado com `period=past30days`.**

Campos com `value`, `chain_ratio` e séries `points[]` quando aplicável:

```text
shop_pv
shop_uv
product_clicks
hybrid_uv
paid_gmv
place_gmv
paid_orders
place_orders
paid_sales_per_order
place_sales_per_order
shop_uv_to_paid_buyers_rate
shop_uv_to_placed_buyers_rate
confirmed_gmv
confirmed_orders
confirmed_sales_per_order
shop_uv_to_confirmed_buyers_rate
product_clicks_to_placed_orders_rate
product_clicks_to_paid_orders_rate
product_clicks_to_confirmed_orders_rate
paid_gmv_without_shopee_rebate
place_gmv_without_shopee_rebate
confirmed_gmv_without_shopee_rebate
```

A captura de 30 dias confirmou que `chain_ratio` compara o período selecionado com uma janela anterior equivalente. O Gestor pode exibir essa comparação desde que rotulada como comparação com o período anterior.

### 11.11.2 Funil por produto histórico

**Endpoint**

```text
GET /api/mydata/v3/dashboard/product-rankings/
```

**Confirmado com `past7days`, `past30days`, `yesterday` e `real_time`.**

A estrutura permanece compatível com a seção 11.3 e inclui, por produto:

```text
product_card_impressions
product_card_clicks
unique_product_card_impressions
unique_product_card_clicks
ctr
uv
pv
bounce_visitors
bounce_rate
search_clicks
add_to_cart_units
add_to_cart_buyers
placed_buyers
placed_orders
paid_buyers
paid_orders
confirmed_buyers
confirmed_orders
uv_to_add_to_cart_rate
uv_to_placed_buyers_rate
uv_to_paid_buyers_rate
uv_to_confirmed_buyers_rate
placed_to_paid_buyers_rate
placed_buyers_to_confirmed_buyers_rate
```

Isso permite que o Plano de Destrave use amostras de 7 ou 30 dias em vez de depender somente do dia corrente.

### 11.11.3 Visão geral de Produto e carrinho

**Endpoint observado**

```text
GET /api/mydata/v2/product/overview/
```

Foi confirmado em `past7days`, `yesterday` e `real_time`, com campos como:

```text
uv.value
pv.value
bounce_visitors.value
bounce_rate.value
search_clicks.value
atc_unit_num.value
atc_uv.value
atc_rate.value
placed_buyers.value
placed_order.value
paid_buyers.value
paid_order.value
confirmed_buyers.value
confirmed_order.value
paid_gmv.value
```

**Atenção:** a captura fornecida não registrou esse endpoint agregado em `past30days`. O Motor Sênior pode consultá-lo como fonte opcional; se a Shopee não responder, o Gestor deve mostrar Carrinho como indisponível na visão geral. Não somar `add_to_cart_buyers` de vários produtos para fingir um total único da loja, porque o mesmo comprador pode aparecer em mais de um produto.

### 11.11.4 Séries diárias de Produto

**Endpoint**

```text
GET /api/mydata/v2/product/overview/metric-trends/
```

**Confirmado em `past7days`, `past30days` e `real_time`.**

A captura de 30 dias retornou 30 pontos diários para:

```text
uv
pv
iv
bounce_visitors
bounce_rate
search_clicks
like_unit_num
atc_unit_num
atc_uv
atc_rate
placed_buyers
placed_unit_num
placed_items
placed_gmv
placed_order
paid_buyers
paid_unit_num
paid_items
paid_gmv
paid_order
confirmed_buyers
confirmed_unit_num
confirmed_items
confirmed_gmv
confirmed_order
conversion_rate
sales_per_buyer
```

Essas séries podem alimentar gráficos históricos no Gestor. Não somar séries de taxa; taxas devem ser usadas ponto a ponto ou recalculadas a partir dos numeradores/denominadores adequados.

### 11.11.5 Performance de pedidos

**Endpoint**

```text
GET /api/mydata/dashboard/order-performance/
```

Confirmado em `past7days`, `past30days` e `yesterday`. A resposta traz totais, comparação e `points[]` para eventos como cancelamentos, devoluções/reembolsos e outras métricas operacionais. Essa fonte é útil para diagnosticar perdas depois do pedido/pagamento sem culpar título ou imagem.

### 11.11.6 Tráfego e contribuição por produto

**Endpoint**

```text
GET /api/mydata/v1/dashboard/traffic-sources/product-contribution/
```

Confirmado em `past7days`, `past30days`, `yesterday` e `real_time`.

A resposta mantém produto, vendas, pedidos, compradores, cliques e impressões e pode variar conforme a origem/filtro selecionado na interface.

O endpoint agregado:

```text
GET /api/mydata/v1/dashboard/traffic-sources/
```

respondeu normalmente em `real_time`, mas em uma captura de `past30days` retornou `code=60001` / `data isn't ready`. Portanto, a tela do Gestor deve aceitar ausência dessa fonte histórica sem substituir por zero.

### 11.11.7 Regras de implementação no Gestor

1. **30 dias é o padrão recomendado para análise**, porque reduz o risco de concluir com base em pouco volume.
2. **7 dias** deve existir como visão recente.
3. **Hoje/tempo real** fica como acompanhamento, não como período principal de diagnóstico.
4. Não liberar **14 dias** até o parâmetro real ser confirmado.
5. Para o funil da loja:
   - Impressões e Cliques podem ser derivados dos campos de card dos produtos;
   - Visitantes devem priorizar `key-metrics.shop_uv`;
   - Carrinho deve priorizar uma métrica agregada real como `product/overview.atc_uv`; se indisponível, exibir `—`;
   - Pedido/Pago/Confirmado devem priorizar `key-metrics.place_orders`, `paid_orders` e `confirmed_orders`.
6. Nunca somar UV ou compradores de produtos e apresentar como usuário único da loja.
7. Comparação histórica pode usar `chain_ratio`, sempre rotulada como comparação com o período anterior.
8. Séries `metric-trends` devem ser preservadas para gráficos futuros.
9. Nenhum cookie, token, `SPC_CDS` ou CSRF deve ser persistido ou enviado ao backend.

---

## Resumo da curadoria v12

- Períodos históricos confirmados: **7 dias e 30 dias**, além de ontem e tempo real.
- `past30days` confirmado no `key-metrics`, `product-rankings`, `metric-trends`, `order-performance` e `product-contribution`.
- Funil por produto de 30 dias: **confirmado**.
- Comparação com período anterior via `chain_ratio`: **confirmada**.
- Séries diárias de 30 dias: **confirmadas**.
- Carrinho agregado de 30 dias: **fonte opcional ainda precisa de confirmação direta no endpoint `product/overview`**.
- `past14days`: **não confirmado; não implementar como fato até nova captura**.


---

# 12. Desconto / Campanhas de Marketing — Seller Center

**Status:** CONFIRMADO por captura passiva do Motor Sênior v0.17.6 em 28/09/2026.

**Página observada:** Central de Marketing / Desconto no Seller Center.

A sessão capturou 120 chamadas, 67 rotas únicas e zero erros. A curadoria abaixo mantém apenas as chamadas com valor de negócio para campanhas de desconto; telemetria, chat, notificações, feature toggles genéricos e infraestrutura foram descartados como ruído para este domínio.

> Estes endpoints são internos do Seller Center e dependem da sessão normal do navegador. Não são equivalentes à Shopee Open Platform oficial. Quando usados pelo Gestor, devem seguir a arquitetura Gestor → Motor Sênior → fetch dentro de `seller.shopee.com.br`, sem enviar cookies, SPC_CDS, CSRF ou tokens ao backend.

## 12.1 Listagem de campanhas de desconto

### Endpoint legado/visão geral

```text
POST /api/marketing/v3/public/discount/list/
```

**Body observado**

```json
{
  "discount_type": 0,
  "limit": 10,
  "offset": 0,
  "time_status": 0
}
```

**Campos confirmados**

```text
data.discounts[]
discount_type
seller_discount.discount_id
seller_discount.name
seller_discount.time_status
seller_discount.start_time
seller_discount.end_time
seller_discount.item_preview.item_count
seller_discount.item_preview.images[]
seller_discount.source
seller_discount.global_discount_id
seller_discount.enable_direct_shop_promo_sync
data.total_count
```

Pelos horários capturados em 28/09/2026, a semântica observada de `time_status` é:

```text
1 = agendada / futura
2 = em andamento
3 = encerrada
```

Usar essa associação somente para este módulo enquanto não houver evidência contrária em outra conta/região.

### Endpoint v4 para campanha específica/listagem detalhada

```text
POST /api/marketing/v4/discount/get_discount_list/
```

**Body observado**

```json
{
  "limit": 1,
  "need_count": true,
  "need_image": true,
  "offset": 0,
  "promotion_id_list": ["<promotion_id>"]
}
```

**Campos confirmados**

```text
data.total_count
data.discount_list[].promotion_id
data.discount_list[].title
data.discount_list[].status
data.discount_list[].source
data.discount_list[].start_time
data.discount_list[].end_time
data.discount_list[].images[]
data.discount_list[].total_product
data.discount_list[].global_discount_id
data.discount_list[].enable_bidding_nomination
data.discount_list[].enable_direct_shop_promo_sync
data.discount_list[].enable_update_direct_shop_promo_sync
```

**Regra importante:** `source=0` foi observado nas campanhas criadas pelo vendedor. Não assumir que outros valores significam a mesma origem sem nova captura.

## 12.2 Produtos e variações dentro de uma campanha

**Endpoint**

```text
POST /api/marketing/v4/discount/get_discount_items_aggregated/
```

**Body observado**

```json
{
  "limit": 1,
  "offset": 0,
  "promotion_id": "<promotion_id>"
}
```

A resposta é rica o suficiente para reconstruir campanha, item e variações.

### Campos de desconto por SKU

```text
data.discount_item_list[].item_id
data.discount_item_list[].model_id
data.discount_item_list[].status
data.discount_item_list[].promotion_price
data.discount_item_list[].promotion_price_after_tax
data.discount_item_list[].user_item_limit
data.discount_item_list[].promotion_stock
data.discount_item_list[].local_promotion_price
```

### Dados das variações

```text
data.model_info[].item_id
data.model_info[].models[].model_id
data.model_info[].models[].name
data.model_info[].models[].price
data.model_info[].models[].stock
data.model_info[].models[].sold
data.model_info[].models[].is_default
```

### Dados do produto

```text
data.item_info[].item_id
data.item_info[].status
data.item_info[].name
data.item_info[].images[]
data.item_info[].price
data.item_info[].stock
data.item_info[].sold
data.item_info[].ext_info.has_wholesale
data.item_info[].ext_info.min_purchase_limit
```

### Preço e estoque agregados

```text
data.price_stock_info[].aggregated_price_info.min_price
data.price_stock_info[].aggregated_price_info.max_price
data.price_stock_info[].aggregated_stock_info.wms_total_stock
data.price_stock_info[].aggregated_stock_info.seller_total_stock
data.price_stock_info[].sku_stock_price_list[].model_id
data.price_stock_info[].sku_stock_price_list[].seller_stock_info.normal_stock
data.price_stock_info[].sku_stock_price_list[].seller_stock_info.promotion_stock
data.price_stock_info[].sku_stock_price_list[].seller_stock_info.reserved_stock
data.price_stock_info[].sku_stock_price_list[].price_info.input_promotion_price
data.price_stock_info[].sku_stock_price_list[].price_info.promotion_price
data.price_stock_info[].sku_stock_price_list[].price_info.input_normal_price
data.price_stock_info[].sku_stock_price_list[].price_info.normal_price
```

### Escala monetária observada

Os valores de preço vieram em inteiros com fator de escala de **100.000**. Exemplo estrutural observado:

```text
2.398.000 -> R$ 23,98
4.099.000 -> R$ 40,99
```

Normalização:

```text
preco_brl = valor_api / 100000
```

Não aplicar essa transformação a campos que não sejam monetários sem validação individual.

## 12.3 Métricas do módulo Desconto

**Endpoint**

```text
POST /api/marketing/v3/public/discount/metrics/
```

**Campos confirmados**

```text
data.date_range.start_time
data.date_range.end_time
data.metrics.sales
data.metrics.orders
data.metrics.units
data.metrics.buyers
data.metrics.sales_pct_diff
data.metrics.orders_pct_diff
data.metrics.units_pct_diff
data.metrics.buyers_pct_diff
```

Essas métricas são do módulo de desconto no período retornado pela Shopee. Não misturar automaticamente com GMV total da loja ou Shopee Ads.

## 12.4 Limite de campanhas ativas

**Endpoint**

```text
POST /api/marketing/v3/public/discount/active/
```

**Campos confirmados**

```text
data.max_active_discounts_data[].discount_type
data.max_active_discounts_data[].max_active_count
data.max_active_discounts_data[].is_exceed_max_active_count
```

Na captura, os tipos 1, 2 e 3 retornaram limite máximo informado pela própria Shopee. O Gestor deve tratar o valor retornado dinamicamente, sem fixá-lo no código.

## 12.5 Validação de desconto enganoso

**Endpoint**

```text
POST /api/marketing/v4/discount/get_misleading_discount_items/
```

**Body**

```json
{
  "item_list": [
    {"item_id": "<item_id>", "model_id": "<model_id>"}
  ]
}
```

**Resposta**

```text
data.misleading_item_list[]
data.error_list
```

Na captura, `misleading_item_list` veio vazio. Isso confirma o fluxo e a estrutura, mas não fornece ainda um exemplo positivo de item classificado como desconto enganoso.

**Uso no Gestor:** executar como validação antes de salvar alterações de campanha quando o fluxo interno do Seller Center for usado.

## 12.6 Verificação de sobreposição/conflito

**Endpoint**

```text
POST /api/marketing/v4/discount/get_overlap_items/
```

**Body observado**

```json
{
  "start_time": "<unix>",
  "end_time": "<unix>",
  "promotion_id": "<promotion_id>",
  "item_id_list": ["<item_id>"]
}
```

**Resposta confirmada**

```text
data.fail_main_items
data.succ_main_items[]
data.error_list
```

Na sessão observada, os itens testados foram aceitos em `succ_main_items`.

**Uso no Gestor:** validar conflitos antes de editar período/produtos de uma campanha. Não interpretar ausência de conflito nesta sessão como garantia universal.

## 12.7 Atualização dos dados gerais da campanha

**Endpoint de escrita confirmado**

```text
POST /api/marketing/v4/discount/update_discount/
```

**Body observado**

```json
{
  "promotion_id": "<promotion_id>",
  "title": "<nome da campanha>",
  "start_time": "<unix>",
  "end_time": "<unix>"
}
```

**Resposta de sucesso observada**

```text
error = 0
data.error_list = null
```

Isso confirma que título e janela da campanha podem ser alterados pelo fluxo interno do Seller Center.

### Guardrail

O Gestor nunca deve executar essa chamada automaticamente. Exigir:
1. ação explícita do usuário;
2. resumo das alterações;
3. confirmação;
4. releitura da campanha após o POST para confirmar persistência.

## 12.8 Atualização de preço promocional por variação

**Endpoint de escrita confirmado**

```text
POST /api/marketing/v4/discount/update_seller_discount_items/
```

**Body estrutural observado**

```json
{
  "promotion_id": "<promotion_id>",
  "discount_model_list": [
    {
      "item_id": "<item_id>",
      "model_id": "<model_id>",
      "percent_off": "<percentual escalado>",
      "promotion_price": "<preco escalado>",
      "promotion_stock": 0,
      "status": 1,
      "user_item_limit": 0
    }
  ]
}
```

**Resposta confirmada**

```text
data.total_count
data.success_count
data.failed_item_list
data.failed_model_list
data.price_ratio
data.error_list
```

A captura registrou atualização bem-sucedida de duas variações do mesmo produto.

### Escalas observadas

- `promotion_price`: mesma escala monetária de 100.000.
- `percent_off`: valor inteiro escalado; a amostra é compatível com percentual × 100.000, mas a Shopee pode arredondar o percentual em relação ao preço final. Recalcular e validar contra a UI antes de automatizar.

### Regra de implementação

Para editar preço promocional no Gestor:

```text
1. Ler campanha atual
2. Ler itens/variações atuais
3. Validar desconto enganoso
4. Validar sobreposição quando período/itens mudarem
5. Mostrar preço normal, promocional e margem calculada
6. Usuário confirma
7. Motor executa update_seller_discount_items
8. Reler get_discount_items_aggregated
9. Só marcar como concluído se o valor persistido for o esperado
```

Nunca alterar preço promocional, preço normal, estoque promocional ou limite por comprador sem confirmação explícita.

## 12.9 Endpoints auxiliares observados

Também foram capturados, mas não promovidos a fontes principais de negócio nesta curadoria:

```text
POST /api/marketing/v4/discount/get_shop_whitelist_info/
POST /api/marketing/v4/discount/get_shop_toggle/
POST /api/marketing/v4/discount/get_upload_log/
GET  /api/marketing/v3/public/toggle/
GET  /api/marketing/v3/shop/profile/
GET  /api/marketing/v3/public/promotion/threshold/
GET  /api/marketing/v4/public/get_marketing_center_campaign_list/
```

Eles podem apoiar elegibilidade, configuração, limites e logs, mas precisam de capturas específicas antes de o Gestor depender de campos internos individuais.

## 12.10 Aplicação no Gestor Sênior

Este mapeamento libera tecnicamente uma futura área de **Campanhas de Desconto** com:

- listar campanhas agendadas, ativas e encerradas;
- mostrar quantidade de produtos e imagens;
- abrir uma campanha e listar produtos/variações;
- comparar preço normal × promocional;
- mostrar estoque e vendas por variação;
- exibir métricas de vendas, pedidos, unidades e compradores do módulo;
- editar nome/período com confirmação;
- editar preço promocional por SKU com confirmação;
- validar sobreposição e desconto enganoso antes da escrita;
- preservar histórico/snapshot antes e depois de cada alteração.

### Prioridade de fonte

Quando a Shopee Open Platform oficial fornecer a mesma ação/dado com autorização adequada, ela continua sendo preferível. Os endpoints desta seção são evidência estruturada do Seller Center e devem ser usados via Motor Sênior somente onde a integração oficial não cobrir a necessidade.

---

## Resumo da curadoria v13 — Descontos de Marketing

- Capturas brutas: **120**.
- Rotas únicas observadas: **67**.
- Erros da sessão: **0**.
- Endpoints de negócio promovidos nesta curadoria: **9**.
- Endpoints auxiliares mantidos como evidência: **7**.
- Escritas confirmadas: **2** — atualização geral da campanha e atualização de preços promocionais por variação.
- Nova capacidade principal: leitura detalhada + edição confirmada de campanhas de desconto do vendedor.
- Falsos positivos/ruído: telemetria, chat, notificações, autenticação auxiliar, feedback e infraestrutura não foram promovidos a mapeamentos de negócio.
- Pendência: capturar um caso positivo de `misleading_item_list` e exemplos reais de conflito em `fail_main_items`.
