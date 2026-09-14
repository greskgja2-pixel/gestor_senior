import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { editManualProductAds,editGmsProductCampaign } from "../../../../lib/shopee-extra";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic="force-dynamic";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ALLOWED=new Set(["pause","resume","start","stop","change_budget","change_roas_target","protection_reset","protection_roas_nudge"]);

function bad(message,status=400){return NextResponse.json({error:message},{status});}
async function edit(shop,mode,args){
  if(mode==="gms")return editGmsProductCampaign(shop,{
    campaignId:args.campaignId,editAction:args.editAction,
    dailyBudget:args.budget,roasTarget:args.roasTarget,
    startDate:args.startDate,endDate:args.endDate
  });
  return editManualProductAds(shop,{
    campaignId:args.campaignId,editAction:args.editAction,
    budget:args.budget,roasTarget:args.roasTarget,
    startDate:args.startDate,endDate:args.endDate
  });
}
async function rememberProtection(shop,campaignId,{status="suspended_assumed",source="gestor",confidence="observed_method",invalidReason=null,details={}}={}){
  try{
    const now=new Date(),next=new Date(now.getTime()+48*60*60*1000),db=supabaseAdmin();
    const {error}=await db.from("ads_roas_protection_state").upsert({
      shop_id:Number(shop.shop_id),campaign_id:Number(campaignId),status,source,confidence,
      invalid_reason:invalidReason,last_action_at:now.toISOString(),next_check_at:next.toISOString(),
      details,updated_at:now.toISOString()
    },{onConflict:"shop_id,campaign_id"});
    if(error)console.error("ads_roas_protection_state upsert",error.message);
  }catch(error){console.error("ads_roas_protection_state",error?.message||error)}
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return bad("Nenhuma loja autorizada.",400);
  let body={};try{body=await request.json();}catch{return bad("JSON inválido.");}
  const campaignId=Number(body.campaignId),action=String(body.action||""),mode=body.mode==="gms"?"gms":"manual";
  if(!Number.isSafeInteger(campaignId)||campaignId<=0)return bad("campaignId inválido.");
  if(!ALLOWED.has(action))return bad("Ação de Ads não permitida.");

  if(action==="change_roas_target"){
    const roas=Number(body.roasTarget);
    if(!Number.isFinite(roas)||roas<=0||roas>9999)return bad("Meta de ROAS inválida.");
    const result=await edit(shop,mode,{campaignId,editAction:"change_roas_target",roasTarget:roas});
    await rememberProtection(shop,campaignId,{source:"roas_target_change",details:{roas_target:roas,method:"observed_roas_change"}});
    return NextResponse.json({ok:true,action,campaignId,mode,roasTarget:roas,result,protectionState:"suspended_assumed"});
  }
  if(action==="protection_roas_nudge"){
    if(mode==="gms")return bad("O ajuste +0,01 não é confiável em GMV Max/GMS porque a Shopee normaliza a Meta de ROAS. Use a rotina Pausar/Retomar 2x.");
    if(body.confirmed!==true)return bad("Confirmação explícita obrigatória para o ajuste experimental +0,01.");
    const current=Number(body.currentRoas);
    if(!Number.isFinite(current)||current<=0||current>=9999)return bad("Meta de ROAS atual inválida.");
    const roas=Math.round((current+0.01)*100)/100;
    const result=await edit(shop,mode,{campaignId,editAction:"change_roas_target",roasTarget:roas});
    await rememberProtection(shop,campaignId,{source:"roas_plus_001",details:{previous_roas:current,roas_target:roas,method:"observed_plus_0_01"}});
    return NextResponse.json({ok:true,experimental:true,action,campaignId,mode,previousRoas:current,roasTarget:roas,result,protectionState:"suspended_assumed"});
  }
  if(action==="change_budget"){
    const budget=Number(body.budget);
    if(!Number.isFinite(budget)||budget<0||budget>10000000)return bad("Orçamento inválido.");
    const result=await edit(shop,mode,{campaignId,editAction:"change_budget",budget});
    return NextResponse.json({ok:true,action,campaignId,mode,budget,result});
  }

  if(action==="protection_reset"){
    if(body.confirmed!==true)return bad("Confirmação explícita obrigatória para a rotina experimental de Proteção de ROAS.");
    const steps=[],sequence=["pause","resume","pause","resume"];
    try{
      for(let i=0;i<sequence.length;i++){
        const editAction=sequence[i];
        const result=await edit(shop,mode,{campaignId,editAction});
        steps.push({step:i+1,action:editAction,ok:true,result});
        if(i<sequence.length-1)await sleep(1200);
      }
      await rememberProtection(shop,campaignId,{source:"pause_resume_x2",details:{sequence,method:"observed_pause_resume_x2"}});
      return NextResponse.json({ok:true,experimental:true,action,campaignId,mode,steps,finalState:"resume",protectionState:"suspended_assumed",nextCheckHours:48,note:"Sequência pause/resume x2 concluída. O método foi observado invalidando a Proteção de ROAS no Seller Center; o Gestor agenda nova verificação em 48h."});
    }catch(error){
      steps.push({step:steps.length+1,action:sequence[steps.length]||"unknown",ok:false,error:String(error?.message||error)});
      let recovery=null;
      try{await sleep(500);recovery=await edit(shop,mode,{campaignId,editAction:"resume"});}catch(recoveryError){recovery={error:String(recoveryError?.message||recoveryError)}}
      return NextResponse.json({ok:false,experimental:true,action,campaignId,mode,steps,recovery,finalState:"resume_attempted",error:"A sequência não terminou. Foi feita uma tentativa final de retomar a campanha."},{status:502});
    }
  }

  const result=await edit(shop,mode,{campaignId,editAction:action});
  return NextResponse.json({ok:true,action,campaignId,mode,result});
}
