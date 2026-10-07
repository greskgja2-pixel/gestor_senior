import {getActiveShop} from '../../lib/shop';
import {getProducts} from '../../lib/products';
import {getOrders} from '../../lib/orders';
import {supabaseAdmin} from '../../lib/supabase';
import {grossMargin} from '../../lib/business-metrics';
import SuperAnaliseWorkspace from './SuperAnaliseWorkspace';

export const dynamic='force-dynamic';

const finite=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const imageOf=item=>item?.image?.image_url_list?.[0]||item?.image?.image_url||item?.image_url||item?.images?.[0]||null;
const qty=v=>Number.isFinite(Number(v))?Number(v):0;
function itemSales(orders,from,to){
  const map=new Map();
  for(const order of orders||[]){
    const created=Number(order?.create_time)*1000;
    if(!Number.isFinite(created)||created<from||created>=to)continue;
    for(const item of order?.item_list||[]){
      const id=String(item?.item_id??'');
      if(id)map.set(id,(map.get(id)||0)+qty(item?.model_quantity_purchased??item?.quantity??1));
    }
  }
  return map;
}

async function loadStoreProducts(shop){
  let products=[],source='cache',syncedAt=null,loadError=null;
  try{const result=await getProducts(shop);products=result.items||[];source=result.source||'cache';syncedAt=result.syncedAt||null;}catch(e){loadError=String(e?.message||e);}
  let salesCurrent=null,salesPrevious=null;
  try{
    const ordersResult=await getOrders(shop,{days:14});
    const now=Date.now(),start7=now-7*86400000,start14=now-14*86400000;
    salesCurrent=itemSales(ordersResult.orders||[],start7,now);
    salesPrevious=itemSales(ordersResult.orders||[],start14,start7);
  }catch(e){loadError=loadError||`Monitoramento de vendas indisponível: ${String(e?.message||e)}`;}
  const db=supabaseAdmin();
  const [{data:costRows,error:costError},{data:reports,error:reportsError}]=await Promise.all([
    db.from('product_costs').select('item_id,model_id,cost,packaging_cost,updated_at').eq('shop_id',shop.shop_id),
    db.from('extension_analysis_reports').select('item_id,analyzed_at,finance_snapshot,metrics').eq('shop_id',shop.shop_id).order('analyzed_at',{ascending:false}).limit(2000)
  ]);
  // Custos/relatórios enriquecem a lista, mas uma falha auxiliar não pode esconder
  // os produtos reais já carregados da Shopee/cache.
  const auxErrors=[costError?.message,reportsError?.message].filter(Boolean);
  if(auxErrors.length)loadError=loadError||`Dados auxiliares indisponíveis: ${auxErrors.join(' · ')}`;
  const baseCosts=new Map(),variationCostsByItem=new Map();
  for(const row of costRows||[]){
    const key=String(row.item_id);
    if(Number(row.model_id)===0)baseCosts.set(key,row);
    else{
      const list=variationCostsByItem.get(key)||[];
      list.push(row);
      variationCostsByItem.set(key,list);
    }
  }
  const latestReport=new Map();
  for(const row of reports||[]){const key=String(row.item_id);if(!latestReport.has(key))latestReport.set(key,row);}
  const items=products.map(it=>{
    const key=String(it.item_id);
    const fullPrice=finite(it?.price_info?.[0]?.original_price??it?.price_info?.[0]?.current_price);
    const price=finite(it?.price_info?.[0]?.current_price??it?.price_info?.[0]?.original_price);
    const stock=finite(it?.stock_info_v2?.summary_info?.total_available_stock??it?.stock);
    const costRow=baseCosts.get(key),baseCost=finite(costRow?.cost),packaging=finite(costRow?.packaging_cost)??0,totalCost=baseCost==null?null:baseCost+packaging;
    const variationCostRows=variationCostsByItem.get(key)||[];
    const variationCostValues=variationCostRows.map(x=>finite(x?.cost)).filter(x=>x!=null);
    const variationCostMin=variationCostValues.length?Math.min(...variationCostValues):null;
    const variationCostMax=variationCostValues.length?Math.max(...variationCostValues):null;
    const report=latestReport.get(key),lastMarginPct=finite(report?.finance_snapshot?.marginPct??report?.metrics?.marginPct),lastMarginR=finite(report?.finance_snapshot?.profit??report?.metrics?.marginR);
    const analyzedAt=report?.analyzed_at||null;
    const analysisAgeDays=analyzedAt?Math.max(0,(Date.now()-new Date(analyzedAt).getTime())/86400000):null;
    const funnelStatus=!analyzedAt?'unavailable':analysisAgeDays>30?'stale':'available';
    const gross=grossMargin({price,cost:baseCost,packaging});
    return{itemId:key,title:it.item_name||`Produto ${it.item_id}`,image:imageOf(it),status:it.item_status||'—',price,fullPrice,stock,cost:totalCost,costSource:baseCost!=null?(packaging?'produto + embalagem':'custo cadastrado'):null,variationCostCount:variationCostValues.length,variationCostMin,variationCostMax,marginPct:gross.percent,marginR:gross.amount,marginSource:gross.source,hasModel:Boolean(it.has_model),lastAnalysisMarginPct:lastMarginPct,lastAnalysisMarginR:lastMarginR,lastAnalysisAt:analyzedAt,analysisAgeDays,funnelStatus,salesCurrent7d:salesCurrent?salesCurrent.get(key)||0:null,salesPrevious7d:salesPrevious?salesPrevious.get(key)||0:null};
  });
  return{items,source,syncedAt,loadError};
}

export default async function SuperAnalisePage({searchParams}){
  const params=await Promise.resolve(searchParams||{});
  const shop=await getActiveShop();
  if(!shop)return <main style={{padding:40,fontFamily:'system-ui'}}>Nenhuma loja Shopee conectada.</main>;
  const store=await loadStoreProducts(shop);
  return <SuperAnaliseWorkspace shopId={shop.shop_id} params={params} store={store}/>;
}
