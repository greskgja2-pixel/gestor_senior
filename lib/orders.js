import { getOrderList, getOrderDetail } from "./shopee";
import { supabaseAdmin } from "./supabase";

const DAY = 24 * 60 * 60;
const MAX_WINDOW_DAYS = 15; // limite real da Shopee por chamada de get_order_list (create_time)
const MAX_PAGES_PER_WINDOW = 60; // ate 3000 pedidos por janela - trava loop infinito por resposta inesperada

async function syncFromShopee(shop, days = 15) {
    const db = supabaseAdmin();
    const now = Math.floor(Date.now() / 1000);
    const totalFrom = now - days * DAY;

  // A Shopee limita o intervalo de get_order_list a no maximo 15 dias por chamada.
  // Pra periodos maiores (30/60/90 dias), percorre em blocos de 15 dias ate cobrir tudo.
  const orderSnSet = new Set();
    let windowTo = now;
    while (windowTo > totalFrom) {
        const windowFrom = Math.max(totalFrom, windowTo - MAX_WINDOW_DAYS * DAY);
        let cursor = "";
    for (let page_i = 0; page_i < MAX_PAGES_PER_WINDOW; page_i++) {
          const page = await getOrderList({ shopId: shop.shop_id, accessToken: shop.access_token, timeFrom: windowFrom, timeTo: windowTo, pageSize: 50, cursor });
          const orders = page.response?.order_list || [];
          orders.forEach((o) => orderSnSet.add(o.order_sn));
          if (!page.response?.more) break;
          cursor = page.response.next_cursor;
          if (!cursor) break;
    }
        windowTo = windowFrom;
  }

  const allOrderSns = [...orderSnSet];
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

/** Devolve os pedidos da loja no periodo pedido (`days`, padrao 15): do cache quando `days<=15`
 * (o cache historico ja cobre essa janela desde sempre), ou buscando direto na Shopee quando
 * `forceRefresh` ou quando o periodo pedido for maior que o que o cache garante cobrir. */
export async function getOrders(shop, { forceRefresh = false, days = 15 } = {}) {
    const boundedDays = Math.max(1, Math.min(90, Number(days) || 15));
    const cutoff = Math.floor(Date.now() / 1000) - boundedDays * DAY;

  if (forceRefresh || boundedDays > MAX_WINDOW_DAYS) {
        const { orders, syncedAt } = await syncFromShopee(shop, boundedDays);
        return { source: "shopee", orders: orders.filter((o) => Number(o.create_time) >= cutoff), syncedAt };
  }

  const db = supabaseAdmin();
    const { data, error } = await db
      .from("orders_cache")
      .select("data, synced_at")
      .eq("shop_id", shop.shop_id)
      .order("synced_at", { ascending: false });
    if (error) throw new Error(error.message);

  if (!data || !data.length) {
        const { orders, syncedAt } = await syncFromShopee(shop, boundedDays);
        return { source: "shopee", orders: orders.filter((o) => Number(o.create_time) >= cutoff), syncedAt };
  }

  const cached = data.map((r) => r.data).filter((o) => Number(o.create_time) >= cutoff);
    return { source: "cache", orders: cached, syncedAt: data[0]?.synced_at || null };
}
