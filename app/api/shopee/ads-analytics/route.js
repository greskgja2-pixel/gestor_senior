import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { shopGetExtra, safeCapability } from "../../../../lib/shopee-extra";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const METRIC_KEYS = new Set(["impression","impressions","click","clicks","expense","cost","spend","broad_gmv","gmv","broad_order","order","orders","broad_order_amount","broad_item_sold","item_sold","sold"]);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const first = (obj, keys) => { for (const key of keys) if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key]; return null; };
const chunk = (arr, size) => { const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; };

function parseIsoDate(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
function isoDate(date) { return date.toISOString().slice(0,10); }
function shopeeDate(date) { return `${String(date.getUTCDate()).padStart(2,"0")}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${date.getUTCFullYear()}`; }
function plusDays(date, delta) { const d = new Date(date); d.setUTCDate(d.getUTCDate() + delta); return d; }
function daysInclusive(start,end) { return Math.floor((end-start)/86400000)+1; }

function metricRows(value,out=[]) {
  if (Array.isArray(value)) { for (const row of value) metricRows(row,out); return out; }
  if (!value || typeof value !== "object") return out;
  const keys = Object.keys(value);
  if (keys.some(k => METRIC_KEYS.has(k))) { out.push(value); return out; }
  for (const child of Object.values(value)) metricRows(child,out);
  return out;
}
function aggregateRows(rows) {
  const a={impressions:0,clicks:0,spend:0,gmv:0,orders:0,sold:0};
  for(const row of rows){
    a.impressions+=num(first(row,["impression","impressions"]));
    a.clicks+=num(first(row,["click","clicks"]));
    a.spend+=num(first(row,["expense","cost","spend"]));
    a.gmv+=num(first(row,["broad_gmv","gmv"]));
    a.orders+=num(first(row,["broad_order","order","orders"]));
    a.sold+=num(first(row,["broad_item_sold","item_sold","broad_order_amount","sold"]));
  }
  a.roas=a.spend>0?a.gmv/a.spend:null;
  a.ctr=a.impressions>0?(a.clicks/a.impressions)*100:null;
  a.costPerConversion=a.orders>0?a.spend/a.orders:(a.spend>0?null:0);
  return a;
}
function campaignNodes(value,out=[]) {
  if (Array.isArray(value)) { for (const row of value) campaignNodes(row,out); return out; }
  if (!value || typeof value !== "object") return out;
  if (value.campaign_id !== undefined && value.campaign_id !== null) { out.push(value); return out; }
  for (const child of Object.values(value)) campaignNodes(child,out);
  return out;
}
function itemMetricNodes(value,out=[]) {
  if (Array.isArray(value)) { for (const row of value) itemMetricNodes(row,out); return out; }
  if (!value || typeof value !== "object") return out;
  const hasMetrics=Object.keys(value).some(k=>METRIC_KEYS.has(k));
  if (value.item_id !== undefined && value.item_id !== null && hasMetrics) { out.push(value); return out; }
  for (const child of Object.values(value)) itemMetricNodes(child,out);
  return out;
}
function addMetric(map,itemId,metric,campaignId,meta={}) {
  const key=String(itemId); if(!itemId) return;
  const cur=map.get(key)||{itemId:Number(itemId),impressions:0,clicks:0,spend:0,gmv:0,orders:0,sold:0,campaignIds:[],campaignCount:0,sharedCampaign:false};
  cur.impressions+=metric.impressions;cur.clicks+=metric.clicks;cur.spend+=metric.spend;cur.gmv+=metric.gmv;cur.orders+=metric.orders;cur.sold+=metric.sold;
  if(campaignId&&!cur.campaignIds.includes(campaignId))cur.campaignIds.push(campaignId);
  cur.campaignCount=cur.campaignIds.length;cur.sharedCampaign=cur.sharedCampaign||!!meta.sharedCampaign;
  map.set(key,cur);
}
function finalize(map){
  const out={};
  for(const [key,x] of map){x.roas=x.spend>0?x.gmv/x.spend:null;x.ctr=x.impressions>0?(x.clicks/x.impressions)*100:null;x.costPerConversion=x.orders>0?x.spend/x.orders:(x.spend>0?null:0);out[key]=x;}
  return out;
}
async function getAllCampaignIds(shop){
  const ids=[];let offset=0;
  for(let page=0;page<20;page++){
    const res=await shopGetExtra("/api/v2/ads/get_product_level_campaign_id_list",{shopId:shop.shop_id,accessToken:shop.access_token,params:{ad_type:"all",limit:100,offset}});
    const d=res?.response||res||{},rows=d.campaign_list||[];
    ids.push(...rows.map(x=>Number(x.campaign_id)).filter(Boolean));
    if(rows.length<100||d.has_next_page===false)break;
    offset+=rows.length;
  }
  return [...new Set(ids)];
}
async function getSettings(shop,ids){
  const results=[];
  for(const batch of chunk(ids,100)){
    const r=await safeCapability("settings",()=>shopGetExtra("/api/v2/ads/get_product_level_campaign_setting_info",{shopId:shop.shop_id,accessToken:shop.access_token,params:{campaign_id_list:batch.join(","),info_type_list:"1,2,3,4"}}));
    if(r.ok)results.push(r.data);
  }
  return results;
}
async function getPerformance(shop,ids,start,end){
  const results=[];
  for(const batch of chunk(ids,100)){
    const r=await safeCapability("performance",()=>shopGetExtra("/api/v2/ads/get_product_campaign_daily_performance",{shopId:shop.shop_id,accessToken:shop.access_token,params:{campaign_id_list:batch.join(","),start_date:shopeeDate(start),end_date:shopeeDate(end)}}));
    if(r.ok)results.push(r.data);
  }
  return results;
}
function buildSettingsMap(results){
  const map=new Map();
  for(const result of results){
    const d=result?.response||result||{};
    const rows=Array.isArray(d.campaign_list)?d.campaign_list:campaignNodes(d,[]);
    for(const row of rows){
      const id=Number(row.campaign_id);if(!id)continue;
      const common=row.common_info||{},auto=Array.isArray(row.auto_product_ads_info)?row.auto_product_ads_info:[];
      const itemIds=(Array.isArray(common.item_id_list)&&common.item_id_list.length?common.item_id_list:auto.map(x=>x.item_id)).map(Number).filter(Boolean);
      map.set(id,{campaignId:id,itemIds,itemId:itemIds[0]||null,title:common.ad_name||auto[0]?.product_name||`Campanha ${id}`,state:common.campaign_status||auto[0]?.status||null,targetRoas:row.auto_bidding_info?.roas_target??null,budget:common.campaign_budget??auto[0]?.campaign_budget??null,controlMode:itemIds.length>1?"gms":"manual"});
    }
  }
  return map;
}
function metricsByItem(performanceResults,settingsMap){
  const out=new Map();
  for(const result of performanceResults){
    for(const campaign of campaignNodes(result?.response||result||{},[])){
      const campaignId=Number(campaign.campaign_id),meta=settingsMap.get(campaignId)||{};
      const itemRows=itemMetricNodes(campaign,[]);
      if(itemRows.length){
        const grouped=new Map();
        for(const row of itemRows){const id=Number(row.item_id);if(!id)continue;const arr=grouped.get(id)||[];arr.push(row);grouped.set(id,arr);}
        for(const [itemId,rows] of grouped)addMetric(out,itemId,aggregateRows(rows),campaignId,{sharedCampaign:false});
      } else if(meta.itemIds?.length===1){
        addMetric(out,meta.itemIds[0],aggregateRows(metricRows(campaign,[])),campaignId,{sharedCampaign:false});
      }
    }
  }
  return finalize(out);
}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
  const u=new URL(request.url),today=new Date();
  const defaultEnd=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
  const defaultStart=plusDays(defaultEnd,-6);
  const start=parseIsoDate(u.searchParams.get("from"))||defaultStart;
  const end=parseIsoDate(u.searchParams.get("to"))||defaultEnd;
  if(start>end)return NextResponse.json({error:"Intervalo inválido: a data inicial é posterior à final."},{status:400});
  const span=daysInclusive(start,end);
  if(span<1||span>90)return NextResponse.json({error:"O intervalo deve ter entre 1 e 90 dias."},{status:400});
  const prevEnd=plusDays(start,-1),prevStart=plusDays(prevEnd,-(span-1));
  const ids=await getAllCampaignIds(shop);
  if(!ids.length)return NextResponse.json({shopId:String(shop.shop_id),range:{from:isoDate(start),to:isoDate(end),days:span},previousRange:{from:isoDate(prevStart),to:isoDate(prevEnd),days:span},campaignCount:0,current:{},previous:{},settings:{}});
  const settingsResults=await getSettings(shop,ids),settingsMap=buildSettingsMap(settingsResults);
  const [currentPerf,previousPerf]=await Promise.all([getPerformance(shop,ids,start,end),getPerformance(shop,ids,prevStart,prevEnd)]);
  return NextResponse.json({
    shopId:String(shop.shop_id),
    range:{from:isoDate(start),to:isoDate(end),days:span},
    previousRange:{from:isoDate(prevStart),to:isoDate(prevEnd),days:span},
    campaignCount:ids.length,
    current:metricsByItem(currentPerf,settingsMap),
    previous:metricsByItem(previousPerf,settingsMap),
    settings:Object.fromEntries([...settingsMap.entries()].map(([id,x])=>[String(id),x]))
  });
}
