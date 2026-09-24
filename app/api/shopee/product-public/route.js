// GET /api/shopee/product-public?item_ids=1,2,3 - dados públicos da vitrine Shopee.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getPublicItemInfo, getShopItemsPublic } from "../../../../lib/shopee-public";
import { getItemBaseInfo } from "../../../../lib/shopee";

export const dynamic = "force-dynamic";
export const maxDuration = 45;
const MAX_ITEMS = 40;

export async function GET(request) {
  const url = new URL(request.url);
  const requestedShopId = String(url.searchParams.get("shop_id") || "").trim();
  const direct = url.searchParams.get("direct") === "1";
  const raw = (url.searchParams.get("item_ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const itemIds = [...new Set(raw)].slice(0, MAX_ITEMS).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!itemIds.length) return NextResponse.json({ error: "Informe item_ids." }, { status: 400 });

  const shop = await getActiveShop();
  if (!shop && !requestedShopId) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });
  const shopId = requestedShopId || String(shop.shop_id);

  let partnerMap = new Map();
  if (shop && String(shop.shop_id) === String(shopId)) {
    try {
      const detail = await getItemBaseInfo({ shopId: shop.shop_id, accessToken: shop.access_token, itemIdList: itemIds });
      for (const item of (detail?.response?.item_list || [])) partnerMap.set(String(item.item_id), item);
    } catch { /* Partner API não fornece todos os campos de vitrine; segue para as demais fontes. */ }
  }

  let shopMap = null;
  let shopMapError = null;
  if (!direct) {
    try { shopMap = await getShopItemsPublic(shopId); }
    catch (err) { shopMapError = String(err.message || err); }
  }

  const results = [];
  for (const itemId of itemIds) {
    const partner = partnerMap.get(String(itemId));
    const partnerRating = partner?.item_rating?.rating_star ?? partner?.rating_star ?? null;
    const partnerCounts = partner?.item_rating?.rating_count ?? partner?.rating_count ?? null;
    const partnerReviewCount = Array.isArray(partnerCounts) ? partnerCounts[0] : partnerCounts;
    const fromShop = shopMap && shopMap.get(String(itemId));
    if (fromShop) {
      let merged = { ...fromShop };
      // A listagem pública da loja nem sempre traz avaliação, nº de avaliações e estoque.
      // Quando faltar qualquer um desses campos, completa com item/get para a Super Análise.
      if (merged.rating == null || merged.reviewCount == null || merged.stock == null) {
        try { merged = { ...merged, ...(await getPublicItemInfo(shopId, itemId)) }; }
        catch { /* mantém os dados válidos já obtidos da listagem */ }
      }
      results.push({ item_id: itemId, ok: true, ...merged, rating: merged.rating ?? partnerRating, reviewCount: merged.reviewCount ?? partnerReviewCount, partnerValidated: Boolean(partner) });
      continue;
    }
    try {
      const info = await getPublicItemInfo(shopId, itemId);
      results.push({ item_id: itemId, ok: true, ...info, rating: info.rating ?? partnerRating, reviewCount: info.reviewCount ?? partnerReviewCount, partnerValidated: Boolean(partner) });
    } catch (err) {
      if (partner && (partnerRating != null || partnerReviewCount != null)) {
        results.push({ item_id: itemId, ok: true, rating: partnerRating, reviewCount: partnerReviewCount, partnerValidated: true });
        continue;
      }
      const detail = String(err.message || err);
      results.push({ item_id: itemId, ok: false, error: shopMapError ? `Listagem da loja falhou (${shopMapError}). Consulta individual: ${detail}` : detail });
    }
  }
  return NextResponse.json({ results });
}
