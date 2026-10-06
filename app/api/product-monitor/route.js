import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
import {collectProductMonitorSnapshot,ensureMonitorWatch} from '../../../lib/product-monitor';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;

const positive=v=>{const x=Number(v);return Number.isSafeInteger(x)&&x>0?x:null};

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const itemId=positive(new URL(request.url).searchParams.get('item_id'));
  if(!itemId)return NextResponse.json({error:'item_id inválido.'},{status:400});
  const db=supabaseAdmin();
  try{
    const watch=await ensureMonitorWatch(db,shop.shop_id,itemId);
    const [{data:snapshots,error:snapError},{data:compWatches,error:watchError}]=await Promise.all([
      db.from('gs_product_monitor_snapshots').select('*').eq('shop_id',shop.shop_id).eq('item_id',itemId).order('collected_at',{ascending:false}).limit(40),
      db.from('gs_competitor_watches').select('*').eq('shop_id',shop.shop_id).eq('owner_item_id',itemId).eq('enabled',true).order('created_at',{ascending:true}).limit(3)
    ]);
    if(snapError)throw new Error(snapError.message);
    if(watchError)throw new Error(watchError.message);
    const ids=(compWatches||[]).map(x=>x.id);
    let compSnapshots=[];
    if(ids.length){
      const {data,error}=await db.from('gs_competitor_snapshots').select('*').in('watch_id',ids).order('collected_at',{ascending:false}).limit(120);
      if(error)throw new Error(error.message);
      compSnapshots=data||[];
    }
    const grouped=(compWatches||[]).map(w=>({
      ...w,
      snapshots:compSnapshots.filter(s=>s.watch_id===w.id).slice(0,40)
    }));
    return NextResponse.json({ok:true,watch,snapshots:snapshots||[],competitors:grouped});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:500});
  }
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const itemId=positive(body?.item_id??body?.itemId);
  if(!itemId)return NextResponse.json({error:'item_id inválido.'},{status:400});
  try{
    const result=await collectProductMonitorSnapshot({shop,itemId,force:body?.force===true});
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const db=supabaseAdmin();
    await db.from('gs_product_monitor_watches').update({last_status:'error',last_error:String(error?.message||error).slice(0,1000),updated_at:new Date().toISOString()}).eq('shop_id',shop.shop_id).eq('item_id',itemId);
    return NextResponse.json({error:String(error?.message||error)},{status:500});
  }
}
