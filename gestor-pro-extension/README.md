# Gestor Pro — laboratório independente
Protótipo T01. Não substitui nem modifica o Motor Sênior.

## Experimento
1. No Chrome acesse chrome://extensions, ative modo de desenvolvedor e carregue esta pasta sem compactação.
2. Para eliminar colisões, desative temporariamente outras extensões que injetam cartões na busca; pesquise na Shopee Brasil.
3. Se os resultados naturais contiverem `item_cards[].item_data.ctime`, observar o cartão Gestor Pro sob os anúncios.
4. Compare amostras de 5–10 anúncios com fontes independentes e registre horário, item_id, shop_id, campo, valor bruto e formato.
5. Se aparecer "Não disponível", investigar o contrato real da resposta e DOM sem inventar data.
6. Antes de chamar validado, comprovar obtenção real, coerência temporal, estabilidade do painel, contrato de integração e regressões.

**Limitação:** injeção/seletores ainda experimentais, não houve teste real em Chrome e não existe integração com Gestor Sênior. Os campos `ctime/create_time/created_at` são hipóteses e não prova de que todos representam data de publicação. Sem envio externo de dados.

## Segurança
Só lê respostas de navegação natural, não coleta credenciais nem chama backend proprietário; rede nenhuma adicionada. Não publica resultados no banco principal.

Fonte externa de hipótese: https://chartedsea.com/docs/scrapers/shopee/
