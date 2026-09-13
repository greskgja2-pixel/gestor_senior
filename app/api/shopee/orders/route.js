// GET /api/shopee/orders - lista os pedidos reais da loja no periodo pedido: ?days= (padrao 15,
// max 90) ou um intervalo explicito ?from=&to= (unix seconds, ex.: escolhido num calendário no
// painel) — quando from/to vem, days é ignorado. Por padrao serve do cache (orders_cache) quando
// o preset é <=15 dias; ?refresh=1 ou um intervalo custom forcam buscar de novo na Shopee.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getOrders } from "../../../../lib/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 45; // teto de seguranca: nunca deixa o painel pendurado indefinidamente

export async function GET(request) {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days")) || 15));
    const fromParam = Number(url.searchParams.get("from"));
    const toParam = Number(url.searchParams.get("to"));
    const hasCustomRange = Number.isFinite(fromParam) && Number.isFinite(toParam) && toParam > fromParam;

  let shop;
    try {
          shop = await getActiveShop();
    } catch (err) {
          return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
    }
    if (!shop) {
          return NextResponse.json(
            { error: "Nenhuma loja autorizada ainda. Va em /api/shopee/authorize pra conectar." },
            { status: 400 }
                );
    }

  try {
        const { source, orders, syncedAt } = await getOrders(
          shop,
          hasCustomRange ? { forceRefresh, from: fromParam, to: toParam } : { forceRefresh, days }
        );
        return NextResponse.json({ source, count: orders.length, syncedAt, orders, days, from: hasCustomRange ? fromParam : null, to: hasCustomRange ? toParam : null });
  } catch (err) {
        return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
