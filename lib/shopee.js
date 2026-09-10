// Cliente mínimo da Shopee Open Platform (Partner API v2).
// Documentação: https://open.shopee.com/documents
//
// Duas famílias de assinatura (HMAC-SHA256, hex, usando a Partner Key como segredo):
//   - API pública (ex.: gerar a URL de autorização, trocar code por token):
//       base = partner_id + api_path + timestamp
//   - API de loja (product/order/etc., já autorizada):
//       base = partner_id + api_path + timestamp + access_token + shop_id
//
// Regras importantes (conferidas contra a documentação oficial):
//   - api_path é SÓ o path (ex.: "/api/v2/auth/token/get"), nunca a URL completa e nunca com querystring.
//   - timestamp é o MESMO valor (segundos Unix, inteiro) usado tanto na assinatura quanto na requisição.
//   - sign é hex lowercase (crypto digest("hex") já devolve lowercase).
//   - Partner Key NUNCA é enviada como parâmetro — só é usada como segredo do HMAC.
//   - auth/token/get e auth/access_token/get são endpoints "públicos" (não usam access_token/shop_id
//     na assinatura), mesmo que o body da requisição carregue code/shop_id — isso é uma pegadinha comum.
//
// Nenhum segredo (Partner Key, access_token, refresh_token) deve chegar ao navegador —
// este arquivo só deve ser importado por código que roda no servidor (API routes / route handlers).

import crypto from "crypto";

const HOSTS = {
  live: "https://partner.shopeemobile.com",
  test: "https://partner.test-stable.shopeemobile.com",
};

function env(name, { required = true } = {}) {
  const v = process.env[name];
  if (required && !v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

function shopeeEnv() {
  return (process.env.SHOPEE_ENV || "test").toLowerCase() === "live" ? "live" : "test";
}

function baseHost() {
  return HOSTS[shopeeEnv()];
}

function sign(baseString, partnerKey) {
  return crypto.createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

// Log estruturado seguro — nunca inclui SHOPEE_PARTNER_KEY, access_token, refresh_token
// ou SUPABASE_SERVICE_ROLE_KEY. Só metadados úteis pra diagnosticar no painel da Vercel.
function logDiag(event, data = {}) {
  try {
    console.log(`[shopee:${event}]`, JSON.stringify(data));
  } catch {
    // nunca deixa um erro de log quebrar o fluxo
  }
}

/** Assinatura pra chamadas de loja já autorizada (a maioria das APIs de produto/pedido). */
function signedShopRequest(path, { shopId, accessToken, extraParams = {} } = {}) {
  const partnerId = env("SHOPEE_PARTNER_ID");
  const partnerKey = env("SHOPEE_PARTNER_KEY");
  const timestamp = Math.floor(Date.now() / 1000);
  const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const signature = sign(base, partnerKey);
  const params = new URLSearchParams({
    partner_id: partnerId,
    timestamp: String(timestamp),
    sign: signature,
    shop_id: String(shopId),
    access_token: accessToken,
    ...extraParams,
  });
  return { url: `${baseHost()}${path}?${params.toString()}`, timestamp, signature };
}

/** Assinatura pra chamadas públicas (sem access_token/shop_id) — ex.: montar a URL de autorização,
 *  auth/token/get, auth/access_token/get. */
function signedPublicRequest(path, extraParams = {}) {
  const partnerId = env("SHOPEE_PARTNER_ID");
  const partnerKey = env("SHOPEE_PARTNER_KEY");
  const timestamp = Math.floor(Date.now() / 1000);
  const base = `${partnerId}${path}${timestamp}`;
  const signature = sign(base, partnerKey);
  const params = new URLSearchParams({
    partner_id: partnerId,
    timestamp: String(timestamp),
    sign: signature,
    ...extraParams,
  });

  logDiag("sign_public", {
    env: shopeeEnv(),
    host: baseHost(),
    partnerId,
    apiPath: path,
    timestamp,
    partnerKeyConfigured: Boolean(process.env.SHOPEE_PARTNER_KEY),
    partnerKeyLength: (process.env.SHOPEE_PARTNER_KEY || "").length,
  });

  return { url: `${baseHost()}${path}?${params.toString()}`, timestamp, signature, partnerId };
}

/** Lê a resposta da Shopee com segurança: tenta JSON, mas nunca quebra se vier HTML/texto puro
 *  (ex.: página de erro do host, rate limit, etc.) — devolve sempre { ok, status, json, rawText }. */
async function readShopeeResponse(res) {
  const rawText = await res.text();
  let json = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, rawText };
}

/** URL pra onde mandar o lojista autorizar a loja (fluxo "Shop Authorization"). */
export function buildShopAuthUrl(redirectUrl) {
  const { url } = signedPublicRequest("/api/v2/shop/auth_partner", { redirect: redirectUrl });
  return url;
}

/** Troca o `code` recebido no callback por access_token/refresh_token.
 *  auth/token/get é uma API "pública" pra fins de assinatura (não leva access_token/shop_id
 *  no base string) mesmo que code/shop_id vão só no body da requisição. */
export async function exchangeCodeForToken(code, shopId) {
  const path = "/api/v2/auth/token/get";
  const { url, timestamp, partnerId } = signedPublicRequest(path);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, shop_id: Number(shopId), partner_id: Number(partnerId) }),
    });
  } catch (networkErr) {
    logDiag("token_network_error", { apiPath: path, timestamp, message: String(networkErr.message || networkErr) });
    throw new Error(`Falha de rede chamando ${path}: ${String(networkErr.message || networkErr)}`);
  }

  const { ok, status, json, rawText } = await readShopeeResponse(res);

  logDiag("token_response", {
    env: shopeeEnv(),
    host: baseHost(),
    apiPath: path,
    timestamp,
    shopIdPresent: shopId != null,
    codePresent: Boolean(code),
    httpStatus: status,
    httpOk: ok,
    shopeeError: json?.error || null,
    shopeeMessage: json?.message || null,
    hasAccessToken: Boolean(json?.access_token),
    rawTextSnippet: json ? undefined : String(rawText || "").slice(0, 300),
  });

  if (!ok) {
    throw new Error(
      `Shopee auth/token/get respondeu HTTP ${status}${json?.error ? ` — ${json.error}: ${json.message || ""}` : ""}`
    );
  }
  if (json?.error) {
    throw new Error(`Shopee auth/token/get: ${json.error} — ${json.message || ""}`);
  }
  if (!json?.access_token) {
    throw new Error(`Shopee auth/token/get: resposta sem access_token (HTTP ${status}).`);
  }

  return json;
}

export async function refreshAccessToken(refreshToken, shopId) {
  const path = "/api/v2/auth/access_token/get";
  const { url, timestamp, partnerId } = signedPublicRequest(path);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, shop_id: Number(shopId), partner_id: Number(partnerId) }),
  });

  const { ok, status, json, rawText } = await readShopeeResponse(res);

  logDiag("refresh_token_response", {
    env: shopeeEnv(),
    apiPath: path,
    timestamp,
    httpStatus: status,
    httpOk: ok,
    shopeeError: json?.error || null,
    rawTextSnippet: json ? undefined : String(rawText || "").slice(0, 300),
  });

  if (!ok || json?.error) {
    throw new Error(`Shopee auth/access_token/get: ${json?.error || `HTTP ${status}`} — ${json?.message || ""}`);
  }
  return json;
}

/** GET genérico assinado pra uma API de loja. `params` vira querystring. */
async function shopGet(path, { shopId, accessToken, params = {} } = {}) {
  const { url } = signedShopRequest(path, { shopId, accessToken, extraParams: params });
  const res = await fetch(url, { method: "GET" });
  const { ok, status, json } = await readShopeeResponse(res);
  if (!ok || json?.error) {
    throw new Error(`Shopee ${path}: ${json?.error || `HTTP ${status}`} — ${json?.message || ""}`);
  }
  return json;
}

export async function getItemList({ shopId, accessToken, offset = 0, pageSize = 50, itemStatus = "NORMAL" }) {
  return shopGet("/api/v2/product/get_item_list", {
    shopId, accessToken,
    params: { offset, page_size: pageSize, item_status: itemStatus },
  });
}

export async function getItemBaseInfo({ shopId, accessToken, itemIdList }) {
  return shopGet("/api/v2/product/get_item_base_info", {
    shopId, accessToken,
    params: { item_id_list: itemIdList.join(",") },
  });
}

export async function getOrderList({ shopId, accessToken, timeFrom, timeTo, pageSize = 20, cursor = "" }) {
  return shopGet("/api/v2/order/get_order_list", {
    shopId, accessToken,
    params: {
      time_range_field: "create_time",
      time_from: timeFrom,
      time_to: timeTo,
      page_size: pageSize,
      cursor,
    },
  });
}

export async function getOrderDetail({ shopId, accessToken, orderSnList }) {
  return shopGet("/api/v2/order/get_order_detail", {
    shopId, accessToken,
    params: {
      order_sn_list: orderSnList.join(","),
      response_optional_fields: "item_list,total_amount,buyer_username,order_status,create_time",
    },
  });
}

export function currentShopeeEnv() {
  return shopeeEnv();
}

