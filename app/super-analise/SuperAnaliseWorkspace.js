import {supabaseAdmin} from '../../lib/supabase';
import SuperAnaliseInteligente from './SuperAnaliseInteligente';
import WebAuditFlow from './WebAuditFlow';
import AutoGeminiAnalysis from './AutoGeminiAnalysis';
import ProductsDashboard from '../produtos/ProductsDashboard';

export default async function SuperAnaliseWorkspace({shopId,params,store}){
  const requestedReport=String(params?.report_id||'').trim();
  const requestedItem=String(params?.item_id||'').trim();
  const startItem=String(params?.start_item_id||'').trim();
  const startUrl=String(params?.start_url||'').trim();
  const requestedTab=String(params?.tab||'').trim();

  // start_item_id/start_url apenas preenchem o fluxo de nova auditoria; não representam
  // uma análise histórica selecionada. A lista da loja deve continuar visível.
  if(!requestedReport&&!requestedItem)return <>
    <WebAuditFlow initialUrl={startUrl}/>
    <ProductsDashboard embedded items={store.items} source={store.source} syncedAt={store.syncedAt} shopId={shopId} loadError={store.loadError}/>
  </>;

  const db=supabaseAdmin();
  const {data:reports,error}=await db.from('extension_analysis_reports')
    .select('id,item_id,analyzed_at,next_reanalysis_at,extension_version,source,objective,situation,bottleneck,score,product_snapshot,ads_snapshot,finance_snapshot,competitors,report,suggestions,metrics,created_at')
    .eq('shop_id',shopId).order('analyzed_at',{ascending:false}).limit(100);
  if(error)return <main style={{padding:40,fontFamily:'system-ui'}}>Erro carregando análises: {error.message}</main>;

  const selected=(reports||[]).find(r=>requestedReport&&String(r.id)===requestedReport)
    ||(reports||[]).find(r=>requestedItem&&String(r.item_id)===requestedItem)||null;
  const products=[],seen=new Set();
  for(const r of reports||[]){const id=String(r.item_id);if(seen.has(id))continue;seen.add(id);products.push({itemId:id,reportId:r.id,title:r.product_snapshot?.title||r.product_snapshot?.item_name||`Produto ${id}`,score:r.score,analyzedAt:r.analyzed_at,imageUrl:r.product_snapshot?.imageUrl||r.product_snapshot?.image_url||r.product_snapshot?.imageUrls?.[0]||null});}
  const needsGemini=Boolean(selected?.id&&!selected?.report?.ai_analysis);
  return <>{needsGemini&&<AutoGeminiAnalysis reportId={selected.id} itemId={selected.item_id}/>}<SuperAnaliseInteligente report={selected} products={products} shopName="" initialTab={requestedTab}/></>;
}
