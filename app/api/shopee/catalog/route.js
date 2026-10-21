import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getCategories, getAttributes, getBrands, getModelList } from "../../../../lib/shopee-catalog";
import { getItemBaseInfo } from "../../../../lib/shopee";
import { normalizeAttributeTree } from "../../../../lib/category-attributes";

export const dynamic = "force-dynamic";

// A lista oficial de categorias é grande e muda pouco: guarda por loja por 10 minutos para não chamar a Shopee a cada abertura.
const categoryCache = new Map();
const CATEGORY_TTL_MS = 10 * 60 * 1000;

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
      const key = String(shop.shop_id);
      const hit = categoryCache.get(key);
      if (hit && Date.now() - hit.at < CATEGORY_TTL_MS) {
        data = hit.data;
      } else {
        data = await getCategories(shop);
        if (!data?.error) categoryCache.set(key, { at: Date.now(), data });
      }
    } else if (resource === "attributes") {
      const categoryId = positiveInt(url.searchParams.get("category_id"));
      if (!categoryId) return NextResponse.json({ error: "category_id inválido." }, { status: 400 });
      const raw = await getAttributes(shop, categoryId);
      data = normalizeAttributeTree(raw, categoryId);
    } else if (resource === "brands") {
      const categoryId = positiveInt(url.searchParams.get("category_id"));
      if (!categoryId) return NextResponse.json({ error: "category_id inválido." }, { status: 400 });
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
      data = await getBrands(shop, categoryId, offset, 100);
    } else if (resource === "item_category") {
      const itemId = positiveInt(url.searchParams.get("item_id"));
      if (!itemId) return NextResponse.json({ error: "item_id inválido." }, { status: 400 });
      const base = await getItemBaseInfo({ shopId: shop.shop_id, accessToken: shop.access_token, itemIdList: [itemId] });
      const item = base?.response?.item_list?.find((x) => Number(x?.item_id) === itemId);
      data = { category_id: item?.category_id ?? null };
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
