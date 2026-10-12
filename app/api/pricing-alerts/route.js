import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
export const dynamic='force-dynamic';
export async function POST(req){
 const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Loja não conectada'},{status:401});
 const body=await req.json().catch(()=>({}));const items=Array.isArray(body.items)?body.items:[];
 if(!items.length||items.length>20)return NextResponse.json({error:'Selecione entre 1 e 20 produtos'},{status:400});
 const db=supabaseAdmin();const {data:existing,error}=await db.from('gs_tasks').select('item_id,dedupe_key').eq('shop_id',shop.shop_id).eq('task_type','pricing').eq('status','open');
 if(error)return NextResponse.json({error:error.message},{status:500});
 const open=new Set((existing||[]).map(x=>String(x.item_id)));const now=new Date().toISOString();
 const rows=[];for(const x of items){const id=Number(x.item_id),pct=Number(x.margin_percent);if(!Number.isSafeInteger(id)||id<=0||!Number.isFinite(pct)||pct>=10)continue;if(open.has(String(id)))continue;open.add(String(id));rows.push({shop_id:shop.shop_id,item_id:id,task_type:'pricing',title:'Revisar preço e margem',description:'Margem estimada '+pct.toFixed(2)+'%. Avalie custos, taxas e promoções antes de alterar o preço.',priority:pct<0?'urgent':'high',status:'open',source:'pricing',dedupe_key:'pricing-margin:'+id,action_url:'/precificacao?item_id='+encodeURIComponent(id),metadata:{margin_percent:pct,source:'pricing_table'},updated_at:now})}
 if(!rows.length)return NextResponse.json({ok:true,created:0,skipped:items.length});
 const res=await db.from('gs_tasks').insert(rows).select('id');if(res.error)return NextResponse.json({error:res.error.message},{status:500});
 return NextResponse.json({ok:true,created:res.data?.length??0,skipped:items.length-rows.length});
}
