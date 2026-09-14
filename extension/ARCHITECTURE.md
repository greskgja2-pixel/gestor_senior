# Arquitetura

## Extensão = braço no navegador

- `page-hook.js`: roda no MAIN world, observa fetch/XHR como o Auto Mapper v2.4.
- `content.js`: ponte segura MAIN → extensão, parser de página e botão GS.
- `background.js`: fila, alarmes, sincronização, concorrentes e automação.
- `sidepanel.*`: interface de análise, automação, Revenda e laboratório.

## Gestor Web = cérebro persistente

A extensão consulta o Gestor Sênior para produtos, Shopee Ads, recomendações de ROAS e ações de campanha. O backend continua responsável por ações que podem rodar mesmo com o Chrome fechado.

## Regra de automação

Automação passa por: dados mínimos → cooldown → proteção financeira → limite de alteração → proposta → aprovação/execução → log → reavaliação.

Nunca fazer uma alteração apenas porque uma métrica caiu em um único dia.
