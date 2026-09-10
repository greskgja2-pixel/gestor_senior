import { getOrderList, getOrderDetail } from "./shopee";
import { supabaseAdmin } from "./supabase";

const FIFTEEN_DAYS = 15 * 24 * 60 * 60;

async function syncFromShopee(shop) {
  const db = supabaseAdmin();
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = timeTo - FIFTEEN_DAYS;

  let cursor = "";
  const allOrderSns = [];
  while (true) {
    const page = await getOrderList({ shopId: shop.shop_id, accessToken: shop.access_token, timeFrom, timeTo, pageSize: 50, cursor });
    const orders = page.response?.order_list || [];
    allOrderSns.push(...orders.map((o) => o.order_sn));
    if (!page.response?.more) break;
    cursor = page.response.next_cursor;
    if (!cursor) break;
  }

  const rows = [];
  for (let i = 0; i < allOrderSns.length; i += 50) {
    const batchSns = allOrderSns.slice(i, i + 50);
    if (!batchSns.length) continue;
    const detail = await getOrderDetail({ shopId: shop.shop_id, accessToken: shop.access_token, orderSnList: batchSns });
    const orders = detail.response?.order_list || [];
    for (const order of orders) {
      rows.push({ shop_id: shop.shop_id, order_sn: order.order_sn, data: order, synced_at: new Date().toISOString() });
    }
  }

  if (rows.length) {
    const { error } = await db.from("orders_cache").upsert(rows, { onConflict: "shop_id,order_sn" });
    if (error) throw new Error(`Erro salvando cache de pedidos: ${error.message}`);
  }
  return { orders: rows.map((r) => r.data), syncedAt: rows[0]?.synced_at || new Date().toISOString() };
}

/** Devolve os pedidos da loja (últimos 15 dias): do cache por padrão, ou buscando na Shopee se `forceRefresh` ou cache vazio. */
export async function getOrders(shop, { forceRefresh = false } = {}) {
  if (forceRefresh) {
    const { orders, syncedAt } = await syncFromShopee(shop);
    return { source: "shopee", orders, syncedAt };
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("orders_cache")
    .select("data, synced_at")
    .eq("shop_id", shop.shop_id)
    .order("synced_at", { ascending: false });
  if (error) throw new Error(error.message);

  if (!data || !data.length) {
    const { orders, syncedAt } = await syncFromShopee(shop);
    return { source: "shopee", orders, syncedAt };
  }

  return { source: "cache", orders: data.map((r) => r.data), syncedAt: data[0]?.synced_at || null };
}

