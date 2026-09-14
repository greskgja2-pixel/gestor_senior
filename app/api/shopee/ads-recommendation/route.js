import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getAdsRecommendedRoiTarget } from "../../../../lib/shopee-extra";

export const dynamic="force-dynamic";
export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
  const itemId=Number(new URL(request.url).searchParams.get("item_id"));
  if(!Number.isSafeInteger(itemId)||itemId<=0)return NextResponse.json({error:"item_id inválido."},{status:400});
  try{
    const data=await getAdsRecommendedRoiTarget(shop,itemId);
    const r=data?.response||{};
    return NextResponse.json({ok:true,itemId,lower:r.lower_bound||null,exact:r.exact||null,upper:r.upper_bound||null,raw:data});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
