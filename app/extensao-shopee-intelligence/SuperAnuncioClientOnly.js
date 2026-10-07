'use client';

import dynamic from 'next/dynamic';

const SuperAnuncioMockup=dynamic(()=>import('./SuperAnuncioMockup'),{
  ssr:false,
  loading:()=>(
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',fontFamily:'system-ui',background:'var(--gs-shell-bg,#f4f7fb)',color:'var(--gs-text,#334155)'}}>
      Carregando Super Anúncio…
    </main>
  )
});

export default function SuperAnuncioClientOnly(props){
  return <SuperAnuncioMockup {...props}/>;
}
