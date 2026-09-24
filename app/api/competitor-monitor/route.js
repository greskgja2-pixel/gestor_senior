import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

const arr=v=>Array.isArray(v)?v:[];
const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const text=(v,max=1000)=>v==null?null:(String(v).trim().slice(0,max)||null);

function idsFromCompetitor(c){
  let shopId=finite(c?.shopId??c?.shop_id),itemId=finite(c?.itemId??c?.item_id??c?.id);
  const url=text(c?.url??c?.link??c?.productUrl??c?.product_url,1200);
  if((!shopId||!itemId)&&url){
    const m=url.match(/(?:product\/|i\.)(\d+)[./](\d+)/i);
    if(m){shopId=shopId||Number(m[1]);itemId=itemId||Number(m[2]);}
  }
  return {shopId,itemId,url};
}
function fallbackPrice(c){
  const direct=finite(c?.price);if(direct!=null)return direct;
  const m=String(c?.searchText||'').match(/R\$\s*\n?\s*([0-9.]+,[0-9]{2})/i);
  return m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
}
function fallbackSold(c){
  const direct=finite(c?.sold);if(direct!=null)return direct;
  const m=String(c?.searchText||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*(mil)?\+?\s*Vendido/i);
  if(!m)return null;
  const base=Number(m[1].replace(',','.'));
  return Number.isFinite(base)?Math.round(base*(m[2]?1000:1)):null;
}
function addDays(iso,days){
  const base=iso?new Date(iso):new Date();
  const ms=Number.isNaN(base.getTime())?Date.now():base.getTime();
  return new Date(ms+Math.max(1,days)*86400000).toISOString();
}
async function syncWatches(db,shopId){
  const {data:reports,error}=await db.from('extension_analysis_reports')
    .select('id,item_id,analyzed_at,competitors')
    .eq('shop_id',shopId).order('analyzed_at',{ascending:false}).limit(1000);
  if(error)throw new Error(error.message);
  const latest=new Map();
  for(const r of reports||[]){if(!latest.has(String(r.item_id)))latest.set(String(r.item_id),r)}
  const {data:existing,error:existingError}=await db.from('gs_competitor_watches')
    .select('id,owner_item_id,competitor_item_id,frequency_days,next_check_at,last_check_at')
    .eq('shop_id',shopId);
  if(existingError)throw new Error(existingError.message);
  const byKey=new Map((existing||[]).map(x=>[`${x.owner_item_id}:${x.competitor_item_id}`,x]));
  for(const r of latest.values()){
    for(const c of arr(r.competitors).slice(0,3)){
      const ids=idsFromCompetitor(c); if(!ids.shopId||!ids.itemId)continue;
      const key=`${r.item_id}:${ids.itemId}`,old=byKey.get(key),freq=old?.frequency_days||7;
      const row={
        shop_id:shopId,owner_item_id:r.item_id,competitor_shop_id:ids.shopId,competitor_item_id:ids.itemId,
        competitor_url:ids.url,competitor_title:text(c?.title,400),enabled:true,
        source_report_id:r.id,updated_at:new Date().toISOString()
      };
      if(!old)row.next_check_at=addDays(r.analyzed_at,freq);
      const {data:saved,error:upsertError}=await db.from('gs_competitor_watches').upsert(row,{onConflict:'shop_id,owner_item_id,competitor_item_id'}).select('*').single();
      if(upsertError)throw new Error(upsertError.message);
      if(!saved?.last_check_at){
        const baselinePrice=fallbackPrice(c),baselineSold=fallbackSold(c),baselineRating=finite(c?.rating);
        if(baselinePrice!=null||baselineSold!=null||baselineRating!=null){
          const baselineAt=r.analyzed_at||new Date().toISOString();
          const {data:previousBaseline}=await db.from('gs_competitor_snapshots').select('id').eq('watch_id',saved.id).limit(1);
          if(!previousBaseline?.length){
            const {error:baselineError}=await db.from('gs_competitor_snapshots').insert({
              watch_id:saved.id,shop_id:shopId,owner_item_id:r.item_id,competitor_shop_id:ids.shopId,competitor_item_id:ids.itemId,
              collected_at:baselineAt,price:baselinePrice,sold:baselineSold,rating:baselineRating,title:text(c?.title,500),
              source:'analysis-report-search',confidence:'fallback',raw:{searchText:text(c?.searchText,3000)}
            });
            if(baselineError)console.warn('[competitor-monitor] baseline error',baselineError.message);
            else await db.from('gs_competitor_watches').update({last_check_at:baselineAt,last_status:'baseline',updated_at:new Date().toISOString()}).eq('id',saved.id);
          }
        }
      }
    }
  }
}
function snapshotChange(previous,latest){
  if(!previous||!latest)return null;
  const prevPrice=finite(previous.price),price=finite(latest.price);
  const prevSold=finite(previous.sold),sold=finite(latest.sold);
  const prevRating=finite(previous.rating),rating=finite(latest.rating);
  const before=new Date(previous.collected_at).getTime(),after=new Date(latest.collected_at).getTime();
  const days=Number.isFinite(before)&&Number.isFinite(after)&&after>before?(after-before)/86400000:null;
  const soldDelta=sold!=null&&prevSold!=null?sold-prevSold:null;
  return {
    price_before:prevPrice,price_now:price,
    price_change:prevPrice!=null&&price!=null?price-prevPrice:null,
    price_change_pct:prevPrice>0&&price!=null?((price-prevPrice)/prevPrice)*100:null,
    sold_before:prevSold,sold_now:sold,sold_delta:soldDelta,
    sold_per_day:days&&soldDelta!=null&&soldDelta>=0?soldDelta/days:null,
    rating_before:prevRating,rating_now:rating,
    rating_change:prevRating!=null&&rating!=null?rating-prevRating:null,
    elapsed_days:days
  };
}
async function snapshotBundles(db,watchIds){
  if(!watchIds.length)return new Map();
  const {data,error}=await db.from('gs_competitor_snapshots').select('*').in('watch_id',watchIds).order('collected_at',{ascending:false});
  if(error)throw new Error(error.message);
  const grouped=new Map();
  for(const row of data||[]){
    if(!grouped.has(row.watch_id))grouped.set(row.watch_id,[]);
    const rows=grouped.get(row.watch_id);
    if(rows.length<8)rows.push(row);
  }
  const map=new Map();
  for(const [watchId,history] of grouped){
    const latest=history[0]||null,previous=history[1]||null;
    map.set(watchId,{latest,previous,history,change:snapshotChange(previous,latest)});
  }
  return map;
}
async function createChangeTask(db,shopId,watch,previous,current){
  if(!previous)return;
  const prevPrice=finite(previous.price),price=finite(current.price),sold=finite(current.sold),prevSold=finite(previous.sold);
  const pricePct=prevPrice&&price?((price-prevPrice)/prevPrice)*100:null;
  const soldDelta=sold!=null&&prevSold!=null?Math.max(0,sold-prevSold):null;
  if(pricePct==null||Math.abs(pricePct)<5)return;
  const down=pricePct<0;
  const pct=Math.abs(pricePct).toLocaleString('pt-BR',{maximumFractionDigits:1});
  const description=down
    ?`${watch.competitor_title||'Concorrente'} reduziu o preço de R$ ${prevPrice.toFixed(2).replace('.',',')} para R$ ${price.toFixed(2).replace('.',',')} (${pct}% de queda).${soldDelta!=null?` Vendas acumuladas aumentaram em ${soldDelta} desde a última coleta.`:''}`
    :`${watch.competitor_title||'Concorrente'} aumentou o preço de R$ ${prevPrice.toFixed(2).replace('.',',')} para R$ ${price.toFixed(2).replace('.',',')} (${pct}% de alta).`;
  const day=new Date(current.collected_at).toISOString().slice(0,10);
  const dedupe=`competitor-price:${watch.id}:${day}:${price}`;
  const task={
    shop_id:shopId,item_id:watch.owner_item_id,task_type:'competitors',
    title:down?'Avaliar preço — concorrente reduziu':'Oportunidade — concorrente aumentou preço',
    description,priority:down?'high':'medium',status:'open',due_at:new Date().toISOString(),remind_at:new Date().toISOString(),
    source:'competitor-monitor',action_url:`/extensao-shopee-intelligence?section=concorrentes&item_id=${watch.owner_item_id}`,
    dedupe_key:dedupe,metadata:{watch_id:watch.id,previous_price:prevPrice,current_price:price,price_change_pct:pricePct,sold_delta:soldDelta,competitor_item_id:watch.competitor_item_id},
    updated_at:new Date().toISOString()
  };
  const {error}=await db.from('gs_tasks').upsert(task,{onConflict:'shop_id,dedupe_key',ignoreDuplicates:true});
  if(error&&!String(error.message).includes('duplicate'))console.warn('[competitor-monitor] task error',error.message);
}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const db=supabaseAdmin();
  try{
    await syncWatches(db,shop.shop_id);
    const url=new URL(request.url),due=url.searchParams.get('due')==='1',owner=finite(url.searchParams.get('owner_item_id'));
    let q=db.from('gs_competitor_watches').select('*').eq('shop_id',shop.shop_id).eq('enabled',true).order('next_check_at',{ascending:true}).limit(100);
    if(due)q=q.lte('next_check_at',new Date().toISOString());
    if(owner)q=q.eq('owner_item_id',owner);
    const {data,error}=await q;if(error)throw new Error(error.message);
    const rows=data||[],bundles=await snapshotBundles(db,rows.map(x=>x.id));
    return NextResponse.json({
      ok:true,
      watches:rows.map(w=>{
        const bundle=bundles.get(w.id)||{};
        return {...w,latest_snapshot:bundle.latest||null,previous_snapshot:bundle.previous||null,snapshot_history:bundle.history||[],latest_change:bundle.change||null};
      }),
      due_count:due?rows.length:rows.filter(w=>new Date(w.next_check_at).getTime()<=Date.now()).length
    });
  }catch(e){return NextResponse.json({error:String(e?.message||e)},{status:500})}
}

export async function PATCH(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const id=text(body?.id,100),freq=finite(body?.frequency_days),action=text(body?.action,40);
  if(!id)return NextResponse.json({error:'Monitoramento inválido.'},{status:400});
  const patch={updated_at:new Date().toISOString()};
  if(action==='due_now')patch.next_check_at=new Date().toISOString();
  if(freq!=null){
    if(freq<1||freq>30)return NextResponse.json({error:'A frequência deve ficar entre 1 e 30 dias.'},{status:400});
    patch.frequency_days=Math.round(freq);
    if(body?.reset_next===true)patch.next_check_at=addDays(new Date().toISOString(),Math.round(freq));
  }
  if(typeof body?.enabled==='boolean')patch.enabled=body.enabled;
  if(Object.keys(patch).length===1)return NextResponse.json({error:'Nenhuma alteração informada.'},{status:400});
  const {data,error}=await supabaseAdmin().from('gs_competitor_watches').update(patch).eq('shop_id',shop.shop_id).eq('id',id).select('*').maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,watch:data});
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const watchId=text(body?.watch_id,100);
  if(!watchId)return NextResponse.json({error:'watch_id obrigatório.'},{status:400});
  const db=supabaseAdmin();
  try{
    const {data:watch,error:watchError}=await db.from('gs_competitor_watches').select('*').eq('shop_id',shop.shop_id).eq('id',watchId).maybeSingle();
    if(watchError)throw new Error(watchError.message);
    if(!watch)return NextResponse.json({error:'Concorrente monitorado não encontrado.'},{status:404});
    const collected=body?.collected_at?new Date(body.collected_at):new Date();
    if(Number.isNaN(collected.getTime()))return NextResponse.json({error:'collected_at inválido.'},{status:400});
    const snapshot={
      watch_id:watch.id,shop_id:shop.shop_id,owner_item_id:watch.owner_item_id,
      competitor_shop_id:watch.competitor_shop_id,competitor_item_id:watch.competitor_item_id,
      collected_at:collected.toISOString(),price:finite(body?.price),sold:finite(body?.sold),rating:finite(body?.rating),
      stock:finite(body?.stock),image_url:text(body?.image_url??body?.imageUrl,1200),title:text(body?.title,500),
      source:text(body?.source,80)||'motor-senior',confidence:text(body?.confidence,40)||'structured',
      raw:body?.raw&&typeof body.raw==='object'?body.raw:{}
    };
    if(snapshot.price==null&&snapshot.sold==null&&!snapshot.image_url)return NextResponse.json({error:'A coleta não trouxe preço, vendas nem imagem confiável.'},{status:422});
    const {data:previousRows,error:prevError}=await db.from('gs_competitor_snapshots').select('*').eq('watch_id',watch.id).order('collected_at',{ascending:false}).limit(1);
    if(prevError)throw new Error(prevError.message);
    const previous=previousRows?.[0]||null;
    const {data:inserted,error:insertError}=await db.from('gs_competitor_snapshots').insert(snapshot).select('*').single();
    if(insertError)throw new Error(insertError.message);
    await db.from('gs_competitor_watches').update({
      competitor_title:snapshot.title||watch.competitor_title,last_check_at:collected.toISOString(),
      next_check_at:addDays(collected.toISOString(),watch.frequency_days||7),last_status:'success',last_error:null,updated_at:new Date().toISOString()
    }).eq('id',watch.id).eq('shop_id',shop.shop_id);
    await createChangeTask(db,shop.shop_id,watch,previous,inserted);
    const prevPrice=finite(previous?.price),price=finite(inserted.price),prevSold=finite(previous?.sold),sold=finite(inserted.sold);
    return NextResponse.json({ok:true,snapshot:inserted,change:{
      price_before:prevPrice,price_now:price,price_change_pct:prevPrice&&price?((price-prevPrice)/prevPrice)*100:null,
      sold_before:prevSold,sold_now:sold,sold_delta:sold!=null&&prevSold!=null?sold-prevSold:null
    }});
  }catch(e){
    await db.from('gs_competitor_watches').update({last_status:'error',last_error:String(e?.message||e).slice(0,1000),updated_at:new Date().toISOString()}).eq('shop_id',shop.shop_id).eq('id',watchId);
    return NextResponse.json({error:String(e?.message||e)},{status:500});
  }
}
