// Endpoint TEMPORÁRIO de diagnóstico: só lê a credencial mais recente (sem chamar a Shopee,
// sem renovar nada) e devolve os mesmos números que getActiveShop() usa pra decidir se renova.
// Não expõe access_token/refresh_token — só metadados. Serve pra descobrir por que o painel
// está tentando renovar um token que acabou de ser emitido. Remover depois do diagnóstico.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFRESH_MARGIN_SECONDS = 5 * 60;

export async function GET() {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("shop_credentials")
      .select("id, shop_id, obtained_at, updated_at, expire_in, created_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ hasRow: false });

    const nowMs = Date.now();
    const obtainedAtMs = new Date(data.obtained_at).getTime();
    const expiresAtMs = obtainedAtMs + data.expire_in * 1000;
    const secondsLeft = (expiresAtMs - nowMs) / 1000;

    return NextResponse.json({
      hasRow: true,
      shopId: String(data.shop_id),
      obtainedAtRaw: data.obtained_at,
      updatedAtRaw: data.updated_at,
      obtainedAtParsedIso: new Date(obtainedAtMs).toISOString(),
      obtainedAtParsedValid: !Number.isNaN(obtainedAtMs),
      expireIn: data.expire_in,
      nowIso: new Date(nowMs).toISOString(),
      secondsLeft,
      wouldTriggerRefresh: !(secondsLeft > REFRESH_MARGIN_SECONDS),
      refreshMarginSeconds: REFRESH_MARGIN_SECONDS,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

