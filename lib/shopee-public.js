// Dados públicos da própria vitrine Shopee (sem autenticação Partner) — mesma técnica já usada
// em /api/shopee/competitors. Serve só pra informação que a Partner API não devolve pra nós
// nesta integração (total de vendas histórico do anúncio, "desde a primeira venda").
// Nunca inventa número: se a Shopee não devolver o campo, a função devolve null nele.

function scalePrice(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // A vitrine pública da Shopee devolve preço multiplicado por 100000 (mesma escala usada
  // em /api/shopee/competitors). Preço "normal" (já em reais) não costuma passar de 10000.
  return n > 10000 ? n / 100000 : n;
}

/** Busca o item na vitrine pública da Shopee (shopee.com.br/api/v4/item/get) — devolve preço,
 * preço antes de desconto e total de vendas histórico ("desde sempre"), quando a Shopee libera. */
export async function getPublicItemInfo(shopId, itemId) {
  const url = `https://shopee.com.br/api/v4/item/get?itemid=${encodeURIComponent(itemId)}&shopid=${encodeURIComponent(shopId)}`;
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
      referer: `https://shopee.com.br/product/${shopId}/${itemId}`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
      "x-api-source": "pc",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vitrine pública da Shopee respondeu HTTP ${res.status}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Shopee bloqueou a consulta pública ou devolveu resposta não-JSON.");
  }
  const item = json?.data?.item || json?.item || null;
  if (!item) throw new Error("Shopee não devolveu dados públicos para este item.");
  const historicalSold = Number.isFinite(Number(item.historical_sold)) ? Number(item.historical_sold) : null;
  const price = scalePrice(item.price ?? item.price_min);
  const priceBeforeDiscount = scalePrice(item.price_before_discount);
  return { itemId: String(itemId), historicalSold, price, priceBeforeDiscount };
}

