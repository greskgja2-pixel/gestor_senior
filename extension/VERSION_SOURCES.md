# Fontes congeladas para esta integração

- Super Anúncio: **v1.5.4+14**, branch `super-anuncio-apk` de `greskgja2-pixel/shopee-login-test`.
- Motor portado: auditoria 0–100, concorrentes, título/descrição, histórico e estratégia de ROAS.
- Auto Mapper: **shopee-seller-auto-mapper-v2.4.zip / 2.4.0**.
- Enciclopédia Gestor Sênior: **v7 / 82 entradas técnicas** como referência de endpoints/campos já curados.
- Coletor Painel Revenda: **extensao-coletor-shopee-v3.1.0.zip / 3.1.0**, recebido em 2026-09-14.
- Extensão unificada: **Gestor Sênior Shopee Intelligence v0.4.0**.

## O que a v0.4 acrescenta

A manutenção periódica pode reabrir o anúncio em uma aba inativa, reexecutar a auditoria Super Anúncio, reaproveitar a base local do Coletor 3.1 e complementar concorrentes com uma busca ao vivo quando necessário. O ciclo registra antes/depois, gera propostas de título, descrição e preço, cruza Ads e pode sugerir ou executar ajuste de ROAS dentro dos guardrails financeiros.

Preço, título e descrição permanecem **aprovação-only** enquanto não houver um endpoint de escrita validado no Gestor. A extensão não inventa uma operação de edição da Shopee. ROAS automático continua exigindo custo do produto, limites de margem/lucro, dados mínimos, cooldown e limite percentual por ciclo. O motor também pode sugerir reversão quando uma alteração de ROAS for seguida de piora relevante sem ganho de pedidos.

A política do projeto é nunca substituir silenciosamente uma fonte por versão anterior. Uma nova versão só vira referência depois de ser identificada e incorporada explicitamente.
