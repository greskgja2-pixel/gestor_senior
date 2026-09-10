// Cliente Supabase só pro servidor — usa a service role key (nunca exposta ao navegador),
// que ignora RLS. É assim que este app single-shop/sem-login acessa o banco com segurança.
import { createClient } from "@supabase/supabase-js";

let _client = null;

export function supabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas.");
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

