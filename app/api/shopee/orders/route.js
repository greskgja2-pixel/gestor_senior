// GET /api/shopee/orders — lista os pedidos reais da loja (últimos 15 dias).
// Por padrão serve do cache (orders_cache); ?refresh=1 força buscar de novo na Shopee.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getOrders } from "../../../../lib/orders";

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
    const { source, orders, syncedAt } = await getOrders(shop, { forceRefresh });
    return NextResponse.json({ source, count: orders.length, syncedAt, orders });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
