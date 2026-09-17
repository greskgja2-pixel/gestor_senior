import {getActiveShop} from '../../lib/shop';
import {supabaseAdmin} from '../../lib/supabase';
import SuperAnaliseInteligente from './SuperAnaliseInteligente';

export const dynamic='force-dynamic';

export default async function SuperAnalisePage({searchParams}){
  const params=await Promise.resolve(searchParams||{});
  const shop=await getActiveShop();
  if(!shop)return <main style={{padding:40,fontFamily:'system-ui'}}>Nenhuma loja Shopee conectada.</main>;

  const db=supabaseAdmin();
  const {data:reports,error}=await db.from('extension_analysis_reports')
    .select('id,item_id,analyzed_at,next_reanalysis_at,extension_version,source,objective,situation,bottleneck,score,product_snapshot,ads_snapshot,finance_snapshot,competitors,report,suggestions,metrics,created_at')
    .eq('shop_id',shop.shop_id)
    .order('analyzed_at',{ascending:false})
    .limit(100);

  if(error)return <main style={{padding:40,fontFamily:'system-ui'}}>Erro carregando análises: {error.message}</main>;

  const requestedReport=String(params?.report_id||'').trim();
  const requestedItem=String(params?.item_id||'').trim();
  const selected=(reports||[]).find(r=>requestedReport&&String(r.id)===requestedReport)
    ||(reports||[]).find(r=>requestedItem&&String(r.item_id)===requestedItem)
    ||(reports||[])[0]
    ||null;

  const products=[];
  const seen=new Set();
  for(const r of reports||[]){
    const id=String(r.item_id);
    if(seen.has(id))continue;
    seen.add(id);
    products.push({
      itemId:id,
      reportId:r.id,
      title:r.product_snapshot?.title||r.product_snapshot?.item_name||`Produto ${id}`,
      score:r.score,
      analyzedAt:r.analyzed_at,
      imageUrl:r.product_snapshot?.imageUrl||r.product_snapshot?.image_url||r.product_snapshot?.imageUrls?.[0]||null
    });
  }

  return <SuperAnaliseInteligente report={selected} products={products} shopName={shop.shop_name||''}/>;
}
