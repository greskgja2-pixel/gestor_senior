import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const text=(v,max)=>v==null?null:(String(v).trim().slice(0,max)||null);

export async function GET(){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const {data,error}=await supabaseAdmin().from('gs_notification_preferences').select('*').eq('shop_id',shop.shop_id).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,preferences:data||{
    shop_id:shop.shop_id,display_name:'',email:'',phone:'',task_enabled:true,email_enabled:true,whatsapp_enabled:false,push_enabled:false,
    timezone:'America/Sao_Paulo',categories:{flash_sale:true,reanalysis:true,competitors:true,images:true,video:true,ads:true,other:true}
  }});
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const email=text(body?.email,320);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:'E-mail inválido.'},{status:400});
  const row={
    shop_id:shop.shop_id,display_name:text(body?.display_name,120),email,phone:text(body?.phone,40),
    task_enabled:body?.task_enabled!==false,email_enabled:body?.email_enabled!==false,
    whatsapp_enabled:body?.whatsapp_enabled===true,push_enabled:body?.push_enabled===true,
    timezone:text(body?.timezone,80)||'America/Sao_Paulo',
    categories:body?.categories&&typeof body.categories==='object'?body.categories:{flash_sale:true,reanalysis:true,competitors:true,images:true,video:true,ads:true,other:true},
    updated_at:new Date().toISOString()
  };
  const {data,error}=await supabaseAdmin().from('gs_notification_preferences').upsert(row,{onConflict:'shop_id'}).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,preferences:data});
}
