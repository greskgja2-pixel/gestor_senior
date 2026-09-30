# Guia de bugs a evitar — Gestor Senior / ShopeeOS

Este arquivo documenta bugs já encontrados (ou de alto risco) no projeto e como evitá-los. Sempre que corrigir um bug real de produção, adicione uma entrada aqui.

## Registro entre IAs (Claude ⇄ ChatGPT/Codex)
Este arquivo é o canal de aprendizado entre as IAs. Antes de alterar código, leia-o inteiro. Ao terminar uma sessão, acrescente no fim, em "Registro de sessões", o que mudou, como foi validado, os erros encontrados e o que ficou pendente. Nunca apague nem reescreva a entrada de outro agente. Nunca registrar tokens, cookies, `SPC_CDS`, `device_sz_fingerprint` ou dados pessoais de pedidos.
Deploys: cada commit em qualquer branch (exceto as desligadas em `vercel.json`) gera deploy na Vercel e o plano Hobby permite ~100/dia. Prefira uma branch própria a partir da `main` atual, junte as mudanças em poucos commits e faça um único merge para a `main`. A branch `dev` não gera deploy, mas na data do registro abaixo estava 70 commits atrás da `main`.

## Regra de honestidade de dados (vale para todo o projeto)
Nunca inventar/estimar dado onde a fonte não está funcionando ou não está conectada. Nesses casos exibir "sem dados" / "não disponível" em vez de qualquer número ou status inventado.

## 1. Loop de re-render por função async com "return" antecipado (JÁ OCORREU NO SITE)
**O que é:** uma função `async` com `return;` (sem valor) resolve a Promise que ela retorna de qualquer forma, de forma assíncrona (microtask). Se essa função é chamada de novo dentro do `.then()` de quem a chamou (ex.: um re-render que dispara o mesmo carregamento), cada nova chamada "retorna na hora" e reagenda outro re-render — criando um laço que roda milhares de vezes por segundo até a busca real (fetch) terminar. Sintoma real: memória/CPU no talo, aba travada, coluna presa em "carregando…" por muito mais tempo que o normal.
**Como evitar:** quando uma função async pode ser chamada várias vezes enquanto ainda está em andamento, guarde a Promise em andamento em `state` (`state.xPromise`) e faça todas as chamadas concorrentes reaproveitarem essa mesma Promise, em vez de cada uma resolver instantaneamente e dependerem de o Chamador tratar o "return" como "já terminou".
**Referência:** [nodebestpractices — returning promises](https://github.com/mahamedmahad/nodebestpractices/blob/master/sections/errorhandling/returningpromises.md)

## 2. Disparo de busca assíncrona duplicada/concorrente sem flag de guarda
**O que é:** duas chamadas quase simultâneas para a mesma função de carregamento (ex.: dois re-renders seguidos, ou clique duplo) disparam duas requisições reais à mesma API.
**Como evitar:** checar uma flag (`state.loadingX`) logo no início da função e sair (`return`) se já houver uma busca em andamento. Já aplicado em `loadPublicInfoForPage`.

## 3. Retornar Promise de dentro de função `async` sem `await`
**O que é:** `return outraFuncaoAsync();` sem `await` deixa a stack trace incompleta em caso de erro e pode permitir execução fora de ordem.
**Como evitar:** usar sempre `return await outraFuncaoAsync();` quando o valor de retorno é o resultado da chamada async.
**Referência:** [nodebestpractices — returning promises](https://github.com/mahamedmahad/nodebestpractices/blob/master/sections/errorhandling/returningpromises.md)

## 4. Comparação com `==` em vez de `===`
**O que é:** coerção de tipo inesperada — comum aqui porque `item_id`/`model_id` às vezes vêm como string da API e às vezes como number no estado local.
**Como evitar:** sempre `===`/`!==`; ao comparar IDs, normalizar com `Number(...)` ou `String(...)` dos dois lados antes de comparar (padrão já usado em várias partes do código, ex.: `Number(item.item_id)`).

## 5. Closure errada dentro de `for`/`forEach` por causa de `var`
**O que é:** `var` não tem escopo de bloco, então closures criadas dentro de um loop podem acabar "vendo" o valor final da variável, não o valor da iteração em que foram criadas.
**Como evitar:** usar sempre `let`/`const` para variáveis de loop (o projeto já segue esse padrão — manter).

## 6. Vazamento de listeners de evento ao reconstruir o DOM
**O que é:** o site reconstrói telas inteiras via `content.innerHTML = ...` e reanexa listeners a cada render. Se algum listener for anexado fora desse ciclo (direto no `document`, por exemplo) sem checar se já existe, ele pode se acumular a cada render.
**Como evitar:** preferir delegação de eventos únicos no `document` (feito para zoom de imagem e modal) anexados uma única vez fora da função de render; listeners específicos de elementos da tela (`content.querySelectorAll(...).forEach(...)`) são seguros porque o `innerHTML` remove os nós antigos e seus listeners junto.

## 7. Montagem ineficiente de HTML grande em várias etapas
**O que é:** múltiplas escritas de `innerHTML` seguidas (uma por item, por exemplo) forçam o navegador a recalcular layout várias vezes.
**Como evitar:** montar a tela inteira em uma única string (ou array + `.join('')`) e escrever no `innerHTML` uma única vez — já é o padrão usado em `renderProducts`/`productRow`; manter esse padrão em novas telas.

## 8. Erros de índice/paginação (off-by-one)
**O que é:** cálculos de página, `slice(start, start+size)` ou índice de array errados por 1 posição.
**Como evitar:** sempre validar contra os casos-limite (primeira página, última página, lista vazia, lista com 1 item) antes de considerar pronto.

## 9. Aspas/chaves desemparelhadas em strings HTML geradas por concatenação
**O que é:** o projeto gera HTML via concatenação de strings com `'` e `"` misturados; um apóstrofo dentro de um texto (nome de produto, por exemplo) sem passar por `esc()` pode quebrar o HTML gerado.
**Como evitar:** sempre passar texto vindo de dados externos (nome do produto, SKU, mensagens de erro da API) pela função `esc()` antes de concatenar em HTML. Validar sintaxe do arquivo com `node --check` antes de publicar mudanças grandes.

## 10. Erro de rede/API não tratado (tela presa em "carregando…" para sempre)
**O que é:** um `fetch`/`api()` que falha sem `catch` deixa a tela travada mostrando "carregando…" indefinidamente, em vez de mostrar o erro.
**Como evitar:** todo `await api(...)` deve estar dentro de `try/catch`, e o `catch` deve terminar o estado de "carregando" e mostrar "sem dados" / "não disponível" / a mensagem de erro real — nunca inventar um valor.

## 11. Renderizadores concorrentes disputando #content (JÁ OCORREU NO SITE — corrigido em 19/09)
**O que é:** `public/shopeeos-live.html` tem seu próprio `render()`/`start()` legado, baseado numa variável interna `state.page` (default `'home'`), que não sabe nada sobre `?section=temas`/`?section=config` nem sobre o roteamento feito por `public/shell-enhancements.js`. O `start()` faz várias chamadas reais de API (`loadConnection`, `loadProducts`, `loadOrders`, `loadProductStatus` — alguns segundos de latência real) e, ao final, chamava `render()` incondicionalmente. Como `state.page` continuava `'home'`, isso forçava `GestorLiveModules.render('dashboard')` e sobrescrevia silenciosamente a tela que o usuário tinha acabado de abrir (Temas ou Configurações), alguns segundos depois de aberta. Sintoma relatado pelo usuário: "menu bugado, tem coisa que não abre" — na verdade abria e revertia sozinho.
**Como evitar:** sempre que o site tiver mais de um sistema de renderização escrevendo no mesmo elemento (`#content`), qualquer bootstrap/render legado precisa checar o estado/URL atual antes de sobrescrever — nunca assumir que é o único dono da tela. Fix aplicado em `start()` (linha 339): antes do `render()` final, ler `new URLSearchParams(location.search).get('section')` e pular o `render()` se for `'temas'` ou `'config'`.
**Referência do commit correto:** `1806e5c` em `main` (fix aplicado antes em `3cfcea4`, mas ficou uma linha residual quebrada até `1806e5c` limpar).

## 12. Publicar no GitHub pelo editor web (quando `git push` está bloqueado no sandbox)
**Situação:** neste ambiente, tanto `git push` quanto a API REST do GitHub retornam 403 ("repo não autorizado nesta sessão"). A única via de publicação é o editor web do GitHub via navegador (`mcp__remote-devices__Claude_Browser__*` ou Chrome).
**Armadilhas encontradas (causaram 2 publicações quebradas antes de acertar):**
- As coordenadas de clique do `computer` tool NÃO batem 1:1 com o screenshot — há um fator de escala (não é um offset fixo). **Nunca** clicar por coordenada bruta em algo que precisa precisão (ex.: posição de cursor num editor de código); sempre usar `find` para pegar um `ref` e clicar no `ref`.
- As teclas `Home` (sozinha) e `Down` (seta, sozinha) não funcionam de forma confiável nesse editor. `ctrl+Home`, `ctrl+End`, `shift+Home`, `shift+End`, `shift+ctrl+End`, `Backspace`, `ctrl+z` funcionam bem.
- Técnica confiável para editar/apagar um trecho específico sem depender de seleção visual: calcular o tamanho exato em bytes do trecho a remover (`wc -c` no conteúdo local já verificado), usar `ctrl+End` para ir ao fim real do documento, e apagar com `Backspace` (repeat) o número exato de caracteres — depois comparar o resultado (`git fetch` + `diff`) com uma versão local já validada (`node --check`) para ter certeza absoluta antes de considerar publicado.
- Sempre validar a sintaxe JS localmente (`node --check`) e comparar o arquivo publicado no `origin/main` (via `git fetch` + `git show origin/main:<arquivo> | diff -`) com o arquivo local esperado — nunca confiar só no screenshot do editor.
- Depois de publicar, verificar o deploy real na Vercel (`mcp__Vercel__list_deployments` no projeto certo — o nome do projeto pode não bater com o subdomínio da URL; usar `list_projects` com `search` para achar o `projectId` certo) e testar o comportamento ao vivo no navegador antes de avisar o usuário que terminou.

## 13. Accordion/submenu escondido no menu lateral (JÁ OCORREU NO SITE — corrigido em 19/09)
**O que é:** `AppShell.js` guardava o estado de "grupo aberto" (`STORAGE_GROUPS`, `localStorage`) e só renderizava os links filhos (`Super Análise`, `Super Anúncio`, etc.) quando o grupo pai (`Produtos`, `Shopee Ads`) estava expandido, com um botão "Recolher/Expandir X" (`aria-expanded`) separado do link de navegação. Isso obrigava o usuário a clicar duas vezes (expandir, depois navegar) para chegar em qualquer subitem, e o usuário pediu explicitamente para eliminar qualquer dependência de clique/accordion no menu.
**Como evitar:** menu lateral de navegação principal deve sempre renderizar todos os itens (inclusive filhos de grupo) de uma vez, sem gate de `display:none`/estado de "aberto"; usar CSS (`.gs-nav-submenu{display:grid}` sempre, nunca `display:none` condicional) e nunca um botão de toggle separado do link — cada entrada do menu é só um `<Link>`. Trancado com o teste `'menu nao tem accordion: sem botao de recolher/expandir nem submenu escondido'` em `tests/sidebar-consistency.test.mjs`, que falha se aparecer `toggleGroup`, `aria-expanded`, `STORAGE_GROUPS` ou `.gs-nav-submenu{display:none` no código.
**Referência do commit:** `ce2a740` (AppShell.js) + `7fbf2f8` (app-shell.css) + `48320b5` (teste).

## 14. Empate de especificidade CSS ao esconder elemento dentro do iframe legado (JÁ OCORREU NO SITE — corrigido em 19/09, bug real visível só em telas ≥901px)
**O que é:** `ShopeeLiveFrame.js` injeta um `<style id="gs-hosted-layout">` no `<head>` do iframe (`installHostedLayout()`) para esconder a sidebar/topbar antigas do HTML legado (`public/shopeeos-live.html`) e deixar só a sidebar nova do `AppShell`. A regra usada era `.sidebar{display:none!important}` — especificidade baixa (0,1,0). Só que `public/shell-enhancements.css` é carregado DEPOIS (como `<link>` externo, via `loadStyle()`, dentro do pipeline `STYLES`/`CORE_SCRIPTS`/`OPTIONAL_SCRIPTS`) e tem a regra `.sidebar{display:flex!important}` na MESMA especificidade — em empate de especificidade e `!important`, quem carrega por último vence a cascata, então a sidebar antiga (escura) voltava a aparecer, duplicada ao lado da nova, em qualquer tela ≥901px. Isso quase passou despercebido porque o primeiro teste manual usou uma janela de navegador de ~800px, onde uma media query `@media(max-width:900px){.sidebar{position:fixed;left:-264px}}` do mesmo `shell-enhancements.css` escondia a sidebar antiga por fora da tela por coincidência — mascarando o bug real.
**Como evitar:** qualquer `<style>` injetado via JS para sobrepor CSS de terceiros que também usa `!important` precisa de seletores com especificidade GARANTIDAMENTE maior (ex.: `html body .app .sidebar{...}` em vez de `.sidebar{...}`), nunca depender de "quem carrega primeiro/depois" nem de coincidências de media query. Sempre testar em viewport desktop real (`resize_window({width:1280,height:800})` ou similar) além de mobile — um teste só em janela estreita pode mascarar um bug que só aparece em telas largas. Trancado com o teste `'regra que esconde a sidebar antiga do iframe tem especificidade reforcada (>901px)'` em `tests/sidebar-consistency.test.mjs`, que exige literalmente `html body .app .sidebar{display:none!important}` no código-fonte de `ShopeeLiveFrame.js`.
**Referência do commit:** `ad41829` (ShopeeLiveFrame.js) + `e8e4564` (teste).

## 15. AVISO — NÃO MEXER no espaçamento/altura do menu lateral sem pedido explícito do usuário (ajustado em 19-20/09, aprovado pelo usuário)
**Para qualquer IA lendo este arquivo (Claude ou ChatGPT):** o espaçamento vertical do menu lateral (`app/app-shell.css`, seletores `.gs-nav`, `.gs-nav>a,.gs-nav-parent-link,.gs-nav-submenu>a` e `.gs-nav-submenu>a`) já passou por 3 rodadas de ajuste fino pedidas e aprovadas pelo usuário. **NÃO altere estes valores** a menos que o usuário peça explicitamente uma mudança de espaçamento/altura do menu nesta conversa:
- `.gs-nav{display:grid;align-content:start;gap:5px;...}` — o `align-content:start` é OBRIGATÓRIO. Sem ele, como `.gs-nav` tem `flex:1 1 auto` (cresce para ocupar a altura da sidebar), o comportamento padrão do CSS Grid distribui o espaço sobrando IGUALMENTE entre as linhas do menu, criando vãos enormes e desiguais entre os itens principais (bug real, reportado pelo usuário com print). Ver item 14 do histórico técnico abaixo.
- `.gs-nav>a,.gs-nav-parent-link,.gs-nav-submenu>a{height:41px;padding:7px 10px;...}` e `.gs-nav-submenu>a{height:41px;padding:7px 8px;...}` — os itens principais (ícone 27px) e os itens de submenu (ícone 23px) usam `height` FIXO (não `min-height`) com o MESMO valor (41px) de propósito, para que a altura da linha seja idêntica em toda a sidebar independente do tamanho do ícone. Trocar `height` por `min-height`, ou usar valores diferentes entre os dois seletores, reintroduz a diferença de altura entre item principal e submenu (bug real, reportado pelo usuário com print).
**Se o usuário pedir para mudar o espaçamento:** ajuste os três valores (`gap:5px` do `.gs-nav`, e o `height:41px` dos dois seletores de link, mantendo-os IGUAIS entre si) e atualize os testes correspondentes em `tests/sidebar-consistency.test.mjs` (`'itens do menu (principais e do submenu) tem a mesma altura de linha'` e `'nav do menu nao espalha espaco vazio entre as linhas (align-content:start)'`) na mesma publicação, para que o `prebuild` do Vercel não quebre.
**Referência dos commits:** `e3c4a0b`/`222ab0f` (height fixo) + `23e3d50`/`fde1cc4` (align-content:start).


## 16. REGRA CRÍTICA — NUNCA publicar checkout/commit antigo sobre a produção (JÁ OCORREU EM 21/09)
**O que aconteceu:** uma execução em ambiente Work publicou na Vercel um checkout antigo do repositório (commit `dd2b115`) depois de a branch `main` já estar dezenas de commits à frente. O deploy ficou `READY`, mas isso não significava que continha o código atual. Na prática, a produção foi regredida e páginas como Super Anúncio, Reanálises, Prioridades, Relatórios, Shopee Ads e Proteção ROAS ficaram com comportamento/layout incompatível ou sem conteúdo.
**Regra obrigatória antes de QUALQUER deploy:** comparar o SHA que será publicado com o HEAD atual de `origin/main`. Se não forem o mesmo commit (ou se o candidato não contiver o HEAD atual), ABORTAR o deploy; nunca publicar uma cópia local antiga, mesmo que build/test passem.
**Regra obrigatória depois do deploy:** `READY` sozinho NÃO é validação. Confirmar no deployment da Vercel que `meta.githubCommitSha` corresponde ao HEAD esperado e executar smoke test das rotas críticas: `/`, `/produtos`, `/super-analise`, `/extensao-shopee-intelligence?section=super-anuncio`, `?section=reanalises`, `?section=prioridades`, `?section=relatorios`, `?section=shopee-ads` e `/protecao-roas`. Cada rota deve responder e renderizar conteúdo principal; menu lateral visível não conta como página funcionando.
**Proteção de escopo:** mudanças de Dashboard/menu não podem remover, substituir ou recriar a implementação interna dessas rotas. Para retirar um item do menu, remova somente a entrada de navegação; preserve a rota e seus componentes. Antes de alterar arquivo compartilhado (`layout.js`, `AppShell.js`, `app-shell.css`, helpers de API), verificar impacto nas rotas críticas acima.
**Proibição:** Work/Claude/ChatGPT nunca deve executar deploy de um workspace desatualizado. Primeiro sincronizar com `origin/main`; se não puder provar que está atualizado, não publicar.


## 17. ARQUITETURA NATIVA — legado removido em 21/09/2026
O shell principal, Dashboard, Temas e Configurações são React/Next nativos. O antigo `ShopeeLiveFrame`, `public/shopeeos-live.html` e os scripts/CSS de enhancement/restoration foram removidos após retirada das dependências de navegação.
**Regra:** não recriar iframe, HTML monolítico, injeção runtime de scripts/CSS ou patches `*-enhancements`/ `*-fix` para implementar novas telas. Novas funções devem entrar como componentes/rotas Next e compartilhar regras em `lib/` ou APIs normalizadas.
**Regra de métrica:** cálculo compartilhado deve ter uma única implementação. Ads e finanças usam módulos de negócio compartilhados; ausência de fonte continua `null`/indisponível, nunca zero inventado.
**Regra de exclusão:** arquivo/rota/API só pode ser removido depois de provar que não possui consumidor ativo e executar build + smoke test das rotas críticas definidas na Regra 16.

**Estado pós-migração:** frontend legado removido do branch principal; validar sempre o deploy do HEAD antes de considerar a migração concluída.

## Registro de sessões

### 2026-09-25 — Claude — Super Anúncio: leitura em cadeia
**Arquivos:** `app/extensao-shopee-intelligence/SuperAnuncioMockup.js`, `app/extensao-shopee-intelligence/super-anuncio-mockup.module.css`, `tests/super-analysis-layout.test.mjs` (2 testes novos), `docs/ENCICLOPEDIA_SHOPEE_GESTOR_SENIOR.md` (v10) e este arquivo. Branch: `claude/super-anuncio-cadeia`.

**O que mudou (só acréscimos, sem trocar a hierarquia aprovada do mockup):**
1. Faixa "leitura em cadeia" abaixo do resumo do anúncio: Custo → Preço → Margem → Vendas → ROAS atual, com cor e uma frase de leitura automática marcada como estimativa.
2. Sem custo cadastrado: aviso na faixa e botão "Cadastrar custo" (abre a aba Preço & Oferta Relâmpago).
3. Preço, Custo, Margem e Vendas viraram métricas principais (maiores); avaliação, fotos, vídeo e variações ficaram secundárias.
4. Faixa de cor lateral por função nas seções (retrato, comparação, ofertas relâmpago, próximas ações, resumo).
5. "Excluir análises" saiu de perto de "Acompanhar outro anúncio" e foi para "Gerenciar análise deste anúncio" no fim da página (o `window.confirm` foi mantido).
6. Comparação: "Primeira coleta" virou "Sem comparação (só 1 coleta)" (não era bug; só havia 1 coleta).

**Heurísticas (ajustáveis):** ROAS mínimo para não ter prejuízo com Ads = `100 / margem%` usando `finance_snapshot.marginPct` (margem após 20% Shopee, taxa fixa e custo); margem "apertada" abaixo de `MARGIN_TIGHT_PCT = 10`; ROAS "com folga" a partir de 1,3 × o mínimo. Tudo usa `dataText`/`missingKind`: sem dado aparece "Sem dados"/"Não coletado".

**Como foi validado:** `npm test` com 62 testes passando (2 novos, incluindo simulação dos casos de `chainVerdict`); sintaxe JSX conferida com o compilador TypeScript. **O `next build` NÃO foi rodado pelo Claude** (o registro npm do sandbox dele bloqueia downloads com 403); o build real fica com o GitHub Actions (PR para `main`) e com a Vercel. **O Claude não viu a tela renderizada.**

**Erros e atenções encontrados:**
- O commit `d1f1e14` gravou em `docs/ENCICLOPEDIA_SHOPEE_GESTOR_SENIOR.md` apenas a mensagem "The requested file reference is not currently visible…" (156 bytes) em vez do documento. Ao salvar arquivos no GitHub, conferir o conteúdo do arquivo depois do commit.
- `report.cpc` em `POST /api/pas/v1/homepage/query/` é custo **por pedido** (igual a `cpdc`), não por clique. CPC real = `cost / click`.
- `statistics.view_count` (Meus Produtos) tem janela de tempo desconhecida e não bate com `sold_count`; não dividir vendas por visualizações.
- Conflito aberto: `roi_target_setting.value` = 40,0 em `report/get_time_graph` enquanto a meta atual é 22,0.
- `uv`/`pv` em `GET /api/mydata/v4/product/performance/` (visitas por produto) são candidatos, ainda sem confirmação na tela.
- A branch `dev` está desatualizada (70 commits atrás da `main`, com 3 commits próprios); não foi usada.
- O sandbox do Claude não faz push para o GitHub; o envio foi feito pelo Chrome do usuário.

**Pendente:** painel de decisão com visitas (`uv`), conversão e qualidade do anúncio; tela de login com frase de valor e meta description (não adicionar "Esqueci minha senha" sem backend de recuperação, para não criar botão morto); seletor de anúncio junto do título só com aprovação explícita (regra em `docs/SUPER_ANALISE_LAYOUT_RULE.md`).

**Pedidos ao ChatGPT/Codex:** (1) revisar `chainVerdict`/`DecisionChain`; (2) confirmar se `finance_snapshot.marginPct` está em % (0–100) e já desconta comissão e taxa fixa; (3) comparar o DELTA de enciclopédia do ChatGPT com a seção v10 e listar divergências abaixo; (4) após o deploy, rodar o smoke test das rotas críticas e registrar o resultado.

### 2026-09-25 (noite) — Claude — Pós-deploy, smoke test e QA da tela Super Anúncio
**Deploys:** PR #13 (`bff3ceb`) e PR #14 (`5d15689`). Em ambos, a Vercel ficou Ready com o SHA igual ao HEAD da `main`. O GitHub Actions ("Dev validation") também passou (npm ci + testes + build).

**Smoke test em produção (Chrome logado):** `/`, `/super-analise`, `/protecao-roas` e as seções `super-anuncio`, `reanalises`, `prioridades`, `relatorios` e `shopee-ads` de `/extensao-shopee-intelligence` abrem sem erro e com conteúdo. `/produtos` redireciona para `/super-analise` (comportamento atual do app).

**Erro que o Claude introduziu (corrigido no PR #14):** ao aumentar a fonte das 4 métricas principais do topo para 16px, "R$ 19,00" e "Sem dados" ficaram cortados nas colunas de 74px. Lição: valores exibidos em grade estreita precisam ser medidos na página real (`scrollWidth > clientWidth`) antes de publicar; o teste de JSX/CSS por texto não pega isso.

**Correções da revisão de QA (esta leva):**
1. Editor embutido (abas Título, Descrição, Imagens, Categoria e Preço) aparecia espremido em colunas de 210px no desktop: `.embeddedScreen` em `app/super-analise/page.module.css` não desligava a grade `210px 1fr` da tela cheia (`.screen`). Agora `display:block!important;grid-template-columns:1fr!important`.
2. Alerta de Oferta Relâmpago: `.flashAttention>span` (28x28px em círculo) também pegava o contêiner `.flashAttentionActions`, e o botão "Lembrar depois" saía da caixa amarela. Corrigido com `.flashAttention>span.flashAttentionActions{...!important}`. Lição: regra genérica `>span` em contêiner com filhos diferentes.
3. Sino de notificações era botão morto (sem `onClick`) com ponto vermelho sempre ligado; agora leva a Prioridades e o ponto só aparece com tarefas pendentes do anúncio.
4. Busca: avisa quando nada é encontrado, volta ao resumo ao encontrar, e o texto deixou de prometer "produtos ou concorrentes" (só procura anúncios já acompanhados).
5. Esc agora fecha o zoom da imagem.
Testes: 64 passando (2 novos cobrindo os itens acima).

**Achados que NÃO foram alterados (para decisão):**
- `/api/tasks` é chamado 2x no mesmo segundo ao abrir a página (provável duplicidade entre componentes; ver item 2 deste arquivo).
- `/api/shopee/flash-sale` leva ~7s (latência da Shopee) e é refeito a cada vez que se abre a aba Preço; vale cachear por item por alguns minutos.
- Botões "Criar oferta ↗" e "Agendar agora ↗" usam ↗ mas abrem o editor na própria página.
- A troca de anúncio no seletor e todas as abas funcionam sem erro de console; a leitura em cadeia mostra "Sem dados" quando falta custo ou ROAS.
- Não foram clicados (gravam dados): Excluir análises, Criar oferta real, Aplicar sugestão, Remover/Substituir imagem, Lembrar depois, Criar lembrete.

### Respostas do ChatGPT/Codex
_(acrescente abaixo: data, o que revisou, divergências, erros encontrados)_



### 2026-09-26 — ChatGPT — Oferta Relâmpago: modo simples com fallback
- Evidência de produção: mesmo após corrigir host BR e parâmetros obrigatórios, `get_time_slot_id` respondeu HTTP 200 com `error: ""` e sem `response` para a loja testada.
- Decisão de UX: não bloquear mais o usuário em um calendário que depende desse retorno. A tela de Preço passa a consultar automaticamente os próximos 30 dias.
- Se a API retornar slots, o fluxo integrado continua disponível.
- Se a API retornar vazio, a tela entra em "Modo de compatibilidade" e oferece link direto para a ferramenta oficial `https://seller.shopee.com.br/portal/marketing/shop-flash-sale/list?type=0`.
- Preço, estoque e limite continuam visíveis no Gestor; nenhuma oferta é criada automaticamente sem confirmação.
- Arquivos: `app/super-analise/SuperAnaliseInteligente.js`, `app/super-analise/page.module.css`, `tests/super-analysis-layout.test.mjs`.


### 2026-09-27 — ChatGPT — Análise de Funil nativa
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, `app/components/AppShell.js`, testes de navegação/sidebar e este arquivo. Branch: `feature/funnel-analysis`.

**O que mudou:**
1. Nova rota nativa `/funil` e item “Análise de Funil” no menu, sem alterar espaçamento/altura da sidebar.
2. Funil por período (7/14/30 dias) usando apenas `/api/shopee/ads` e `/api/shopee/orders` já existentes; métricas ausentes aparecem como “—”.
3. Etapas: Impressões → Cliques → Carrinho (somente se a fonte trouxer) → Pedidos Ads; taxas CTR, clique→pedido, carrinho→pedido e impressão→pedido.
4. Diagnósticos não usam benchmark universal: comparam campanhas com a mediana da própria conta, além de sinalizar clique sem pedido.
5. Página inclui explicação simples do que cada vazamento costuma significar e links para Shopee Ads, Super Anúncio, Produtos e Pesquisa de Produtos.

**Validação planejada:** prebuild/testes via PR e preview Vercel antes de merge em `main`. Não foram criadas APIs novas nem números estimados.


### 2026-09-27 — ChatGPT — Funil completo via Informações Gerenciais
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, `tests/navigation-routes.test.mjs`, `docs/ENCICLOPEDIA_SHOPEE_GESTOR_SENIOR.md` (v11) e este arquivo. Branch: `feature/funnel-sellercenter-v2`.

**O que mudou:**
1. A página de Funil passou a pedir `sellerFunnel` ao Motor Sênior e usar os endpoints estruturados MyData da sessão normal do Seller Center.
2. Funil completo confirmado para hoje/tempo real: Impressões → Cliques → Visitantes → Carrinho → Pedido criado → Pago → Confirmado.
3. Nova aba por produto com diagnóstico relativo à mediana da própria loja; sem benchmark universal.
4. Nova aba de Fontes de Tráfego para Card/Busca, Live, Vídeo, Afiliados e Shopee Ads.
5. Histórico Ads de 7 dias foi mantido como camada complementar e fallback.
6. A UI avisa explicitamente quando a extensão ainda não suporta `sellerFunnel`; não preenche métricas ausentes com zero.
7. Enciclopédia promovida para v11 com os endpoints `key-metrics`, `realtime_metrics`, `product-rankings`, `traffic-sources`, `product-contribution` e `contribution-trend`.

**Extensão correspondente:** Motor Sênior v0.17.1. A coleta ocorre dentro de `seller.shopee.com.br`; cookies/tokens/`SPC_CDS` não são retornados ao Gestor nem documentados.

**Pendência:** os endpoints MyData foram confirmados com `period=real_time`. Não automatizar histórico 7/14/30 neles até mapear os parâmetros corretos; por isso o histórico continua vindo da integração Ads já existente.


### 2026-09-27 — ChatGPT — Plano de Destrave no Funil
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, `tests/navigation-routes.test.mjs`, `docs/ENCICLOPEDIA_SHOPEE_GESTOR_SENIOR.md` e este arquivo. Branch: `feature/funnel-action-plan`.

**O que mudou:** a aba Por Produto agora ordena produtos por prioridade e mostra “onde travou → por quê → evidência → o que fazer primeiro”, cobrindo atração (CTR), visita→carrinho, carrinho→pedido, pedido→pago e pago→confirmado. Produtos com baixo volume não recebem diagnóstico forte. A tabela numérica continua disponível recolhida.

**Heurística:** gargalo = taxa < 60% da mediana da própria loja, respeitando amostras mínimas (100 impressões para CTR; 10 UV para carrinho; 5 eventos nas etapas finais). O limiar é interno e ajustável, não oficial da Shopee.

**Regra de UX:** ações recomendadas devem corresponder à etapa. Ex.: gargalo pós-pagamento prioriza operação/estoque/expedição, não capa/título. Nenhuma recomendação promete resultado.


### 2026-09-27 — ChatGPT — Modos Padrão e Específico no Funil
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, `app/api/funnel/context/route.js`, testes, Enciclopédia e este arquivo. Branch: `feature/funnel-guidance-modes`.

**O que mudou:**
1. A aba Por Produto ganhou seletor persistente: **Padrão** ou **Específico · me diga o que fazer**.
2. O modo específico cruza o gargalo com a última Super Análise do mesmo `item_id`, até 3 concorrentes vinculados, preço, custo, margem e sugestões já coletadas.
3. Quando houver evidência suficiente, o card mostra um teste concreto, os valores usados e links dos concorrentes de referência.
4. Se faltar margem/custo/concorrentes, o sistema declara a limitação e não inventa um valor.
5. Nenhuma alteração de preço, anúncio ou Ads é aplicada automaticamente; são testes recomendados para o usuário executar.
6. Preferência de modo fica em `localStorage` apenas neste navegador.

**Segurança de decisão:** preço exato só aparece como teste quando o preço próprio, a mediana de concorrentes e uma margem cadastrada compatível dão suporte; caso contrário, o valor é apresentado como alvo de mercado que precisa de validação de margem.


### 2026-09-27 — ChatGPT — Funil visual baseado no mockup aprovado
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, testes e este arquivo. Branch: `feature/funnel-visual-mockup`.

**O que mudou:**
1. A aba Funil da Loja agora usa um funil visual vertical real, com 7 faixas afunilando: Impressões → Cliques → Visitantes → Carrinho → Pedido criado → Pago → Confirmado.
2. As taxas entre etapas aparecem ao lado do funil e a menor taxa válida é destacada automaticamente como **Maior gargalo**, com a perda calculada.
3. Abaixo do funil há cinco KPIs visuais: CTR, Visita→Carrinho, Carrinho→Pedido, Pedido→Pago e Pago→Confirmado. Nenhum delta histórico foi inventado.
4. O Plano de Destrave passou a aparecer também na aba principal, mostrando automaticamente o produto de maior prioridade, com o seletor Padrão/Específico já implementado.
5. O cabeçalho mostra **Hoje · tempo real**, porque os endpoints MyData históricos ainda não foram confirmados; o mockup tinha 30 dias, mas isso não foi reproduzido como dado falso.
6. Layout responsivo: no mobile o funil permanece vertical, as taxas viram cartões e os KPIs empilham.

**Regra mantida:** não inventar períodos, tendências ou conversões ausentes. O destaque do gargalo só usa taxas numéricas entre 0 e 1 que estejam realmente disponíveis.


### 2026-09-27 — ChatGPT — Funil histórico real de 7/30 dias
**Fonte:** capturas manuais Motor Sênior de Informações Gerenciais / Produto com `period=past7days` e `period=past30days`.

**O que mudou:**
1. A Análise de Funil passa a usar **30 dias como período padrão** e oferece **7 dias | 30 dias | Hoje**. 14 dias não foi liberado porque ainda não foi capturado.
2. O frontend envia `{period}` para a ação `sellerFunnel`; Motor Sênior v0.17.4+ é necessário para histórico.
3. Funil da loja deixou de somar UV/carrinho de produtos como se fossem usuários únicos da loja. Visitantes priorizam `key-metrics.shop_uv`; Carrinho prioriza `product/overview.atc_uv` e fica `—` se a fonte agregada não responder.
4. Pedido criado, Pago e Confirmado priorizam `place_orders`, `paid_orders` e `confirmed_orders` do `key-metrics`.
5. A tela ganhou comparação real com o período anterior usando `chain_ratio` para visitantes, pedidos pagos, GMV pago e confirmados.
6. Corrigido helper numérico do Funil: `null`/undefined/string vazia não viram mais zero.
7. Modo específico: preço exato agora também exige custo cadastrado, além da margem/mediana já exigidas.
8. Enciclopédia promovida para **v12**, registrando endpoints, períodos e séries históricas confirmadas.

**Mapeamentos históricos confirmados:** `/api/mydata/v3/dashboard/key-metrics/`, `/api/mydata/v3/dashboard/product-rankings/`, `/api/mydata/v2/product/overview/metric-trends/`, `/api/mydata/dashboard/order-performance/`, `/api/mydata/v1/dashboard/traffic-sources/product-contribution/`. `/api/mydata/v2/product/overview/` foi confirmado em 7 dias/ontem/tempo real e é fonte opcional para carrinho agregado; em 30 dias deve falhar para `—` se não responder.

**Regra:** não somar compradores/UV por produto para criar totais de loja; a mesma pessoa pode aparecer em vários produtos. Não inventar `past14days`.


### 2026-09-28 — ChatGPT — Card global de atividade do Motor Sênior
**Arquivos:** `app/lib/client-async.js`, `app/components/AppShell.js`, `app/app-shell.css`, testes e este arquivo. Branch: `feature/motor-activity-card`.

**O que mudou:**
1. Toda chamada feita por `motorRequest()` agora emite eventos locais `gs-motor-activity` com início, sucesso, timeout ou erro.
2. O AppShell exibe um card compacto fixo no **topo central** do Gestor, sem alterar o espaçamento/altura da sidebar.
3. O card traduz ações conhecidas em linguagem simples, por exemplo: “Coletando o funil de 30 dias no Seller Center…”, “Lendo dados do anúncio…”, “Atualizando dados do Shopee Ads…”.
4. Enquanto trabalha, mostra spinner e contador de segundos. Em sucesso mostra confirmação curta e some sozinho; em erro/timeout mostra a falha por alguns segundos.
5. O card é global e reutilizável por qualquer tela que use o Motor Sênior.

**Objetivo:** dar visibilidade do que a extensão está fazendo, especialmente no Android/Quetta, onde a ponte básica pode estar conectada mas a ação no Seller Center pode travar.


### 2026-09-28 — ChatGPT — Progresso por etapas + otimização Quetta
**Site:** o protocolo Gestor ↔ Motor passa a aceitar mensagens intermediárias `GS_ENGINE_PROGRESS`. O card do topo atualiza texto e percentual sem encerrar a requisição.

**Extensão v0.17.5:** a coleta `sellerFunnel` foi ajustada para Android/Quetta:
- timeout individual por API MyData (8–9s), evitando uma única chamada pendurada bloquear toda a coleta;
- coleta de métricas gerais em paralelo;
- ranking de produtos: primeira página descobre o total e as demais são coletadas em lotes paralelos de até 4 páginas;
- progresso enviado nas etapas: localizar Seller Center → aguardar página → métricas gerais → produtos → normalização → envio ao Gestor;
- falha de uma fonte opcional vira entrada em `errors` e não impede o restante do funil, mantendo a regra de não inventar dados.

**Objetivo:** reduzir o timeout de 60s observado no Quetta e, se ainda houver gargalo, mostrar exatamente em qual etapa a coleta parou.


### 2026-09-28 — ChatGPT — Redesign completo do Funil por Produto
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, testes e este arquivo. Branch: `feature/funil-produto-mockup`.

**O que mudou:**
1. O layout antigo da aba **Por Produto** foi removido da renderização principal e substituído pelo mockup aprovado.
2. Cada produto agora tem um **mini funil visual** com etapas reais: Impressões → Cliques → Visitas → Carrinho → Pedido → Pago, com valor e taxa entre etapas.
3. O card mostra status visual **CRÍTICO / ATENÇÃO / SAUDÁVEL / POUCOS DADOS**, mantendo a lógica determinística já existente do `productPlan`.
4. O diagnóstico ganhou bloco visual “Maior gargalo”, evidência real e explicação simples.
5. “Faça assim” mostra até 3 ações concretas da orientação atual; no modo específico continua cruzando contexto real de Super Análise, preço, custo, margem e concorrentes.
6. Um concorrente de referência aparece de forma compacta quando há concorrente real vinculado; se não houver, a UI informa isso em vez de inventar.
7. CTA de ação permanece ligado ao destino real já definido pelo plano (Comparar mercado, Avaliar tráfego, revisar anúncio etc.).
8. Desktop usa funil + diagnóstico lado a lado; mobile empilha os blocos e preserva legibilidade.
9. A tabela completa de números continua disponível recolhida no fim da aba para auditoria.

**Importante:** o redesign é visual/estrutural; não mudou fonte de dados, heurísticas, período histórico nem regras de segurança.


### 2026-09-28 — ChatGPT — Calculadora inline de preço no Funil por Produto
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, `app/api/funnel/context/route.js`, nova rota `app/api/shopee/product-price/route.js`, `lib/shopee.js`, testes e este arquivo. Branch: `feature/funil-inline-calculadora`.

**O que mudou:**
1. Recomendações de preço/oferta/concorrente na aba **Por Produto** ganham botão **Abrir calculadora** dentro do próprio card, sem sair do Funil.
2. Ao abrir, o Gestor carrega automaticamente o que já conhece: custo salvo, preço atual/final, dados Ads do último snapshot, concorrentes vinculados e variações; consulta também `/api/shopee/flash-sale` para identificar oferta ativa/agendada e variações atuais da loja.
3. Ads por pedido é calculado apenas quando há gasto Ads e pedidos Ads atribuídos: `gasto ÷ pedidos Ads`. Sem atribuição suficiente aparece indisponível.
4. O concorrente com maior número de vendidos entre os concorrentes vinculados é usado como referência; a UI lista **todas as variações e preços coletados** desse anúncio, sem afirmar qual variação vende mais.
5. Logo ao lado/abaixo aparecem **Minhas variações**, com preço atual, eventual variação equivalente do concorrente, campo de novo preço e margem estimada.
6. Pareamento de variações tenta nome exato normalizado e depois similaridade simples; quando não há equivalência, não inventa correspondência.
7. A referência de preço competitivo usa preço do concorrente líder ou mediana dos concorrentes e só vira sugestão automática quando custo disponível + fórmula financeira atual + Ads disponíveis deixam lucro positivo. Não há subcotação arbitrária.
8. Fórmula segue a regra financeira já usada no projeto: preço − 20% Shopee − taxa fixa R$ 4,50 − custo − Ads por pedido. É mostrada como estimativa, não como valor contábil definitivo.
9. Foi adicionada integração oficial `/api/v2/product/update_price` por uma rota protegida do Gestor. O usuário precisa clicar **Salvar novo preço** e confirmar; nada é alterado automaticamente.
10. Para produto em Oferta Relâmpago, o painel avisa que alterar o preço normal não substitui automaticamente o preço promocional da campanha selecionada.
11. Após salvar, a rota relê preço/modelos e só confirma sucesso se o valor persistido bater com o enviado.

**Regra de segurança:** nunca enviar preço sem clique/confirm explícito; nunca preencher custo, Ads, margem, preço concorrente ou variação ausente com estimativa inventada.


### 2026-09-28 — ChatGPT — Custos, ofertas, taxas e colunas configuráveis em Produtos
**Arquivos:** `app/produtos/ProductsDashboard.js`, `app/produtos/products.module.css`, `app/super-analise/page.js`, novas rotas `app/api/products/manage/route.js` e `app/api/shopee/marketing-discounts/route.js`, `lib/shopee.js`, testes e este arquivo. Branch: `feature/produtos-custos-colunas-taxas`.

**O que mudou:**
1. A lista inicial da Super Análise mostra um popup diário quando existem produtos sem custo, explicando que custo é necessário para margem, precificação e Funil. O botão **Cadastrar custos agora** garante que a coluna Custo esteja visível e leva à tabela.
2. **Custo do produto** e **Estoque** viraram colunas editáveis. Produto simples pode ser salvo inline; produto com variações abre editor por variação com custo e estoque.
3. Custos são persistidos em `product_costs`; estoque é enviado à Shopee somente após ação explícita do usuário via `v2.product.update_stock`.
4. A tabela ganhou **Opções de exibição** para mostrar/esconder Status, Preço/Oferta, Custo, Margem e Estoque. Produto e Ações permanecem fixos.
5. **Preço / Oferta** mostra preço cheio e somente oferta de campanha de desconto da loja obtida pelo módulo oficial `discount` (`get_discount_list` + `get_discount`). Oferta Relâmpago não entra nesse cálculo nem nessa coluna.
6. O botão **Configurar taxas** permite ajustar as faixas usadas no cálculo de margem. Preferências de taxas e colunas ficam salvas neste navegador.
7. Padrão pesquisado em 28/09/2026: abaixo de R$ 8 usa comissão 20% + tarifa proporcional de 50% do preço; R$ 8–79,99 usa 20% + R$ 4 até 30/09/2026 e R$ 4,50 a partir de 01/10/2026; R$ 80–99,99 usa 14% + R$ 16; R$ 100–199,99 usa 14% + R$ 20; R$ 200+ usa 14% + R$ 26. Foi incluído campo opcional para adicional de campanha, default 0%, pois isso pode variar por conta/campanha.
8. Margem da tabela usa o preço final da campanha de marketing quando uma oferta da loja estiver ativa; sem oferta usa preço normal. Para produtos com variações, a tabela não inventa uma margem agregada sem preço/custo correspondentes; o usuário abre o editor por variação.

**Segurança:** nenhum custo ou estoque é inventado; nenhuma alteração de estoque ocorre sem clique do usuário. As taxas são configuráveis porque políticas/condições da conta podem divergir do padrão público.


### 2026-09-28 — ChatGPT — Editor inline de título no Funil por Produto
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, `app/api/funnel/context/route.js`, testes e este arquivo. Branch: `feature/funil-editor-titulo-inline`.

**O que mudou:**
1. Quando uma orientação do Funil envolve **título / palavra-chave**, aparece o botão **Editar título** dentro do próprio card do produto.
2. O editor abre inline, sem sair do Funil, seguindo o mockup aprovado: Título atual × Título sugerido, justificativa, palavras-chave, concorrentes usados como base, campo editável e ações.
3. A sugestão automática **não é inventada no frontend**: o contexto do Funil passa a expor `report.ai_analysis.title.suggestion` da última Super Análise do mesmo item. Se a Super Análise não tiver sugestão estruturada, o editor informa isso e pede atualização da Super Análise.
4. Palavras-chave mostradas no editor usam primeiro as keywords estruturadas da Super Análise (quando existirem) e complementam com termos recorrentes nos títulos reais dos concorrentes vinculados + título sugerido/atual. Não há consulta genérica externa nem palavras inventadas.
5. O bloco “Concorrentes usados como base” mostra até 3 concorrentes vinculados, com título, preço, vendas, imagem e link quando disponíveis.
6. O título sugerido entra pré-preenchido no campo de edição e o usuário pode ajustar antes de aplicar.
7. **Aplicar no anúncio** reutiliza a rota real `/api/shopee/product-update`, que já publica `item_name` pela Shopee Open Platform e relê o item para confirmar persistência.
8. Há confirmação explícita antes do envio; nada é aplicado automaticamente.
9. Limite do editor segue a implementação real atual de publicação: 120 caracteres. Se o título não mudar ou estiver vazio, o botão de publicação não prossegue.
10. Ao abrir o editor de título, a calculadora de preço do mesmo card é recolhida e vice-versa, evitando dois editores concorrentes no mesmo produto.

**Regra de evidência:** ausência de Super Análise/concorrentes/keywords aparece como indisponível; não gerar uma sugestão improvisada apenas para preencher o card.


### 2026-09-28 — ChatGPT — Super Análise como porta de entrada do Funil por Produto
**Arquivos:** `app/super-analise/page.js`, `app/produtos/ProductsDashboard.js`, `app/produtos/products.module.css`, `app/funil/page.js`, `app/funil/funil.module.css`, testes e este arquivo. Branch: `feature/super-analise-funil-status-redesign`.

**O que mudou:**
1. O design anterior da tabela de produtos dentro da Super Análise foi substituído pelo mockup aprovado, mantendo as funções de custo, estoque, ofertas, margem, taxas e opções de exibição.
2. A tabela ganhou a coluna fixa **Funil de vendas** com três estados reais:
   - **Disponível**: existe Super Análise com até 30 dias;
   - **Análise antiga**: a última Super Análise tem mais de 30 dias;
   - **Indisponível**: nunca passou pela Super Análise.
3. Ações da coluna: **Abrir Funil**, **Reanalisar** ou **Fazer Super Análise** conforme o estado.
4. O topo da lista mostra uma faixa explicando a regra e três cards quantitativos: disponíveis, pendentes e análises antigas.
5. A idade da análise é calculada no servidor a partir de `extension_analysis_reports.analyzed_at`; nenhum status é inventado no cliente.
6. A aba **Funil por Produto** agora filtra a lista: só renderiza produtos que possuem contexto da Super Análise com `analyzedAt` de até 30 dias.
7. O Funil da Loja continua usando métricas agregadas da Shopee; a restrição é aplicada às recomendações/ações **por produto**, que dependem de concorrentes e Super Análise.
8. O botão **Abrir Funil** usa `/funil?tab=produto&item_id=<id>`; a página abre a aba Por Produto e prioriza o item solicitado.
9. Produtos sem análise recente não aparecem nos cards de ação por produto; o Funil mostra aviso e link para gerenciar a Super Análise.
10. O CSS da tabela foi refeito do zero para seguir o novo mockup, sem alterar o espaçamento da sidebar global.

**Regra de produto:** o Funil por Produto exige Super Análise recente porque editores contextuais (preço, título e futuros cards) dependem das evidências e concorrentes vinculados. Não preencher contexto ausente com inferência.


### 2026-09-28 — ChatGPT — Landing da Super Análise sem etapas antes do início
**Arquivos:** `app/super-analise/SuperAnaliseWorkspace.js`, `app/produtos/ProductsDashboard.js`, `app/produtos/products.module.css`, testes e este arquivo. Branch: `feature/super-analise-landing-funil`.

**O que mudou:**
1. A tela inicial de **Super Análise** não renderiza mais o fluxo guiado nem a barra de etapas antes de o usuário escolher um produto.
2. A landing agora começa direto com o cabeçalho **Super Análise**, o aviso do Funil por Produto, os cards de resumo e a tabela de produtos, conforme o mockup aprovado.
3. A barra de etapas do `WebAuditFlow` continua intacta, porém só aparece depois que o usuário clica em **Enviar para Super Análise** e a URL recebe `start_url/start_item_id`.
4. A landing ganhou quatro cards: **Produtos analisados**, **Disponíveis no Funil**, **Pendentes** e **Precisam reanálise**.
5. A coluna **Funil de vendas** mantém três estados reais: Disponível, Análise antiga e Indisponível. Indisponível agora mostra somente a orientação para fazer a Super Análise; não duplica um segundo botão dentro da mesma coluna.
6. A coluna **Ações** usa o botão amarelo **Enviar para Super Análise** em todas as linhas, seguindo o mockup.
7. Nenhum aviso do tipo “As etapas da Super Análise aparecem...” foi adicionado.
8. Regras existentes de disponibilidade continuam: análise recente até 30 dias = disponível; acima de 30 dias = reanalisar; sem análise = indisponível.

**Importante:** o fluxo interno da Super Análise, coleta, custos, concorrentes e publicação não foi alterado; apenas o momento em que a UI do fluxo aparece.


### 2026-09-28 — Claude — Tabela de Produtos: cabeçalhos ordenáveis, título com clamp e botão Reanalisar
**Arquivos:** `app/produtos/ProductsDashboard.js`, `app/produtos/products.module.css`, `tests/navigation-routes.test.mjs` (5 testes novos) e este arquivo. Branch: `feature/produtos-tabela-ordenavel`.

**O que mudou (só na tabela de Produtos/Super Análise, layout geral preservado):**
1. Removido o seletor **Ordenar** (Nome/Menor preço/Maior preço/Maior estoque/Maior margem); os filtros restantes (Buscar produto, Status do anúncio, Por página, Atualizar da Shopee, Configurar taxas, Opções de exibição) ocupam o espaço liberado (`.controls` de 3 para 2 colunas de filtro).
2. Todos os cabeçalhos (exceto Ações) ficaram clicáveis: `Produto`, `Status`, `Preço / oferta`, `Custo`, `Margem`, `Estoque`, `Funil de vendas`, com indicador `↕`/`🔺`/`🔻`. Primeiro clique ordena crescente; clique de novo no mesmo cabeçalho inverte; clicar em outro cabeçalho troca a coluna ativa direto para crescente.
3. Ordenação real por coluna: Produto = alfabética; Status = texto real; Preço/oferta = preço final de campanha quando ativa, senão preço normal (Oferta Relâmpago nunca é usada aqui); Custo = custo cadastrado (produto simples) ou custo mínimo entre variações; Margem = % de margem já exibida; Estoque = numérico; Funil de vendas = prioridade Disponível > Análise antiga > Indisponível. Custo/Margem/Estoque/Preço ausentes sempre vão para o fim da lista, em qualquer direção.
4. Título do produto agora quebra em no máximo 2 linhas com reticências (`-webkit-line-clamp:2`), com `max-width` na célula para a coluna não crescer indefinidamente; miniatura e linha do ID abaixo do título foram preservadas.
5. Coluna Ações: produto nunca analisado mostra **Enviar para Super Análise**; produto já analisado (Disponível ou Análise antiga) mostra **Reanalisar** — nunca mais os dois ao mesmo tempo. O botão "Reanalisar" da coluna Funil de vendas (para Análise antiga) permanece como estava antes (duplicação intencional, confirmada pela leitura literal do pedido do usuário).
6. "Reanalisar" continua chamando `sendToAnalysis(item)`, que sempre entra pelo fluxo guiado da Super Análise; a persistência é um `INSERT` novo em `extension_analysis_reports` (nunca update/upsert), então cada reanálise vira uma linha própria e o histórico anterior nunca é apagado — comportamento já existente, sem mudança de código, só travado com teste novo.

**Não alterado de propósito (já corretos, confirmados por leitura de código antes de mexer):** fórmula/cálculo de margem (`marginFor`/`grossMargin`); estados visuais da coluna Funil de vendas (badges e botão "Abrir Funil"/"Reanalisar"/texto para Indisponível); espaçamento/altura da sidebar; layout geral da página.

**Como foi validado:** `node --test tests/*.test.mjs` → 101/101 passando (5 testes novos cobrindo: seletor Ordenar removido, ordenação por cabeçalho, regra de dado ausente no fim da lista, clamp de 2 linhas do título, lógica do botão Ações, preservação de histórico via INSERT). Sintaxe de `ProductsDashboard.js` validada com `tsc --noEmit --allowJs --jsx react-jsx` (exit 0, já que `next build` continua bloqueado neste sandbox por 403 no registro npm). Balanceamento de chaves do CSS conferido à parte. A lógica de ordenação (`compareRows`/`sortValue`/`toggleSort`) foi reimplementada e executada isoladamente contra dados sintéticos para confirmar o comportamento real, não só o texto-fonte.

**Publicação (concluída nesta sessão):** os 4 arquivos foram publicados via editor web do GitHub na branch `feature/produtos-tabela-ordenavel` (commits `0913f5a`, `fd233bb`, `16ae702`, `d6cd651`), cada um verificado por hash SHA-256 (conteúdo decodificado no navegador == `sha256sum` local) antes do commit. PR #45 aberto, todos os checks passaram (Vercel build + 2 checks) e mesclado via "Merge pull request" em `main`, gerando o commit `61fb1f1`. Branch de feature apagada depois do merge. `git fetch origin main` confirmou `origin/main` == `61fb1f1` e o checkout local (`main`) foi atualizado por fast-forward para o mesmo commit.

**Verificação Vercel (Regra 16):** deployment de produção `dpl_2F38Htse4rQ2YgWjbzdp6hyg4fqi` (projeto `shopeeos-real`) com `state`/`readyState` = `READY`, `target` = `production`, `meta.githubCommitSha` = `61fb1f1ac3a86ca08c52592e44e74efc35da237f` — idêntico ao `origin/main`/checkout local. Alias de produção: `shopeeos-real.vercel.app`. (Nota lateral: os deployments dos commits intermediários `fd233bb` e `16ae702` retornaram `state=ERROR` — esperado, pois o `prebuild` roda os testes novos que só passam a bater com o código a partir do commit final `d6cd651`; não indica problema real, já que o commit final antes do merge e o commit de merge buildaram `READY`.)

**Smoke test das rotas críticas:** todas as 9 rotas (`/`, `/produtos`, `/super-analise`, as 5 variações de `/extensao-shopee-intelligence?section=...`, `/protecao-roas`) responderam com redirecionamento (nenhum erro 500) para `/login`, confirmando que o app exige autenticação e que o build não quebrou nenhuma rota.

**Pendente (bloqueado por falta de credenciais):** checagem visual ao vivo do clamp de título, dos cabeçalhos ordenáveis e do botão Reanalisar em `/produtos`, incluindo viewport mobile — não foi possível porque a página exige login e esta sessão não tem as credenciais da conta (entrar com senha real não é uma ação que a Claude deve realizar sozinha). Fica para o usuário confirmar visualmente após login, ou fornecer credenciais de teste numa próxima sessão.


### 2026-09-28 — ChatGPT — Canal oficial de atualização do Motor Sênior v0.17.6
**Arquivos:** `app/api/extension/latest/route.js`, `app/motor-senior/page.js` e este arquivo. Branch: `feature/motor-senior-updater-v0176`.

**O que mudou:**
1. O Gestor ganhou o manifesto oficial `GET /api/extension/latest`, hoje apontando para a versão **0.17.6**.
2. O manifesto informa versão, nome, arquivo esperado, notas, data de publicação e página oficial de atualização.
3. Foi criada `/motor-senior` como página estável para o fluxo de atualização do Motor.
4. O ZIP v0.17.6 foi gerado fora do repositório a partir da v0.17.5 e validado com `unzip -t`; ele adiciona verificação automática a cada 6 horas, ao instalar e ao iniciar, notificação de nova versão e painel de atualização no `engine-status.html`.
5. A extensão compara semanticamente a versão instalada com a publicada pelo Gestor e só avisa quando a publicada for superior.
6. Como a extensão é instalada manualmente por ZIP/unpacked, ela **não substitui os próprios arquivos silenciosamente**. O aviso abre a página oficial do Gestor para atualização; o usuário continua responsável por instalar/recarregar a nova versão.
7. O binário ZIP não foi commitado neste repositório nesta sessão; o canal de versão e a página oficial ficam no Gestor. Não afirmar que o ZIP está hospedado no Vercel até existir um artefato persistente lá.


### 2026-09-28 — ChatGPT — Refinamento do Funil por Produto a partir do teste visual
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, `app/api/funnel/context/route.js`, testes e este arquivo. Branch: `feature/funil-produto-ux-e-dados`.

**Problemas observados no print e correções:**
1. A calculadora mostrava preço/custo como ausentes porque dependia quase só do snapshot da última Super Análise. Ao abrir a calculadora, ela agora consulta `/api/products/manage?item_id=` para obter preço, modelos e custos atuais do produto.
2. O contexto do Funil agora também cruza `product_costs`, então o modo específico consegue usar custo cadastrado mesmo quando o snapshot antigo não o continha.
3. O bloco “Campanha / Oferta” usava Oferta Relâmpago apesar do texto sugerir campanha de marketing. A calculadora passou a consultar `/api/shopee/marketing-discounts` e exibe a campanha/desconto vigente; Oferta Relâmpago não é tratada como campanha de marketing.
4. A fórmula inline estava fixa em 20% + R$ 4,50. Foi alinhada às faixas já usadas na tela Produtos: abaixo de R$8, R$8–79,99, R$80–99,99, R$100–199,99 e R$200+, incluindo R$4 até 30/09/2026 e R$4,50 a partir de 01/10/2026.
5. A calculadora lê a configuração salva em `gs_shopee_fee_config_v1`, evitando divergência com as taxas configuradas pelo usuário na tela Produtos.
6. A área de comparação por variações ficou recolhida em `details` por padrão. Isso reduz bastante a altura do card; o usuário abre apenas quando realmente vai comparar/editar variações.
7. O resumo da calculadora passou para 3 colunas no desktop, 2 em telas médias e 1 no mobile, com textos maiores/menos espremidos.
8. O título do produto no card foi limitado visualmente a duas linhas.
9. A imagem principal ganhou fallback para o favicon quando a URL da Shopee falhar, evitando o ícone de imagem quebrada observado no print.
10. O ícone quadrado sem função no rodapé do card foi removvido; o CTA principal continua ocupando a largura útil.
11. Nenhum preço é alterado automaticamente. O botão de salvar continua exigindo confirmação explícita e usa a rota oficial existente de atualização de preço.


### 2026-09-28 — ChatGPT — Correção da imagem no card do Funil por Produto
- O card usava somente `p.image` vindo de `sellerFunnel`; essa fonte de métricas pode não fornecer URL de imagem.
- `/api/funnel/context` já expunha `image` do `product_snapshot` da Super Análise, mas o card não a utilizava.
- O card agora usa `p.image || productContext.image || /favicon.ico` e mantém fallback em erro de carregamento.


### 2026-09-28 — ChatGPT — Curadoria do mapeamento Seller Center / Descontos
- Fonte: ZIP Motor Sênior v0.17.6, sessão passiva em Central de Marketing/Desconto.
- 120 capturas, 67 rotas únicas, zero erros.
- Enciclopédia promovida para curadoria v13 com 9 endpoints de negócio do módulo Desconto e 7 auxiliares.
- Confirmadas duas escritas internas: `update_discount` (nome/período) e `update_seller_discount_items` (preço promocional por SKU).
- Confirmados leitura detalhada por campanha/SKU, métricas, limite ativo, validação de misleading discount e verificação de overlap.
- Não persistir/reutilizar SPC_CDS, cookies ou tokens capturados; chamadas internas devem ocorrer pelo Motor na sessão normal do Seller Center.


### 2026-09-28 — ChatGPT — Integração operacional da Enciclopédia v13 (Descontos)
**Site:** `app/funil/page.js`, `app/funil/funil.module.css`, `app/produtos/ProductsDashboard.js`, `app/super-analise/WebAuditFlow.js`, `app/api/funnel/context/route.js`, manifesto do Motor e testes.
**Motor:** artefato local v0.17.7 gerado a partir da v0.17.6.

1. O Motor v0.17.7 ganhou a ação somente-leitura `sellerDiscounts`, executada dentro da sessão normal do Seller Center. Ela usa `discount/list` para campanhas em andamento e `get_discount_items_aggregated` para detalhar preço normal/promocional, faixa de oferta, modelos/SKUs, estoque promocional e vendas observadas.
2. `collectProduct` passa a enriquecer o produto com `marketingDiscount`; a Super Análise mostra preço cheio/oferta ativa e o snapshot histórico preserva a campanha daquela rodada.
3. Funil/Calculadora consulta em paralelo: produto atual, fonte oficial de descontos e `sellerDiscounts`. Prioridade: Motor detalhado → integração oficial → snapshot da Super Análise. Se o Motor antigo não reconhecer a ação, o fallback oficial continua funcionando.
4. A Calculadora exibe faixa de oferta e, quando disponível, preço cheio → promocional por variação e estoque promocional. Nenhuma escrita em campanha foi habilitada nesta etapa.
5. Produtos/Super Análise também enriquecem a coluna Preço/Oferta via Motor, mantendo a API oficial como fallback.
6. O contexto do Funil expõe `marketingDiscount` salvo no histórico, permitindo usar a campanha observada na reanálise mesmo quando a leitura ao vivo estiver temporariamente indisponível.
7. O manifesto oficial do Motor foi atualizado para v0.17.7.
8. Guardrail mantido: SPC_CDS/cookies/tokens nunca saem da extensão; somente dados de negócio normalizados retornam ao Gestor.
9. As APIs de escrita mapeadas na v13 (`update_discount`, `update_seller_discount_items`) continuam DESABILITADAS até existir UI explícita de revisão/confirmar + releitura pós-escrita.


### 2026-09-28 — ChatGPT — Funil da Loja: modo “Específico · me diga o que fazer”
**Arquivos:** `app/funil/page.js`, `app/funil/funil.module.css`, testes e este arquivo.

1. O seletor já existente no Plano de Destrave da aba Funil da Loja agora tem comportamento realmente diferente no modo específico. O modo Padrão foi preservado.
2. Em “Específico · me diga o que fazer”, o Gestor usa o maior gargalo agregado já exibido no funil e calcula, produto a produto, a taxa correspondente àquela transição.
3. Os produtos são priorizados pelo gap contra a mediana dos próprios produtos da loja ponderado pelo volume da etapa. Esse número é usado somente para ordenar oportunidade de investigação; a UI deixa explícito que não é previsão de vendas.
4. O painel dá três ações em ordem, coerentes com a etapa: CTR prioriza capa/título/oferta de busca; Visita→Carrinho prioriza oferta/página; Carrinho→Pedido prioriza preço final/cupom/frete/estoque; Pedido→Pago evita mexer em capa/título; Pago→Confirmado prioriza operação.
5. Mostra até 3 produtos para começar, com taxa real do produto, referência mediana e volume observado.
6. Quando o produto possui contexto de Super Análise, a primeira ação é enriquecida pelo `specificPlan` já existente (concorrentes, preço, margem e sugestões). Sem Super Análise, a UI informa que falta esse contexto e não inventa uma alteração exata.
7. O botão de cada produto abre a aba Por Produto e coloca aquele item no topo do plano. “Ver todos” abre a aba Por Produto.
8. Nenhuma alteração é aplicada automaticamente. O painel é diagnóstico/ordenação de ações.
9. Layout responsivo: 3 colunas no desktop e 1 coluna abaixo de 900px, com ajustes adicionais no mobile.


### 2026-09-28 — ChatGPT — Funil da Loja alinhado visualmente ao Funil por Produto
1. O card principal da aba Funil da Loja foi refeito para usar a mesma linguagem visual aprovada no Funil por Produto: cabeçalho compacto, borda lateral de status, funil à esquerda e diagnóstico à direita.
2. O funil da loja continua usando exatamente os agregados já existentes, agora em 7 faixas compactas: Impressões, Cliques, Visitas, Carrinho, Pedido, Pago e Confirmado. Volume e taxa de passagem ficam visíveis na mesma linha.
3. O maior gargalo permanece calculado pelas taxas reais disponíveis; o diagnóstico agora aparece em um card equivalente ao diagnóstico do produto, com taxa de passagem e perda.
4. À direita foi adicionado um resumo “Passagem por etapa”, destacando visualmente o pior ponto sem remover os KPIs detalhados existentes abaixo.
5. O Plano de Destrave e o modo “Específico · me diga o que fazer” foram preservados integralmente abaixo do funil.
6. O layout é responsivo: duas colunas no desktop, uma coluna em telas menores, mantendo leitura confortável no celular.
7. Nenhuma fonte, cálculo de negócio, API ou sidebar foi alterada nesta mudança; foi uma reorganização visual do funil da loja.


### 2026-09-29 — ChatGPT — Curadoria Motor Sênior: Oferta Relâmpago da Loja
- Fonte: `Motor-Senior-Mapeamento-2026-09-29.zip`, Motor v0.17.7, captura passiva de fluxo manual real no Seller Center BR.
- Sessão: 102 capturas, 61 combinações método+rota, 15 rotas de negócio Marketing, 0 erros.
- Enciclopédia promovida para v14 com o fluxo completo de Oferta Relâmpago da Loja.
- Confirmados: elegibilidade da loja/produto, slots reais, criação por `timeslot_id`, seletor estruturado de produtos, validação em lote, GraphQL de variações/estoque, gravação de itens por variação, validação de misleading discount, sequência dos itens, ponte opcional para Ads, métricas e releitura final.
- Escritas confirmadas: `set_shop_flash_sale`, `set_shop_flash_sale_items`, `set_item_sequence`.
- Descoberta crítica: a criação é em duas fases. Primeiro cria o contêiner pelo `timeslot_id` e recebe `flash_sale_id` + janela autoritativa; depois grava as variações/preço/estoque. O Gestor deve reler a Shopee antes de declarar sucesso.
- Foi observada reserva progressiva de estoque por variação nas releituras GraphQL.
- Segurança: a exportação bruta pode carregar SPC_CDS no campo URL; nunca copiar token/cookie/identificador de sessão para docs, banco, logs públicos ou commits.


## 2026-09-28 — Motor Sênior v0.17.8 / Messenger Shopee
- ChatGPT criou a extensão v0.17.8 a partir da v0.17.7, preservando os módulos existentes.
- Novas ações do Motor: `shopeeMessengerList`, `shopeeMessengerHistory` e `shopeeMessengerSendText`.
- Lista e histórico usam a sessão local autenticada do Seller Center/WebChat; nenhum cookie/token foi fixado no pacote ou enviado à Vercel.
- Histórico também tenta enriquecer a conversa com comprador e, quando há vínculo, pedido e produto.
- IMPORTANTE: `shopeeMessengerSendText` está deliberadamente em fail-closed. O mapeamento disponível capturou integralmente envio de sticker, mas não o POST completo de uma mensagem de texto normal. Não inferir esse payload. Capturar primeiro um envio de texto real no WebChat.
- Automação de pagamento aprovado é tecnicamente planejada, mas não deve disparar até o envio de texto estar confirmado e haver idempotência. `to_pay` não deve ser chamado de carrinho abandonado.
- O manifesto oficial `/api/extension/latest` e a página `/motor-senior` foram atualizados para v0.17.8.


## 2026-09-28 — Motor Sênior v0.17.9 / Diagnóstico da Pesquisa de Produtos
- ChatGPT rastreou o fluxo marketplaceSearch -> shopee-parser -> Gestor e encontrou perda de campos em dois pontos.
- No Motor, apiItem() reduzia a resposta da busca e não aproveitava aliases já conhecidos no item_card_displayed_asset.
- Na v0.17.9, a busca aproveita historical_sold_count, monthly_sold_count, shop_location, aliases de rating/reviews e preferred quando presentes.
- marketplaceSearch agora retorna diagnostics.coverage e diagnostics.detectedPaths, sem cookies/tokens/PII.
- No Gestor, normalizeOne() passou a aceitar row.reviewCount e row.shopLocation.
- A UI foi renomeada de “Qualidade da coleta” para “Cobertura dos dados” e ganhou “Diagnóstico da coleta”, comparando Motor x Gestor por campo.
- Interpretação: Motor > Gestor indica falha de normalização; Motor = 0 indica que o campo não veio da busca e deve ser investigado/enriquecido, sem inventar zero.

- Correção adicional v0.17.9: directSearch agora respeita o número da página da URL e converte em offset `newest` (0, 60, 120...), evitando repetir o primeiro lote em pesquisas Padrão/Profunda.
- Fallbacks textuais de vendas também usam os textos compactos exibidos pela Shopee quando o campo numérico estruturado não existir.

- PR #60 foi validado e incorporado ao main; a próxima pesquisa com Motor v0.17.9 deve ser usada para confirmar a cobertura real por campo.


### 2026-09-29 — ChatGPT — Funil desacoplado da coleta do Motor
- Corrigida a elegibilidade do Funil por Produto: a fonte de verdade agora é a Super Análise salva em `extension_analysis_reports`, não a presença do produto em `sellerFunnel.products`.
- `/api/funnel/context` sem `item_ids` passa a listar o contexto recente da loja; com IDs mantém o comportamento filtrado.
- Produtos com Super Análise recente (até 30 dias) continuam aparecendo no Funil mesmo se o Motor/Seller Center não devolver métricas naquele momento.
- Quando faltar a coleta do Motor, o produto permanece disponível com métricas ausentes, permitindo distinguir “produto analisado” de “métrica temporariamente indisponível”.
- O Motor continua responsável por complementar Impressões, Cliques, Visitas, Carrinho, Pedido, Pago e Confirmado; ele não decide mais se um anúncio analisado existe no Funil.


### 2026-09-29 — ChatGPT — painel Saúde do Sistema em Configurações
**Arquivos:** `app/UtilityNative.js`, `app/utility-native.module.css`, `app/api/system-health/route.js`.

**O que mudou:**
1. Configurações ganhou o card “Saúde do Sistema”, com diagnóstico rápido automático e botão manual “Executar diagnóstico agora”.
2. O painel mostra status por módulo/dependência com verde, amarelo, vermelho, detalhe da falha e horário da última verificação.
3. O backend `/api/system-health` valida conexão da loja, Supabase e tabelas principais da Super Análise, concorrentes, tarefas e preferências sem expor credenciais.
4. O navegador valida o handshake real com o Motor Sênior e o endpoint de contexto do Funil.
5. O diagnóstico manual profundo chama `sellerFunnel` em modo somente leitura para o período “Hoje”, permitindo validar a cadeia do Funil de ponta a ponta sem alterar preço, estoque, ROAS ou anúncios.
6. O status não inventa sucesso: quando uma dependência falha ou não está disponível, o módulo aparece como falha/atenção e mostra qual teste quebrou.

**Cuidados:** o diagnóstico rápido não dispara coleta pesada no Seller Center; a coleta real do Funil só ocorre por ação explícita no botão de diagnóstico.


### 2026-09-29 — ChatGPT — correção final do build após Saúde do Sistema
**Causa raiz:** o `prebuild` executava `tests/navigation-routes.test.mjs`, e o teste “Análise de Funil possui modos padrão e específico com evidências reais” ainda exigia a URL antiga `/api/funnel/context?item_ids=...`. Desde o ajuste “Funil desacoplado da coleta do Motor”, a tela chama `getJson('/api/funnel/context')` sem `item_ids`; o código estava correto e o teste estava desatualizado.

**Arquivo funcional alterado:** somente `tests/navigation-routes.test.mjs`, atualizando a expectativa para o fluxo atual sem mexer no código do Funil.

**Validação:** o deployment de produção da Vercel para o commit `47725246f27fac96ce94e17b5cb7ff376332eba8` ficou `READY`, confirmando que `npm run build` (incluindo `prebuild`) passou. O status combinado do GitHub/Vercel ficou `success`. Smoke tests HTTP retornaram 200 em `/`, `/?section=config`, `/funil`, `/super-analise`, `/extensao-shopee-intelligence?section=super-anuncio`, `?section=concorrentes` e `?section=shopee-ads`.

**Limitação desta sessão:** não foi possível executar `npm test` completo num checkout local porque o ambiente de container não resolve `github.com`; portanto não registrar contagem 122/122 como verificada aqui. O `prebuild` do deployment passou integralmente.


### 2026-09-29 — ChatGPT — Saúde do Sistema virou diagnóstico persistente para correção
**Arquivos:** `app/lib/funnel-health.js`, `app/UtilityNative.js`, `app/api/system-health/report/route.js`. Banco: tabela `gs_system_health_reports`.

1. O diagnóstico profundo deixou de ser apenas visual. Ao clicar “Executar diagnóstico agora”, o Gestor salva um relatório sanitizado no Supabase, vinculado ao `shop_id` da sessão.
2. O relatório salva apenas evidências técnicas necessárias à investigação: status dos módulos, checks, cobertura do Funil, presença/ausência dos campos-fonte, período, versão da extensão e erros normalizados. Não salva cookies, tokens, SPC_CDS nem payload bruto do Seller Center.
3. Para o Funil, `deriveStoreFunnel` agora também produz `evidence`: quantidade de produtos; cobertura de impressões/cliques nos produtos; presença dos campos em `keyMetrics`, `productOverview` e `realtime`; erros retornados pelo Motor.
4. O relatório profundo recebe um ID e pode ser lido por `GET /api/system-health/report` na própria sessão. O objetivo é permitir que ChatGPT/Claude consulte a evidência concreta e investigue a causa, em vez de depender de print.
5. Importante: o Gestor não ganha permissão autônoma para editar GitHub a partir do navegador do lojista. A correção de código continua sendo feita por um agente autorizado (ChatGPT/Claude) depois de ler o relatório; o painel fornece a evidência e o histórico.
6. A tabela `gs_system_health_reports` está com RLS habilitado e o app acessa via service role no servidor, sempre filtrando pela loja da sessão.

**Fluxo esperado:** usuário executa diagnóstico profundo → relatório é salvo → agente consulta o relatório mais recente → cruza evidências com código/enciclopédia → tenta correção → valida build/deploy → usuário roda diagnóstico novamente para confirmar a melhora.


### 2026-09-29 — ChatGPT — Pesquisa de Produtos: exportação do diagnóstico técnico
**Arquivos:** `app/pesquisa-produtos/MarketResearch.js`, `app/pesquisa-produtos/pesquisa-produtos.module.css`, `tests/market-research-v2.test.mjs`.

1. A tela de Pesquisa de Produtos ganhou o botão **“Baixar diagnóstico técnico”** quando o Motor retorna `diagnostics`.
2. O arquivo exportado contém apenas o objeto de diagnóstico devolvido pelo Motor, a palavra-chave da pesquisa e o horário da exportação; ele serve para investigar perda de dados entre captura, parser e normalização sem depender de prints.
3. Quando o Motor informar `mode: 'diagnostic-only'`, a interface deixa explícito que a coleta é uma amostra controlada e não uma pesquisa final.
4. Esta alteração acompanha a extensão experimental v0.18.4, criada fora do repositório a partir da v0.18.3 enviada pelo usuário. A v0.18.4 limita a investigação a 3 itens e registra a cadeia captura natural → busca direta → parser → DOM → PDP → ratings → retorno ao Gestor, sem misturar fontes no valor final.
5. O manifesto oficial `/api/extension/latest` não foi alterado; v0.18.4 continua experimental até validação no Chrome desktop.


### 2026-09-29 — ChatGPT — Motor Sênior v0.18.6 / Pesquisa de Produtos pela captura natural
**Motor:** artefato local `Gestor-Senior-Shopee-Intelligence-v0.18.6-PESQUISA-NATURAL.zip`. **Enciclopédia:** v14.1.

1. O diagnóstico v0.18.5 confirmou a causa: a navegação normal da busca pública recebe `/api/v4/search/search_items` com HTTP 200 e 60 itens, enquanto chamadas artificiais da extensão para a mesma família podem receber HTTP 403.
2. A resposta natural já trouxe preço, vendas acumuladas, vendas/mês, localização, avaliação e reviews; o parser preservou os campos até o objeto normalizado.
3. A v0.18.6 deixa de usar a sonda direta/PDP/ratings como caminho da pesquisa básica. O fluxo funcional passa a ser: navegar página real → interceptar resposta natural → normalizar → deduplicar por item_id → enviar ao Gestor.
4. A paginação usa navegação real `page=0..N`; cada página espera sua própria captura natural e registra cobertura/quantidade adicionada. Se uma página não produzir captura válida, não inventar dados.
5. `pdp/get_pc` fica como fallback pontual futuro quando algum campo realmente faltar. `get_ratings` fica reservado para análise profunda/mineração de avaliações, não para os 36/60 itens em massa.
6. A v0.18.6 mantém o modo diagnóstico antigo como ferramenta auxiliar, mas `marketplaceSearch` agora usa a nova ação `GS_COLLECT_NATURAL_SEARCH`.
7. Guardrail: ausência de campo continua `null`; não misturar fontes silenciosamente; não inferir Ads por `adsid` isolado.


### 2026-09-29 — ChatGPT — Assistente de Criação do Anúncio na Pesquisa de Produtos
**Arquivos:** `app/pesquisa-produtos/MarketResearch.js`, `app/pesquisa-produtos/pesquisa-produtos.module.css`, `tests/market-research-v2.test.mjs`.

1. A página Pesquisa de Produtos ganhou o bloco **Assistente de Criação do Anúncio** abaixo do conteúdo principal, ocupando a área inferior da página como no mockup aprovado.
2. Foram adicionados controles independentes para **mostrar/ocultar a Visão Geral** e **mostrar/ocultar o Assistente**, nos pontos de cabeçalho aprovados pelo usuário.
3. Para manter a tela limpa, o Assistente usa abas internas: Estratégia, Título, Descrição, Imagens, Categoria/NCM, Variações, Referências e Checklist. Só uma seção do assistente aparece por vez.
4. Nesta primeira implementação, título, descrição, variações, faixa de preço, concorrência e referências usam somente dados já coletados pela Pesquisa de Produtos e cálculos determinísticos. O sistema não inventa categoria ou NCM quando a busca não fornece evidência suficiente; esses campos ficam explicitamente marcados para revisão.
5. Variações são inferidas de termos observáveis nos títulos (ex.: menino/menina, ursinho/ursinha, Homem-Aranha, princesa, floral, cores e temas conhecidos) e ordenadas pela força observada de vendas/30d ou vendas acumuladas nos anúncios que contêm o termo.
6. Referências usam anúncios reais da coleta, priorizados por vendas/30d/vendas, com botão para abrir o anúncio e a imagem em nova aba. Download direto de imagem não foi forçado nesta etapa porque depende de permissões/CORS do host da Shopee.
7. O layout recebeu responsividade para desktop, tablet e mobile e testes de regressão para presença das abas, toggles e honestidade de Categoria/NCM.

### 2026-09-30 — Codex — Canal de atualização do Motor sincronizado com v0.18.6
- Causa: o ZIP v0.18.6 já havia sido distribuído, mas `/api/extension/latest` e `/motor-senior` ainda anunciavam v0.17.9.
- Metadados centralizados em `lib/motor-release.js`, consumidos pela API e pela página. Nome do pacote e data conferidos na referência do artefato distribuído; notas baseadas no registro v0.18.6 acima.
- Preservados o contrato JSON, a URL existente e `Cache-Control: no-store`; a extensão instalada pode obter o valor corrigido em “Verificar agora”, sem reinstalação.
- Atualizado o teste de versão antiga para conferir o registro compartilhado e seus consumidores. `npm run prebuild`: 114 testes passaram.
- Nenhum ZIP novo foi criado ou hospedado nesta correção; nenhuma lógica de coleta foi alterada.

### 2026-09-30 — Claude — Pesquisa de Produtos: reorganização de UX para leigos
**Arquivos:** `app/pesquisa-produtos/MarketResearch.js`, `app/pesquisa-produtos/pesquisa-produtos.module.css` (reescrito, sem CSS legado duplicado), `tests/market-research-v2.test.mjs`. Branch local `claude/pesquisa-produtos-ux` (não commitado/deployado).

1. Só UX/hierarquia: APIs, coleta, `opportunityScore`, cálculos e `financeAnalysis` intactos; helpers novos são apenas rótulos/ícones/tons.
2. Busca em 3 passos (o que pesquisar → profundidade Rápida/Padrão/Profunda → custo opcional). Importar/Exportar/Histórico viraram ações secundárias.
3. Histórico: cada linha mostra nome, data, profundidade, score + rótulo, anúncios, lucro e margem em destaque, exportar/excluir. Painel "Resumo da oportunidade" com ações Abrir pesquisa / Repetir e comparar / Exportar / Excluir.
4. Sem pesquisa aberta: só estado vazio "Nenhuma pesquisa aberta". Com pesquisa: 5 indicadores simples → abas Resultados/Oportunidades/Palavras-chave/Concorrência/Insights. "Cobertura dos dados" e diagnóstico do Motor ficam atrás de "Qualidade dos dados"/"Ver detalhes técnicos".
5. Cor nunca é o único sinal (chips com texto + ícone). Limiares são heurísticas ajustáveis: margem ≥20% saudável, ≥10% apertada; score ≥65 bom, ≥50 atenção; concorrência ≥45% alta, ≥25% média. Demanda relativa só com ≥3 pesquisas salvas; antes disso mostra o fato (vendas).
6. Mobile: blocos verticais, `resultCards` no lugar da tabela (≤900px), palavras-chave com quebra natural. Assistente de Criação agora começa recolhido (mudança de comportamento).
**Validação:** `node --test` da lista do prebuild: 117 passaram; `tsc --noEmit --allowJs` ok; QA visual em Chromium com harness sintético (desktop + 390px, sem overflow horizontal). **Não validado:** `next build` (npm 403 no sandbox) e dados reais da extensão.
**Pendente:** revisar no deploy real; "Excluir" continua sem confirmação (comportamento original).


## 2026-09-30 — Pesquisa de Produto: refinamento manual do Radar
- Branch: `feat/radar-refinar-resultados`.
- Arquivos alterados: `app/pesquisa-produtos/MarketResearch.js` e `app/pesquisa-produtos/pesquisa-produtos.module.css`.
- O Radar de oportunidades agora permite retirar resultados irrelevantes com **Remover da análise**.
- A remoção é reversível na sessão: **Desfazer última** e **Restaurar todos**.
- Ao remover um item, ele sai de `rows`, portanto todos os cálculos determinísticos derivados são recalculados com a amostra refinada (preço, demanda, concorrência, palavras-chave, oportunidades etc.).
- Nova orientação visual explica ao usuário por que limpar resultados e mostra quantos itens continuam sendo usados e quantos foram removidos.
- `loadPayload` zera a lista de removidos ao carregar uma nova coleta, evitando misturar exclusões entre pesquisas.
- Não houve alteração em APIs, coleta, Motor Sênior ou regras de IA.


## 2026-09-30 — Radar: seleção em lote para limpar resultados
- Branch: `feat/radar-selecao-lote`.
- Substituído o botão individual **Remover da análise** por caixas de seleção.
- Cada linha possui checkbox; o cabeçalho permite selecionar todos os resultados da página atual.
- Após selecionar um ou mais itens, aparece **Excluir selecionados (N)** no bloco de orientação.
- A exclusão em lote retira os itens de `rows`, portanto os indicadores derivados são recalculados com a amostra refinada.
- Mantidos **Desfazer última** e **Restaurar todos**.
- No mobile, cada card tem a opção **Selecionar para excluir**.
- A seleção é limpa ao trocar página, ordenação ou filtros, evitando exclusões acidentais fora da visualização atual.
