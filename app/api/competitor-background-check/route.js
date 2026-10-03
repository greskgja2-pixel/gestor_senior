import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';
import {getPublicItemInfo} from '../../../lib/shopee-public';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;

const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const text=(v,max=500)=>v==null?'':String(v).trim().slice(0,max);
const norm=v=>text(v,1000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
const STOP=new Set(['para','com','sem','de','da','do','das','dos','em','no','na','nos','nas','e','ou','a','o','as','os','um','uma','kit','produto','novo','nova','original','pronta','pronto','mais','super','tipo','modelo','unidade','unidades','cm','mm','kg','ml']);
const compactQuery=value=>norm(value).split(' ').filter(x=>x.length>=3&&!STOP.has(x)&&!/^\d+$/.test(x)).slice(0,8).join(' ');
const price=v=>{const x=finite(v);return x==null?null:(x>10000?x/100000:x)};
const pageFrom=(position,perPage=60)=>position?Math.floor((position-1)/perPage)+1:null;

function unwrap(raw){
  const b=raw?.item_basic||raw?.item||raw||{};
  const itemId=String(b?.itemid??b?.item_id??raw?.itemid??raw?.item_id??'');
  const shopId=String(b?.shopid??b?.shop_id??raw?.shopid??raw?.shop_id??'');
  if(!itemId)return null;
  const rating=finite(b?.item_rating?.rating_star??b?.rating_star??raw?.rating);
  const preferredKeys=['is_preferred_plus_seller','is_preferred_shop','is_preferred_seller'];
  const preferredPresent=preferredKeys.some(k=>Object.prototype.hasOwnProperty.call(b,k));
  const preferred=preferredPresent?preferredKeys.some(k=>b?.[k]===true||b?.[k]===1||b?.[k]==='1'):null;
  const adsDetected=Boolean(
    finite(raw?.ads_id??raw?.adsid??b?.ads_id??b?.adsid)!=null||
    raw?.is_ads===true||raw?.is_ad===true||b?.is_ads===true||b?.is_ad===true
  );
  return{
    itemId,shopId,
    title:text(b?.name??b?.item_name??raw?.title,500)||null,
    price:price(b?.price??b?.price_min??raw?.price),
    originalPrice:price(b?.price_before_discount??b?.original_price??raw?.originalPrice),
    sold:finite(b?.historical_sold??b?.sold??raw?.sold),
    monthlySold:finite(b?.monthly_sold??b?.sold_30d??raw?.monthlySold),
    rating,
    preferred,
    location:text(b?.shop_location??b?.location??b?.shop_location_name??raw?.location,200)||null,
    ads:{status:adsDetected?'detected':'unknown',evidence:adsDetected?'search-item ads flag/id':null}
  };
}

async function searchPage(keyword,offset,limit=60){
  const q=new URLSearchParams({
    by:'relevancy',keyword,limit:String(limit),newest:String(offset),order:'desc',
    page_type:'search',scenario:'PAGE_GLOBAL_SEARCH',version:'2'
  });
  const res=await fetch('https://shopee.com.br/api/v4/search/search_items?'+q.toString(),{
    cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(16000),
    headers:{
      accept:'application/json, text/plain, */*','accept-language':'pt-BR,pt;q=0.9,en;q=0.7',
      referer:'https://shopee.com.br/search?keyword='+encodeURIComponent(keyword),
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36',
      'x-api-source':'pc'
    }
  });
  const body=await res.text();
  if(!res.ok)throw new Error('Busca pública Shopee respondeu HTTP '+res.status);
  let json;try{json=JSON.parse(body)}catch{throw new Error('Shopee devolveu resposta não-JSON na busca pública.')}
  if(json?.error)throw new Error('Busca Shopee: '+json.error+(json.message?' — '+json.message:''));
  return Array.isArray(json?.items)?json.items:[];
}

async function searchMany(keyword,maxPages,targetIds){
  const perPage=60,found=new Map(),all=[],attempts=[];
  for(let page=0;page<maxPages;page++){
    let rows=[];
    try{
      rows=await searchPage(keyword,page*perPage,perPage);
      attempts.push({page:page+1,ok:true,count:rows.length});
    }catch(error){
      attempts.push({page:page+1,ok:false,error:String(error?.message||error)});
      if(page===0)throw error;
      break;
    }
    for(let i=0;i<rows.length;i++){
      const item=unwrap(rows[i]);if(!item)continue;
      const rank=page*perPage+i+1;
      const row={...item,rank,page:page+1,raw:rows[i]};
      all.push(row);
      if(targetIds.has(item.itemId)&&!found.has(item.itemId))found.set(item.itemId,row);
    }
    if([...targetIds].every(id=>found.has(id))||rows.length<perPage)break;
  }
  return{keyword,perPage,found,all,attempts};
}

function marketFromDirect(info,watch){
  if(!info)return null;
  return{
    title:info.title||watch.competitor_title||null,
    price:finite(info.price),originalPrice:finite(info.priceBeforeDiscount),
    sold:finite(info.historicalSold),monthlySold:null,rating:finite(info.rating),
    preferred:info.preferred===true?true:(info.preferred===false?false:null),
    location:info.shopLocation||null,
    shopName:info.shopName||null,shopUsername:info.shopUsername||null,shopUrl:info.shopUrl||null
  };
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const ids=Array.isArray(body?.watch_ids)?body.watch_ids.map(x=>text(x,100)).filter(Boolean).slice(0,20):[];
  if(!ids.length)return NextResponse.json({error:'watch_ids obrigatório.'},{status:400});

  const db=supabaseAdmin();
  const {data:watches,error}=await db.from('gs_competitor_watches').select('*').eq('shop_id',shop.shop_id).in('id',ids).eq('enabled',true);
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(!watches?.length)return NextResponse.json({error:'Nenhum concorrente monitorado encontrado.'},{status:404});

  const first=watches[0];
  const primaryKeyword=text(body?.keyword,300)||text(first?.settings?.search_keyword,300)||compactQuery(first?.competitor_title);
  const maxPages=Math.max(3,Math.min(10,Math.round(finite(body?.max_pages)||8)));
  const targetIds=new Set(watches.map(w=>String(w.competitor_item_id)));
  let primary=null,primaryError='';
  try{primary=await searchMany(primaryKeyword,maxPages,targetIds)}catch(e){primaryError=String(e?.message||e)}

  const results=[];
  for(const watch of watches){
    const itemId=String(watch.competitor_item_id),shopId=String(watch.competitor_shop_id);
    let match=primary?.found?.get(itemId)||null;
    let usedKeyword=primaryKeyword,foundBy=match?'primary-search':'';
    let fallbackAttempts=[];

    if(!match){
      const fallbackQueries=[text(watch.competitor_title,300),compactQuery(watch.competitor_title)].filter(Boolean);
      for(const q of [...new Set(fallbackQueries)]){
        if(norm(q)===norm(primaryKeyword))continue;
        try{
          const searched=await searchMany(q,3,new Set([itemId]));
          fallbackAttempts.push({query:q,attempts:searched.attempts});
          const candidate=searched.found.get(itemId);
          if(candidate){match=candidate;usedKeyword=q;foundBy='fallback-title-search';break}
        }catch(e){fallbackAttempts.push({query:q,error:String(e?.message||e)})}
      }
    }

    let direct=null,directError='';
    try{direct=await getPublicItemInfo(shopId,itemId)}catch(e){directError=String(e?.message||e)}
    if(!foundBy&&direct){foundBy='direct-item'}

    const market=match?{
      title:match.title,price:match.price,originalPrice:match.originalPrice,sold:match.sold,monthlySold:match.monthlySold,
      rating:match.rating,preferred:match.preferred,location:match.location,
      shopName:direct?.shopName||null,shopUsername:direct?.shopUsername||null,shopUrl:direct?.shopUrl||null
    }:marketFromDirect(direct,watch);

    const ownerMatch=primary?.all?.find(x=>String(x.itemId)===String(watch.owner_item_id))||null;
    results.push({
      watch_id:watch.id,owner_item_id:String(watch.owner_item_id),competitor_item_id:itemId,
      keyword:usedKeyword||primaryKeyword,searched_at:new Date().toISOString(),
      max_pages:foundBy==='fallback-title-search'?3:maxPages,items_per_page:60,
      competitor:{found:Boolean(match||direct),position:match?.rank??null,page:match?.page??null},
      owner:{found:Boolean(ownerMatch),position:ownerMatch?.rank??null,page:ownerMatch?.page??null},
      ads:match?.ads||{status:'unknown',evidence:null},
      market,
      found_by:foundBy||'not-found',
      diagnostics:{primary_error:primaryError||null,primary_attempts:primary?.attempts||[],fallback_attempts:fallbackAttempts,direct_error:directError||null}
    });
  }

  return NextResponse.json({
    ok:true,source:'server-background-search',keyword:primaryKeyword,max_pages:maxPages,
    total:results.length,found:results.filter(x=>x.competitor.found).length,results
  });
}
