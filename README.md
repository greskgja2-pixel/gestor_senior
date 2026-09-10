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
O host de teste é `https://partner.test-stable.shopeemobile.com`.
Opcionalmente fixe `SHOPEE_REDIRECT_URL` em
`https://shopeeos-real-greskgja.vercel.app/api/shopee/callback`, conforme o portal Shopee.
Após alterar variáveis de Production, faça um novo deployment e inicie uma nova
autorização (não reutilize um code anterior).

Validação: `npm test` verifica assinaturas e troca de token com respostas simuladas;
`npm run build` valida a compilação. A conexão real exige autorização da loja e
credenciais correspondentes configuradas na Vercel.

