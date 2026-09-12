// GET /api/shopee/products - lista os produtos reais da loja.
// Por padrao serve do cache (products_cache); ?refresh=1 forca buscar de novo na Shopee.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getProducts } from "../../../../lib/products";

export const dynamic = "force-dynamic";
export const maxDuration = 45; // teto de seguranca: nunca deixa o painel pendurado indefinidamente

export async function GET(request) {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get("refresh") === "1";

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
        const { source, items, syncedAt } = await getProducts(shop, { forceRefresh });
        return NextResponse.json({ source, count: items.length, syncedAt, items });
  } catch (err) {
        return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
