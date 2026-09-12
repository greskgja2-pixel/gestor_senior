// Endpoint TEMPORÁRIO de diagnóstico: só lê a credencial mais recente (sem chamar a Shopee,
// sem renovar nada) e devolve os mesmos números que getActiveShop() usa pra decidir se renova.
// Não expõe access_token/refresh_token — só metadados. Serve pra descobrir por que o painel
// está tentando renovar um token que acabou de ser emitido. Remover depois do diagnóstico.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { getActiveShop } from "../../../../lib/shop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFRESH_MARGIN_SECONDS = 5 * 60;

export async function GET() {
  const out = {};

  // 1) Mesma leitura "crua" de antes, só pra comparação.
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("shop_credentials")
      .select("id, shop_id, obtained_at, updated_at, expire_in, created_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      out.rawRead = { hasRow: false };
    } else {
      const nowMs = Date.now();
      const obtainedAtMs = new Date(data.obtained_at).getTime();
      const expiresAtMs = obtainedAtMs + data.expire_in * 1000;
      const secondsLeft = (expiresAtMs - nowMs) / 1000;
      out.rawRead = {
        hasRow: true,
        shopId: String(data.shop_id),
        obtainedAtRaw: data.obtained_at,
        updatedAtRaw: data.updated_at,
        expireIn: data.expire_in,
        secondsLeft,
        wouldTriggerRefresh: !(secondsLeft > REFRESH_MARGIN_SECONDS),
      };
    }
  } catch (err) {
    out.rawRead = { error: String(err.message || err) };
  }

  // 2) Chama a MESMA função real que o resto do app usa, pra ver exatamente
  //    o que ela devolve/estoura neste exato momento.
  try {
    const shop = await getActiveShop();
    out.getActiveShopResult = shop
      ? { ok: true, shopId: String(shop.shop_id), obtainedAt: shop.obtained_at, updatedAt: shop.updated_at }
      : { ok: true, shopId: null, note: "getActiveShop devolveu null" };
  } catch (err) {
    out.getActiveShopResult = { ok: false, error: String(err.message || err) };
  }

  return NextResponse.json(out);
}
