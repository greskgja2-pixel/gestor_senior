const txt=(el)=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
const numberPt=(s)=>{const m=String(s||'').replace(/\s/g,'').match(/-?[\d.]+(?:,\d+)?/);if(!m)return null;const raw=m[0].includes(',')?m[0].replace(/\./g,'').replace(',','.') : m[0];const n=Number(raw);return Number.isFinite(n)?n:null;};
const compactPt=(s)=>{const raw=String(s||'').trim().toLowerCase();const base=numberPt(raw);if(base==null)return null;if(/(?:mil|\bk\b)/i.test(raw))return Math.round(base*1000);if(/(?:mi|milh(?:ão|ões)|\bm\b)/i.test(raw))return Math.round(base*1000000);return base;};
const apiPrice=(v)=>{const n=Number(v);if(!Number.isFinite(n))return null;return Math.abs(n)>=100000?n/100000:n;};
const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
export function parseIds(url=location.href){const s=String(url);let m=s.match(/-i\.(\d+)\.(\d+)/);if(m)return{shopId:m[1],itemId:m[2]};m=s.match(/\/product\/(\d+)\/(\d+)(?:[/?#]|$)/i);if(m)return{shopId:m[1],itemId:m[2]};m=s.match(/[?&]shopid=(\d+).*?[?&]itemid=(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};return{shopId:null,itemId:null};}
export function parseCurrentProduct(){
  const ids=parseIds();const title=txt(document.querySelector('h1'))||document.title.split('|')[0].trim();
  const descSelectors=['[data-testid="pdp-product-description"]','.product-detail','.shopee-product-detail','[class*="product-detail"]'];let description='';for(const s of descSelectors){const e=document.querySelector(s);if(e&&txt(e).length>description.length)description=txt(e)}
  const images=[...document.images].map(i=>i.currentSrc||i.src).filter(u=>/^https?:/.test(u));const uniqueImages=[...new Set(images)].filter(u=>/shopee|cf\.s/i.test(u));
  const body=txt(document.body);
  const nearTitle=(document.querySelector('h1')?.parentElement?.parentElement?.innerText||'').replace(/\s+/g,' ').trim();
  const ratingText=`${nearTitle} ${[...document.querySelectorAll('[class*="rating" i],[data-testid*="rating" i]')].map(txt).join(' ')}`;
  const ratingMatch=ratingText.match(/(?:^|\s)([0-5](?:[.,]\d{1,2})?)(?=\s*(?:★|Avalia|Estrela|\d))/i)||body.match(/(?:^|\s)([0-5][.,]\d{1,2})\s*(?:de\s*5|estrelas?)/i);const rating=numberPt(ratingMatch?.[1]);
  const reviewMatches=[...(`${nearTitle} ${body.slice(0,18000)}`).matchAll(/([\d.,]+\s*(?:mil|k|mi|m)?)\s*(?:avaliações|avaliação|reviews?)/ig)].map(m=>compactPt(m[1])).filter(v=>Number.isFinite(v));const reviewCount=reviewMatches.length?Math.min(...reviewMatches.filter(v=>v>=0)):null;
  const soldMatch=nearTitle.match(/([\d.,]+\s*(?:mil|k|mi|m)?)\s*vendid[oa]s?/i)||body.match(/([\d.,]+\s*(?:mil|k|mi|m)?)\s*vendid[oa]s?/i);const sold=compactPt(soldMatch?.[1]);
  let price=null;for(const e of document.querySelectorAll('[class*="price" i],[data-testid*="price" i]')){const t=txt(e);if(/R\$/.test(t)){const p=numberPt(t);if(Number.isFinite(p)&&p>0){price=p;break;}}}
  if(price==null){const m=body.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/);const p=numberPt(m?.[1]);if(Number.isFinite(p)&&p>0)price=p;}
  const hasVideo=!!document.querySelector('video, [class*="video" i]');
  return {url:location.href,...ids,title,description,category:'',price,imageUrl:uniqueImages[0]||null,imageUrls:uniqueImages.slice(0,12),imageCount:uniqueImages.length,hasVideo,rating,reviewCount,sold,stock:null,attributesCount:0,variationCount:0};
}
export async function fetchCurrentItemApi(){
  const {shopId,itemId}=parseIds();if(!shopId||!itemId)return null;
  const r=await fetch(`/api/v4/item/get?itemid=${encodeURIComponent(itemId)}&shopid=${encodeURIComponent(shopId)}`,{credentials:'include',headers:{accept:'application/json, text/plain, */*','x-api-source':'pc'}});if(!r.ok)throw new Error(`item/get HTTP ${r.status}`);const j=await r.json();const item=j?.data?.item||j?.data||j?.item;if(!item||typeof item!=='object')return null;
  const rc=item?.item_rating?.rating_count;const reviewCount=Array.isArray(rc)?finite(rc[0]):finite(rc??item?.rating_count??item?.review_count);
  return{rating:finite(item?.item_rating?.rating_star??item?.rating_star),reviewCount,sold:finite(item?.historical_sold??item?.sold),stock:finite(item?.stock??item?.stock_info_v2?.summary_info?.total_available_stock),price:apiPrice(item?.price??item?.price_min),priceBeforeDiscount:apiPrice(item?.price_before_discount)};
}
function cardFromLink(a){const card=a.closest('[data-sqe="item"],li,div')||a.parentElement;const title=a.getAttribute('title')||txt(card?.querySelector('[title]'))||txt(card).split('R$')[0].slice(0,240);const link=new URL(a.getAttribute('href'),location.href).href;const ids=parseIds(link);let price=null;for(const e of card?.querySelectorAll?.('*')||[]){const t=txt(e);if(/^R\$\s*[\d.]+(?:,\d+)?$/.test(t)){price=numberPt(t);break;}}const sold=compactPt(txt(card).match(/([\d.,]+\s*(?:mil|k|mi|m)?)\s*vendid/i)?.[1]);const rating=numberPt(txt(card).match(/(?:^|\s)([0-5][.,]\d{1,2})(?:\s|$)/)?.[1]);const img=card?.querySelector('img');return {title,link,...ids,price,imageUrl:img?.currentSrc||img?.src||null,sold,rating};}
function apiItem(raw){const b=raw?.item_basic||raw?.item||raw||{};const itemId=String(b.itemid??b.item_id??raw?.itemid??raw?.item_id??'');const shopId=String(b.shopid??b.shop_id??raw?.shopid??raw?.shop_id??'');const title=String(b.name??b.title??raw?.name??raw?.title??'').trim();if(!itemId||!title)return null;const image=b.image??b.image_url??raw?.image??raw?.image_url??null;const imageUrl=image&&!String(image).startsWith('http')?`https://down-br.img.susercontent.com/file/${image}`:image;const rc=b?.item_rating?.rating_count;return{title,link:`https://shopee.com.br/product/${shopId}/${itemId}`,shopId,itemId,price:apiPrice(b.price??b.price_min??raw?.price??raw?.price_min),imageUrl:imageUrl||null,sold:finite(b.historical_sold??b.sold??raw?.historical_sold??raw?.sold),rating:finite(b.item_rating?.rating_star??b.rating_star??b.rating??raw?.item_rating?.rating_star),reviewCount:Array.isArray(rc)?finite(rc[0]):finite(rc)};}
function fullSearchKeyword(keyword){return String(keyword||'').replace(/\s+/g,' ').trim();}
function compactSearchKeyword(keyword){const raw=String(keyword||'').normalize('NFD').replace(/[\u0300-\u036f]/g,' ').replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ ]/g,' ').replace(/\s+/g,' ').trim();const noise=new Set(['tema','folha','folhas','a4','melhor','shopee','oficial','original','promocao','promoção','frete','gratis','grátis']);const tokens=raw.split(' ').filter(Boolean).filter((w,i)=>{const low=w.toLowerCase();if(noise.has(low))return false;if(/^\d$/.test(w)&&i>2)return false;return true;});return tokens.slice(0,7).join(' ');}
async function directSearchOnce(q,max){if(!q)return[];const params=new URLSearchParams({by:'relevancy',keyword:q,limit:String(Math.min(Math.max(max,20),60)),newest:'0',order:'desc',page_type:'search',scenario:'PAGE_GLOBAL_SEARCH',version:'2'});const res=await fetch(`/api/v4/search/search_items?${params.toString()}`,{credentials:'include',headers:{accept:'application/json'}});if(!res.ok)throw new Error(`Busca Shopee HTTP ${res.status}`);const body=await res.json();if(body?.error&&body.error!==0)throw new Error(body.error_msg||`Busca Shopee erro ${body.error}`);return(Array.isArray(body?.items)?body.items:[]).map(apiItem).filter(Boolean).slice(0,max);}
async function directSearch(keyword,max){const full=fullSearchKeyword(keyword);const first=await directSearchOnce(full,max);if(first.length)return first;const compact=compactSearchKeyword(keyword);return compact&&compact!==full?directSearchOnce(compact,max):[];}
export async function collectSearchResults({max=20,scrollSteps=8,delayMs=650}={}){
  const keyword=new URL(location.href).searchParams.get('keyword')||'';
  if(keyword){try{const direct=await directSearch(keyword,max);if(direct.length)return direct;}catch{}}
  const seen=new Map();let stable=0,last=0;
  for(let step=0;step<scrollSteps;step++){
    for(const a of document.querySelectorAll('a[href*="-i."],a[href*="/product/"],a[href*="itemid="]')){try{const row=cardFromLink(a);if(row.itemId&&row.title.length>=4&&!seen.has(row.itemId))seen.set(row.itemId,row);}catch{}}
    if(seen.size===last)stable++;else stable=0;last=seen.size;if(seen.size>=max||stable>=2)break;window.scrollBy({top:Math.max(600,innerHeight*.85),behavior:'smooth'});await new Promise(r=>setTimeout(r,Math.min(delayMs,450)));
  }
  return [...seen.values()].slice(0,max);
}
