# Preparação multiusuário / ISV — Gestor Sênior

Atualizado em 25/09/2026.

## Implementado no código
- Cadastro público com nome, e-mail e senha.
- Login com Supabase Auth.
- Sessão própria do Gestor em cookie HttpOnly assinado.
- Associação de cada usuário a uma loja Shopee por `shop_id`.
- OAuth state vinculado ao usuário que iniciou a autorização.
- APIs protegidas por sessão.
- Painel administrativo de usuários, atividade e loja vinculada.
- Páginas públicas: apresentação, privacidade, termos, documentação técnica e status.

## Limite atual documentado
Nesta fase cada conta do Gestor Sênior possui uma loja Shopee vinculada por vez. Não declarar múltiplas lojas por conta, subcontas manager/viewer, 2FA, Redis, Sentry, Stripe, SLA 99%, AES-256 de aplicação ou rate limit de 100 req/h até que esses itens sejam efetivamente implementados e verificados.

## Dependências externas — ação do proprietário
1. Definir o canal profissional de contato que aparecerá na Política e nos Termos.
2. Confirmar os dados jurídicos que serão usados na solicitação (CNPJ/CPF, razão social/nome e telefone).
3. Solicitar à Shopee a modalidade de parceiro/aplicativo apropriada para permitir autorização de lojas de terceiros.
4. Após aprovação, criar/configurar o novo app ERP System e fornecer ao projeto apenas as novas credenciais por variáveis de ambiente da Vercel.
5. Criar/fornecer contas de teste somente se a Shopee pedir isso no fluxo de aprovação.
6. Não substituir as credenciais do app atual em produção até o novo app ser aprovado e validado em ambiente separado.

## Observação sobre os documentos originais
Os documentos gerados inicialmente por IA foram tratados como rascunho. Eles continham placeholders e declarações de funcionalidades/compliance não comprovadas no código atual. As páginas públicas deste branch foram deliberadamente reduzidas ao que é verificável.
