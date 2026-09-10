// Passo 1 do fluxo de autorização: manda o lojista pra tela da Shopee onde ele
// autoriza este app a acessar a loja dele.
import { NextResponse } from "next/server";
import { buildShopAuthUrl, currentShopeeEnv } from "../../../../lib/shopee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const redirectUrl = process.env.SHOPEE_REDIRECT_URL?.trim() || `${origin}/api/shopee/callback`;
  try {
    const authUrl = buildShopAuthUrl(redirectUrl);
    console.log(
      "[shopee:authorize] redirecionando pro authUrl",
      JSON.stringify({ env: currentShopeeEnv(), redirectUrl, authUrlHost: new URL(authUrl).host })
    );
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[shopee:authorize] erro montando authUrl", String(err.message || err));
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

