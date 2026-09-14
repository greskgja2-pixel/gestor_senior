import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
const CONFIRMED=new Set(["valid","invalid","unsupported"]);

function cors(origin){return{
  "Access-Control-Allow-Origin":origin||"*",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type",
  "Cache-Control":"no-store"
};}
export async function OPTIONS(request){return new NextResponse(null,{status:204,headers:cors(request.headers.get("origin"))});}

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

export async function POST(request){
  const origin=request.headers.get("origin")||"";
  const allowedOrigin=!origin||origin.startsWith("chrome-extension://")||origin===new URL(request.url).origin;
  if(!allowedOrigin)return NextResponse.json({error:"Origem não autorizada."},{status:403,headers:cors(origin)});
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400,headers:cors(origin)});
  let body={};try{body=await request.json();}catch{return NextResponse.json({error:"JSON inválido."},{status:400,headers:cors(origin)});}
  const campaignId=Number(body.campaignId),status=String(body.status||"");
  if(!Number.isSafeInteger(campaignId)||campaignId<=0||!CONFIRMED.has(status))return NextResponse.json({error:"Status/campanha inválidos."},{status:400,headers:cors(origin)});
  const now=new Date(),db=supabaseAdmin(),next=status==="invalid"?new Date(now.getTime()+48*60*60*1000):null;
  const {error}=await db.from("ads_roas_protection_state").upsert({
    shop_id:Number(shop.shop_id),campaign_id:campaignId,status,
    source:"seller_center_capture",confidence:"confirmed",
    invalid_reason:body.invalidReason?String(body.invalidReason):null,
    last_confirmed_at:now.toISOString(),next_check_at:next?.toISOString()||null,
    details:{total_amount:body.totalAmount??null,raw_status:status},updated_at:now.toISOString()
  },{onConflict:"shop_id,campaign_id"});
  if(error)return NextResponse.json({error:error.message},{status:500,headers:cors(origin)});
  return NextResponse.json({ok:true,campaignId,status,confirmedAt:now.toISOString()},{headers:cors(origin)});
}
