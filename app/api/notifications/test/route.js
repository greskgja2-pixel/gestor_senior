import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';
import {getNotificationProviderStatus,sendNotificationTest} from '../../../../lib/notifications';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};
  try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const channel=String(body?.channel||'').trim().toLowerCase();
  if(!['email','whatsapp'].includes(channel))return NextResponse.json({error:'Canal inválido.'},{status:400});

  const db=supabaseAdmin();
  const {data:preferences,error}=await db.from('gs_notification_preferences').select('*').eq('shop_id',shop.shop_id).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(!preferences)return NextResponse.json({error:'Salve nome, e-mail e telefone nas Configurações antes de testar.'},{status:400});

  const providers=getNotificationProviderStatus();
  if(!providers[channel]?.configured){
    return NextResponse.json({
      error:channel==='email'
        ?'Resend ainda não está configurado no servidor.'
        :'WhatsApp Cloud API ainda não está configurada no servidor.',
      providers
    },{status:503});
  }
  if(channel==='email'&&!preferences.email)return NextResponse.json({error:'Cadastre o e-mail dos alertas.'},{status:400});
  if(channel==='whatsapp'&&!preferences.phone)return NextResponse.json({error:'Cadastre o celular / WhatsApp.'},{status:400});

  try{
    const result=await sendNotificationTest({channel,preferences});
    if(!result?.sent)return NextResponse.json({error:'O provedor não confirmou o envio.',result,providers},{status:502});
    return NextResponse.json({ok:true,channel,result,providers});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error),providers},{status:502});
  }
}
