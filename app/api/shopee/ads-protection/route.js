import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
  const db=supabaseAdmin();
  const {data,error}=await db
    .from("ads_roas_protection_state")
    .select("campaign_id,status,source,confidence,invalid_reason,last_action_at,last_confirmed_at,next_check_at,details,updated_at")
    .eq("shop_id",Number(shop.shop_id));
  if(error)return NextResponse.json({error:error.message},{status:500});
  const now=Date.now();
  const states=(data||[]).map(row=>{
    const dueAt=row.next_check_at?new Date(row.next_check_at).getTime():null;
    const due=Number.isFinite(dueAt)&&dueAt<=now&&["suspended_assumed","invalid"].includes(row.status);
    return {...row,due};
  });
  return NextResponse.json({shopId:String(shop.shop_id),states});
}
