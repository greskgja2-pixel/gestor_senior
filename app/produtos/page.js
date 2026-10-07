import {redirect} from 'next/navigation';

export const dynamic='force-dynamic';

const INSIGHTS=new Set(['top-sales','lost-sales','zero-sales']);

export default async function ProdutosPage({searchParams}){
  const params=await Promise.resolve(searchParams||{});
  const insight=String(params?.insight||'').trim();
  redirect(INSIGHTS.has(insight)?`/super-analise?insight=${encodeURIComponent(insight)}`:'/super-analise');
}
