# Plano de implantação — Coleta Unificada / referência Avant Pro
Data: 13/10/2026 | Dono: Gestor Sênior | Status: piloto técnico no frontend/backend

## Princípio
A extensão Avant Pro mostrou captura passiva de Fetch/XHR, cache e fallbacks. O CLAUDE.md já registra que o Motor Sênior v0.18.6 coleta buscas pela navegação natural da Shopee; essa extensão é distribuída como ZIP fora do GitHub. **Este pacote não está no repositório**; portanto este piloto **não altera o interceptor da extensão**.

Este PR implementa apenas o contrato de evidências da coleta pública:
- `app/lib/marketplace-evidence.js`: extrai linhas de formatos antigos/atuais, normaliza métricas e identifica fonte, campos disponíveis e estimativas excluídas.
- `app/pesquisa-produtos/MarketResearch.js`: usa o extrator compartilhado e **não trata valores mensais explicitamente estimados como dados observados**.
- `app/api/competitor-background-check/route.js`: usa a mesma normalização e não considera `ads_id` isolado ou selo Indicado como publicidade.
- `app/extensao-shopee-intelligence/IntelligenceSections.js`: inclui procedência em novas coletas de snapshots.
- Testes de regressão no prebuild: `tests/marketplace-evidence.test.mjs`.

## Matriz de cobertura por área
| Área | Fonte atual verificada no código | Migração para camada unificada | Situação |
| --- | --- | --- | --- |
| Pesquisa de Produtos / Radar de Oportunidades | `motorData('marketplaceSearch')` e histórico local | Extrator/contrato comum; captura natural já no Motor 0.18.6 | Piloto estático |
| Concorrentes / checagem em segundo plano | `/api/competitor-background-check` com busca pública e fallback PDP | Normalizador comum; procedência no snapshot; não inferir Ads de `ads_id` | Piloto estático |
| Super Análise / WebAuditFlow | `collectProduct` pelo Motor, validação pública adicional | Adaptador de produto e qualidade de evidência | Planejado |
| Super Anúncio | `extension_analysis_reports`, snapshots de concorrentes | Leitura de procedência, gráficos sem alterar históricos existentes | Planejado |
| Produtos | API oficial da Shopee + `products_cache` | Preservar fonte oficial; enriquecimento público opcional | Planejado |
| Funil da Loja | `sellerFunnel` / MyData, 7 e 30 dias | Manter indicadores oficiais por período; não usar vendas estimadas | Planejado |
| Shopee Ads | APIs de Seller Ads | Manter métricas reais de Ads; padronizar somente erros e procedência | Planejado |
| Precificação | Produtos, custos e promoções cadastrados | Usar preços com origem conhecida; não alterar preços automaticamente | Planejado |
| Prioridades e Relatórios | Históricos e snapshots | Consumir dados normalizados, com cobertura e data | Planejado |

## Critérios obrigatórios antes de cada avanço
1. Validar os dados do Motor em Chrome desktop e Quetta/Android, com testes de anúncio próprio e concorrente.
2. Comparar preço, vendas acumuladas, avaliação, quantidade de avaliações e localização com a resposta original; onde faltar fonte, mostrar indisponível.
3. Vendas/mês estimadas nunca substituem vendas reais de 30 dias. Diferença entre snapshots pode ser rotulada como vendas **entre coletas**, não automaticamente últimos 30 dias.
4. Não mostrar patrocínio a partir de `ads_id` ou selo `Indicado`.
5. Preservar em `extension_analysis_reports` e `gs_competitor_watches` todos os snapshots históricos. Não migrar ou apagar histórico sem backup/testes.
6. Usar sessão normal do navegador para os endpoints internos que exigem login; nunca persistir tokens, cookies ou SPC_CDS.
7. Só integrar uma tela depois de teste de contrato, teste de erro/timeout, QA mobile/desktop e smoke test de rotas críticas.
8. Habilitar rollout na produção apenas com critério de reversão; se a captura passiva falhar, preservar fonte existente, apontando a origem/falha.
9. Verificar SHA atual de `main` antes de qualquer merge; a Vercel deve publicar o merge sobre o HEAD atual, nunca checkout antigo.

## Limitações atuais
- O método de interceptor natural já descrito para Motor v0.18.6 não foi modificado aqui: o ZIP-fonte do Motor não está neste repositório.
- `/api/competitor-background-check` ainda faz tentativa HTTP de busca pública no servidor, que pode receber 403; este PR melhora a interpretação, não remove esse bloqueio.
- Testes do pacote são determinísticos/sintéticos. Build de prévia não confirma sessão Shopee, qualidade real de coleta nem Android.
- Não há modificação em banco de dados, CSS, fluxos de reanálise, custos, anúncios ou Ads.
