import {getActiveShop} from '../../lib/shop';
import {getProducts} from '../../lib/products';
import {supabaseAdmin} from '../../lib/supabase';
import ProductsDashboard from './ProductsDashboard';

export const dynamic='force-dynamic';

const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const imageOf=item=>item?.image?.image_url_list?.[0]||item?.image?.image_url||item?.image_url||item?.images?.[0]||null;

export default async function ProdutosPage(){
  const shop=await getActiveShop();
  if(!shop)return <main style={{padding:40,fontFamily:'system-ui'}}>Nenhuma loja Shopee conectada.</main>;

  let products=[],source='cache',syncedAt=null,loadError=null;
  try{const result=await getProducts(shop);products=result.items||[];source=result.source||'cache';syncedAt=result.syncedAt||null;}catch(e){loadError=String(e?.message||e);}

  const db=supabaseAdmin();
  const [{data:costRows},{data:reports}]=await Promise.all([
    db.from('product_costs').select('item_id,model_id,cost,packaging_cost,updated_at').eq('shop_id',shop.shop_id),
    db.from('extension_analysis_reports').select('item_id,analyzed_at,finance_snapshot,metrics').eq('shop_id',shop.shop_id).order('analyzed_at',{ascending:false}).limit(2000)
  ]);
  const baseCosts=new Map();
  for(const row of costRows||[])if(Number(row.model_id)===0)baseCosts.set(String(row.item_id),row);
  const latestReport=new Map();
  for(const row of reports||[]){const key=String(row.item_id);if(!latestReport.has(key))latestReport.set(key,row);}

  const items=products.map(it=>{
    const key=String(it.item_id),price=finite(it?.price_info?.[0]?.current_price??it?.price_info?.[0]?.original_price),stock=finite(it?.stock_info_v2?.summary_info?.total_available_stock??it?.stock),costRow=baseCosts.get(key),baseCost=finite(costRow?.cost),packaging=finite(costRow?.packaging_cost)??0,totalCost=baseCost==null?null:baseCost+packaging,report=latestReport.get(key),reportMargin=finite(report?.finance_snapshot?.marginPct??report?.metrics?.marginPct),reportProfit=finite(report?.finance_snapshot?.profit??report?.metrics?.marginR);
    let marginPct=reportMargin,marginR=reportProfit,marginSource=reportMargin!=null||reportProfit!=null?'última Super Análise':null;
    if(marginPct==null&&marginR==null&&price!=null&&price>0&&totalCost!=null){marginR=price-totalCost;marginPct=marginR/price*100;marginSource='bruta pelo custo cadastrado';}
    return{itemId:String(it.item_id),title:it.item_name||`Produto ${it.item_id}`,image:imageOf(it),status:it.item_status||'—',price,stock,cost:totalCost,costSource:baseCost!=null?(packaging?`produto + embalagem`:'custo cadastrado'):null,marginPct,marginR,marginSource,hasModel:Boolean(it.has_model)};
  });

  return <ProductsDashboard items={items} source={source} syncedAt={syncedAt} shopId={shop.shop_id} loadError={loadError}/>;
}
