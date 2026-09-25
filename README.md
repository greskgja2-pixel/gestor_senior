# Gestor Senior

Gestão e inteligência para operações Shopee — Next.js 14 + React 18 + Supabase + Shopee Open Platform API v2.

## Variáveis de ambiente (Vercel → Project Settings → Environment Variables)

- `SHOPEE_PARTNER_ID`
- `SHOPEE_PARTNER_KEY`
- `SHOPEE_ENV` (`test` ou `live`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SESSION_SECRET` (recomendado; mínimo 32 caracteres)

Para o aplicativo de teste atual, use as credenciais Test do mesmo Partner ID. Nunca misture Partner ID e Partner Key de ambientes ou aplicativos diferentes. Após alterar variáveis de produção, faça novo deployment e inicie uma nova autorização.

## Contas e isolamento

O cadastro em `/cadastro` é aberto: cada lojista informa nome, e-mail e senha. O login usa Supabase Auth e o Gestor emite uma sessão própria assinada em cookie HttpOnly.

Depois de entrar, o usuário autoriza sua própria loja Shopee. O vínculo é salvo em `gs_accounts` por `user_id` e `shop_id`. Nesta fase, cada conta do Gestor possui uma loja Shopee vinculada por vez.

As APIs protegidas resolvem a loja pela conta autenticada. Tokens da Shopee e a service role permanecem no servidor.

O administrador global acessa `/admin` após ativação administrativa e pode visualizar contas, último login, atividade recente e loja vinculada.

## Páginas públicas

- `/apresentacao` — apresentação do produto
- `/privacidade` — política de privacidade em versão de preparação
- `/termos` — termos atuais
- `/docs/tecnica` — arquitetura realmente implementada
- `/status` — situação da preparação multiusuário

A lista técnica de pendências externas está em `docs/ISV_READINESS.md`. O rascunho conservador de solicitação à Shopee está em `docs/SHOPEE_ISV_TICKET_DRAFT.md`.

## Validação

`npm test` verifica o conjunto completo de testes. `npm run build` executa a validação crítica de prebuild e compila a aplicação. A conexão real com a Shopee exige autorização da loja e credenciais correspondentes configuradas na Vercel.
