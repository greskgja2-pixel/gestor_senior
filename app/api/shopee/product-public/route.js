// GET /api/shopee/product-public?item_ids=1,2,3 - dados públicos da vitrine Shopee.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getPublicItemInfo, getShopItemsPublic } from "../../../../lib/shopee-public";

export const dynamic = "force-dynamic";
export const maxDuration = 45;
const MAX_ITEMS = 40;

export async function GET(request) {
  const url = new URL(request.url);
  const requestedShopId = String(url.searchParams.get("shop_id") || "").trim();
  const raw = (url.searchParams.get("item_ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const itemIds = [...new Set(raw)].slice(0, MAX_ITEMS).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!itemIds.length) return NextResponse.json({ error: "Informe item_ids." }, { status: 400 });

  const shop = await getActiveShop();
  if (!shop && !requestedShopId) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });
  const shopId = requestedShopId || String(shop.shop_id);

  let shopMap = null;
  let shopMapError = null;
  try { shopMap = await getShopItemsPublic(shopId); }
  catch (err) { shopMapError = String(err.message || err); }

  const results = [];
  for (const itemId of itemIds) {
    const fromShop = shopMap && shopMap.get(String(itemId));
    if (fromShop) {
      let merged = { ...fromShop };
      // A listagem pública da loja nem sempre traz avaliação, nº de avaliações e estoque.
      // Quando faltar qualquer um desses campos, completa com item/get para a Super Análise.
      if (merged.rating == null || merged.reviewCount == null || merged.stock == null) {
        try { merged = { ...merged, ...(await getPublicItemInfo(shopId, itemId)) }; }
        catch { /* mantém os dados válidos já obtidos da listagem */ }
      }
      results.push({ item_id: itemId, ok: true, ...merged });
      continue;
    }
    try {
      const info = await getPublicItemInfo(shopId, itemId);
      results.push({ item_id: itemId, ok: true, ...info });
    } catch (err) {
      const detail = String(err.message || err);
      results.push({ item_id: itemId, ok: false, error: shopMapError ? `Listagem da loja falhou (${shopMapError}). Consulta individual: ${detail}` : detail });
    }
  }
  return NextResponse.json({ results });
}
