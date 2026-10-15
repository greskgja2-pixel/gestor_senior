# Diário de desenvolvimento — Gestor Pro
Data inicial: 2026-10-15

## Regras permanentes
- **Projeto:** Gestor Pro, extensão Chrome nova e independente do Motor Sênior atual.
- **Escopo:** executar as 35 tarefas de `app/gestor-pro/tasks.js` uma por vez; o painel do Gestor Sênior apenas acompanha.
- **Fonte técnica:** engenharia reversa estática da Avantpro SHP v7.7.29, Enciclopédia Shopee Seller Center → Gestor Sênior e capturas reais da Shopee; distinguir inferência, estimativa e dado confirmado.
- **Critério 100%:** coleta real confiável + apresentação funcional na busca da Shopee + contrato de integração + disponibilidade efetiva no Gestor Sênior + testes sem regressão. Validada apenas no laboratório é marco separado, não 100% geral.
- **Tentativas:** registrar cada tentativa e erro por tarefa. **Na quarta tentativa com erro, parar e preparar um prompt de diagnóstico para Claude**, com objetivo, sintomas, evidências, caminhos de arquivos, logs sanitizados e tentativas anteriores. Nunca enviar credenciais, cookies, tokens ou dados pessoais.
- **Deploys:** desenvolver em branch dedicada; agrupar alterações; minimizar commits e deploys; fazer build/testes antes de merge; nunca publicar checkout desatualizado; confirmar SHA publicado e testar rotas críticas.
- **Segurança:** não modificar Motor Sênior, funil ou fluxos operacionais durante o desenvolvimento da extensão Gestor Pro sem necessidade e aprovação explícita; banco de laboratório separado.
- **Números:** dado faltante = indisponível; média histórica não é venda real dos últimos 30 dias; selo Indicado não comprova Ads; ads_id isolado não comprova patrocínio.
- Ao final de **cada sessão**, registrar: tarefa(s), alterações, origem dos dados, testes, acertos, falhas, tentativas, SHA/branch, deploys realizados, pendências e próximo passo. Preservar entradas antigas.

## 2026-10-15 — ChatGPT — Implantação inicial do acompanhamento
- **Objetivo:** página visual para acompanhar 35 tarefas, com resumo por tarefa e diário compartilhado.
- **Alterações previstas nesta entrega:** nova rota `/gestor-pro`, novo item de navegação, lista versionada `app/gestor-pro/tasks.js`; este diário.
- **Estado:** todas as tarefas de implementação começam pendentes; nenhuma métrica foi coletada nem validada nesta sessão.
- **Acertos:** arquitetura Next.js nativa localizada; política de não regressão e deploy mínimo respeitada no planejamento.
- **Limitações:** sem validação de dados Shopee nem extensão Gestor Pro criada nesta etapa. A rota precisa de teste de build e smoke test após publicação.
- **Próxima tarefa:** T01 (data de criação do anúncio), começando por confirmação de campo e procedência.

## 2026-10-15 — ChatGPT — Enciclopédia consolidada para Gestor Pro
- Mantidas exatamente 35 tarefas; nenhuma tarefa foi marcada concluída.
- Adendo sobre engenharia reversa estática Avantpro v7.7.29, evidência visual SHBUSCA, fluxo do vídeo, campos confirmados anteriormente, cálculos, lacunas e riscos.
- Acerto: conhecimento separado por níveis de confiança, sem copiar backend ou código proprietário.
- Falhas: nenhuma falha de implementação investigada; não houve coleta real nesta sessão.
- Próximo: T01, identificar origem real da data de criação do anúncio.
- Publicação: somente documentação na branch do painel Gestor Pro, sem merge para main nesta sessão.

## 2026-10-15 — ChatGPT — T01 em investigação (protótipo experimental)
- Hipótese independente: `data.item_cards[].item_data.ctime` é timestamp de criação da listagem segundo documentação de terceiro (Charted Sea).
- Novo laboratório separado em `gestor-pro-extension/`, Manifest V3, observador passivo Fetch/XHR e painel T01 nos resultados quando a fonte traz ID, loja e timestamp.
- **Resultado:** protótipo escrito, não testado ao vivo; não afirmar que o campo existe em todos os resultados, nem que corresponde à publicação.
- Status T01: investigando, 0/4 tentativas com erro em execução real. T02–T35 mantidas pendentes.
- Não alterado o Motor Sênior. Integração com backend ainda não implementada.


## 2026-10-15 — ChatGPT — Primeira coleta real do Mapeador Gestor Pro
- Recebidos print Shopee e JSON da busca 'tag saída maternidade': 6 respostas de API, 60 anúncios, cinco campos por anúncio (`ctime`, `item_rating`, `itemid`, `liked_count`, `shopid`).
- Descoberta: `ctime` presente em todos os 60 anúncios na resposta natural `api/v4/search/search_items`, em `$.items[N].item_data.ctime`.
- Não foi exibido painel de extensão sob os cards no print. Possível falha no reconhecimento dos links ou contêiner visual. Versão 0.1.1 recompilada para novo teste, ainda não validada ao vivo.
- Acertos: interceptação e exportação JSON. Erro/limitação: overlay sem exibição. Sem prova conclusiva da semântica de publicação do `ctime`.
- Contagem de tentativas com erro do overlay nesta tarefa: 1; nenhuma integração Motor Sênior. T01 permanece investigando.
- Próximo: usuário instalar versão 0.1.1, verificar cards e enviar JSON/print; se necessário, inspecionar DOM exato dos links.
