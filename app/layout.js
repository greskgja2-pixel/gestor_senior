import "./globals.css";
import Image from "next/image";
import LogoutButton from "./components/LogoutButton";

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
              <div className="logo-frame">
                <Image
                  src="/gestor-senior-logo.jpg"
                  alt="Logo Gestor Senior"
                  fill
                  priority
                  sizes="74px"
                />
              </div>
              <span>Gestor Senior</span>
            </div>
            <nav className="tabs">
              <a href="/">Início</a>
              <a href="/produtos">Produtos</a>
              <a href="/pedidos">Pedidos</a>
              <LogoutButton />
            </nav>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
