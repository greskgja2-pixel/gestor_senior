import { getActiveShop } from "../lib/shop";
import { currentShopeeEnv } from "../lib/shopee";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let shop = null;
  let loadError = null;
  let envLabel = null;

  try {
    envLabel = currentShopeeEnv();
  } catch (e) {
    // SHOPEE_PARTNER_ID/KEY ainda não configurados — trata abaixo
  }

  try {
    shop = await getActiveShop();
  } catch (e) {
    loadError = String(e.message || e);
  }

  const missingEnv = [];
  if (!process.env.SHOPEE_PARTNER_ID) missingEnv.push("SHOPEE_PARTNER_ID");
  if (!process.env.SHOPEE_PARTNER_KEY) missingEnv.push("SHOPEE_PARTNER_KEY");
  if (!process.env.SUPABASE_URL) missingEnv.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");

  return (
    <>
      <div className="card">
        <h2>Status da conexão</h2>
        <div className="sub">Ambiente Shopee: {envLabel || "não configurado"} {envLabel === "test" && "(sandbox — dados de teste, não da loja real)"}</div>

        {missingEnv.length > 0 && (
          <div className="error-box" style={{ marginBottom: 14 }}>
            Faltam variáveis de ambiente no projeto Vercel: <b>{missingEnv.join(", ")}</b>.
            Configure em Project Settings → Environment Variables e redeploy.
          </div>
        )}

        {loadError && (
          <div className="error-box" style={{ marginBottom: 14 }}>{loadError}</div>
        )}

        {shop ? (
          <>
            <p>
              <span className="chip ok">✓ loja conectada</span>{" "}
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>shop_id: {shop.shop_id}</span>
            </p>
            <a className="btn ghost" href="/api/shopee/authorize">Reautorizar loja</a>
          </>
        ) : (
          !loadError && missingEnv.length === 0 && (
            <>
              <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
                Nenhuma loja autorizada ainda. Clique abaixo pra conectar sua loja Shopee via
                Gestor Senior.
              </p>
              <a className="btn" href="/api/shopee/authorize">🔗 Conectar minha loja Shopee</a>
            </>
          )
        )}
      </div>

      <div className="card">
        <h2>Próximos passos</h2>
        <div className="sub">Depois de conectar a loja:</div>
        <ul style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.8, paddingLeft: 18 }}>
          <li><a href="/produtos">Produtos</a> — puxa o catálogo real via get_item_list / get_item_base_info</li>
          <li><a href="/pedidos">Pedidos</a> — puxa os pedidos reais dos últimos 15 dias via get_order_list / get_order_detail</li>
        </ul>
      </div>
    </>
  );
}

