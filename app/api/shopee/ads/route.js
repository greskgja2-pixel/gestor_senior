import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getAdsDaily,getAdsHourly,getAdsCampaignList,getAdsCampaignSettings,getAdsCampaignDaily,safeCapability } from "../../../../lib/shopee-extra";
import {adsDerivedMetrics} from "../../../../lib/business-metrics";

export const dynamic="force-dynamic";
export const maxDuration=45;

const METRIC_KEYS=new Set(["impression","impressions","click","clicks","expense","cost","spend","broad_gmv","gmv","broad_order","order","orders","broad_order_amount","broad_item_sold","item_sold","sold","broad_roi","broad_roas","roas","roi"]);
const finite=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const numeric=v=>finite(v)?Number(v):null;
const first=(obj,keys)=>{for(const key of keys){if(obj&&obj[key]!==undefined&&obj[key]!==null&&obj[key]!=="")return obj[key];}return null;};

function payload(result){return result?.data?.response||result?.data||result?.response||result||{};}
function campaignListRows(result){const d=payload(result);return Array.isArray(d?.campaign_list)?d.campaign_list:[];}
function idsFrom(result){return campaignListRows(result).map(x=>Number(x.campaign_id)).filter(Boolean);}
function listAdTypes(result){return new Map(campaignListRows(result).map(x=>[Number(x.campaign_id),x.ad_type||null]));}
function listNodeMap(result){return new Map(campaignListRows(result).map(x=>[Number(x.campaign_id),x]));}

function metricRows(value,out=[]){
  if(Array.isArray(value)){for(const row of value)metricRows(row,out);return out;}
  if(!value||typeof value!=="object")return out;
  const keys=Object.keys(value);
  if(keys.some(k=>METRIC_KEYS.has(k))){out.push(value);return out;}
  for(const child of Object.values(value))metricRows(child,out);
  return out;
}

function aggregateRows(rows){
  const spec={
    impressions:["impression","impressions"],
    clicks:["click","clicks"],
    spend:["expense","cost","spend"],
    gmv:["broad_gmv","gmv"],
    orders:["broad_order","order","orders"],
    sold:["broad_item_sold","item_sold","broad_order_amount","sold"]
  };
  const totals={},seen={};
  for(const key of Object.keys(spec)){totals[key]=0;seen[key]=false;}
  for(const row of rows||[]){
    for(const [key,aliases] of Object.entries(spec)){
      const raw=first(row,aliases);
      if(!finite(raw))continue;
      totals[key]+=Number(raw);seen[key]=true;
    }
  }
  const a={rowCount:Array.isArray(rows)?rows.length:0};
  for(const key of Object.keys(spec))a[key]=seen[key]?totals[key]:null;
  Object.assign(a,adsDerivedMetrics(a));
  a.available=Object.values(seen).some(Boolean);
  return a;
}

function aggregateCampaignSummaries(campaigns){
  return aggregateRows((campaigns||[]).map(c=>({
    impression:c.impressions,clicks:c.clicks,expense:c.spend,broad_gmv:c.gmv,broad_order:c.orders,broad_item_sold:c.sold
  })));
}

function campaignNodes(value,out=[]){
  if(Array.isArray(value)){for(const row of value)campaignNodes(row,out);return out;}
  if(!value||typeof value!=="object")return out;
  if(value.campaign_id!==undefined&&value.campaign_id!==null){out.push(value);return out;}
  for(const child of Object.values(value))campaignNodes(child,out);
  return out;
}
function metricSummaryFromNode(node){
  const direct=Object.keys(node||{}).some(k=>METRIC_KEYS.has(k))?[node]:[];
  const rows=direct.length?direct:metricRows(node,[]);
  return aggregateRows(rows);
}

function settingsMap(result,campaignList){
  const map=new Map(),types=listAdTypes(campaignList);
  const d=payload(result);
  const rows=Array.isArray(d.campaign_list)?d.campaign_list:campaignNodes(d,[]);
  for(const row of rows){
    const id=Number(row.campaign_id);if(!id)continue;
    const common=row.common_info||{},autoInfo=Array.isArray(row.auto_product_ads_info)?row.auto_product_ads_info:[],firstProduct=autoInfo[0]||{};
    const itemIds=(Array.isArray(common.item_id_list)&&common.item_id_list.length?common.item_id_list:autoInfo.map(x=>x.item_id)).map(Number).filter(Boolean);
    const duration=common.campaign_duration||firstProduct.campaign_duration||null;
    const adType=common.ad_type||types.get(id)||null;
    map.set(id,{
      campaignId:id,itemId:itemIds[0]||Number(firstProduct.item_id)||null,itemIds,
      title:String(common.ad_name||firstProduct.product_name||`Campanha ${id}`),productName:firstProduct.product_name||null,
      state:common.campaign_status||firstProduct.status||null,
      budget:finite(common.campaign_budget)?Number(common.campaign_budget):(finite(firstProduct.campaign_budget)?Number(firstProduct.campaign_budget):null),
      targetRoas:numeric(row.auto_bidding_info?.roas_target),adType,biddingMethod:common.bidding_method||null,
      placement:common.campaign_placement||null,duration,startTime:duration?.start_time??null,endTime:duration?.end_time??null,
      controlMode:itemIds.length>1?"gms":"manual"
    });
  }
  return map;
}

function normalizeCampaigns(campaignDaily,settings,campaignList){
  const meta=settingsMap(settings,campaignList),listMap=listNodeMap(campaignList);
  const perfNodes=campaignNodes(payload(campaignDaily),[]),perf=new Map();
  for(const node of perfNodes){const id=Number(node.campaign_id);if(id)perf.set(id,node);}
  const ids=new Set([...idsFrom(campaignList),...meta.keys(),...perf.keys()]),list=[];
  for(const campaignId of ids){
    const node=perf.get(campaignId)||{},rawList=listMap.get(campaignId)||{},m=metricSummaryFromNode(node),s=meta.get(campaignId)||{};
    const spend=m.spend,orders=m.orders;
    list.push({
      campaignId,
      itemId:(s.itemId??numeric(first(node,["item_id"]))??numeric(first(rawList,["item_id"])))||null,
      itemIds:s.itemIds||[],
      title:s.title||String(first(node,["ad_name","campaign_name","name","title"])||first(rawList,["ad_name","campaign_name","name","title"])||`Campanha ${campaignId}`),
      productName:s.productName||null,
      state:s.state??first(node,["status","state","campaign_status"])??first(rawList,["status","state","campaign_status"])??null,
      budget:s.budget??null,targetRoas:s.targetRoas??null,
      adType:s.adType??first(node,["ad_type"])??rawList.ad_type??null,
      biddingMethod:s.biddingMethod??null,placement:s.placement??null,startTime:s.startTime??null,endTime:s.endTime??null,
      controlMode:s.controlMode||"manual",
      ...m,
      costPerOrder:orders!=null&&orders>0&&spend!=null?spend/orders:null,
      performanceStatus:m.available?"success":(campaignDaily?.ok===false?"error":"empty")
    });
  }
  return list.sort((a,b)=>{
    const ao=a.state==="ongoing"?0:a.state?1:2,bo=b.state==="ongoing"?0:b.state?1:2;
    const bs=b.spend??-Infinity,as=a.spend??-Infinity;
    return ao-bo||bs-as;
  });
}

function campaignInsights(campaigns){
  const withSpend=campaigns.filter(c=>c.spend!=null&&c.spend>0);
  const topSpend=[...withSpend].sort((a,b)=>b.spend-a.spend)[0]||null;
  const bestRoas=[...withSpend].filter(c=>c.roas!=null).sort((a,b)=>b.roas-a.roas)[0]||null;
  const withOrders=withSpend.filter(c=>c.orders!=null);
  const waste=[...withOrders].sort((a,b)=>{
    const aZero=a.orders===0?1:0,bZero=b.orders===0?1:0;if(aZero!==bZero)return bZero-aZero;
    const ac=a.orders>0?a.spend/a.orders:a.spend,bc=b.orders>0?b.spend/b.orders:b.spend;return bc-ac;
  })[0]||null;
  return{topSpend,bestRoas,highestSpendLowConversion:waste,zeroOrderSpendCount:withOrders.length?withOrders.filter(c=>c.orders===0).length:null};
}

function productSeries(campaignDaily){
  if(!campaignDaily?.ok)return[];
  const rows=metricRows(payload(campaignDaily),[]),groups=new Map();
  for(const row of rows){
    const key=String(row.date||row.performance_date||row.stat_date||"");if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([date,dayRows])=>{
    const a=aggregateRows(dayRows);
    return{date,impression:a.impressions,clicks:a.clicks,expense:a.spend,broad_gmv:a.gmv,broad_order:a.orders,broad_item_sold:a.sold};
  }).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}

function capabilityStatus(cap,hasRows=false){
  if(!cap?.ok)return"error";
  return hasRows?"success":"empty";
}
function capabilityMessage(cap){
  return cap?.ok?null:(cap?.error||"A fonte não respondeu.");
}
function customRangeFromQuery(url){
  const startDate=String(url.searchParams.get("start_date")||"").trim();
  const endDate=String(url.searchParams.get("end_date")||"").trim();
  if(!startDate&&!endDate)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate))throw new Error("Informe data inicial e final válidas.");
  const start=new Date(`${startDate}T12:00:00.000Z`),end=new Date(`${endDate}T12:00:00.000Z`);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)throw new Error("O período personalizado de Ads é inválido.");
  const days=Math.floor((end-start)/86400000)+1;
  if(days<1||days>90)throw new Error("O período personalizado deve ter entre 1 e 90 dias.");
  return{startDate,endDate,days};
}

export async function GET(request){
  let shop;
  try{shop=await getActiveShop();}
  catch(error){
    console.error("[Shopee Ads] falha lendo conexão",String(error?.message||error));
    return NextResponse.json({error:"Não foi possível verificar a loja conectada."},{status:500});
  }
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});

  const u=new URL(request.url);
  let customRange=null;
  try{customRange=customRangeFromQuery(u);}catch(error){return NextResponse.json({error:String(error?.message||error)},{status:400});}
  const days=customRange?.days??Math.max(1,Math.min(90,Number(u.searchParams.get("days")||7)));
  const period=customRange?{startDate:customRange.startDate,endDate:customRange.endDate}:days;
  const [daily,hourly,campaigns]=await Promise.all([
    safeCapability("daily",()=>getAdsDaily(shop,period)),
    safeCapability("hourly",()=>getAdsHourly(shop)),
    safeCapability("campaigns",()=>getAdsCampaignList(shop))
  ]);
  const ids=idsFrom(campaigns);
  const [settings,campaignDaily]=await Promise.all([
    safeCapability("settings",()=>getAdsCampaignSettings(shop,ids)),
    safeCapability("campaign_daily",()=>getAdsCampaignDaily(shop,ids,period))
  ]);

  const dailyRows=daily?.ok?metricRows(payload(daily),[]):[],
        allCpcSummary=aggregateRows(dailyRows),
        normalizedCampaigns=normalizeCampaigns(campaignDaily,settings,campaigns),
        productSummary=aggregateCampaignSummaries(normalizedCampaigns),
        summary=campaignDaily?.ok?productSummary:allCpcSummary,
        insights=campaignInsights(normalizedCampaigns),
        series=productSeries(campaignDaily),
        activeCampaigns=normalizedCampaigns.filter(c=>c.state==="ongoing");

  const availability={
    daily:capabilityStatus(daily,dailyRows.length>0),
    hourly:capabilityStatus(hourly,metricRows(payload(hourly),[]).length>0),
    campaigns:capabilityStatus(campaigns,ids.length>0),
    settings:capabilityStatus(settings,settingsMap(settings,campaigns).size>0),
    campaignDaily:capabilityStatus(campaignDaily,metricRows(payload(campaignDaily),[]).length>0),
    messages:{
      daily:capabilityMessage(daily),hourly:capabilityMessage(hourly),campaigns:capabilityMessage(campaigns),
      settings:capabilityMessage(settings),campaignDaily:capabilityMessage(campaignDaily)
    }
  };

  const v7={
    source:"Enciclopédia Shopee Seller Center v7",
    scope:campaignDaily?.ok?"product_ads":"all_cpc_fallback",
    summary,productSummary,allCpcSummary,campaigns:normalizedCampaigns,activeCampaigns,series,insights,availability,
    controls:{enabled:true,actions:["pause","resume","start","stop","change_budget","change_roas_target","protection_reset"],protectionResetExperimental:true}
  };
  return NextResponse.json({
    days,startDate:customRange?.startDate||null,endDate:customRange?.endDate||null,customRange:!!customRange,
    shopId:String(shop.shop_id),campaignIds:ids,daily,hourly,campaigns,settings,campaignDaily,
    v7,v5:{...v7,source:"Enciclopédia Shopee Seller Center v7 (compat v5)"}
  });
}
