// GET /api/shopee/products — lista os produtos reais da loja.
// Por padrão serve do cache (products_cache); ?refresh=1 força buscar de novo na Shopee.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getProducts } from "../../../../lib/products";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const shop = await getActiveShop();
  if (!shop) {
    return NextResponse.json(
      { error: "Nenhuma loja autorizada ainda. Vá em /api/shopee/authorize pra conectar." },
      { status: 400 }
    );
  }

  try {
    const { source, items, syncedAt } = await getProducts(shop, { forceRefresh });
    return NextResponse.json({ source, count: items.length, syncedAt, items });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

