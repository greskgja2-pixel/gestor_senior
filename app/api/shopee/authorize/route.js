// Passo 1 do fluxo de autorização: manda o lojista pra tela da Shopee onde ele
// autoriza este app a acessar a loja dele.
import { NextResponse } from "next/server";
import { buildShopAuthUrl, currentShopeeEnv } from "../../../../lib/shopee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Domínio cadastrado como "Redirect URL Domain" no console da Shopee Open Platform
// (App List > Gestor Senior > Authorization Information). A Shopee rejeita a autorização
// se o "redirect" enviado não bater EXATAMENTE com esse domínio, mesmo que o site também
// responda em outro domínio/alias (ex.: apelido mais curto na Vercel). Por isso não usamos
// o origin da requisição aqui — sempre mandamos o domínio cadastrado, que a Vercel mantém
// funcionando mesmo quando o domínio "bonito" do projeto muda.
const SHOPEE_CONSOLE_REDIRECT_DOMAIN = "https://shopeeos-real-greskgja.vercel.app";

export async function GET() {
  const redirectUrl =
    process.env.SHOPEE_REDIRECT_URL?.trim() || `${SHOPEE_CONSOLE_REDIRECT_DOMAIN}/api/shopee/callback`;
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
