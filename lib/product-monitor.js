import {getOrders} from './orders';
import {getProducts} from './products';
import {getAdsCampaignList,getAdsCampaignSettings,getAdsCampaignDaily,safeCapability} from './shopee-extra';
import {supabaseAdmin} from './supabase';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const arr=v=>Array.isArray(v)?v:[];
const DAY=86400;

function payload(result){return result?.data?.response||result?.data||result?.response||result||{};}
function campaignListRows(result){const d=payload(result);return Array.isArray(d?.campaign_list)?d.campaign_list:[];}
function campaignIds(result){return campaignListRows(result).map(x=>Number(x.campaign_id)).filter(Boolean);}
function campaignNodes(value,out=[]){
  if(Array.isArray(value)){for(const row of value)campaignNodes(row,out);return out;}
  if(!value||typeof value!=='object')return out;
  if(value.campaign_id!==undefined&&value.campaign_id!==null){out.push(value);return out;}
  for(const child of Object.values(value))campaignNodes(child,out);
  return out;
}
function metricRows(value,out=[]){
  if(Array.isArray(value)){for(const row of value)metricRows(row,out);return out;}
  if(!value||typeof value!=='object')return out;
  const keys=Object.keys(value);
  if(keys.some(k=>['impression','impressions','click','clicks','expense','cost','spend','broad_gmv','gmv','broad_order','order','orders','broad_item_sold','item_sold','sold'].includes(k))){out.push(value);return out;}
  for(const child of Object.values(value))metricRows(child,out);
  return out;
}
function first(obj,keys){for(const k of keys){if(obj?.[k]!==undefined&&obj?.[k]!==null&&obj?.[k]!=='')return obj[k];}return null;}
function aggregate(rows){
  const out={impressions:0,clicks:0,spend:0,gmv:0,orders:0,sold:0},seen={};
  for(const row of rows||[]){
    const spec={impressions:['impression','impressions'],clicks:['click','clicks'],spend:['expense','cost','spend'],gmv:['broad_gmv','gmv'],orders:['broad_order','order','orders'],sold:['broad_item_sold','item_sold','sold']};
    for(const [key,aliases] of Object.entries(spec)){
      const v=finite(first(row,aliases));
      if(v==null)continue;
      out[key]+=v;seen[key]=true;
    }
  }
  for(const key of Object.keys(out))if(!seen[key])out[key]=null;
  out.roas=out.spend!=null&&out.spend>0&&out.gmv!=null?out.gmv/out.spend:null;
  return out;
}
function itemCampaignMap(settings){
  const map=new Map(),d=payload(settings),rows=Array.isArray(d?.campaign_list)?d.campaign_list:campaignNodes(d,[]);
  for(const row of rows){
    const id=Number(row.campaign_id);if(!id)continue;
    const common=row.common_info||{},auto=arr(row.auto_product_ads_info);
    const ids=(arr(common.item_id_list).length?arr(common.item_id_list):auto.map(x=>x.item_id)).map(Number).filter(Boolean);
    map.set(id,ids);
  }
  return map;
}
function countItemSales(orders,itemId){
  let qty=0;
  for(const order of orders||[]){
    const status=String(order?.order_status||'').toUpperCase();
    if(['CANCELLED','IN_CANCEL','UNPAID'].includes(status))continue;
    for(const line of arr(order?.item_list)){
      if(String(line?.item_id)!==String(itemId))continue;
      qty+=Math.max(0,Number(line?.model_quantity_purchased??line?.quantity??1)||0);
    }
  }
  return qty;
}
function productExtras(product){
  const models=arr(product?.model).concat(arr(product?.models));
  const stock=models.length?models.reduce((s,x)=>s+(finite(x?.stock_info_v2?.summary_info?.total_available_stock??x?.stock_info?.normal_stock??x?.stock)||0),0):finite(product?.stock_info_v2?.summary_info?.total_available_stock??product?.stock);
  return {
    views:finite(product?.views??product?.view_count??product?.view),
    price:finite(product?.price_info?.current_price??product?.price??product?.original_price),
    stock,
    rating:finite(product?.rating_star??product?.rating),
    reviewCount:finite(product?.rating_count?.total??product?.review_count??product?.reviewCount)
  };
}
async function adsForItem(shop,itemId,days){
  const list=await safeCapability('campaigns',()=>getAdsCampaignList(shop));
  if(!list?.ok)return {summary:null,error:list?.error||'campaigns unavailable'};
  const ids=campaignIds(list);if(!ids.length)return {summary:{spend:0,gmv:0,roas:null,clicks:0,impressions:0,orders:0,sold:0},error:null};
  const [settings,daily]=await Promise.all([
    safeCapability('settings',()=>getAdsCampaignSettings(shop,ids)),
    safeCapability('campaign_daily',()=>getAdsCampaignDaily(shop,ids,days))
  ]);
  if(!daily?.ok)return {summary:null,error:daily?.error||'campaign daily unavailable'};
  const map=itemCampaignMap(settings),nodes=campaignNodes(payload(daily),[]);
  const rows=[];
  for(const node of nodes){
    const id=Number(node?.campaign_id);if(!id)continue;
    const itemIds=map.get(id)||[];
    if(!itemIds.some(x=>String(x)===String(itemId)))continue;
    rows.push(...metricRows(node,[]));
  }
  return {summary:aggregate(rows),error:null};
}

export async function ensureMonitorWatch(db,shopId,itemId){
  const now=new Date();
  const {data,error}=await db.from('gs_product_monitor_watches').upsert({
    shop_id:shopId,item_id:itemId,enabled:true,frequency_days:3,updated_at:now.toISOString()
  },{onConflict:'shop_id,item_id'}).select('*').single();
  if(error)throw new Error(error.message);
  await db.from('gs_competitor_watches').update({frequency_days:3,updated_at:now.toISOString()}).eq('shop_id',shopId).eq('owner_item_id',itemId).eq('enabled',true);
  return data;
}

export async function collectProductMonitorSnapshot({shop,itemId,force=false}){
  const db=supabaseAdmin(),watch=await ensureMonitorWatch(db,shop.shop_id,itemId);
  const now=new Date();
  if(!force&&watch?.last_check_at&&new Date(watch.last_check_at).getTime()>Date.now()-3*86400000){
    return {skipped:true,watch,snapshot:null};
  }
  const periodEnd=Math.floor(now.getTime()/1000),periodStart=periodEnd-3*DAY;
  const [{orders},{items},ads]=await Promise.all([
    getOrders(shop,{forceRefresh:true,from:periodStart,to:periodEnd}),
    getProducts(shop,{forceRefresh:true}),
    adsForItem(shop,itemId,3)
  ]);
  const product=(items||[]).find(x=>String(x?.item_id)===String(itemId))||{};
  const extras=productExtras(product),a=ads.summary||{};
  const snapshot={
    shop_id:shop.shop_id,item_id:Number(itemId),collected_at:now.toISOString(),
    period_start:new Date(periodStart*1000).toISOString(),period_end:new Date(periodEnd*1000).toISOString(),
    sales_period:countItemSales(orders,itemId),views:extras.views,price:extras.price,stock:extras.stock,
    rating:extras.rating,review_count:extras.reviewCount,
    ads_spend:finite(a.spend),ads_gmv:finite(a.gmv),ads_roas:finite(a.roas),ads_clicks:finite(a.clicks),
    ads_impressions:finite(a.impressions),ads_orders:finite(a.orders),
    source:{orders:'shopee-api',ads:ads.error?'unavailable':'seller-center',ads_error:ads.error||null}
  };
  const {data:inserted,error}=await db.from('gs_product_monitor_snapshots').insert(snapshot).select('*').single();
  if(error)throw new Error(error.message);
  const next=new Date(now.getTime()+3*86400000).toISOString();
  await db.from('gs_product_monitor_watches').update({last_check_at:now.toISOString(),next_check_at:next,last_status:'success',last_error:null,updated_at:now.toISOString()}).eq('shop_id',shop.shop_id).eq('item_id',itemId);
  return {skipped:false,watch:{...watch,last_check_at:now.toISOString(),next_check_at:next,last_status:'success'},snapshot:inserted};
}
