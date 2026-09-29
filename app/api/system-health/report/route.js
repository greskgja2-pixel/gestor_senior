import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const text=(v,max=500)=>v==null?null:(String(v).trim().slice(0,max)||null);
const cleanJson=(value,maxLen=50000)=>{
  try{
    const raw=JSON.stringify(value??null);
    if(raw.length>maxLen)return null;
    return JSON.parse(raw);
  }catch{return null}
};

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const summary=['ok','warning','error'].includes(body?.summary)?body.summary:'warning';
  const modules=Array.isArray(body?.modules)?body.modules.slice(0,30).map(m=>({
    id:text(m?.id,80),
    label:text(m?.label,120),
    status:['ok','warning','error'].includes(m?.status)?m.status:'warning',
    detail:text(m?.detail,1000),
    checks:Array.isArray(m?.checks)?m.checks.slice(0,30).map(c=>({
      label:text(c?.label,160),ok:c?.ok===true,detail:text(c?.detail,1000)
    })):[]
  })):[];
  const row={
    shop_id:shop.shop_id,
    checked_at:body?.checkedAt&&!Number.isNaN(new Date(body.checkedAt).getTime())?new Date(body.checkedAt).toISOString():new Date().toISOString(),
    summary,
    deep:body?.deep===true,
    modules,
    funnel_coverage:cleanJson(body?.funnelCoverage,12000),
    funnel_evidence:cleanJson(body?.funnelEvidence,20000),
    client_meta:cleanJson({
      extensionVersion:text(body?.extensionVersion,80),
      userAgent:text(body?.userAgent,500)
    },4000)||{}
  };
  const {data,error}=await supabaseAdmin().from('gs_system_health_reports').insert(row).select('id,checked_at,summary,deep').single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,report:data});
}

export async function GET(){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const {data,error}=await supabaseAdmin().from('gs_system_health_reports')
    .select('id,checked_at,summary,deep,modules,funnel_coverage,funnel_evidence,client_meta')
    .eq('shop_id',shop.shop_id).order('checked_at',{ascending:false}).limit(10);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,reports:data||[]});
}
