import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getCategories, getAttributes, getBrands, getModelList } from "../../../../lib/shopee-catalog";

export const dynamic = "force-dynamic";

function positiveInt(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function GET(request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") || "categories";
  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja Shopee autorizada." }, { status: 400 });

  try {
    let data;
    if (resource === "categories") {
      data = await getCategories(shop);
    } else if (resource === "attributes") {
      const categoryId = positiveInt(url.searchParams.get("category_id"));
      if (!categoryId) return NextResponse.json({ error: "category_id inválido." }, { status: 400 });
      data = await getAttributes(shop, categoryId);
    } else if (resource === "brands") {
      const categoryId = positiveInt(url.searchParams.get("category_id"));
      if (!categoryId) return NextResponse.json({ error: "category_id inválido." }, { status: 400 });
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
      data = await getBrands(shop, categoryId, offset, 100);
    } else if (resource === "models") {
      const itemId = positiveInt(url.searchParams.get("item_id"));
      if (!itemId) return NextResponse.json({ error: "item_id inválido." }, { status: 400 });
      data = await getModelList(shop, itemId);
    } else {
      return NextResponse.json({ error: "resource desconhecido." }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
