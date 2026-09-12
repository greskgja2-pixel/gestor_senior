// Helper central: pega a credencial da loja autorizada no Supabase, renovando o access_token
// sozinho quando estiver perto de vencer (a Shopee dá ~4h de vida pro access_token e ~30 dias
// pro refresh_token). Como é single-shop, sempre pega a linha mais recente de shop_credentials.
import { supabaseAdmin } from "./supabase";
import { refreshAccessToken, currentShopeeEnv } from "./shopee";

const REFRESH_MARGIN_SECONDS = 5 * 60; // renova se faltar menos de 5min pra expirar

function isUnlinkedCredentialError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("shop_no_linked") || message.includes("partner and shop has no linked");
}

export async function getActiveShop() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("shop_credentials")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Erro lendo shop_credentials: ${error.message}`);
  if (!data) return null; // nenhuma loja autorizada ainda

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
    .select("*")
    .single();
  if (updateError) throw new Error(`Erro salvando token renovado: ${updateError.message}`);
  return saved;
}
