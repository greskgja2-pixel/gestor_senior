# Gestor Sênior Shopee Intelligence v0.3.0

A v0.3 integra os motores em vez de apenas colocá-los na mesma extensão.

## Fluxo inteligente

1. A análise identifica o anúncio aberto.
2. Procura concorrentes primeiro no índice local alimentado pelo Coletor Shopee 3.1.
3. Se a base não tiver amostra suficiente, completa com busca pública da Shopee em aba de segundo plano.
4. Cruza produto + concorrentes + Shopee Ads + Proteção ROAS + custo informado + histórico.
5. O motor Super Anúncio 1.5.4+14 gera nota, diagnóstico e plano priorizado.
6. Ações de Ads passam por guardrails financeiros antes de serem executadas.
7. Tarefas periódicas registram cada ciclo e podem sugerir ou executar mudanças de Ads.
8. O histórico permite comparar antes/depois e detectar possível rollback de Meta de ROAS.

## Regras de segurança

- Sem custo do produto, mudanças financeiras automáticas ficam bloqueadas.
- A Meta de ROAS não pode variar mais que o limite configurado; o comando manual inteligente possui trava absoluta de 15% por alteração.
- Título, descrição e preço continuam em aprovação enquanto o caminho de escrita não estiver validado ponta a ponta.
- Proteção ROAS é opcional e explicitamente tratada como rotina experimental.
- Não são enviados senha, cookie ou token da sessão pública da Shopee para o Gestor.

## Painel Revenda

Os JSONs coletados pela v3.1 continuam sendo baixados. Ao mesmo tempo, os produtos são normalizados e deduplicados em um índice local de até 3.500 itens para alimentar concorrência, mediana de preço, produtos mais vendidos na amostra e futuras funções do Painel Revenda.
