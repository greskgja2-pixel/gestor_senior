# Gestor Sênior — Shopee Intelligence Extension

Extensão companheira do Gestor Sênior para unir, no Chrome, quatro motores que antes funcionavam separados:

1. **Super Anúncio v1.5.4+14** — auditoria do anúncio, concorrentes, nota 0–100, título/descrição sugeridos e estratégia de ROAS.
2. **Gestor Sênior Web** — dados oficiais da loja, histórico, Shopee Ads, Proteção de ROAS e execução das ações já validadas.
3. **Auto Mapper v2.4** — captura técnica opcional para continuar expandindo a Enciclopédia Shopee.
4. **Coletor Shopee v3.1.0** — coleta por termo/categoria para o Painel Revenda e, agora, também uma base local reutilizável de concorrentes.

## v0.4 — melhoria contínua

O fluxo principal é: **coletar → analisar → decidir → agir → acompanhar → manter ou reverter**.

Ao analisar um anúncio aberto, a extensão tenta localizar concorrentes na base criada pelo Coletor 3.1. Se a amostra for insuficiente, pode complementar com uma busca ao vivo da Shopee em segundo plano. O Super Anúncio pontua o anúncio e o Gestor cruza o resultado com Ads, custo, preço e histórico.

Uma manutenção periódica pode reabrir o anúncio numa aba inativa e repetir a auditoria. O histórico registra nota, preço, vendidos/visualizações quando disponíveis, ROAS, gasto, GMV, pedidos, cliques e impressões. Depois de uma alteração, ciclos futuros conseguem comparar o antes/depois e sugerir reversão quando houver piora relevante sem ganho de pedidos.

## Automação e segurança

- **ROAS:** pode ser automático, desde que haja custo informado, dados mínimos, cooldown, limite percentual por ciclo e proteção de margem/lucro.
- **Preço:** a extensão calcula uma proposta limitada por ciclo e valida margem/lucro, mas deixa a alteração para aprovação enquanto não existir endpoint de escrita confirmado.
- **Título e descrição:** são preparados automaticamente, mas permanecem aprovação-only pelo mesmo motivo.
- **Proteção de ROAS:** o estado é observado/sincronizado; reset automático só ocorre se o usuário habilitar explicitamente essa política.
- **Aplicar melhorias seguras:** executa somente ações cujo caminho de escrita já foi validado; o restante permanece pendente para aprovação.
- A extensão não envia senha, cookie, token, e-mail ou telefone para o servidor.
- CAPTCHA/login não é burlado. Uma auditoria que dependa da página pode falhar e será registrada como tal.

## Painel Revenda

O Coletor 3.1 mantém seus recursos de pesquisa por categoria/termo, seleção de páginas, pausar/continuar/cancelar, sanitização e download dos JSONs. Paralelamente, as respostas coletadas alimentam um índice local que pode ser reaproveitado pelo motor de concorrentes do Super Anúncio.

## Desenvolvimento

A extensão vive em `feature/gestor-senior-extension-v1`; a `main`/produção do Gestor permanece separada enquanto o conjunto está em teste. O CI valida manifesto, sintaxe, referências de arquivos e regressões do Super Anúncio, índice de concorrentes, guardrails de automação e motor de melhoria contínua.
