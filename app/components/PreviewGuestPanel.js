import Link from 'next/link';

const NAV=[
  {href:'/',icon:'◈',name:'Visão geral',note:'Camada de coleta'},
  {href:'/pesquisa-produtos',icon:'⌕',name:'Pesquisa de Produtos',note:'Tela interativa sem dados privados'},
  {href:'/extensao-shopee-intelligence?section=concorrentes',icon:'◎',name:'Concorrentes',note:'Radar e procedência'},
  {href:'/extensao-shopee-intelligence?section=super-anuncio',icon:'▣',name:'Super Anúncio',note:'Histórico de análises'},
  {href:'/super-analise',icon:'✦',name:'Super Análise',note:'Validação por anúncio'}
];

export default function PreviewGuestPanel({section='Visão geral'}){
  return <div style={{padding:'clamp(18px,3vw,36px)',maxWidth:1260,margin:'0 auto',color:'var(--gs-text,#1c3154)'}}>
    <div style={{background:'linear-gradient(118deg,#172851,#1c4d82)',color:'white',borderRadius:20,padding:'clamp(22px,4vw,42px)',marginBottom:20}}>
      <div style={{display:'inline-flex',alignItems:'center',fontWeight:800,fontSize:12,background:'rgba(255,255,255,.15)',padding:'8px 12px',borderRadius:999,marginBottom:16}}>MODO PRÉVIA · SEM LOGIN</div>
      <h1 style={{fontSize:'clamp(27px,4vw,37px)',lineHeight:1.15,margin:'0 0 12px'}}>Gestor Sênior — {section}</h1>
      <p style={{fontSize:15,lineHeight:1.7,margin:0,maxWidth:780,opacity:.94}}>Acesse as páginas para conferir o projeto de Coleta Unificada. Esta visualização não utiliza produtos, vendas, anúncios ou credenciais da sua loja.</p>
    </div>
    <div style={{background:'#fff7e6',border:'1px solid #ebd5a1',borderRadius:12,padding:'13px 17px',marginBottom:20,color:'#71501c',fontSize:14,lineHeight:1.6}}>
      <b>Prévia somente para apresentação.</b> O acesso aos dados reais da Shopee, aos históricos do Supabase e às ações de gravação continua protegido. A Pesquisa de Produtos pode ser aberta para verificar a interface e a presença do Motor, mas recursos que dependam de APIs autenticadas não ficam liberados.
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,marginBottom:24}}>
      {NAV.map(link=><Link key={link.href} href={link.href} style={{textDecoration:'none',display:'flex',flexDirection:'column',gap:10,padding:'21px 18px',background:'var(--gs-card-bg,#fff)',border:'1px solid #d6e1ec',borderRadius:15,color:'inherit'}}>
        <span style={{fontSize:30,color:'#2264b1'}}>{link.icon}</span>
        <b style={{fontSize:16}}>{link.name}</b>
        <small style={{fontSize:13,opacity:.8}}>{link.note}</small>
        <span style={{fontWeight:700,color:'#296eb8',marginTop:'auto'}}>Abrir →</span>
      </Link>)}
    </div>
    <section style={{borderRadius:16,background:'var(--gs-card-bg,#fff)',border:'1px solid #d6e1ec',padding:'20px 22px'}}>
      <h2 style={{fontSize:19,margin:'0 0 14px'}}>O que está implementado nesta prévia</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,fontSize:14,lineHeight:1.6}}>
        <div><b>✓ Busca natural pelo Motor</b><p>O Radar prioriza a captura natural e conserva o fallback do servidor.</p></div>
        <div><b>✓ Procedência de dados</b><p>Campos observados, estimativas e informações ausentes são diferenciados.</p></div>
        <div><b>✓ Histórico preservado</b><p>Reanálises podem distinguir dados novos de valores herdados.</p></div>
      </div>
      <small style={{display:'block',opacity:.7}}>Os textos acima descrevem recursos do código; não são resultados de coleta ao vivo.</small>
    </section>
  </div>;
}
