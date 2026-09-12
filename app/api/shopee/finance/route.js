import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getEscrowList, getWalletTransactionList, safeCapability } from "../../../../lib/shopee-extra";
export const dynamic="force-dynamic";
export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
  const u=new URL(request.url),days=Math.max(1,Math.min(90,Number(u.searchParams.get("days")||30)));
  const now=Math.floor(Date.now()/1000);
  const [escrow,prevEscrow,wallet]=await Promise.all([
    safeCapability("escrow",()=>getEscrowList(shop,days,now)),
    safeCapability("escrow_prev",()=>getEscrowList(shop,days,now-days*86400)),
    safeCapability("wallet",()=>getWalletTransactionList(shop,90)),
  ]);
  return NextResponse.json({days,shopId:String(shop.shop_id),escrow,prevEscrow,wallet});
}
