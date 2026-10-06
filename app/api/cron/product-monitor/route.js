import {NextResponse} from 'next/server';
import {supabaseAdmin} from '../../../../lib/supabase';
import {collectProductMonitorSnapshot} from '../../../../lib/product-monitor';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;

export async function GET(request){
  const secret=process.env.CRON_SECRET;
  if(secret){
    const auth=request.headers.get('authorization')||'';
    if(auth!==`Bearer ${secret}`)return NextResponse.json({error:'Não autorizado.'},{status:401});
  }
  const db=supabaseAdmin(),now=new Date().toISOString();
  const {data:watches,error}=await db.from('gs_product_monitor_watches')
    .select('*').eq('enabled',true).lte('next_check_at',now).order('next_check_at',{ascending:true}).limit(12);
  if(error)return NextResponse.json({error:error.message},{status:500});
  const results=[];
  for(const watch of watches||[]){
    try{
      const {data:shop,error:shopError}=await db.from('shop_credentials').select('*').eq('shop_id',watch.shop_id).eq('paused',false).maybeSingle();
      if(shopError)throw new Error(shopError.message);
      if(!shop)throw new Error('Loja sem credencial ativa.');
      const result=await collectProductMonitorSnapshot({shop,itemId:watch.item_id,force:true});
      results.push({item_id:watch.item_id,ok:true,skipped:result.skipped===true});
    }catch(error){
      const message=String(error?.message||error);
      await db.from('gs_product_monitor_watches').update({last_status:'error',last_error:message.slice(0,1000),next_check_at:new Date(Date.now()+86400000).toISOString(),updated_at:new Date().toISOString()}).eq('id',watch.id);
      results.push({item_id:watch.item_id,ok:false,error:message});
    }
  }
  return NextResponse.json({ok:true,due:(watches||[]).length,results});
}
