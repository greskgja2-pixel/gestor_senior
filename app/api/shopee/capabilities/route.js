import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getAdsDaily,getAdsHourly,getAdsCampaignList,getEscrowList,getAccountHealth,safeCapability } from "../../../../lib/shopee-extra";
export const dynamic="force-dynamic";
export async function GET(){const shop=await getActiveShop();if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});const [adsDaily,adsHourly,campaigns,finance,health]=await Promise.all([
safeCapability("ads_daily",()=>getAdsDaily(shop,7)),safeCapability("ads_hourly",()=>getAdsHourly(shop)),safeCapability("ads_campaigns",()=>getAdsCampaignList(shop)),safeCapability("payment_escrow",()=>getEscrowList(shop,30)),safeCapability("account_health",()=>getAccountHealth(shop))]);return NextResponse.json({shopId:String(shop.shop_id),environment:process.env.SHOPEE_ENV||"live",capabilities:[adsDaily,adsHourly,campaigns,finance,health]});}
