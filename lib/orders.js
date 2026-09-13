import { getOrderList, getOrderDetail } from "./shopee";
import { supabaseAdmin } from "./supabase";

const DAY = 24 * 60 * 60;
const MAX_WINDOW_DAYS = 15; // limite real da Shopee por chamada de get_order_list (create_time)
const MAX_PAGES_PER_WINDOW = 60; // ate 3000 pedidos por janela - trava loop infinito por resposta inesperada
const MAX_RANGE_DAYS = 90; // teto do painel pra qualquer período (preset ou calendário)

/** Busca direto na Shopee todos os pedidos com create_time em [from, to] (unix seconds),
 * percorrendo em blocos de no máximo 15 dias (limite real da API) até cobrir o intervalo. */
async function syncFromShopee(shop, from, to) {
    const db = supabaseAdmin();

  const orderSnSet = new Set();
    let windowTo = to;
    while (windowTo > from) {
        const windowFrom = Math.max(from, windowTo - MAX_WINDOW_DAYS * DAY);
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

function normalizeRange({ days = 15, from, to } = {}) {
  const now = Math.floor(Date.now() / 1000);
  if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
    const boundedTo = Math.min(to, now);
    const boundedFrom = Math.max(from, boundedTo - MAX_RANGE_DAYS * DAY);
    return { from: boundedFrom, to: boundedTo, custom: true };
  }
  const boundedDays = Math.max(1, Math.min(MAX_RANGE_DAYS, Number(days) || 15));
  return { from: now - boundedDays * DAY, to: now, custom: false, days: boundedDays };
}

/** Devolve os pedidos da loja no período pedido: um preset em dias (padrao 15, cache quando
 * <=15 dias) ou um intervalo explícito `{from,to}` (unix seconds, ex.: escolhido num calendário
 * — sempre busca direto na Shopee, nunca usa o cache de dias corridos). */
export async function getOrders(shop, { forceRefresh = false, days = 15, from, to } = {}) {
    const range = normalizeRange({ days, from, to });

  if (range.custom || forceRefresh || range.to - range.from > MAX_WINDOW_DAYS * DAY) {
        const { orders, syncedAt } = await syncFromShopee(shop, range.from, range.to);
        return { source: "shopee", orders: orders.filter((o) => { const t = Number(o.create_time); return t >= range.from && t <= range.to; }), syncedAt };
  }

  const db = supabaseAdmin();
    const { data, error } = await db
      .from("orders_cache")
      .select("data, synced_at")
      .eq("shop_id", shop.shop_id)
      .order("synced_at", { ascending: false });
    if (error) throw new Error(error.message);

  if (!data || !data.length) {
        const { orders, syncedAt } = await syncFromShopee(shop, range.from, range.to);
        return { source: "shopee", orders: orders.filter((o) => { const t = Number(o.create_time); return t >= range.from && t <= range.to; }), syncedAt };
  }

  const cached = data.map((r) => r.data).filter((o) => { const t = Number(o.create_time); return t >= range.from && t <= range.to; });
    return { source: "cache", orders: cached, syncedAt: data[0]?.synced_at || null };
}
