# Gestor Sênior — Shopee Intelligence Extension

Primeira fundação da extensão unificada. Ela combina quatro papéis sem misturar responsabilidades:

1. **Super Anúncio**: análise do anúncio, concorrentes, pontuação 0–100 e estratégia de ROAS.
2. **Gestor Sênior**: dados oficiais, histórico, Shopee Ads e execução de ações confirmadas.
3. **Auto Mapper v2.4**: captura técnica opcional de endpoints; fica desligada por padrão para evitar peso. Endpoints críticos de Ads/Proteção são observados de forma leve.
4. **Painel Revenda**: motor financeiro e espaço de integração do coletor v3.1.0.

## Segurança operacional

- A extensão não copia senha, cookie ou token da Shopee para o servidor.
- Alterações financeiras usam guardrails: custo, margem mínima, lucro mínimo e limites de Ads.
- Automação de título, descrição e preço permanece desativada até existir um caminho de escrita confirmado e testado.
- Ações de Ads usam as APIs já implementadas no Gestor Sênior.
- CAPTCHA/login pausa o processo; nunca deve ser burlado.

## Estado da v0.1

Funcional na fundação local: motor Super Anúncio portado, busca de concorrentes, leitura básica do anúncio atual, integração Ads, sincronização da Proteção de ROAS, tarefas periódicas, guardrails financeiros e modo de captura técnica.

Pendente: incorporação literal do código da `extensao-coletor-shopee-v3.1.0.zip`, pois esse ZIP ainda precisa ser fornecido ao projeto.
