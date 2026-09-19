import "./globals.css";
import "./motor-senior-theme.css";
import "./app-shell.css";
import AppShell from "./components/AppShell";
import { Suspense } from "react";

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
        <Suspense fallback={<div style={{minHeight:"100vh",background:"var(--gs-shell-bg,#f4f7fb)"}} />}><AppShell>{children}</AppShell></Suspense>
      </body>
    </html>
  );
}
