// Reconecta a loja pausada sem passar pela autorização da Shopee de novo: só desmarca
// o "paused" salvo no Supabase. O access_token/refresh_token continuam os mesmos; se o
// access_token estiver vencido, getActiveShop() renova sozinho na próxima chamada.
import { NextResponse } from "next/server";
import { resumeShop } from "../../../../lib/shop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    if(!(await resumeShop()))return NextResponse.json({error:'Faça login com a Shopee para reconectar sua loja.'},{status:401});
    console.log("[shopee:resume] loja reconectada sem nova autorização");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[shopee:resume] erro ao reconectar", String(err.message || err));
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
