export const dynamic = "force-dynamic";

import { getActiveShop } from "../lib/shop";

export default async function HomePage() {
  let shop = null;
  let error = null;
  try {
    shop = await getActiveShop();
  } catch (err) {
    error = String(err.message || err);
  }

  return (
    <main>
      <section className="hero card">
        <p className="eyebrow">PAINEL OPERACIONAL</p>
        <h1>Gestão da sua loja Shopee</h1>
        <p>Produtos e pedidos são carregados pela integração autorizada da Shopee.</p>
        {error ? <div className="error-box">Não foi possível verificar a conexão: {error}</div> : shop ? (
          <div className="connection ok"><b>Loja conectada</b><span>Shop ID {shop.shop_id}</span></div>
        ) : (
          <div className="connection"><b>Nenhuma loja conectada</b><a className="btn" href="/api/shopee/authorize">Conectar loja Shopee</a></div>
        )}
      </section>
      <section className="quick-grid">
        <a className="card quick-link" href="/produtos"><h2>Produtos</h2><p>Consulte o catálogo real e atualize os dados diretamente da Shopee.</p><span>Ver produtos →</span></a>
        <a className="card quick-link" href="/pedidos"><h2>Pedidos</h2><p>Veja os pedidos reais dos últimos 15 dias e atualize a lista.</p><span>Ver pedidos →</span></a>
      </section>
    </main>
  );
}
