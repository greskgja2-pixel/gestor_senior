# Fontes congeladas para esta integração

- Super Anúncio: **v1.5.4+14**, branch `super-anuncio-apk` de `greskgja2-pixel/shopee-login-test`.
- Motor portado: auditoria 0–100, concorrentes, título/descrição, histórico e estratégia de ROAS.
- Auto Mapper: **shopee-seller-auto-mapper-v2.4.zip / 2.4.0**.
- Enciclopédia Gestor Sênior: **v7 / 82 entradas técnicas** como referência de endpoints/campos já curados.
- Coletor Painel Revenda: **extensao-coletor-shopee-v3.1.0.zip / 3.1.0**, recebido em 2026-09-14.
- Extensão unificada: **Gestor Sênior Shopee Intelligence v0.5.0**.

## O que a v0.5 acrescenta

A extensão ganhou uma página completa de **Dashboard Analítica de Anúncios**, aberta em uma aba própria para comportar uma tabela larga. Ela cruza a lista de produtos da loja com Shopee Ads, custos locais, histórico da Super Análise e limites financeiros.

A dashboard possui intervalo customizado de 1 a 90 dias, atalhos de Hoje, Ontem, Últimos 3 dias, Últimos 7 dias, semana atual e mês atual, além de comparar automaticamente com o período anterior equivalente. A API `/api/shopee/ads-analytics` busca campanhas em lotes, suporta mais de 100 campanhas e evita duplicar métricas de campanhas multi-item quando a Shopee não fornece atribuição por produto.

A tabela traz imagem, nome, nota Super Análise, custo unitário, preço De/Por, custo por conversão Ads, GMV, ROAS, CTR e margem de contribuição em R$ e %. As métricas exibem badges de variação e todas as colunas numéricas são ordenáveis. Há busca, filtro, paginação 10/25/50/100, exportação CSV e XLSX sem dependência externa e detalhamento da Super Análise ao clicar na nota.

A margem é tratada como métrica derivada: GMV atribuído ao Ads menos custo unitário × itens vendidos, taxas configuradas e gasto Ads. Sem custo cadastrado, a margem fica como N/A para impedir uma falsa impressão de rentabilidade.

A manutenção periódica continua podendo reabrir o anúncio em uma aba inativa, reexecutar a auditoria Super Anúncio, reaproveitar a base local do Coletor 3.1 e complementar concorrentes com busca ao vivo. Preço, título e descrição permanecem **aprovação-only** enquanto não houver um endpoint de escrita validado. ROAS automático continua exigindo custo, limites de margem/lucro, dados mínimos, cooldown e limite percentual por ciclo.

A política do projeto é nunca substituir silenciosamente uma fonte por versão anterior. Uma nova versão só vira referência depois de ser identificada e incorporada explicitamente.
