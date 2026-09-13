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

