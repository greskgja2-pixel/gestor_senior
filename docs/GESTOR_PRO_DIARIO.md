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

## 2026-10-15 — ChatGPT — Validação visual v0.1.2
- Evidência: print da Shopee com painéis inseridos sob resultados e contador da extensão.
- Diagnóstico legível: 60 coletados, 38 links, 36 correspondências, **35 painéis**. A captura+inserção visual funcionou; falta cobertura total e correspondência precisa em todos os cards.
- Problemas observados: painéis grandes com valores JSON brutos, layout afetado, uma diferença entre correspondências e painéis, e alguns produtos sem painel. Código da função locateCard/insertAdjacentElement precisa de refinamento.
- Status T01 permanece investigando; nenhuma integração ao Gestor Sênior, nenhuma prova definitiva de semântica ctime. Rodada visual v0.1.2 confirmou avanço, sem concluir tarefa.
- Próximo passo: painel compacto com data convertida e idade (indicada como derivada), seletor estável por itemid/shopid e diagnóstico de omissões. Manter Motor Sênior isolado.

## 2026-10-15 — ChatGPT — Mapeador v0.1.3 e correção local v0.1.4
- Evidência: prints da busca 'tag saída maternidade' e JSON exportado pela v0.1.3: 60 produtos, 7 eventos e campos ctime, item_rating, itemid, liked_count, shopid. Diagnóstico visual: 60 coletados, 63 links, 61 correspondências, 60 painéis.
- Acerto: exibição legível de data derivada de ctime, idade, nota, avaliações e curtidas; coleta preservada.
- Erro: painéis inseridos antes de imagens em parte da grade e um painel indevido na área de lojas relacionadas. Ainda sem confirmação semântica independente do ctime e sem integração ao Motor Sênior.
- Correção v0.1.4: seleção da raiz do cartão por geometria e inclusão do painel ao final do cartão; exclusão da seção acima do cabeçalho da pesquisa; campo sem nota distinguido de nota zero. Scripts passaram node --check; ZIP para teste local, não publicado no GitHub nem validado ao vivo.
- Próximo passo: usuário instalar v0.1.4 e enviar print das primeiras duas linhas, validar posição e cobertura. T01 não concluída; manter 35 tarefas e Motor Sênior isolado.

## 2026-10-15 — ChatGPT — T01, teste visual v0.1.4 e escalonamento Claude
- Evidência: print da Shopee e exportação JSON de 60 produtos, 7 respostas, `/api/v4/search/search_items`, capturado às 22:57:05Z.
- Diagnóstico: 60 produtos capturados, 63 links detectados, 61 correspondências e 60 painéis declarados. Alguns painéis permanecem fora do card, entre linhas, e um próximo ao bloco de lojas relacionadas; problema de ancoragem visual não resolvido.
- Pontos bons: dados `ctime`, avaliação e curtidas exibidos e exportação mantida. Limites: a semântica de `ctime` ainda não é independentemente validada, e não houve integração ao Gestor Sênior.
- Foram acumuladas quatro ou mais tentativas com erro de apresentação. **Escalonado ao Claude** conforme regra; diagnóstico técnico preparado em `PROMPT_CLAUDE_GESTOR_PRO_T01_LAYOUT.md` para ser enviado com ZIP v0.1.4 e print. Não lançar nova versão por tentativa cega.
- Hipótese a validar: `locateCard()` escolhe ancestral genérico, `appendChild` insere no nível errado; filtros da região de busca insuficientes.
- Estado: T01 ainda em investigação; nenhuma mudança no Motor Sênior nem deploy de produção.

## 2026-10-15 — Claude — T01: diagnóstico de ancoragem e Mapeador v0.1.5
- **Tarefa:** T01, 5ª tentativa de apresentação após escalonamento no 4º erro. Continua investigando, não 100%.
- **Causa raiz:** escolha do card por largura/altura, inserção após conteúdo de altura fixa causando transbordamento; cabeçalho com span não reconhecido; deduplicação em ordem de DOM usando link da faixa de anúncios antes da grade.
- **Correção entregue:** versão 0.1.5 isolada em ZIP enviado pelo usuário, com identificação estrutural de card, filtragem de anúncios fora da grade, medição geométrica da inserção e omissão controlada sem espaço. JSON exporta diagnóstico/probe. Evita duplicações, loops e painéis órfãos.
- **Testes relatados pelo Claude:** Chromium com DOM sintético e itens reais: 33 verificações sem falhas; **não validados no site Shopee real**. Nesta sessão ChatGPT conferiu os três scripts com node --check e o manifesto JSON 0.1.5.
- **Arquivos:** overlay.js, page-observer.js, popup.js, popup.html, manifest.json, LEIA-ME.txt. Pacote original: Gestor-Pro-Mapeador-v0.1.5_1.zip, fornecido na conversa. Sem cópia do código no repositório neste commit documental.
- **Pendente:** teste de usuário em Shopee real, confirmação de ctime, integração ao Gestor Sênior. Sem deploy de produção nem mudança no Motor Sênior.
