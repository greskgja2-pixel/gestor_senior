// A credencial usada em cada requisição pertence à loja da sessão assinada.
// A rotina de renovação de token continua restrita a essa mesma loja.
import { supabaseAdmin } from "./supabase";
import { refreshAccessToken, currentShopeeEnv, getShopInfo } from "./shopee";
import { cookies } from 'next/headers';
import { SESSION_COOKIE, shopIdFromSession } from './shop-session';

const REFRESH_MARGIN_SECONDS = 5 * 60; // renova se faltar menos de 5min pra expirar

function isUnlinkedCredentialError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("shop_no_linked") || message.includes("partner and shop has no linked");
}

export function sessionShopId(){
  return shopIdFromSession(cookies().get(SESSION_COOKIE)?.value);
}

// Uso explícito pelo agendador, depois de autenticar seu segredo próprio.
export async function getShopById(shopId){
  if(!/^[1-9]\d*$/.test(String(shopId||''))||!Number.isSafeInteger(Number(shopId)))return null;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("shop_credentials")
    .select("*")
    .eq('shop_id',Number(shopId))
    .maybeSingle();

  if (error) throw new Error(`Erro lendo shop_credentials: ${error.message}`);
  if (!data) return null; // nenhuma loja autorizada ainda
  if (data.paused) return null; // lojista clicou em "Sair da Shopee": trata como desconectado sem apagar a credencial

  const obtainedAtMs = new Date(data.obtained_at).getTime();
  const expiresAtMs = obtainedAtMs + data.expire_in * 1000;
  const secondsLeft = (expiresAtMs - Date.now()) / 1000;

  if (secondsLeft > REFRESH_MARGIN_SECONDS) {
    return data; // token ainda válido
  }

  // token perto de vencer (ou já vencido) — renova e salva antes de devolver.
  // Ao trocar de sandbox para LIVE, o banco pode ainda conter um refresh_token do
  // Partner de teste. A Shopee responde shop_no_linked nesse caso. Isso não é um
  // erro fatal do site: significa apenas que a loja precisa autorizar o Partner LIVE.
  let refreshed;
  try {
    refreshed = await refreshAccessToken(data.refresh_token, data.shop_id);
  } catch (refreshError) {
    if (isUnlinkedCredentialError(refreshError)) {
      console.warn(
        "[shopee:shop] credencial antiga não pertence ao Partner atual; nova autorização necessária",
        JSON.stringify({ environment: currentShopeeEnv(), shopId: String(data.shop_id) })
      );
      return null;
    }
    // A renovação falhou, mas se o access_token atual ainda não venceu de fato
    // (só estava perto do prazo de 5min), não faz sentido derrubar o painel inteiro
    // por causa disso — continua usando o token que ainda é válido e tenta renovar
    // de novo na próxima chamada. Só propaga o erro se o token já estiver REALMENTE vencido.
    if (secondsLeft > 0) {
      console.warn(
        "[shopee:shop] renovação falhou mas o token atual ainda não venceu; mantendo token atual",
        JSON.stringify({ shopId: String(data.shop_id), secondsLeft, error: String(refreshError.message || refreshError) })
      );
      return data;
    }
    throw refreshError;
  }

  const updated = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expire_in: refreshed.expire_in,
    obtained_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error: updateError } = await db
    .from("shop_credentials")
    .update(updated)
    .eq("id", data.id)
    .eq('shop_id',Number(shopId))
    .select("*")
    .single();
  if (updateError) throw new Error(`Erro salvando token renovado: ${updateError.message}`);
  return saved;
}

export async function getActiveShop(){
  const shopId=sessionShopId();
  return shopId?getShopById(shopId):null;
}

// Compatibilidade com sessões antigas de uma loja pausada: só retoma a loja da sessão.
export async function resumeShop() {
  const shopId=sessionShopId();
  if(!shopId)return false;
  const db = supabaseAdmin();
  const { error } = await db.from("shop_credentials").update({ paused: false }).eq('shop_id',Number(shopId));
  if (error) throw new Error(`Erro reconectando a loja: ${error.message}`);
  return true;
}

// O estado exibido no menu é exclusivo da sessão atual.
export async function getConnectionState() {
  const shopId=sessionShopId();
  if(!shopId)return { connected: false, paused: false, shopId: null, shopName: null };
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("shop_credentials")
    .select("shop_id, paused")
    .eq('shop_id',Number(shopId))
    .maybeSingle();
  if (error) throw new Error(`Erro lendo shop_credentials: ${error.message}`);
  if (!data) return { connected: false, paused: false, shopId: null, shopName: null };
  if (data.paused) return { connected: false, paused: true, shopId: String(data.shop_id), shopName: null };
  const shop = await getActiveShop();
  if (!shop) return { connected: false, paused: false, shopId: null, shopName: null };
  // Nome real da loja é buscado ao vivo na Shopee — nunca inventado. Se a chamada falhar
  // (rate limit, escopo não concedido etc.), o painel simplesmente cai pro Shop ID.
  let shopName = null;
  try {
    const info = await getShopInfo({ shopId: shop.shop_id, accessToken: shop.access_token });
    shopName = info?.shop_name || null;
  } catch (err) {
    console.warn("[shopee:shop] não foi possível obter o nome da loja", String(err.message || err));
  }
  return { connected: true, paused: false, shopId: String(shop.shop_id), shopName };
}
