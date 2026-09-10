// Passo 2 do fluxo de autorização: a Shopee redireciona pra cá com ?code=...&shop_id=...
// depois que o lojista autoriza. Trocamos o code por access_token/refresh_token e
// salvamos no Supabase (upsert por shop_id — reautorizar substitui o token antigo).
import { NextResponse } from "next/server";
import { exchangeCodeForToken, currentShopeeEnv } from "../../../../lib/shopee";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shopId = url.searchParams.get("shop_id");
  const shopeeError = url.searchParams.get("error"); // a Shopee às vezes já volta com erro na query

  console.log(
    "[shopee:callback] recebido",
    JSON.stringify({
      env: currentShopeeEnv(),
      codePresent: Boolean(code),
      shopIdPresent: Boolean(shopId),
      shopeeErrorParam: shopeeError || null,
    })
  );

  if (shopeeError) {
    console.error("[shopee:callback] Shopee retornou erro direto na query string", shopeeError);
    return NextResponse.json(
      { error: `Shopee retornou erro na autorização: ${shopeeError}` },
      { status: 400 }
    );
  }

  if (!code || !shopId) {
    console.error("[shopee:callback] callback sem code/shop_id", JSON.stringify({ code: Boolean(code), shopId: Boolean(shopId) }));
    return NextResponse.json(
      { error: "Callback sem code/shop_id — a autorização não foi concluída." },
      { status: 400 }
    );
  }

  try {
    const token = await exchangeCodeForToken(code, shopId);

    console.log(
      "[shopee:callback] token trocado com sucesso",
      JSON.stringify({ shopId, expireIn: token.expire_in })
    );

    const db = supabaseAdmin();
    const { error } = await db.from("shop_credentials").upsert(
      {
        shop_id: Number(shopId),
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expire_in: token.expire_in,
        obtained_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id" }
    );
    if (error) {
      console.error("[shopee:callback] erro salvando no Supabase", error.message);
      throw new Error(`Erro salvando credenciais no Supabase: ${error.message}`);
    }

    return NextResponse.redirect(`${url.origin}/?authorized=1`);
  } catch (err) {
    // exchangeCodeForToken já loga o detalhe completo (status HTTP, erro/mensagem da Shopee)
    // via [shopee:token_response] — aqui só propagamos a mensagem já resumida pro response.
    console.error("[shopee:callback] falha na troca de token", String(err.message || err));
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

