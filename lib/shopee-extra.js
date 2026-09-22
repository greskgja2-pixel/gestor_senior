import crypto from "crypto";

const HOSTS={live:"https://partner.shopeemobile.com",test:"https://openplatform.sandbox.test-stable.shopee.sg"};
function host(){const e=(process.env.SHOPEE_ENV||"live").trim().toLowerCase();return HOSTS[e]||HOSTS.live;}
function creds(){const partnerId=String(process.env.SHOPEE_PARTNER_ID||"").trim(),partnerKey=String(process.env.SHOPEE_PARTNER_KEY||"").trim();if(!partnerId||!partnerKey)throw new Error("Credenciais Shopee ausentes.");return{partnerId,partnerKey};}
function signed(path,shopId,accessToken){const{partnerId,partnerKey}=creds(),timestamp=Math.floor(Date.now()/1000),base=`${partnerId}${path}${timestamp}${accessToken}${shopId}`,sign=crypto.createHmac("sha256",partnerKey).update(base).digest("hex");return{partnerId,timestamp,sign};}
async function read(res,path){const text=await res.text();let json=null;try{json=text?JSON.parse(text):null}catch{}if(!res.ok)throw new Error(`Shopee ${path}: HTTP ${res.status}${json?.message?` — ${json.message}`:""}`);if(json?.error){const e=new Error(`Shopee ${path}: ${json.error} — ${json.message||""}`);e.shopeeCode=json.error;throw e;}return json||{};}
export async function shopGetExtra(path,{shopId,accessToken,params={}}){const s=signed(path,shopId,accessToken),q=new URLSearchParams({partner_id:s.partnerId,timestamp:String(s.timestamp),sign:s.sign,shop_id:String(shopId),access_token:accessToken});Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")q.set(k,String(v));});return read(await fetch(`${host()}${path}?${q}`,{cache:"no-store",signal:AbortSignal.timeout(20000)}),path);}
export async function shopPostExtra(path,{shopId,accessToken,body={}}){const s=signed(path,shopId,accessToken),q=new URLSearchParams({partner_id:s.partnerId,timestamp:String(s.timestamp),sign:s.sign,shop_id:String(shopId),access_token:accessToken});return read(await fetch(`${host()}${path}?${q}`,{method:"POST",cache:"no-store",signal:AbortSignal.timeout(20000),headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),path);}
const SHOPEE_ADS_TIME_ZONE="America/Sao_Paulo";
function zonedDateParts(date,timeZone=SHOPEE_ADS_TIME_ZONE){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(date));
  const read=type=>Number(parts.find(p=>p.type===type)?.value);
  return{year:read("year"),month:read("month"),day:read("day")};
}
function formatDateParts({year,month,day}){return`${String(day).padStart(2,"0")}-${String(month).padStart(2,"0")}-${year}`;}
export function formatShopeeDate(date){return formatDateParts(zonedDateParts(date));}
export function dateRange(days=7,now=new Date()){
  const endParts=zonedDateParts(now),endAnchor=new Date(Date.UTC(endParts.year,endParts.month-1,endParts.day,12));
  const startAnchor=new Date(endAnchor);startAnchor.setUTCDate(startAnchor.getUTCDate()-Math.max(0,days-1));
  const startParts={year:startAnchor.getUTCFullYear(),month:startAnchor.getUTCMonth()+1,day:startAnchor.getUTCDate()};
  return{startDate:formatDateParts(startParts),endDate:formatDateParts(endParts)};
}
function isoToShopeeDate(value){
  const m=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const d=new Date(Date.UTC(year,month-1,day,12));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
  return formatDateParts({year,month,day});
}
export function adsDateRange(period=7){
  if(period&&typeof period==="object"){
    const startDate=isoToShopeeDate(period.startDate),endDate=isoToShopeeDate(period.endDate);
    if(!startDate||!endDate)throw new Error("Período personalizado de Ads inválido.");
    return{startDate,endDate};
  }
  return dateRange(period);
}
export async function getAdsDaily(shop,period=7){const{startDate,endDate}=adsDateRange(period);return shopGetExtra("/api/v2/ads/get_all_cpc_ads_daily_performance",{shopId:shop.shop_id,accessToken:shop.access_token,params:{start_date:startDate,end_date:endDate}});}
export async function getAdsHourly(shop,date=new Date()){return shopGetExtra("/api/v2/ads/get_all_cpc_ads_hourly_performance",{shopId:shop.shop_id,accessToken:shop.access_token,params:{performance_date:formatShopeeDate(date)}});}
export async function getAdsCampaignList(shop){return shopGetExtra("/api/v2/ads/get_product_level_campaign_id_list",{shopId:shop.shop_id,accessToken:shop.access_token,params:{ad_type:"all",limit:100,offset:0}});}
export async function getAdsCampaignSettings(shop,ids){if(!ids?.length)return{response:{campaign_list:[]}};return shopGetExtra("/api/v2/ads/get_product_level_campaign_setting_info",{shopId:shop.shop_id,accessToken:shop.access_token,params:{campaign_id_list:ids.slice(0,100).join(","),info_type_list:"1,2,3,4"}});}
export async function getAdsCampaignDaily(shop,ids,period=7){if(!ids?.length)return{response:{campaign_list:[]}};const{startDate,endDate}=adsDateRange(period);return shopGetExtra("/api/v2/ads/get_product_campaign_daily_performance",{shopId:shop.shop_id,accessToken:shop.access_token,params:{campaign_id_list:ids.slice(0,100).join(","),start_date:startDate,end_date:endDate}});}
export async function getAdsCampaignHourly(shop,ids,date=new Date()){if(!ids?.length)return{response:{campaign_list:[]}};return shopGetExtra("/api/v2/ads/get_product_campaign_hourly_performance",{shopId:shop.shop_id,accessToken:shop.access_token,params:{campaign_id_list:ids.slice(0,100).join(","),performance_date:formatShopeeDate(date)}});}

// Escrita oficial Shopee Open Platform para campanhas de produto com seleção manual.
// Nunca reutiliza cookies/SPC_CDS do Seller Center; usa somente a autorização Partner já conectada.
export async function editManualProductAds(shop,{campaignId,editAction,budget,roasTarget,startDate,endDate,referenceId}){
  const body={campaign_id:Number(campaignId),edit_action:String(editAction),reference_id:String(referenceId||crypto.randomUUID())};
  if(budget!==undefined&&budget!==null)body.budget=Number(budget);
  if(roasTarget!==undefined&&roasTarget!==null)body.roas_target=Number(roasTarget);
  if(startDate)body.start_date=String(startDate);
  if(endDate!==undefined&&endDate!==null&&endDate!=="")body.end_date=String(endDate);
  return shopPostExtra("/api/v2/ads/edit_manual_product_ads",{shopId:shop.shop_id,accessToken:shop.access_token,body});
}

// Escrita oficial para campanhas GMS/GMV Max da loja. A Shopee normaliza roas_target
// para uma casa decimal neste endpoint; não usar este caminho para truques de +0,01.
export async function editGmsProductCampaign(shop,{campaignId,editAction,dailyBudget,roasTarget,startDate,endDate,referenceId}){
  const body={campaign_id:Number(campaignId),edit_action:String(editAction),reference_id:String(referenceId||crypto.randomUUID())};
  if(dailyBudget!==undefined&&dailyBudget!==null)body.daily_budget=Number(dailyBudget);
  if(roasTarget!==undefined&&roasTarget!==null)body.roas_target=Number(roasTarget);
  if(startDate)body.start_date=String(startDate);
  if(endDate!==undefined&&endDate!==null&&endDate!=="")body.end_date=String(endDate);
  return shopPostExtra("/api/v2/ads/edit_gms_product_campaign",{shopId:shop.shop_id,accessToken:shop.access_token,body});
}

export async function getAdsRecommendedRoiTarget(shop,itemId,referenceId){
  return shopGetExtra("/api/v2/ads/get_product_recommended_roi_target",{shopId:shop.shop_id,accessToken:shop.access_token,params:{item_id:Number(itemId),reference_id:String(referenceId||crypto.randomUUID())}});
}

export async function getEscrowList(shop,days=30,endTime){const to=endTime||Math.floor(Date.now()/1000),from=to-Math.max(1,days)*86400;return shopPostExtra("/api/v2/payment/get_escrow_list",{shopId:shop.shop_id,accessToken:shop.access_token,body:{page_no:1,page_size:100,release_time_from:from,release_time_to:to}});}
// Saldo/carteira: só funciona pra lojas "locais" (BR incluso) e pode exigir escopo especifico
// liberado no Partner. Se a Shopee recusar, o painel cai pra "sem dados" — nunca inventa saldo.
export async function getWalletTransactionList(shop,days=90){const now=Math.floor(Date.now()/1000),from=now-Math.max(1,days)*86400;return shopPostExtra("/api/v2/payment/get_wallet_transaction_list",{shopId:shop.shop_id,accessToken:shop.access_token,body:{page_no:1,page_size:100,create_time_from:from,create_time_to:now}});}
export async function getAccountHealth(shop){return shopGetExtra("/api/v2/account_health/get_shop_performance",{shopId:shop.shop_id,accessToken:shop.access_token,params:{}});}
// Desativar (unlist:true) ou reativar (unlist:false) um anúncio real na Shopee. Ação de escrita
// de verdade — quem chama isso já confirmou com o lojista antes (ver /api/shopee/product-action).
export async function unlistItem(shop,itemId,unlist){return shopPostExtra("/api/v2/product/unlist_item",{shopId:shop.shop_id,accessToken:shop.access_token,body:{item_id:Number(itemId),unlist:Boolean(unlist)}});}
// Excluir um anúncio real na Shopee — irreversível. Também é ação de escrita de verdade.
export async function deleteItem(shop,itemId){return shopPostExtra("/api/v2/product/delete_item",{shopId:shop.shop_id,accessToken:shop.access_token,body:{item_id:Number(itemId)}});}
export async function safeCapability(name,fn){try{return{name,ok:true,data:await fn()}}catch(error){return{name,ok:false,error:String(error?.message||error),code:error?.shopeeCode||null}}}
