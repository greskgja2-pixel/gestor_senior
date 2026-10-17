// Dados observados nas buscas públicas Shopee: schema item_basic e schema item_data.
// Não faz requisições nem armazena cookies. Ausência de campo nunca equivale a zero.
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const present=v=>v!==null&&v!==undefined&&v!=='';
const first=(...v)=>v.find(present);
const text=v=>present(v)?String(v).trim()||null:null;
const finite=v=>{
  if(!present(v)||typeof v==='boolean')return null;
  const n=Number(v);return Number.isFinite(n)&&n>=0?n:null;
};
const truth=v=>v===true||v===1||v==='true'||v==='1'?true:v===false||v===0||v==='false'||v==='0'?false:null;
const money=(raw,{scaled=false}={})=>{
  const n=finite(raw);
  return n===null?null:scaled||n>10000?n/100000:n;
};
const soldText=v=>{
  if(typeof v==='number')return finite(v);
  const m=String(v||'').toLowerCase().match(/([\d.,]+)\s*(mil|k|mi|m)?/);
  if(!m)return null;
  let n=m[1],unit=m[2]||'';
  if(/^\d{1,3}(\.\d{3})+$/.test(n))n=n.replace(/\./g,'');
  else n=n.replace(/\./g,'').replace(',','.');
  const vNum=Number(n);return Number.isFinite(vNum)?Math.round(vNum*(unit==='mil'||unit==='k'?1000:unit==='mi'||unit==='m'?1000000:1)):null;
};
const sel=(...pairs)=>pairs.find(([v])=>present(v))||[null,null];
const signal=(v,src,path)=>({kind:v===null?'unavailable':'observed',source:v===null?null:src,path:v===null?null:path});

export function extractMarketplaceRows(payload){
  const root=payload?.data??payload;
  if(Array.isArray(root))return root;
  if(!root||typeof root!=='object')return[];
  for(const value of [
    root.items,root.results,root.products,root.search_items,root.searchItems,
    root.data?.items,root.data?.results,root.data?.products,
    root.discovery?.items,root.discovery?.results
  ])if(Array.isArray(value)&&value.length)return value;
  const discovered=root.discovery?.candidates;
  return discovered&&typeof discovered==='object'&&!Array.isArray(discovered)?Object.values(discovered):[];
}

function adsSignal(raw,old,current){
  // 'Indicado', adsid e icon_in_image.ads_text não comprovam publicidade.
  const keys=['is_ads','is_ad','is_sponsored','isSponsored','sponsored_listing'];
  for(const scope of [raw,old,current])for(const key of keys){
    const value=truth(scope?.[key]);
    if(value!==null)return{status:value?'detected':'not_detected',evidence:key};
  }
  if(/(^|\n)\s*Ad\s*(\n|$)/i.test(String(raw?.searchText||old?.searchText||'')))
    return{status:'detected',evidence:'search-label-ad'};
  return{status:'unknown',evidence:null,hint:(finite(raw?.adsid??old?.adsid)||0)>0?'adsid-unconfirmed':null};
}

export function marketplaceItemEvidence(raw,{source='unspecified',collectedAt=null}={}){
  if(!raw||typeof raw!=='object')return null;
  const basic=obj(raw.item_basic);
  const old=Object.keys(basic).length?basic:Object.keys(obj(raw.item)).length?obj(raw.item):obj(raw.product);
  const modern=obj(raw.item_data||old.item_data);
  const asset=obj(raw.item_card_displayed_asset||modern.item_card_displayed_asset||old.item_card_displayed_asset);
  const dp=obj(modern.item_card_display_price||old.item_card_display_price||raw.item_card_display_price);
  const sc=obj(modern.item_card_display_sold_count||old.item_card_display_sold_count||raw.item_card_display_sold_count);
  const rating=obj(modern.item_rating||old.item_rating||raw.item_rating);
  const shop=obj(modern.shop_data||old.shop_data||raw.shop_data);
  const counts=Array.isArray(rating.rating_count)?rating.rating_count:null;
  const itemId=text(first(raw.itemid,raw.itemId,raw.item_id,modern.itemid,modern.item_id,old.itemid,old.item_id));
  if(!itemId)return null;
  const shopId=text(first(raw.shopid,raw.shopId,raw.shop_id,modern.shopid,modern.shop_id,old.shopid,old.shop_id));

  const priceP=sel([dp.price,'item_data.item_card_display_price.price'],[old.price,'item_basic.price'],
    [old.price_min,'item_basic.price_min'],[modern.price,'item_data.price'],[raw.price,'price']);
  const originalP=sel([dp.strikethrough_price,'item_data.item_card_display_price.strikethrough_price'],
    [old.price_before_discount,'item_basic.price_before_discount'],[old.original_price,'item_basic.original_price'],
    [raw.originalPrice,'originalPrice'],[raw.original_price,'original_price']);
  const price=money(priceP[0],{scaled:priceP[1]==='item_data.item_card_display_price.price'});
  const originalPrice=money(originalP[0],{scaled:originalP[1]==='item_data.item_card_display_price.strikethrough_price'});

  const soldP=sel([sc.historical_sold_count,'item_data.item_card_display_sold_count.historical_sold_count'],
    [old.historical_sold,'item_basic.historical_sold'],[modern.historical_sold,'item_data.historical_sold'],
    [raw.historicalSold,'historicalSold'],[raw.sold,'sold'],[old.sold,'item_basic.sold'],
    [sc.historical_sold_count_text,'item_data.item_card_display_sold_count.historical_sold_count_text']);
  const sold=finite(soldP[0])??soldText(soldP[0]);
  const monthlyP=sel(
    [sc.rounded_local_monthly_sold_count,'item_data.item_card_display_sold_count.rounded_local_monthly_sold_count'],
    [sc.monthly_sold_count,'item_data.item_card_display_sold_count.monthly_sold_count'],
    [sc.local_monthly_sold_count_text,'item_data.item_card_display_sold_count.local_monthly_sold_count_text'],
    [sc.monthly_sold_count_text,'item_data.item_card_display_sold_count.monthly_sold_count_text'],
    [old.monthly_sold,'item_basic.monthly_sold'],[old.sold_30d,'item_basic.sold_30d'],
    [old.sold,'item_basic.sold'],[raw.monthlySold,'monthlySold'],
    [raw.monthly_sold,'monthly_sold'],[raw.sold_30d,'sold_30d']);
  const monthlyRaw=finite(monthlyP[0])??soldText(monthlyP[0]);
  const estimated=[
    raw.monthlySoldEstimated,raw.monthly_sold_estimated,raw.isMonthlySalesEstimated,raw.monthlySalesEstimated,
    old.monthly_sold_estimated,old.monthlyEstimated
  ].some(x=>truth(x)===true)||/estimat|infer|calculat|projection/i.test(String(
    raw.monthlySoldSource||raw.monthly_sold_source||old.monthly_sold_source||''));
  const monthlySold=estimated?null:monthlyRaw;

  const reviewsP=sel([counts?.[0],'item_data.item_rating.rating_count[0]'],
    [old.rating_count,'item_basic.rating_count'],[raw.reviewCount,'reviewCount'],[raw.review_count,'review_count']);
  const reviewCount=finite(reviewsP[0]);
  const fiveStarReviews=finite(counts?.[5]);
  const ratingStar=finite(first(rating.rating_star,old.rating_star,raw.rating));
  const title=text(first(asset.name,modern.name,old.name,old.item_name,raw.title,raw.name));
  const locP=sel([asset.shop_location,'item_card_displayed_asset.shop_location'],
    [old.shop_location,'item_basic.shop_location'],[modern.shop_location,'item_data.shop_location'],
    [shop.shop_location,'item_data.shop_data.shop_location'],
    [raw.shopLocation,'shopLocation'],[raw.shop_location,'shop_location'],[raw.seller_location,'seller_location'],[raw.location,'location']);
  const location=text(locP[0]);
  const flag=text(asset.seller_flag?.name);
  const preferred=flag==='PREFERRED'?true:flag==='OFFICIAL_SHOP'?false:
    truth(first(modern.shopee_verified,old.shopee_verified,old.is_preferred_shop,
      old.is_preferred_seller,raw.preferred,raw.is_preferred_shop));
  const official=flag==='OFFICIAL_SHOP'?true:flag==='PREFERRED'?false:
    truth(first(old.is_official_shop,raw.official,raw.is_official_shop));
  const ctime=finite(first(modern.ctime,old.ctime,raw.ctime));
  const createdAt=ctime!==null&&ctime>0?new Date(ctime*1000).toISOString():null;
  const brand=text(first(modern.global_brand?.display_name,old.brand?.display_name,typeof old.brand==='string'?old.brand:null));
  const sellerName=text(first(shop.shop_name,modern.shop_name,old.shop_name,raw.shopName));
  const image=text(first(asset.image,asset.images?.[0],old.image,old.images?.[0],raw.image,raw.imageUrl));
  const videoList=Array.isArray(old.video_info_list)?old.video_info_list:null;
  const icon=finite(asset.icon_in_image?.icon_type);
  const hasVideo=icon===2?true:videoList?videoList.length>0:icon===null?null:false;
  const stock=finite(first(old.stock,modern.stock,raw.stock));
  const discountPct=finite(first(dp.discount,old.raw_discount,raw.discount));
  const fields={
    price:signal(price,source,priceP[1]),originalPrice:signal(originalPrice,source,originalP[1]),
    sold:signal(sold,source,soldP[1]),monthlySold:signal(monthlySold,source,monthlyP[1]),
    rating:signal(ratingStar,source,'item_data.item_rating.rating_star'),
    reviewCount:signal(reviewCount,source,reviewsP[1]),
    fiveStarReviews:signal(fiveStarReviews,source,'item_data.item_rating.rating_count[5]'),
    location:signal(location,source,locP[1]),
    createdAt:signal(createdAt,source,ctime!==null?'ctime':null),
    brand:signal(brand,source,'global_brand.display_name'),stock:signal(stock,source,'stock'),
    hasVideo:signal(hasVideo,source,'icon_in_image.icon_type / video_info_list')
  };
  if(estimated&&monthlyRaw!==null)fields.monthlySold={kind:'estimated-excluded',source,path:monthlyP[1]};
  return{
    itemId,shopId,title,price,originalPrice,sold,monthlySold,estimatedMonthlySold:estimated?monthlyRaw:null,
    rating:ratingStar,reviewCount,fiveStarReviews,createdAt,location,preferred,official,
    brand,sellerName,image,hasVideo,stock,discountPct,ads:adsSignal(raw,old,modern),
    provenance:{source,collectedAt,shape:Object.keys(modern).length?'item_data':'item_basic',fields}
  };
}
