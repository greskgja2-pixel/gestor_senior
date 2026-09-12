// Desconecta a loja da Shopee: apaga a credencial salva no Supabase. Depois disso o
// painel volta a mostrar "desconectada" e o botão "Entrar com a Shopee" (que usa
// /api/shopee/authorize) até uma nova autorização.
import { NextResponse } from "next/server";
import { logoutShop } from "../../../../lib/shop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    await logoutShop();
    console.log("[shopee:logout] loja desconectada com sucesso");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[shopee:logout] erro ao desconectar", String(err.message || err));
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
