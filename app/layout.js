import "./globals.css";
import "./sidebar-standard.css";
import "./motor-senior-theme.css";
import Image from "next/image";
import SidebarOrderGuard from "./components/SidebarOrderGuard";

const themeBootstrap=`(()=>{try{
  const allowed=new Set(['dark','warm','win11','classic','ubuntu','light']);
  const apply=value=>{
    const theme=allowed.has(value)?value:'dark';
    document.documentElement.dataset.gsTheme=theme;
    if(document.body)document.body.dataset.gsTheme=theme;
    return theme;
  };
  let current=apply(localStorage.getItem('gs_theme')||'dark');
  window.addEventListener('storage',e=>{if(e.key==='gs_theme')current=apply(e.newValue||'dark');});
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.data?.source!=='GS_GESTOR_THEME')return;
    const next=apply(e.data.theme);
    if(next!==current){current=next;try{localStorage.setItem('gs_theme',next);}catch{}}
  });
}catch{}})();`;

export const metadata = {
  title: "Gestor Senior",
  description: "Gestão da loja Shopee com dados reais.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{__html:themeBootstrap}} />
        <SidebarOrderGuard />
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
              <a href="/">Dashboard</a>
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
