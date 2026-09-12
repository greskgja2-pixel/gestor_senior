import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getAccountHealth,safeCapability } from "../../../../lib/shopee-extra";
export const dynamic="force-dynamic";
export async function GET(){const shop=await getActiveShop();if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});return NextResponse.json(await safeCapability("account_health",()=>getAccountHealth(shop)));}
