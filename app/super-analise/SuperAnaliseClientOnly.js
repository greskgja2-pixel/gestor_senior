'use client';

import dynamic from 'next/dynamic';

const SuperAnaliseInteligente=dynamic(()=>import('./SuperAnaliseInteligente'),{
  ssr:false,
  loading:()=>(
    <main style={{minHeight:'70vh',display:'grid',placeItems:'center',fontFamily:'system-ui',background:'var(--gs-shell-bg,#f4f7fb)',color:'var(--gs-text,#334155)'}}>
      Carregando Super Análise…
    </main>
  )
});

export default function SuperAnaliseClientOnly(props){
  return <SuperAnaliseInteligente {...props}/>;
}
