import "./globals.css";

export const metadata = {
  title: "Gestor Senior",
  description: "Gestão da loja Shopee com dados reais.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">
          <div className="topbar">
            <div className="brand">
              <img src="/logo-mark.png" alt="Gestor Senior" className="logo-img" />
              Gestor Senior
            </div>
            <nav className="tabs">
              <a href="/">Início</a>
              <a href="/produtos">Produtos</a>
              <a href="/pedidos">Pedidos</a>
            </nav>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
