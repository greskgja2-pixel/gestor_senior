// Read-only helpers for Shopee catalog metadata used by the live product editor.
// Kept separate from the main client so the existing, working auth/product sync flow stays untouched.
import crypto from "crypto";

const HOSTS = {
  live: "https://partner.shopeemobile.com",
  test: "https://openplatform.sandbox.test-stable.shopee.sg",
};

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

function baseHost() {
  const mode = (process.env.SHOPEE_ENV || "test").trim().toLowerCase();
  if (!HOSTS[mode]) throw new Error("SHOPEE_ENV deve ser test ou live.");
  return HOSTS[mode];
}

async function signedGet(path, shop, params = {}) {
  const partnerId = env("SHOPEE_PARTNER_ID");
  const partnerKey = env("SHOPEE_PARTNER_KEY");
  const timestamp = Math.floor(Date.now() / 1000);
  const shopId = String(shop.shop_id);
  const accessToken = String(shop.access_token);
  const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const sign = crypto.createHmac("sha256", partnerKey).update(base).digest("hex");
  const query = new URLSearchParams({
    partner_id: partnerId,
    timestamp: String(timestamp),
    sign,
    shop_id: shopId,
    access_token: accessToken,
  });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });

  const res = await fetch(`${baseHost()}${path}?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const raw = await res.text();
  let json = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
  if (!res.ok || json?.error) {
    throw new Error(`Shopee ${path}: ${json?.error || `HTTP ${res.status}`} — ${json?.message || raw.slice(0, 200) || "erro desconhecido"}`);
  }
  return json || {};
}

export function getCategories(shop) {
  return signedGet("/api/v2/product/get_category", shop, { language: "pt-br" });
}

// get_attributes was retired/offlined for this LIVE partner. Shopee's current
// product metadata endpoint is get_attribute_tree.
export function getAttributes(shop, categoryId) {
  return signedGet("/api/v2/product/get_attribute_tree", shop, {
    category_id: categoryId,
    language: "pt-BR",
  });
}

export function getBrands(shop, categoryId, offset = 0, pageSize = 100) {
  return signedGet("/api/v2/product/get_brand_list", shop, {
    category_id: categoryId,
    offset,
    page_size: pageSize,
    status: 1,
  });
}

export function getModelList(shop, itemId) {
  return signedGet("/api/v2/product/get_model_list", shop, { item_id: itemId });
}
