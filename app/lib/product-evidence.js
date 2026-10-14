// Contrato compartilhado para dados de produto, usados na Super Análise e reanálise.
// Dados ausentes NÃO tornam dados antigos "atuais"; IDs divergentes são rejeitados.
const present = v => v !== null && v !== undefined && v !== '';
const num = v => {
  if (!present(v) || typeof v === 'boolean') return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : null;
};
const first = (...values) => values.find(present);
const text = v => present(v) ? String(v).trim() || null : null;
const id = (...values) => text(first(...values));
const metric = (product, key) => {
  if (!product || typeof product !== 'object') return null;
  const priceInfo = Array.isArray(product.price_info) ? product.price_info[0] : null;
  const ratingInfo = product.item_rating;
  const ratingCounts = ratingInfo?.rating_count;
  const count = Array.isArray(ratingCounts) ? ratingCounts[0] : ratingCounts;
  const from = {
    price: first(product.price, product.currentPrice, priceInfo?.current_price),
    sold: first(product.historicalSold, product.sold),
    rating: first(product.rating, product.rating_star, ratingInfo?.rating_star),
    reviewCount: first(product.reviewCount, product.review_count, count),
    stock: first(product.stock, product.availableStock, product.stock_info_v2?.summary_info?.total_available_stock),
    originalPrice: first(product.originalPrice, product.priceBeforeDiscount, priceInfo?.original_price)
  };
  const value = num(from[key]);
  return key === 'rating' && value !== null && value > 5 ? null : value;
};
const metrics = ['price','sold','rating','reviewCount','stock','originalPrice'];

export function beginProductReanalysis(previous={}) {
  const old = previous && typeof previous === 'object' ? previous : {};
  const oldFields = old.collectionEvidence?.fields || {};
  const fields = {};
  for (const key of metrics) {
    const value = metric(old,key);
    if (value !== null) fields[key] = {
      kind:'historical', source:oldFields[key]?.source || 'prior-analysis',
      previousCollectedAt:oldFields[key]?.collectedAt || old.collectedAt || null
    };
  }
  return {...old,collectionEvidence:{fields,rejectedSources:[]}};
}

export function mergeObservedProduct(previous={},fresh,{source='unknown',expectedItemId=null,expectedShopId=null,collectedAt=null}={}) {
  const before = previous && typeof previous === 'object' ? previous : {};
  if (!fresh || typeof fresh !== 'object') return before;
  const expectedId = id(expectedItemId);
  const incomingId = id(fresh.itemId,fresh.item_id,fresh.itemid);
  const expectedShop = id(expectedShopId);
  const incomingShop = id(fresh.shopId,fresh.shop_id,fresh.shopid);
  const baseEvidence = before.collectionEvidence || {};
  const rejected = [...(baseEvidence.rejectedSources || [])];
  if ((expectedId && incomingId !== expectedId) ||
      (expectedShop && incomingShop && expectedShop !== incomingShop)) {
    return {...before, collectionEvidence:{
      ...baseEvidence,
      rejectedSources:[...rejected,{source,reason:incomingId !== expectedId ? 'item-id-mismatch' : 'shop-id-mismatch'}]
    }};
  }
  // Nunca sobrescreve informações válidas por null retornado por API parcial.
  const next = {...before};
  for (const [key,value] of Object.entries(fresh)) {
    if (present(value) && key !== 'collectionEvidence' && key !== 'provenance') next[key]=value;
  }
  const fields={...(baseEvidence.fields || {})};
  for (const key of metrics) {
    if (!fields[key] && metric(before,key) !== null) {
      fields[key]={kind:'historical',source:'legacy-snapshot'};
    }
    const value=metric(fresh,key);
    if (value !== null) {
      next[key]=value;
      fields[key]={kind:'observed',source,collectedAt};
    }
  }
  const title = text(first(fresh.title,fresh.item_name,fresh.name));
  if (title) next.title=title;
  if (incomingId) {next.itemId=incomingId;next.item_id=incomingId;}
  if (incomingShop) next.shopId=incomingShop;
  const image = text(first(fresh.imageUrl,fresh.image_url,fresh.image?.image_url_list?.[0]));
  if (image) next.imageUrl=image;
  if (Array.isArray(fresh.imageUrls) && fresh.imageUrls.length) next.imageUrls=fresh.imageUrls;
  if (Array.isArray(fresh.image?.image_url_list) && fresh.image.image_url_list.length) next.imageUrls=fresh.image.image_url_list;
  next.collectionEvidence={fields,rejectedSources:rejected};
  return next;
}

export function observedValue(snapshot,key) {
  const kind=snapshot?.collectionEvidence?.fields?.[key]?.kind;
  if (kind && kind !== 'observed') return null;
  return metric(snapshot,key);
}
