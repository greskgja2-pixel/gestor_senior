import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json({
    version:'0.17.9',
    version_name:'0.17.9 - Diagnóstico da Pesquisa de Produtos',
    filename:'Gestor-Senior-Shopee-Intelligence-v0.17.9.zip',
    notes:'Pesquisa de Produtos com aliases estruturados de vendas, vendas 30d, localização, avaliações e diagnóstico de cobertura Motor x Gestor. Messenger permanece incluído.',
    download_url:'https://shopeeos-real-greskgja.vercel.app/motor-senior',
    published_at:'2026-09-28T23:23:00-03:00'
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
