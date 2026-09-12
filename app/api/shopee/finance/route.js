import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getEscrowList,safeCapability } from "../../../../lib/shopee-extra";
export const dynamic="force-dynamic";
export async function GET(request){const shop=await getActiveShop();if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});const u=new URL(request.url),days=Math.max(1,Math.min(90,Number(u.searchParams.get("days")||30)));const escrow=await safeCapability("escrow",()=>getEscrowList(shop,days));return NextResponse.json({days,shopId:String(shop.shop_id),escrow});}
