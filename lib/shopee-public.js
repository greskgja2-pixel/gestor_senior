// Dados públicos da própria vitrine Shopee (sem autenticação Partner) — mesma técnica já usada
// em /api/shopee/competitors (que busca por palavra-chave). Aqui usamos primeiro o endpoint que
// lista os itens de UMA loja (o mesmo que a página pública da loja usa pra paginar produtos),
// porque ele devolve o total de vendas histórico ("desde sempre") de vários itens em UMA
// chamada só — mais rápido e mais confiável do que consultar item por item. Quando um item não
// aparece nessa listagem (loja muito grande, item pausado etc.), caímos pro item/get individual
// como reserva. Nunca inventa número: se a Shopee não devolver o campo, ou bloquear a consulta,
// a função explica o motivo (pra aparecer como dica no painel) em vez de chutar um valor.

const PAGE_SIZE = 50;
const MAX_PAGES = 6; // até 300 itens — cobre lojas bem maiores que o catálogo atual

function scalePrice(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 10000 ? n / 100000 : n;
}
function finiteOrNull(v){const n=Number(v);return v===null||v===undefined||v===''||!Number.isFinite(n)?null:n;}
function ratingInfo(item){
  const r=item?.item_rating||item?.rating||{};
  const rating=finiteOrNull(r?.rating_star??item?.rating_star);
  const counts=r?.rating_count;
  let reviewCount=null;
  if(Array.isArray(counts))reviewCount=finiteOrNull(counts[0]);
  else reviewCount=finiteOrNull(counts??item?.rating_count??item?.review_count);
  return{rating,reviewCount};
}

function commonHeaders(shopId, itemIdForReferer) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
    referer: itemIdForReferer
      ? `https://shopee.com.br/product/${shopId}/${itemIdForReferer}`
      : `https://shopee.com.br/shop/${shopId}`,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
    "x-api-source": "pc",
  };
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000), headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vitrine pública da Shopee respondeu HTTP ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`Shopee bloqueou a consulta pública ou devolveu resposta não-JSON (início: "${text.slice(0, 120).replace(/\s+/g, " ")}")`); }
}

function unwrapItemBasic(raw) {
  const ib = raw?.item_basic || raw?.item || raw;
  if (!ib) return null;
  const itemId = ib.itemid ?? ib.item_id;
  if (!itemId) return null;
  const historicalSold = finiteOrNull(ib.historical_sold);
  const {rating,reviewCount}=ratingInfo(ib);
  return {
    itemId: String(itemId), historicalSold,
    price: scalePrice(ib.price ?? ib.price_min),
    priceBeforeDiscount: scalePrice(ib.price_before_discount),
    rating, reviewCount,
    stock: finiteOrNull(ib.stock ?? ib.stock_info?.normal_stock ?? ib.stock_info_v2?.summary_info?.total_available_stock),
  };
}

export async function getShopItemsPublic(shopId) {
  const map = new Map(); let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `https://shopee.com.br/api/v4/shop/get_items?shopid=${encodeURIComponent(shopId)}&offset=${offset}&limit=${PAGE_SIZE}&is_preview=0`;
    const json = await fetchJson(url, commonHeaders(shopId));
    const items = json?.item || json?.data?.item || json?.items || [];
    if (!Array.isArray(items) || !items.length) break;
    items.forEach((raw) => { const parsed = unwrapItemBasic(raw); if (parsed) map.set(parsed.itemId, parsed); });
    if (items.length < PAGE_SIZE) break; offset += PAGE_SIZE;
  }
  return map;
}

export async function getPublicItemInfo(shopId, itemId) {
  let pdpError=null;
  try {
    const pdpUrl = `https://shopee.com.br/api/v4/pdp/get_pc?shop_id=${encodeURIComponent(shopId)}&item_id=${encodeURIComponent(itemId)}`;
    const pdp = await fetchJson(pdpUrl, commonHeaders(shopId, itemId));
    const item = pdp?.data?.item || null;
    if (item) {
      const shopDetailed=pdp?.data?.shop_detailed||pdp?.data?.shop_detail||pdp?.data?.shop||{};
      const {rating,reviewCount}=ratingInfo(item);
      const preferredRaw=shopDetailed?.is_preferred_plus_seller ?? shopDetailed?.is_preferred_shop ?? shopDetailed?.is_preferred_seller;
      const preferred=preferredRaw===true||preferredRaw===1?true:(preferredRaw===false||preferredRaw===0?false:null);
      const shopName=String(shopDetailed?.name||shopDetailed?.shop_name||'').trim()||null;
      const shopUsername=String(shopDetailed?.account?.username||shopDetailed?.username||'').trim()||null;
      const shopLocation=String(shopDetailed?.shop_location||item?.shop_location||pdp?.data?.product_shipping?.shipping_fee_info?.ship_from_location||'').trim()||null;
      const shopUrl=shopUsername?`https://shopee.com.br/${encodeURIComponent(shopUsername)}`:`https://shopee.com.br/shop/${encodeURIComponent(shopId)}`;
      return {
        itemId: String(itemId),
        title: String(item?.title||item?.name||'').trim()||null,
        historicalSold: finiteOrNull(pdp?.data?.product_review?.historical_sold ?? item?.historical_sold),
        price: scalePrice(item?.price ?? item?.price_min ?? pdp?.data?.product_price?.price?.single_value),
        priceBeforeDiscount: scalePrice(item?.price_before_discount ?? pdp?.data?.product_price?.price_before_discount?.single_value),
        rating, reviewCount,
        stock: finiteOrNull(item?.stock ?? item?.normal_stock ?? item?.stock_info?.normal_stock ?? item?.stock_info_v2?.summary_info?.total_available_stock),
        preferred, shopName, shopUsername, shopUrl, shopLocation,
        preferredEvidence: preferred===null?null:'pdp.shop_detailed.is_preferred'
      };
    }
  } catch (error) {
    pdpError=error;
  }

  const url = `https://shopee.com.br/api/v4/item/get?itemid=${encodeURIComponent(itemId)}&shopid=${encodeURIComponent(shopId)}`;
  const json = await fetchJson(url, commonHeaders(shopId, itemId));
  const item = json?.data?.item || json?.item || null;
  if (!item) {
    const keys = json && typeof json === "object" ? Object.keys(json).join(", ") : "resposta vazia";
    const prefix=pdpError?`PDP falhou (${String(pdpError.message||pdpError)}). `:'';
    throw new Error(prefix+`Shopee não devolveu dados públicos para este item (chaves recebidas: ${keys || "nenhuma"}).`);
  }
  const {rating,reviewCount}=ratingInfo(item);
  return {
    itemId: String(itemId),
    title:String(item?.name||item?.title||'').trim()||null,
    historicalSold: finiteOrNull(item.historical_sold),
    price: scalePrice(item.price ?? item.price_min),
    priceBeforeDiscount: scalePrice(item.price_before_discount),
    rating, reviewCount,
    stock: finiteOrNull(item.stock ?? item.stock_info?.normal_stock ?? item.stock_info_v2?.summary_info?.total_available_stock),
    shopLocation:String(item?.shop_location||'').trim()||null
  };
}
