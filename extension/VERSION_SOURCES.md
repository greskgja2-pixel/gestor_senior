# Fontes congeladas para esta integração

- Super Anúncio: **v1.5.4+14**, branch `super-anuncio-apk` de `greskgja2-pixel/shopee-login-test`.
- Motor portado: auditoria 0–100, concorrentes, título/descrição, histórico e estratégia de ROAS.
- Auto Mapper: **shopee-seller-auto-mapper-v2.4.zip / 2.4.0**.
- Enciclopédia Gestor Sênior: **v7 / 82 entradas técnicas** como referência de endpoints/campos já curados.
- Coletor Painel Revenda: **extensao-coletor-shopee-v3.1.0.zip / 3.1.0**, recebido em 2026-09-14.
- Extensão unificada: **Gestor Sênior Shopee Intelligence v0.9.0**.

## O que a v0.9 acrescenta

A Super Análise passa a usar um fluxo guiado de cinco etapas: validação do link/anúncio, mini anamnese + Ads + custos, seleção de até três concorrentes, Raio-X completo e finalização. O motor continua sendo o Super Anúncio 1.5.4+14 adaptado para navegador.

A extensão consulta título, categoria oficial, imagens, vídeo, avaliação quando disponível, avaliações, vendidos, estoque, variações, descrição e preço. Ads tenta preencher ROAS 7 dias, Meta de ROAS e gasto automaticamente e mantém fallback manual. Custos podem ser cadastrados no produto e por model_id/variação.

A busca de concorrentes reaproveita primeiro o índice do Coletor 3.1 e complementa com busca ao vivo sem fechar a extensão. O usuário confirma até três concorrentes antes do cálculo final.

O Raio-X mostra velocímetro de saúde, notas por área e visão "Como era × Como vai ficar" para título, descrição e categoria. Categorias usam a lista oficial da Shopee. Como ainda não existe no Gestor um endpoint de escrita de título/descrição/categoria validado, "Aplicar Sugestão" aprova/copia a sugestão mas **não altera silenciosamente o anúncio**. Esse comportamento só deve mudar depois do endpoint de escrita ser mapeado e testado.

Ao concluir, o relatório completo é enviado para o histórico web **Extensão Shopee Intelligence** e a reanálise padrão pode ser agendada para 10 dias. Reanálises periódicas posteriores também sincronizam novos relatórios com o Gestor.

A antiga área Automação passa a ser tratada como **Gestor de Análises**, reunindo anúncios analisados, frequência de reanálise e métricas disponíveis: visitantes, vendas, GMV, gasto Ads, ROAS e margem. Campos que a Shopee não disponibilizar aparecem como sem dados, nunca com números inventados.

A v0.9 também adiciona tema Claro/Escuro pela engrenagem da extensão e mantém os tutoriais, Dashboard Analítica, ações em massa, Revenda e Laboratório técnico.

## Segurança operacional

Preço, título, descrição e categoria permanecem **aprovação-only** enquanto não houver endpoint de escrita validado. ROAS automático continua exigindo custo do produto, limites de margem/lucro, dados mínimos, cooldown e limite percentual por ciclo. Campanhas compartilhadas e produtos sem custo informado continuam bloqueados em alterações automáticas em massa.

Senha, cookie, token, e-mail, telefone e outros dados de sessão não fazem parte do índice do Coletor nem do histórico sincronizado. O Auto Mapper completo fica desligado por padrão; a captura técnica é acionada apenas quando necessário.

## Histórico

A v0.8 adicionou mini tutoriais interativos. A v0.7 consolidou o primeiro pacote unificado instalável. A v0.6 adicionou ações em massa. A v0.5 adicionou a Dashboard Analítica. A v0.4 adicionou manutenção periódica profunda e estratégia de reversão de ROAS.

A política do projeto é nunca substituir silenciosamente uma fonte por versão anterior. Uma nova versão só vira referência depois de ser identificada e incorporada explicitamente.
