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
