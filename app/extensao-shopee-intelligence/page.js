import {redirect} from 'next/navigation';
import {getActiveShop} from '../../lib/shop';
import {supabaseAdmin} from '../../lib/supabase';
import SuperAnuncioMockup from './SuperAnuncioMockup';

export const dynamic='force-dynamic';

export default async function ExtensionIntelligencePage({searchParams}){
  const params=await Promise.resolve(searchParams||{});
  if(String(params?.view||'')==='super-analysis'){
    const qs=new URLSearchParams();if(params?.item_id)qs.set('item_id',String(params.item_id));if(params?.report_id)qs.set('report_id',String(params.report_id));
    redirect(`/super-analise${qs.toString()?`?${qs.toString()}`:''}`);
  }
  const shop=await getActiveShop();
  if(!shop)return <main style={{padding:40,fontFamily:'system-ui'}}>Nenhuma loja Shopee conectada.</main>;
  const db=supabaseAdmin();
  const [{data:reports,error},{data:schedules,error:scheduleError}]=await Promise.all([
    db.from('extension_analysis_reports').select('id,item_id,analyzed_at,next_reanalysis_at,extension_version,source,objective,situation,bottleneck,score,product_snapshot,ads_snapshot,finance_snapshot,competitors,report,suggestions,metrics,created_at').eq('shop_id',shop.shop_id).order('analyzed_at',{ascending:false}).limit(500),
    db.from('extension_analysis_schedules').select('id,item_id,title,product_url,enabled,frequency_days,mode,next_run_at,last_run_at,last_report_id,settings,created_at,updated_at').eq('shop_id',shop.shop_id).order('updated_at',{ascending:false})
  ]);
  if(error||scheduleError)return <main style={{padding:40,fontFamily:'system-ui'}}>Erro carregando o histórico: {(error||scheduleError)?.message}</main>;
  const grouped=new Map();
  for(const r of reports||[]){const k=String(r.item_id);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r);}
  const scheduleMap=new Map((schedules||[]).map(s=>[String(s.item_id),s]));
  const items=[...grouped.entries()].map(([itemId,history])=>({itemId,history,latest:history[0],previous:history[1]||null,schedule:scheduleMap.get(itemId)||null})).sort((a,b)=>new Date(b.latest?.analyzed_at||0)-new Date(a.latest?.analyzed_at||0));
  const initialItemId=String(params?.item_id||'').trim();
  const initialSection=String(params?.section||'super-anuncio').trim();
  const sectionTab={concorrentes:'competitors','shopee-ads':'ads',reanalises:'history'}[initialSection]||String(params?.tab||'overview').trim();
  return <SuperAnuncioMockup items={items} shopName={shop.shop_name||''} initialItemId={initialItemId} initialTab={sectionTab} initialSection={initialSection}/>;
}
