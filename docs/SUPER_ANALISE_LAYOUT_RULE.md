# Regra oficial — layout da Super Análise

Esta regra é obrigatória para qualquer alteração em `/super-analise`.

## Layout aprovado

A Super Análise deve manter o padrão horizontal aprovado pelo usuário:

1. menu lateral próprio do Gestor à esquerda;
2. conteúdo ocupando toda a largura restante da janela;
3. sem o cabeçalho legado global `GESTOR SENIOR / Início / Produtos / Pedidos`;
4. cabeçalho compacto da própria Super Análise;
5. resumo horizontal do anúncio logo abaixo;
6. abas horizontais de Título, Descrição, Imagens, Vídeo, Categoria Shopee, Preço & Concorrência e Atributos & Variações;
7. área principal em `Original → Sugestão da IA`, com painel de nota/ações à direita;
8. blocos explicativos e comparativos abaixo, sem transformar a tela em uma coluna estreita;
9. desktop deve priorizar uso do espaço horizontal; não aplicar `max-width` central que comprima a página.

## Proibido

- Reutilizar o shell visual legado na Super Análise.
- Exibir o cabeçalho global antigo acima da Super Análise.
- Centralizar a Super Análise em um container estreito.
- Trocar o padrão horizontal aprovado por um layout vertical sem aprovação explícita do usuário.
- Alterar a hierarquia visual principal do mockup aprovado ao implementar novas funções.

## Proteção técnica obrigatória

A rota deve renderizar `SuperAnaliseBodyMode`, que adiciona `super-analise-page` ao `body`.

`app/globals.css` deve manter regras para `body.super-analise-page` que:

- removem o background legado;
- definem `body.super-analise-page > .shell` com `max-width: none`, `width: 100%`, `margin: 0` e `padding: 0`;
- ocultam `body.super-analise-page > .shell > .topbar`.

O teste `tests/super-analysis-layout.test.mjs` é um guard de regressão e deve rodar antes de cada `next build`. Se qualquer uma dessas proteções for removida, o build deve falhar.

## Regra de mudança

Novos recursos devem ser encaixados dentro desse layout. Se uma função exigir mudança estrutural, primeiro preservar uma versão equivalente ao mockup aprovado e só alterar a estrutura após aprovação explícita do usuário.
