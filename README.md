# Gestor Senior

Gestão da loja Shopee com dados reais — Next.js 14 + Supabase + Shopee Open Platform API v2.

## Variáveis de ambiente (Vercel → Project Settings → Environment Variables)

- `SHOPEE_PARTNER_ID`
- `SHOPEE_PARTNER_KEY`
- `SHOPEE_ENV` (`test` ou `live`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Para o aplicativo de teste atual, use `SHOPEE_ENV=test` e
`SHOPEE_PARTNER_ID=1243923`, junto da **Test API Partner Key do mesmo app**.
Nunca use uma chave de outro Partner ID ou do ambiente live.
O host do sandbox de teste é `https://openplatform.sandbox.test-stable.shopee.sg`.
Opcionalmente fixe `SHOPEE_REDIRECT_URL` em
`https://shopeeos-real-greskgja.vercel.app/api/shopee/callback`, conforme o portal Shopee.
Após alterar variáveis de Production, faça um novo deployment e inicie uma nova
autorização (não reutilize um code anterior).

Validação: `npm test` verifica assinaturas e troca de token com respostas simuladas;
`npm run build` valida a compilação. A conexão real exige autorização da loja e
credenciais correspondentes configuradas na Vercel.


## Contas e administração

Em `/cadastro`, cada lojista cria conta com nome, e-mail, senha e código de
convite. Entra em `/login` e autoriza sua
própria loja Shopee. O vínculo da loja é gravado em `gs_accounts` e todos os
acessos aos dados são restritos à loja daquela conta. As sessões expiram em sete
dias; os tokens da Shopee e a chave de serviço permanecem apenas no servidor.

O proprietário usa o código inicial no próprio cadastro, entra em `/admin` e
informa o mesmo código de ativação. Depois pode gerar novos convites de uso
único e validade de 30 dias no painel. Cada convidado escolhe sua própria senha.
O painel lista contas criadas, loja conectada, último
login e atividade recente. Uma conta é exibida como online quando houve
atividade nos últimos dois minutos. As tabelas do painel têm RLS habilitado e
somente a service role pode acessá-las diretamente.

O envio de e-mail do Supabase não está configurado para endereços externos.
Contas por convite são habilitadas pela API administrativa no servidor; o e-mail
informado não é verificado. A recuperação de senha por e-mail dependerá de SMTP.
