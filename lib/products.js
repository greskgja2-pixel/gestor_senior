import { getItemList, getItemBaseInfo } from "./shopee";
import { supabaseAdmin } from "./supabase";

async function syncFromShopee(shop) {
  const db = supabaseAdmin();
  let offset = 0;
  const pageSize = 50;
  const allItemIds = [];
  while (true) {
    const page = await getItemList({ shopId: shop.shop_id, accessToken: shop.access_token, offset, pageSize });
    const items = page.response?.item || [];
    allItemIds.push(...items.map((i) => i.item_id));
    if (!page.response?.has_next_page) break;
    offset = page.response.next_offset;
  }

  const rows = [];
  for (let i = 0; i < allItemIds.length; i += 50) {
    const batchIds = allItemIds.slice(i, i + 50);
    if (!batchIds.length) continue;
    const detail = await getItemBaseInfo({ shopId: shop.shop_id, accessToken: shop.access_token, itemIdList: batchIds });
    const items = detail.response?.item_list || [];
    for (const item of items) {
      rows.push({ shop_id: shop.shop_id, item_id: item.item_id, data: item, synced_at: new Date().toISOString() });
    }
  }

  if (rows.length) {
    const { error } = await db.from("products_cache").upsert(rows, { onConflict: "shop_id,item_id" });
    if (error) throw new Error(`Erro salvando cache de produtos: ${error.message}`);
  }
  return { items: rows.map((r) => r.data), syncedAt: rows[0]?.synced_at || new Date().toISOString() };
}

/** Devolve os produtos da loja: do cache por padrão, ou buscando na Shopee se `forceRefresh` ou cache vazio. */
export async function getProducts(shop, { forceRefresh = false } = {}) {
  if (forceRefresh) {
    const { items, syncedAt } = await syncFromShopee(shop);
    return { source: "shopee", items, syncedAt };
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("products_cache")
    .select("data, synced_at")
    .eq("shop_id", shop.shop_id)
    .order("synced_at", { ascending: false });
  if (error) throw new Error(error.message);

  if (!data || !data.length) {
    const { items, syncedAt } = await syncFromShopee(shop);
    return { source: "shopee", items, syncedAt };
  }

  return { source: "cache", items: data.map((r) => r.data), syncedAt: data[0]?.synced_at || null };
}

