import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json({
    version:'0.18.0',
    version_name:'0.18.0 - Pesquisa baseada na Enciclopédia',
    filename:'Gestor-Senior-Shopee-Intelligence-v0.18.0.zip',
    notes:'Pesquisa refeita com os campos reais capturados pelo mapeador e consolidados na Enciclopédia: preço, vendas, vendas/mês, avaliação, reviews e localização; fallback confirmado via pdp/get_pc. Messenger permanece incluído.',
    download_url:'https://shopeeos-real-greskgja.vercel.app/motor-senior',
    published_at:'2026-09-29T02:40:00-03:00'
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
