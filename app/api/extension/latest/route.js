import {NextResponse} from 'next/server';

export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json({
    version:'0.17.6',
    version_name:'0.17.6 - Atualizador integrado do Motor Sênior',
    filename:'Gestor-Senior-Shopee-Intelligence-v0.17.6.zip',
    notes:'Atualizador integrado: verificação automática a cada 6 horas, aviso de nova versão e acesso à página oficial de atualização.',
    download_url:'https://shopeeos-real-greskgja.vercel.app/motor-senior',
    published_at:'2026-09-28T16:59:00-03:00'
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
