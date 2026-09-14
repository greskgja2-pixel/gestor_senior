import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { editManualProductAds,editGmsProductCampaign } from "../../../../lib/shopee-extra";

export const dynamic="force-dynamic";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ALLOWED=new Set(["pause","resume","start","stop","change_budget","change_roas_target","protection_reset"]);

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
    return NextResponse.json({ok:true,action,campaignId,mode,roasTarget:roas,result});
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
      return NextResponse.json({ok:true,experimental:true,action,campaignId,mode,steps,finalState:"resume",note:"Sequência pause/resume x2 concluída. O estado da Proteção de ROAS não é confirmado pela Open Platform nesta resposta."});
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
