# Fontes congeladas para esta integração

- Super Anúncio: **v1.5.4+14**, branch `super-anuncio-apk` de `greskgja2-pixel/shopee-login-test`.
- Motor portado: auditoria 0–100, concorrentes, título/descrição, histórico e estratégia de ROAS.
- Auto Mapper: **shopee-seller-auto-mapper-v2.4.zip / 2.4.0**.
- Enciclopédia Gestor Sênior: **v7 / 82 entradas técnicas** como referência de endpoints/campos já curados.
- Coletor Painel Revenda: **extensao-coletor-shopee-v3.1.0.zip / 3.1.0**, recebido em 2026-09-14.
- Extensão unificada: **Gestor Sênior Shopee Intelligence v0.8.0**.

## O que a v0.8 acrescenta

A extensão ganhou **mini tutoriais interativos e contextuais** acessíveis pelo botão `?`. O painel lateral possui guias para Primeiros passos, Super Análise, Automação de melhoria, Revenda/concorrentes, Coletor técnico e Dashboard Analítica. A Dashboard Analítica possui tutoriais próprios para leitura de desempenho, ações em massa e exportação/paginação.

Os tutoriais destacam visualmente o controle explicado, mudam automaticamente para a aba correta quando necessário e usam passos curtos com Voltar, Próximo, Sair e Concluir. Na primeira execução da v0.8 aparece apenas um aviso discreto indicando os novos tutoriais; eles não são forçados a cada abertura.

## O que a v0.7 consolidou

A v0.7 foi o primeiro pacote tratado como extensão unificada pronta para instalação e testes de uso real. Ela juntou Super Anúncio, Coletor Shopee 3.1, Auto Mapper 2.4, dashboard analítica, manutenção periódica, ações em massa e integração com o Gestor Sênior Web.

O painel da extensão mantém as áreas Visão, Analisar, Automação, Revenda e Coletor. A Dashboard Analítica continua em página própria horizontal para tabelas, filtros temporais, comparação entre períodos e exportação CSV/XLSX.

O Gestor Web também usa uma camada global de layout wide responsivo: em telas horizontais, cards, gráficos, tabelas, módulos de concorrência, Ads, enciclopédia e editores usam a largura disponível sem comprimir textos. Quando a largura não é suficiente, os grids empilham e as tabelas usam rolagem dentro do próprio bloco.

## Segurança operacional

Preço, título e descrição permanecem **aprovação-only** enquanto não houver um endpoint de escrita validado no Gestor. A extensão não inventa uma operação de edição da Shopee. ROAS automático continua exigindo custo do produto, limites de margem/lucro, dados mínimos, cooldown e limite percentual por ciclo. Campanhas compartilhadas e produtos sem custo informado são bloqueados em alterações automáticas em massa.

Senha, cookie, token, e-mail, telefone e outros dados de sessão não fazem parte do índice do Coletor nem devem ser enviados ao Gestor. O Auto Mapper completo fica desligado por padrão; a captura técnica é acionada apenas quando necessário.

## Histórico das etapas anteriores

A v0.4 adicionou manutenção periódica profunda, reabertura do anúncio em segundo plano, reaproveitamento da base do Coletor 3.1, busca de concorrentes ao vivo quando necessária, registro antes/depois e estratégia de reversão de ROAS.

A v0.5 adicionou a Dashboard Analítica de Anúncios com intervalo customizado, comparação temporal, paginação, ordenação, CSV/XLSX, Nota Super Análise clicável, GMV, ROAS, CTR, custo por conversão e margem de contribuição.

A v0.6 adicionou seleção e ações em massa, atalhos para produtos com ROAS abaixo da meta, não analisados e margem negativa, auditoria profunda de até 25 anúncios por rodada e correção segura de ROAS em lote.

A política do projeto é nunca substituir silenciosamente uma fonte por versão anterior. Uma nova versão só vira referência depois de ser identificada e incorporada explicitamente.
