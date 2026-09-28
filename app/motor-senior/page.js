import Link from 'next/link';

export const metadata={title:'Motor Sênior — Atualizações'};

export default function MotorSeniorUpdatePage(){
  return <main style={{minHeight:'100vh',background:'#07111d',color:'#edf5fd',padding:'32px 18px',fontFamily:'system-ui,Segoe UI,sans-serif'}}>
    <section style={{maxWidth:720,margin:'0 auto',border:'1px solid #27415e',borderRadius:18,background:'#0c1c2d',padding:24}}>
      <small style={{color:'#8ddcff',fontWeight:800}}>ATUALIZAÇÕES OFICIAIS</small>
      <h1 style={{margin:'8px 0',color:'#f2d36d'}}>Motor Sênior v0.17.6</h1>
      <p style={{color:'#b8c9d8',lineHeight:1.6}}>Esta é a versão oficial mais recente registrada pelo Gestor Sênior. A partir da v0.17.6, o próprio Motor verifica periodicamente se existe uma versão nova e avisa o usuário.</p>
      <div style={{margin:'18px 0',padding:14,borderRadius:12,background:'#10263b',border:'1px solid #294866'}}>
        <b>Como funciona</b>
        <p style={{color:'#b8c9d8',margin:'7px 0 0'}}>O Motor consulta o manifesto oficial do Gestor a cada 6 horas e também ao iniciar. Se a versão publicada for superior à instalada, aparece uma notificação e o painel mostra a atualização disponível.</p>
      </div>
      <p style={{color:'#91a8bc',fontSize:13}}>Instalações manuais por ZIP ainda precisam que o usuário substitua/recarregue a extensão no navegador. O Motor não troca arquivos silenciosamente.</p>
      <Link href="/super-analise" style={{display:'inline-block',marginTop:12,padding:'11px 14px',borderRadius:9,background:'#1769e8',color:'#fff',fontWeight:800,textDecoration:'none'}}>Voltar ao Gestor Sênior</Link>
    </section>
  </main>;
}
