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
    return <div className="gs-page"><div className="gs-panel">
      <h1 style={{marginTop:0}}>Pedidos</h1>
      <p className="gs-muted">Nenhuma loja Shopee está conectada.</p>
      <a className="gs-action" href="/api/shopee/authorize">Conectar minha loja Shopee</a>
    </div></div>;
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

  const sourceText=loadError
    ?'A última tentativa falhou; nenhum número novo foi inventado.'
    :source==='cache'&&syncedAt
      ?`Servido do cache real · sincronizado em ${new Date(syncedAt).toLocaleString('pt-BR')}`
      :source==='shopee'
        ?'Buscado diretamente da Shopee nesta consulta.'
        :'Origem da atualização não informada.';

  return <div className="gs-page">
    <header className="gs-page-header">
      <div><h1>Pedidos</h1><p>Pedidos reais da loja nos últimos 15 dias.</p></div>
      <RefreshButton apiPath="/api/shopee/orders" timeoutMs={30000}/>
    </header>
    <section className="gs-panel">
      <div className="gs-muted" style={{marginBottom:12}}>{sourceText}</div>
      {loadError&&<div className="gs-error-state">{loadError}</div>}
      {!loadError&&orders.length===0&&<div className="gs-empty-state">A fonte respondeu, mas não retornou pedidos nos últimos 15 dias.</div>}
      {orders.length>0&&<div style={{overflowX:'auto'}}><table>
        <thead><tr><th>Pedido</th><th>Comprador</th><th>Status</th><th>Valor</th></tr></thead>
        <tbody>{orders.map(o=><tr key={o.order_sn}>
          <td><b>{o.order_sn}</b></td>
          <td>{o.buyer_username||'Não informado'}</td>
          <td><span className="chip ok">{STATUS_LABEL[o.order_status]||o.order_status||'Não informado'}</span></td>
          <td>{o.total_amount!=null?fmtMoney(o.total_amount):'Sem dados'}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </div>;}

