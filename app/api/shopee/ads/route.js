import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getAdsDaily,getAdsHourly,getAdsCampaignList,getAdsCampaignSettings,getAdsCampaignDaily,safeCapability } from "../../../../lib/shopee-extra";
export const dynamic="force-dynamic";

const METRIC_KEYS=new Set(["impression","impressions","click","clicks","expense","cost","spend","broad_gmv","gmv","broad_order","order","orders","broad_order_amount","broad_item_sold","item_sold","sold","broad_roi","broad_roas","roas","roi"]);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const first=(obj,keys)=>{for(const key of keys){if(obj&&obj[key]!==undefined&&obj[key]!==null&&obj[key]!=="")return obj[key];}return null;};
function idsFrom(result){const d=result?.data?.response||result?.data||{};return (d.campaign_list||[]).map(x=>Number(x.campaign_id)).filter(Boolean);}
function metricRows(value,out=[]){if(Array.isArray(value)){for(const row of value)metricRows(row,out);return out;}if(!value||typeof value!=="object")return out;const keys=Object.keys(value);if(keys.some(k=>METRIC_KEYS.has(k))){out.push(value);return out;}for(const child of Object.values(value))metricRows(child,out);return out;}
function aggregateRows(rows){const a={impressions:0,clicks:0,spend:0,gmv:0,orders:0,sold:0};for(const row of rows){a.impressions+=num(first(row,["impression","impressions"]));a.clicks+=num(first(row,["click","clicks"]));a.spend+=num(first(row,["expense","cost","spend"]));a.gmv+=num(first(row,["broad_gmv","gmv"]));a.orders+=num(first(row,["broad_order","order","orders"]));a.sold+=num(first(row,["broad_item_sold","item_sold","broad_order_amount","sold"]));}a.roas=a.spend>0?a.gmv/a.spend:null;a.ctr=a.impressions>0?(a.clicks/a.impressions)*100:null;a.cpc=a.clicks>0?a.spend/a.clicks:null;a.conversionRate=a.clicks>0?(a.orders/a.clicks)*100:null;return a;}
function aggregateCampaignSummaries(campaigns){const a={impressions:0,clicks:0,spend:0,gmv:0,orders:0,sold:0};for(const c of campaigns||[]){a.impressions+=num(c.impressions);a.clicks+=num(c.clicks);a.spend+=num(c.spend);a.gmv+=num(c.gmv);a.orders+=num(c.orders);a.sold+=num(c.sold);}a.roas=a.spend>0?a.gmv/a.spend:null;a.ctr=a.impressions>0?(a.clicks/a.impressions)*100:null;a.cpc=a.clicks>0?a.spend/a.clicks:null;a.conversionRate=a.clicks>0?(a.orders/a.clicks)*100:null;return a;}
function campaignNodes(value,out=[]){if(Array.isArray(value)){for(const row of value)campaignNodes(row,out);return out;}if(!value||typeof value!=="object")return out;if(value.campaign_id!==undefined&&value.campaign_id!==null){out.push(value);return out;}for(const child of Object.values(value))campaignNodes(child,out);return out;}
function metricSummaryFromNode(node){const direct=Object.keys(node||{}).some(k=>METRIC_KEYS.has(k))?[node]:[];const rows=direct.length?direct:metricRows(node,[]);return aggregateRows(rows);}
function settingsMap(result){const map=new Map();for(const row of campaignNodes(result?.data?.response||result?.data||result,[])){const id=Number(row.campaign_id);if(!id)continue;const common=row.common_info||row;map.set(id,{campaignId:id,itemId:Number(first(common,["item_id","itemid"])||first(row,["item_id","itemid"]))||null,title:String(first(common,["ad_name","campaign_name","name","title"])||first(row,["campaign_name","name","title"])||`Campanha ${id}`),state:first(common,["campaign_status","status","state"])??first(row,["status","state","campaign_status"])??null,budget:num(first(common,["campaign_budget","daily_budget","budget"])||first(row,["daily_budget","budget"]))||null});}return map;}
function normalizeCampaigns(campaignDaily,settings){const meta=settingsMap(settings);const nodes=campaignNodes(campaignDaily?.data?.response||campaignDaily?.data||campaignDaily,[]);const list=[];for(const node of nodes){const campaignId=Number(node.campaign_id);if(!campaignId)continue;const m=metricSummaryFromNode(node),s=meta.get(campaignId)||{};list.push({campaignId,itemId:(s.itemId??Number(first(node,["item_id"])))||null,title:s.title||String(first(node,["campaign_name","name","title"])||`Campanha ${campaignId}`),state:s.state??first(node,["status","state","campaign_status"])??null,budget:s.budget??null,...m,costPerOrder:m.orders>0?m.spend/m.orders:(m.spend>0?null:0)});}return list;}
function campaignInsights(campaigns){const withSpend=campaigns.filter(c=>c.spend>0);const topSpend=[...withSpend].sort((a,b)=>b.spend-a.spend)[0]||null;const bestRoas=[...withSpend].filter(c=>c.roas!=null).sort((a,b)=>b.roas-a.roas)[0]||null;const waste=[...withSpend].sort((a,b)=>{const aZero=a.orders===0?1:0,bZero=b.orders===0?1:0;if(aZero!==bZero)return bZero-aZero;const ac=a.orders>0?a.spend/a.orders:a.spend,bc=b.orders>0?b.spend/b.orders:b.spend;return bc-ac;})[0]||null;return{topSpend,bestRoas,highestSpendLowConversion:waste,zeroOrderSpendCount:withSpend.filter(c=>c.orders===0).length};}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
  const u=new URL(request.url),days=Math.max(1,Math.min(90,Number(u.searchParams.get("days")||7)));
  // A Shopee limita Ads a 5 requests em 5 segundos. Mantemos esta rota em exatamente 5 chamadas.
  // O resumo exibido ao usuário usa SOMENTE campanhas de produto, para corresponder à aba
  // "Todos os Anúncios de Produtos" do Seller Center. A visão geral de CPC continua disponível
  // separadamente em allCpcSummary para diagnóstico, sem contaminar o KPI de investimento.
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
  const normalizedCampaigns=campaignDaily?.ok?normalizeCampaigns(campaignDaily,settings):[];
  const productSummary=aggregateCampaignSummaries(normalizedCampaigns);
  const summary=campaignDaily?.ok?productSummary:allCpcSummary;
  const insights=campaignInsights(normalizedCampaigns);
  return NextResponse.json({days,shopId:String(shop.shop_id),campaignIds:ids,daily,hourly,campaigns,settings,campaignDaily,v5:{source:"Enciclopédia Shopee Seller Center v5",scope:campaignDaily?.ok?"product_ads":"all_cpc_fallback",summary,productSummary,allCpcSummary,campaigns:normalizedCampaigns,insights}});
}
