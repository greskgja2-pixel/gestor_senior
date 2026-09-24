import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const text=(v,max=1000)=>v==null?null:(String(v).trim().slice(0,max)||null);
const bool=v=>v===true;
const pageFrom=(position,perPage=60)=>{
  const p=finite(position),size=finite(perPage)||60;
  return p&&p>0?Math.floor((p-1)/size)+1:null;
};

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const url=new URL(request.url),watchId=text(url.searchParams.get('watch_id'),100),owner=finite(url.searchParams.get('owner_item_id'));
  let q=supabaseAdmin().from('gs_competitor_visibility_snapshots').select('*').eq('shop_id',shop.shop_id).order('searched_at',{ascending:false}).limit(200);
  if(watchId)q=q.eq('watch_id',watchId);
  if(owner)q=q.eq('owner_item_id',owner);
  const {data,error}=await q;
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,snapshots:data||[]});
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const watchId=text(body?.watch_id,100),keyword=text(body?.keyword,300);
  if(!watchId||!keyword)return NextResponse.json({error:'watch_id e keyword são obrigatórios.'},{status:400});

  const db=supabaseAdmin();
  const {data:watch,error:watchError}=await db.from('gs_competitor_watches').select('*').eq('shop_id',shop.shop_id).eq('id',watchId).maybeSingle();
  if(watchError)return NextResponse.json({error:watchError.message},{status:500});
  if(!watch)return NextResponse.json({error:'Concorrente monitorado não encontrado.'},{status:404});

  const itemsPerPage=Math.max(1,Math.min(200,Math.round(finite(body?.items_per_page)||60)));
  const maxPages=Math.max(1,Math.min(10,Math.round(finite(body?.max_pages)||3)));
  const competitorPosition=finite(body?.competitor_position),ownerPosition=finite(body?.owner_position);
  const adsStatus=['detected','not_detected','unknown'].includes(String(body?.competitor_ads_status||''))?String(body.competitor_ads_status):'unknown';
  const searchedAt=body?.searched_at?new Date(body.searched_at):new Date();
  if(Number.isNaN(searchedAt.getTime()))return NextResponse.json({error:'searched_at inválido.'},{status:400});

  const row={
    watch_id:watch.id,shop_id:shop.shop_id,owner_item_id:watch.owner_item_id,competitor_item_id:watch.competitor_item_id,
    keyword,searched_at:searchedAt.toISOString(),max_pages:maxPages,items_per_page:itemsPerPage,
    competitor_found:bool(body?.competitor_found)||competitorPosition!=null,
    competitor_position:competitorPosition,
    competitor_page:finite(body?.competitor_page)||pageFrom(competitorPosition,itemsPerPage),
    owner_found:bool(body?.owner_found)||ownerPosition!=null,
    owner_position:ownerPosition,
    owner_page:finite(body?.owner_page)||pageFrom(ownerPosition,itemsPerPage),
    competitor_ads_status:adsStatus,
    competitor_ads_evidence:text(body?.competitor_ads_evidence,500),
    source:text(body?.source,80)||'motor-senior-search',
    confidence:text(body?.confidence,40)||'observed',
    raw:body?.raw&&typeof body.raw==='object'?body.raw:{}
  };
  const {data,error}=await db.from('gs_competitor_visibility_snapshots').insert(row).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,snapshot:data});
}
