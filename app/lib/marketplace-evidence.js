// Contrato único de dados públicos da busca Shopee (Motor Sênior e fallback do servidor).
// Não faz requisições, não manipula credenciais e não gera dados ausentes.
// Um campo só é "observado" quando aparece no payload recebido.
const finite = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const nonempty = value => value === null || value === undefined ? null : (String(value).trim() || null);
const amount = value => {
  const n = finite(value);
  return n === null ? null : (n > 10000 ? n / 100000 : n);
};
const bool = value => {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
};
const item = raw => raw?.item_basic || raw?.item || raw?.product || raw || {};
const first = (...values) => values.find(v => v !== null && v !== undefined && v !== '');

export function extractMarketplaceRows(payload) {
  const root = payload?.data ?? payload;
  if (Array.isArray(root)) return root;
  if (!root || typeof root !== 'object') return [];
  const candidates = [
    root.items, root.results, root.products, root.search_items, root.searchItems,
    root.data?.items, root.data?.results, root.data?.products,
    root.discovery?.items, root.discovery?.results
  ];
  const found = candidates.find(a => Array.isArray(a) && a.length);
  if (found) return found;
  const discovered = root.discovery?.candidates;
  return discovered && typeof discovered === 'object' && !Array.isArray(discovered)
    ? Object.values(discovered) : [];
}

function explicitAds(raw, basic) {
  // ads_id, adsid e selo "Indicado" NÃO são prova de patrocínio.
  const keys = ['is_ads', 'is_ad', 'is_sponsored', 'isSponsored', 'sponsored_listing'];
  for (const scope of [raw, basic]) {
    if (!scope || typeof scope !== 'object') continue;
    for (const key of keys) {
      const signal = bool(scope[key]);
      if (signal !== null) return {status: signal ? 'detected' : 'not_detected', evidence: key};
    }
  }
  if (/(^|\n)\s*Ad\s*(\n|$)/i.test(String(raw?.searchText || basic?.searchText || ''))) {
    return {status: 'detected', evidence: 'search-label-ad'};
  }
  return {status: 'unknown', evidence: null};
}

export function marketplaceItemEvidence(raw, {source = 'unspecified', collectedAt = null} = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const basic = item(raw);
  const itemId = nonempty(first(basic.itemid, basic.item_id, raw.itemid, raw.itemId, raw.item_id));
  const shopId = nonempty(first(basic.shopid, basic.shop_id, raw.shopid, raw.shopId, raw.shop_id));
  if (!itemId) return null;
  const rating = basic.item_rating || raw.item_rating || {};
  const ratingCounts = first(rating.rating_count, basic.rating_count, raw.reviewCount, raw.review_count);
  const reviewCount = Array.isArray(ratingCounts) ? finite(ratingCounts[0]) : finite(ratingCounts);
  const price = amount(first(basic.price, basic.price_min, basic.price_min_before_discount, raw.price));
  const originalPrice = amount(first(basic.price_before_discount, basic.original_price, raw.originalPrice, raw.original_price));
  const sold = finite(first(basic.historical_sold, basic.sold, raw.historicalSold, raw.sold));
  const monthlyRaw = finite(first(basic.monthly_sold, basic.sold_30d, raw.monthlySold, raw.monthly_sold, raw.sold_30d));
  const monthlyFlag = [
    basic.monthly_sold_estimated, raw.monthly_sold_estimated, raw.monthlySoldEstimated,
    raw.isMonthlySalesEstimated, raw.monthlySalesEstimated
  ].some(v => bool(v) === true);
  const monthlySource = String(first(raw.monthlySoldSource, raw.monthly_sold_source, basic.monthly_sold_source) || '').toLowerCase();
  const estimated = monthlyFlag || /estimat|infer|calculat|projection/.test(monthlySource);
  const monthlySold = estimated ? null : monthlyRaw;
  const preferredFlags = [
    basic.is_preferred_plus_seller, basic.is_preferred_shop, basic.is_preferred_seller,
    raw.is_preferred_shop, raw.is_preferred_seller
  ].map(bool).filter(v => v !== null);
  const preferred = preferredFlags.length ? preferredFlags.some(Boolean) : null;
  const location = nonempty(first(
    basic.shop_location, basic.location, basic.shop_location_name, basic.seller_location,
    raw.shopLocation, raw.shop_location, raw.seller_location, raw.location
  ));
  const evidence = {};
  for (const [key, value] of Object.entries({price, originalPrice, sold, monthlySold, reviewCount, location})) {
    evidence[key] = {kind: value === null ? 'unavailable' : 'observed', source: value === null ? null : source};
  }
  if (estimated && monthlyRaw !== null) evidence.monthlySold = {kind: 'estimated-excluded', source};
  return {
    itemId, shopId,
    title: nonempty(first(basic.name, basic.item_name, raw.title, raw.name)),
    price, originalPrice, sold, monthlySold,
    estimatedMonthlySold: estimated ? monthlyRaw : null,
    rating: finite(first(rating.rating_star, basic.rating_star, raw.rating)),
    reviewCount, location, preferred,
    ads: explicitAds(raw, basic),
    provenance: {source, collectedAt, fields: evidence}
  };
}
