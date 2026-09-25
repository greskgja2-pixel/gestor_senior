// Cliente Supabase só pro servidor — usa a service role key (nunca exposta ao navegador),
// que ignora RLS. Cada acesso a dados de lojista precisa usar o shop_id da
// sessão verificada no servidor; nunca selecionar a loja mais recente global.
import { createClient } from "@supabase/supabase-js";

let _client = null;

// O supabase-js chama o Postgrest por baixo usando fetch(). No Next.js (App Router), o fetch
// global é "empacotado" com cache automático — mesma URL+corpo pode voltar uma resposta
// cacheada em vez de bater no banco de novo. Isso já causou um bug real: getActiveShop()
// (que usa .select("*")) ficava recebendo uma linha de shop_credentials desatualizada,
// de ANTES de uma reautorização, mesmo com o banco já tendo a linha nova — porque a query
// com esse "select=*" específico batia no cache. Forçando cache:"no-store" aqui garante que
// toda leitura de credencial/pedido/produto sempre vem direto do Postgres, nunca de um cache.
function noStoreFetch(url, options = {}) {
  return fetch(url, { ...options, cache: "no-store" });
}

export function supabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas.");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  });
  return _client;
}
