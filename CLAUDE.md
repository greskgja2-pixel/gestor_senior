# Guia de bugs a evitar — Gestor Senior / ShopeeOS

Este arquivo documenta bugs já encontrados (ou de alto risco) no projeto e como evitá-los. Sempre que corrigir um bug real de produção, adicione uma entrada aqui.

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
