// POST /api/shopee/product-action - executa uma ação real e irreversível (ou reversível, no caso
// de desativar) direto na Shopee: desativar (unlist), reativar (relist) ou excluir um anúncio.
// A confirmação ao lojista acontece no painel (front-end) antes de chamar esta rota; aqui só
// validamos e chamamos a Shopee de verdade — nunca simulamos sucesso.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { unlistItem, deleteItem } from "../../../../lib/shopee-extra";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["unlist", "relist", "delete"]);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const itemId = Number(body?.item_id);
  const action = String(body?.action || "");
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "item_id inválido." }, { status: 400 });
  }
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: "Ação inválida. Use unlist, relist ou delete." }, { status: 400 });
  }

  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });

  try {
    if (action === "unlist") await unlistItem(shop, itemId, true);
    else if (action === "relist") await unlistItem(shop, itemId, false);
    else if (action === "delete") await deleteItem(shop, itemId);

    // Mantém o cache local coerente com a Shopee sem esperar o próximo "Atualizar da Shopee".
    const db = supabaseAdmin();
    if (action === "delete") {
      await db.from("products_cache").delete().eq("shop_id", shop.shop_id).eq("item_id", itemId);
    } else {
      const { data } = await db
        .from("products_cache")
        .select("data")
        .eq("shop_id", shop.shop_id)
        .eq("item_id", itemId)
        .maybeSingle();
      if (data?.data) {
        const patched = { ...data.data, item_status: action === "unlist" ? "UNLIST" : "NORMAL" };
        await db
          .from("products_cache")
          .update({ data: patched, synced_at: new Date().toISOString() })
          .eq("shop_id", shop.shop_id)
          .eq("item_id", itemId);
      }
    }

    return NextResponse.json({ ok: true, action, itemId });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

