import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getAdsDaily,getAdsHourly,getAdsCampaignList,getAdsCampaignSettings,getAdsCampaignDaily,safeCapability } from "../../../../lib/shopee-extra";
export const dynamic="force-dynamic";

const METRIC_KEYS=new Set(["impression","impressions","click","clicks","expense","cost","spend","broad_gmv","gmv","broad_order","order","orders","broad_order_amount","broad_item_sold","item_sold","sold","broad_roi","broad_roas","roas","roi"]);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const first=(obj,keys)=>{for(const key of keys){if(obj&&obj[key]!==undefined&&obj[key]!==null&&obj[key]!=="")return obj[key];}return null;};
function idsFrom(result){const d=result?.data?.response||result?.data||{};return (d.campaign_list||[]).map(x=>Number(x.campaign_id)).filter(Boolean);}
function listAdTypes(result){const d=result?.data?.response||result?.data||{};return new Map((d.campaign_list||[]).map(x=>[Number(x.campaign_id),x.ad_type||null]));}
function metricRows(value,out=[]){if(Array.isArray(value)){for(const row of value)metricRows(row,out);return out;}if(!value||typeof value!=="object")return out;const keys=Object.keys(value);if(keys.some(k=>METRIC_KEYS.has(k))){out.push(value);return out;}for(const child of Object.values(value))metricRows(child,out);return out;}
function aggregateRows(rows){const a={impressions:0,clicks:0,spend:0,gmv:0,orders:0,sold:0};for(const row of rows){a.impressions+=num(first(row,["impression","impressions"]));a.clicks+=num(first(row,["click","clicks"]));a.spend+=num(first(row,["expense","cost","spend"]));a.gmv+=num(first(row,["broad_gmv","gmv"]));a.orders+=num(first(row,["broad_order","order","orders"]));a.sold+=num(first(row,["broad_item_sold","item_sold","broad_order_amount","sold"]));}a.roas=a.spend>0?a.gmv/a.spend:null;a.ctr=a.impressions>0?(a.clicks/a.impressions)*100:null;a.cpc=a.clicks>0?a.spend/a.clicks:null;a.conversionRate=a.clicks>0?(a.orders/a.clicks)*100:null;return a;}
function aggregateCampaignSummaries(campaigns){return aggregateRows((campaigns||[]).map(c=>({impression:c.impressions,clicks:c.clicks,expense:c.spend,broad_gmv:c.gmv,broad_order:c.orders,broad_item_sold:c.sold})));}
function campaignNodes(value,out=[]){if(Array.isArray(value)){for(const row of value)campaignNodes(row,out);return out;}if(!value||typeof value!=="object")return out;if(value.campaign_id!==undefined&&value.campaign_id!==null){out.push(value);return out;}for(const child of Object.values(value))campaignNodes(child,out);return out;}
function metricSummaryFromNode(node){const direct=Object.keys(node||{}).some(k=>METRIC_KEYS.has(k))?[node]:[];const rows=direct.length?direct:metricRows(node,[]);return aggregateRows(rows);}
function settingsMap(result,campaignList){const map=new Map(),types=listAdTypes(campaignList);const d=result?.data?.response||result?.data||result||{};const rows=Array.isArray(d.campaign_list)?d.campaign_list:campaignNodes(d,[]);for(const row of rows){const id=Number(row.campaign_id);if(!id)continue;const common=row.common_info||{},autoInfo=Array.isArray(row.auto_product_ads_info)?row.auto_product_ads_info:[],firstProduct=autoInfo[0]||{},itemIds=(Array.isArray(common.item_id_list)&&common.item_id_list.length?common.item_id_list:autoInfo.map(x=>x.item_id)).map(Number).filter(Boolean);const duration=common.campaign_duration||firstProduct.campaign_duration||null;const adType=common.ad_type||types.get(id)||null;map.set(id,{campaignId:id,itemId:itemIds[0]||Number(firstProduct.item_id)||null,itemIds,title:String(common.ad_name||firstProduct.product_name||`Campanha ${id}`),productName:firstProduct.product_name||null,state:common.campaign_status||firstProduct.status||null,budget:Number.isFinite(Number(common.campaign_budget))?Number(common.campaign_budget):(Number.isFinite(Number(firstProduct.campaign_budget))?Number(firstProduct.campaign_budget):null),targetRoas:row.auto_bidding_info?.roas_target??null,adType,biddingMethod:common.bidding_method||null,placement:common.campaign_placement||null,duration,startTime:duration?.start_time??null,endTime:duration?.end_time??null,controlMode:itemIds.length>1?"gms":"manual"});}return map;}
function normalizeCampaigns(campaignDaily,settings,campaignList){const meta=settingsMap(settings,campaignList),perfNodes=campaignNodes(campaignDaily?.data?.response||campaignDaily?.data||campaignDaily,[]),perf=new Map();for(const node of perfNodes){const id=Number(node.campaign_id);if(id)perf.set(id,node);}const ids=new Set([...meta.keys(),...perf.keys()]),list=[];for(const campaignId of ids){const node=perf.get(campaignId)||{},m=metricSummaryFromNode(node),s=meta.get(campaignId)||{};list.push({campaignId,itemId:(s.itemId??Number(first(node,["item_id"])))||null,itemIds:s.itemIds||[],title:s.title||String(first(node,["ad_name","campaign_name","name","title"])||`Campanha ${campaignId}`),productName:s.productName||null,state:s.state??first(node,["status","state","campaign_status"])??null,budget:s.budget??null,targetRoas:s.targetRoas??null,adType:s.adType??first(node,["ad_type"])??null,biddingMethod:s.biddingMethod??null,placement:s.placement??first(node,["campaign_placement"])??null,startTime:s.startTime??null,endTime:s.endTime??null,controlMode:s.controlMode||"manual",...m,costPerOrder:m.orders>0?m.spend/m.orders:(m.spend>0?null:0)});}return list.sort((a,b)=>{const ao=a.state==="ongoing"?0:1,bo=b.state==="ongoing"?0:1;return ao-bo||b.spend-a.spend;});}
function campaignInsights(campaigns){const withSpend=campaigns.filter(c=>c.spend>0);const topSpend=[...withSpend].sort((a,b)=>b.spend-a.spend)[0]||null;const bestRoas=[...withSpend].filter(c=>c.roas!=null).sort((a,b)=>b.roas-a.roas)[0]||null;const waste=[...withSpend].sort((a,b)=>{const aZero=a.orders===0?1:0,bZero=b.orders===0?1:0;if(aZero!==bZero)return bZero-aZero;const ac=a.orders>0?a.spend/a.orders:a.spend,bc=b.orders>0?b.spend/b.orders:b.spend;return bc-ac;})[0]||null;return{topSpend,bestRoas,highestSpendLowConversion:waste,zeroOrderSpendCount:withSpend.filter(c=>c.orders===0).length};}
function productSeries(campaignDaily){const rows=metricRows(campaignDaily?.data?.response||campaignDaily?.data||{},[]),m=new Map();for(const row of rows){const key=String(row.date||row.performance_date||row.stat_date||"");if(!key)continue;const cur=m.get(key)||{date:key,impression:0,clicks:0,expense:0,broad_gmv:0,broad_order:0,broad_item_sold:0};cur.impression+=num(first(row,["impression","impressions"]));cur.clicks+=num(first(row,["click","clicks"]));cur.expense+=num(first(row,["expense","cost","spend"]));cur.broad_gmv+=num(first(row,["broad_gmv","gmv"]));cur.broad_order+=num(first(row,["broad_order","order","orders"]));cur.broad_item_sold+=num(first(row,["broad_item_sold","item_sold","broad_order_amount","sold"]));m.set(key,cur);}return [...m.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
  const u=new URL(request.url),days=Math.max(1,Math.min(90,Number(u.searchParams.get("days")||7)));
  const [daily,hourly,campaigns]=await Promise.all([
    safeCapability("daily",()=>getAdsDaily(shop,days)),
    safeCapability("hourly",()=>getAdsHourly(shop)),
    safeCapability("campaigns",()=>getAdsCampaignList(shop))
  ]);
  const ids=idsFrom(campaigns);
  const [settings,campaignDaily]=await Promise.all([
    safeCapability("settings",()=>getAdsCampaignSettings(shop,ids)),
    safeCapability("campaign_daily",()=>getAdsCampaignDaily(shop,ids,days))
  ]);
  const dailyRows=daily?.ok?metricRows(daily.data?.response||daily.data,[]):[];
  const allCpcSummary=aggregateRows(dailyRows);
  const normalizedCampaigns=campaignDaily?.ok?normalizeCampaigns(campaignDaily,settings,campaigns):[];
  const productSummary=aggregateCampaignSummaries(normalizedCampaigns);
  const summary=campaignDaily?.ok?productSummary:allCpcSummary;
  const insights=campaignInsights(normalizedCampaigns),series=campaignDaily?.ok?productSeries(campaignDaily):[];
  const activeCampaigns=normalizedCampaigns.filter(c=>c.state==="ongoing");
  const v7={source:"Enciclopédia Shopee Seller Center v7",scope:campaignDaily?.ok?"product_ads":"all_cpc_fallback",summary,productSummary,allCpcSummary,campaigns:normalizedCampaigns,activeCampaigns,series,insights,controls:{enabled:true,actions:["pause","resume","start","stop","change_budget","change_roas_target","protection_reset"],protectionResetExperimental:true}};
  return NextResponse.json({days,shopId:String(shop.shop_id),campaignIds:ids,daily,hourly,campaigns,settings,campaignDaily,v7,v5:{...v7,source:"Enciclopédia Shopee Seller Center v7 (compat v5)"}});
}
