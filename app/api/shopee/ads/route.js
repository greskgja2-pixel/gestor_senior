import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getAdsDaily,getAdsHourly,getAdsCampaignList,getAdsCampaignSettings,getAdsCampaignDaily,safeCapability } from "../../../../lib/shopee-extra";
export const dynamic="force-dynamic";
function idsFrom(result){const d=result?.data?.response||result?.data||{};return (d.campaign_list||[]).map(x=>Number(x.campaign_id)).filter(Boolean);}
export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
  const u=new URL(request.url),days=Math.max(1,Math.min(90,Number(u.searchParams.get("days")||7)));
  // A Shopee limita Ads a 5 requests em 5 segundos. Mantemos esta rota em exatamente 5 chamadas:
  // visão diária da loja, visão horária da loja, lista de campanhas por produto, configurações
  // (pra achar o item_id de cada campanha) e desempenho diário por campanha no período pedido
  // (pra dar gasto de Ads por produto no período — não só "hoje").
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
  return NextResponse.json({days,shopId:String(shop.shop_id),campaignIds:ids,daily,hourly,campaigns,settings,campaignDaily});
}
