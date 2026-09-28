import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json({
    version:'0.17.7',
    version_name:'0.17.7 - Campanhas de desconto no Gestor Sênior',
    filename:'Gestor-Senior-Shopee-Intelligence-v0.17.7.zip',
    notes:'Integração das campanhas de desconto do Seller Center com Funil, Produtos e Super Análise, mantendo o atualizador automático.',
    download_url:'https://shopeeos-real-greskgja.vercel.app/motor-senior',
    published_at:'2026-09-28T16:59:00-03:00'
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
