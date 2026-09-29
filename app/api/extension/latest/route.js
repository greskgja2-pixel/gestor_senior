import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json({
    version:'0.17.8',
    version_name:'0.17.8 - Messenger Shopee no Gestor Sênior',
    filename:'Gestor-Senior-Shopee-Intelligence-v0.17.8.zip',
    notes:'Messenger Shopee com leitura de conversas, histórico e contexto de comprador/pedido/produto pela sessão local do Seller Center. Envio de texto permanece protegido até validação do payload real.',
    download_url:'https://shopeeos-real-greskgja.vercel.app/motor-senior',
    published_at:'2026-09-28T22:50:00-03:00'
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
