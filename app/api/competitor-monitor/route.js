import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
import {sendTaskNotification,whatsappVelocityRule} from '../../../lib/notifications';

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
function defaultSearchKeyword(title){
  const stop=new Set(['kit','para','com','sem','de','da','do','das','dos','e','em','um','uma','o','a','os','as','personalizado','personalizada','novo','nova','oficial']);
  return String(title||'').toLowerCase().replace(/[^a-z0-9áàâãéèêíïóôõöúçñ\s-]/gi,' ').split(/\s+/).filter(Boolean).filter(x=>!stop.has(x)).slice(0,7).join(' ').trim();
}
function addDays(iso,days){
  const base=iso?new Date(iso):new Date();
  const ms=Number.isNaN(base.getTime())?Date.now():base.getTime();
  return new Date(ms+Math.max(1,days)*86400000).toISOString();
}
async function syncWatches(db,shopId){
  const {data:reports,error}=await db.from('extension_analysis_reports')
    .select('id,item_id,analyzed_at,competitors,product_snapshot')
    .eq('shop_id',shopId).order('analyzed_at',{ascending:false}).limit(1000);
  if(error)throw new Error(error.message);
  const latest=new Map();
  for(const r of reports||[]){if(!latest.has(String(r.item_id)))latest.set(String(r.item_id),r)}
  const {data:existing,error:existingError}=await db.from('gs_competitor_watches')
    .select('id,owner_item_id,competitor_item_id,frequency_days,next_check_at,last_check_at,enabled,settings')
    .eq('shop_id',shopId);
  if(existingError)throw new Error(existingError.message);
  const byKey=new Map((existing||[]).map(x=>[`${x.owner_item_id}:${x.competitor_item_id}`,x]));
  for(const r of latest.values()){
    for(const c of arr(r.competitors).slice(0,3)){
      const ids=idsFromCompetitor(c); if(!ids.shopId||!ids.itemId)continue;
      const key=`${r.item_id}:${ids.itemId}`,old=byKey.get(key),freq=old?.frequency_days||7;
      const ownerTitle=r?.product_snapshot?.title||r?.product_snapshot?.item_name||'';
      const existingSettings=old?.settings&&typeof old.settings==='object'?old.settings:{};
      const derivedKeyword=defaultSearchKeyword(ownerTitle);
      const row={
        shop_id:shopId,owner_item_id:r.item_id,competitor_shop_id:ids.shopId,competitor_item_id:ids.itemId,
        competitor_url:ids.url,competitor_title:text(c?.title,400),enabled:old?.enabled===false?false:true,
        source_report_id:r.id,
        settings:{...existingSettings,search_keyword:text(existingSettings.search_keyword,300)||derivedKeyword||null,search_max_pages:Math.max(1,Math.min(5,Math.round(finite(existingSettings.search_max_pages)||3)))},
        updated_at:new Date().toISOString()
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
    const latest=history[0]||null,previous=history[1]||null,older=history[2]||null;
    const change=snapshotChange(previous,latest),prior=snapshotChange(older,previous);
    if(change&&prior&&finite(change.sold_per_day)!=null&&finite(prior.sold_per_day)!=null){
      change.sold_velocity_before=finite(prior.sold_per_day);
      change.sold_velocity_change_pct=prior.sold_per_day>0?((change.sold_per_day-prior.sold_per_day)/prior.sold_per_day)*100:null;
    }
    map.set(watchId,{latest,previous,history,change});
  }
  return map;
}
async function visibilityBundles(db,watchIds){
  if(!watchIds.length)return new Map();
  const {data,error}=await db.from('gs_competitor_visibility_snapshots').select('*').in('watch_id',watchIds).order('searched_at',{ascending:false});
  if(error)throw new Error(error.message);
  const grouped=new Map();
  for(const row of data||[]){
    if(!grouped.has(row.watch_id))grouped.set(row.watch_id,[]);
    const rows=grouped.get(row.watch_id);
    if(rows.length<12)rows.push(row);
  }
  const map=new Map();
  for(const [watchId,history] of grouped)map.set(watchId,{latest:history[0]||null,history});
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
  if(error&&!String(error.message).includes('duplicate')){console.warn('[competitor-monitor] task error',error.message);return}
  const {data:saved}=await db.from('gs_tasks').select('*').eq('shop_id',shopId).eq('dedupe_key',dedupe).maybeSingle();
  if(saved){
    try{
      await sendTaskNotification({
        db,shopId,task:saved,allowWhatsApp:false,
        event:{kind:'competitor_price',competitorTitle:watch.competitor_title,priceChangePct:pricePct}
      });
    }catch(error){console.warn('[competitor-monitor] notification error',String(error?.message||error))}
  }
}
async function createVelocityTask(db,shopId,watch,older,previous,current){
  const prior=snapshotChange(older,previous),latest=snapshotChange(previous,current);
  if(!prior||!latest)return;
  const before=finite(prior.sold_per_day),now=finite(latest.sold_per_day),soldDelta=finite(latest.sold_delta);
  if(before==null||now==null||soldDelta==null||soldDelta<5||now<2)return;
  const pct=before>0?((now-before)/before)*100:null;
  if((pct==null&&now<5)||(pct!=null&&pct<50))return;
  const pctText=pct==null?'novo ritmo':`${pct.toLocaleString('pt-BR',{maximumFractionDigits:0})}% acima do ritmo anterior`;
  const description=`${watch.competitor_title||'Concorrente'} acelerou para aproximadamente ${now.toLocaleString('pt-BR',{maximumFractionDigits:1})} venda(s)/dia, ${pctText}. Foram +${soldDelta.toLocaleString('pt-BR')} vendas desde a última coleta.`;
  const day=new Date(current.collected_at).toISOString().slice(0,10);
  const task={
    shop_id:shopId,item_id:watch.owner_item_id,task_type:'competitors',title:'Concorrente acelerou vendas',description,
    priority:now>=10||(pct!=null&&pct>=100)?'high':'medium',status:'open',due_at:new Date().toISOString(),remind_at:new Date().toISOString(),
    source:'competitor-monitor',action_url:`/extensao-shopee-intelligence?section=concorrentes&item_id=${watch.owner_item_id}`,
    dedupe_key:`competitor-velocity:${watch.id}:${day}:${Math.round(now*10)}`,
    metadata:{watch_id:watch.id,competitor_item_id:watch.competitor_item_id,sold_delta:soldDelta,sold_per_day:now,previous_sold_per_day:before,velocity_change_pct:pct},
    updated_at:new Date().toISOString()
  };
  const {error}=await db.from('gs_tasks').upsert(task,{onConflict:'shop_id,dedupe_key',ignoreDuplicates:true});
  if(error&&!String(error.message).includes('duplicate')){console.warn('[competitor-monitor] velocity task error',error.message);return}
  const {data:saved}=await db.from('gs_tasks').select('*').eq('shop_id',shopId).eq('dedupe_key',task.dedupe_key).maybeSingle();
  if(saved){
    let criticalWhatsApp=false;
    try{
      const {data:prefs}=await db.from('gs_notification_preferences').select('categories').eq('shop_id',shopId).maybeSingle();
      const rule=whatsappVelocityRule(prefs);
      criticalWhatsApp=rule.enabled&&now>=rule.minSalesPerDay&&(pct==null||pct>=rule.pctThreshold);
    }catch(error){console.warn('[competitor-monitor] whatsapp rule error',String(error?.message||error))}
    try{
      await sendTaskNotification({
        db,shopId,task:saved,allowWhatsApp:criticalWhatsApp,
        event:{kind:'competitor_velocity',competitorTitle:watch.competitor_title,soldPerDay:now,velocityChangePct:pct}
      });
    }catch(error){console.warn('[competitor-monitor] velocity notification error',String(error?.message||error))}
  }
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
    const watchIds=(data||[]).map(x=>x.id),[bundles,visibility]=await Promise.all([snapshotBundles(db,watchIds),visibilityBundles(db,watchIds)]);
    const rows=data||[];
    return NextResponse.json({
      ok:true,
      watches:rows.map(w=>{
        const bundle=bundles.get(w.id)||{},search=visibility.get(w.id)||{};
        return {...w,latest_snapshot:bundle.latest||null,previous_snapshot:bundle.previous||null,snapshot_history:bundle.history||[],latest_change:bundle.change||null,latest_visibility:search.latest||null,visibility_history:search.history||[]};
      }),
      due_count:due?rows.length:rows.filter(w=>new Date(w.next_check_at).getTime()<=Date.now()).length
    });
  }catch(e){return NextResponse.json({error:String(e?.message||e)},{status:500})}
}

export async function PATCH(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const id=text(body?.id,100),freq=finite(body?.frequency_days),action=text(body?.action,40),lastError=text(body?.last_error,1000);
  if(!id)return NextResponse.json({error:'Monitoramento inválido.'},{status:400});
  const db=supabaseAdmin();
  const {data:current,error:currentError}=await db.from('gs_competitor_watches').select('settings').eq('shop_id',shop.shop_id).eq('id',id).maybeSingle();
  if(currentError)return NextResponse.json({error:currentError.message},{status:500});
  const patch={updated_at:new Date().toISOString()};
  if(action==='due_now'){patch.next_check_at=new Date().toISOString();patch.last_error=null;}
  if(action==='record_error'){patch.last_status='error';patch.last_error=lastError||'Falha na coleta pelo Motor Senior.';}
  if(freq!=null){
    if(freq<1||freq>30)return NextResponse.json({error:'A frequência deve ficar entre 1 e 30 dias.'},{status:400});
    patch.frequency_days=Math.round(freq);
    if(body?.reset_next===true)patch.next_check_at=addDays(new Date().toISOString(),Math.round(freq));
  }
  if(typeof body?.enabled==='boolean')patch.enabled=body.enabled;
  if(body?.search_keyword!==undefined||body?.search_max_pages!==undefined){
    const settings=current?.settings&&typeof current.settings==='object'?current.settings:{};
    const keyword=body?.search_keyword!==undefined?text(body.search_keyword,300):text(settings.search_keyword,300);
    const maxPages=body?.search_max_pages!==undefined?finite(body.search_max_pages):finite(settings.search_max_pages);
    patch.settings={...settings,search_keyword:keyword||null,search_max_pages:Math.max(1,Math.min(5,Math.round(maxPages||3)))};
  }
  if(Object.keys(patch).length===1)return NextResponse.json({error:'Nenhuma alteração informada.'},{status:400});
  const {data,error}=await db.from('gs_competitor_watches').update(patch).eq('shop_id',shop.shop_id).eq('id',id).select('*').maybeSingle();
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
    const {data:previousRows,error:prevError}=await db.from('gs_competitor_snapshots').select('*').eq('watch_id',watch.id).order('collected_at',{ascending:false}).limit(2);
    if(prevError)throw new Error(prevError.message);
    const previous=previousRows?.[0]||null,older=previousRows?.[1]||null;
    const {data:inserted,error:insertError}=await db.from('gs_competitor_snapshots').insert(snapshot).select('*').single();
    if(insertError)throw new Error(insertError.message);
    await db.from('gs_competitor_watches').update({
      competitor_title:snapshot.title||watch.competitor_title,last_check_at:collected.toISOString(),
      next_check_at:addDays(collected.toISOString(),watch.frequency_days||7),last_status:'success',last_error:null,updated_at:new Date().toISOString()
    }).eq('id',watch.id).eq('shop_id',shop.shop_id);
    await Promise.all([createChangeTask(db,shop.shop_id,watch,previous,inserted),createVelocityTask(db,shop.shop_id,watch,older,previous,inserted)]);
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
