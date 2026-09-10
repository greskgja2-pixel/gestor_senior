import { getActiveShop } from "../../lib/shop";
import { getOrders } from "../../lib/orders";
import RefreshButton from "../components/RefreshButton";

export const dynamic = "force-dynamic";

function fmtMoney(v) {
  const n = Number(v || 0);
  return "R$ " + n.toFixed(2).replace(".", ",");
}

const STATUS_LABEL = {
  UNPAID: "Não pago",
  READY_TO_SHIP: "Pronto pra envio",
  PROCESSED: "Processado",
  SHIPPED: "Enviado",
  COMPLETED: "Concluído",
  IN_CANCEL: "Cancelando",
  CANCELLED: "Cancelado",
  INVOICE_PENDING: "Nota pendente",
};

export default async function PedidosPage() {
  const shop = await getActiveShop();
  if (!shop) {
    return (
      <div className="card">
        <h2>Pedidos</h2>
        <p className="sub">Nenhuma loja autorizada ainda.</p>
        <a className="btn" href="/api/shopee/authorize">🔗 Conectar minha loja Shopee</a>
      </div>
    );
  }

  let orders = [], source = null, syncedAt = null, loadError = null;
  try {
    const result = await getOrders(shop);
    orders = result.orders;
    source = result.source;
    syncedAt = result.syncedAt;
  } catch (e) {
    loadError = String(e.message || e);
  }

  return (
    <div className="card">
      <div className="meta-row">
        <h2 style={{ margin: 0 }}>Pedidos ({orders.length}) · últimos 15 dias</h2>
        <RefreshButton apiPath="/api/shopee/orders" />
      </div>
      <div className="sub">
        {source === "cache" ? `Servido do cache · sincronizado em ${new Date(syncedAt).toLocaleString("pt-BR")}` : "Buscado agora direto da Shopee"}
      </div>

      {loadError && <div className="error-box">{loadError}</div>}

      {!loadError && orders.length === 0 && (
        <div className="empty-note">Nenhum pedido encontrado nos últimos 15 dias (ou a sincronização ainda não rodou — clique em Atualizar).</div>
      )}

      {orders.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Comprador</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_sn}>
                <td><b>{o.order_sn}</b></td>
                <td>{o.buyer_username || "—"}</td>
                <td><span className="chip ok">{STATUS_LABEL[o.order_status] || o.order_status}</span></td>
                <td>{o.total_amount != null ? fmtMoney(o.total_amount) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

