import {getActiveShop} from '../../lib/shop';
import {supabaseAdmin} from '../../lib/supabase';
import SuperAnuncioDashboard from './SuperAnuncioDashboard';
import SuperAnuncioEnhancements from './SuperAnuncioEnhancements';
import MarginPriceEnhancements from './MarginPriceEnhancements';

export const dynamic='force-dynamic';

export default async function ExtensionIntelligencePage(){
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
  const enhancementItems=items.map(item=>({
    itemId:item.itemId,
    reportId:item.latest?.id||null,
    title:item.latest?.product_snapshot?.title||item.latest?.product_snapshot?.item_name||`Produto ${item.itemId}`,
    productSnapshot:item.latest?.product_snapshot||{},
    financeSnapshot:item.latest?.finance_snapshot||{},
    metrics:item.latest?.metrics||{},
    adsSnapshot:item.latest?.ads_snapshot||{},
    competitors:Array.isArray(item.latest?.competitors)?item.latest.competitors.slice(0,3):[]
  }));
  return <><SuperAnuncioDashboard items={items} shopName={shop.shop_name||''}/><SuperAnuncioEnhancements items={enhancementItems}/><MarginPriceEnhancements items={enhancementItems}/></>;
}