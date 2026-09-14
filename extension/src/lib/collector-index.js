export const COLLECTOR_INDEX_KEY = 'gsCollectorIndexV2';
export const COLLECTOR_STATS_KEY = 'gsCollectorStatsV2';
const MAX_ITEMS = 3500;

const STOP=new Set(['para','com','sem','por','uma','uns','das','dos','de','em','do','da','e','o','a']);
const words=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
const meaningful=s=>words(s).filter(w=>w.length>=3&&!STOP.has(w));
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const price=v=>{const n=num(v);if(n==null)return null;return Math.abs(n)>=100000?n/100000:n;};
const first=(...xs)=>xs.find(x=>x!==undefined&&x!==null&&x!=='');

export function normalizeSearchItem(raw,meta={}){
  const b=raw?.item_basic||raw?.item||raw||{};
  const itemId=String(first(b.itemid,b.item_id,raw?.itemid,raw?.item_id,'')||'');
  const shopId=String(first(b.shopid,b.shop_id,raw?.shopid,raw?.shop_id,'')||'');
  const title=String(first(b.name,b.title,raw?.name,raw?.title,'')||'').trim();
  if(!itemId||!title)return null;
  const rating=num(first(b.item_rating?.rating_star,b.rating_star,b.rating,raw?.item_rating?.rating_star));
  const sold=num(first(b.historical_sold,b.sold,raw?.historical_sold,raw?.sold));
  const currentPrice=price(first(b.price,b.price_min,raw?.price,raw?.price_min));
  const priceMin=price(first(b.price_min,raw?.price_min,b.price));
  const priceMax=price(first(b.price_max,raw?.price_max,b.price));
  const image=first(b.image,b.image_url,raw?.image,raw?.image_url,null);
  const imageUrl=image&&!String(image).startsWith('http')?`https://down-br.img.susercontent.com/file/${image}`:image;
  return{key:`${shopId||'shop'}:${itemId}`,itemId,shopId,title,price:currentPrice,priceMin,priceMax,rating,sold,imageUrl:imageUrl||null,categoryId:first(b.catid,b.cat_id,raw?.catid,raw?.cat_id,null),shopName:String(first(b.shop_name,raw?.shop_name,'')||''),source:meta.source||'coletor-3.1',query:meta.query||null,category:meta.category||null,filename:meta.filename||null,collectedAt:meta.collectedAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
}

export function normalizeSearchBody(body,meta={}){const items=Array.isArray(body?.items)?body.items:[];return items.map(x=>normalizeSearchItem(x,meta)).filter(Boolean);}
export async function loadCollectorIndex(){const r=await chrome.storage.local.get(COLLECTOR_INDEX_KEY);return r[COLLECTOR_INDEX_KEY]&&typeof r[COLLECTOR_INDEX_KEY]==='object'?r[COLLECTOR_INDEX_KEY]:{};}
export async function indexSearchBody(body,meta={}){const normalized=normalizeSearchBody(body,meta);if(!normalized.length)return{added:0,updated:0,total:0};const index=await loadCollectorIndex();let added=0,updated=0;for(const item of normalized){if(index[item.key])updated++;else added++;index[item.key]={...index[item.key],...item};}const rows=Object.values(index).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,MAX_ITEMS),compact=Object.fromEntries(rows.map(x=>[x.key,x])),stats=computeDatasetStats(rows);await chrome.storage.local.set({[COLLECTOR_INDEX_KEY]:compact,[COLLECTOR_STATS_KEY]:stats});return{added,updated,total:rows.length,stats};}
function similarity(a,b){const A=new Set(meaningful(a)),B=new Set(meaningful(b));if(!A.size||!B.size)return 0;let inter=0;for(const x of A)if(B.has(x))inter++;const union=new Set([...A,...B]).size,j=inter/union,coverage=inter/Math.min(A.size,B.size);return j*.55+coverage*.45;}
export async function findCollectedCompetitors(title,ownItemId,{max=20,minScore=.22}={}){const index=await loadCollectorIndex();return Object.values(index).filter(x=>String(x.itemId)!==String(ownItemId||'')).map(x=>({...x,similarity:similarity(title,x.title)})).filter(x=>x.similarity>=minScore).sort((a,b)=>b.similarity-a.similarity||(b.sold||0)-(a.sold||0)).slice(0,max).map(x=>({title:x.title,price:x.price,priceMin:x.priceMin,priceMax:x.priceMax,link:`https://shopee.com.br/product/${x.shopId}/${x.itemId}`,imageUrl:x.imageUrl,rating:x.rating,sold:x.sold,shopId:x.shopId,itemId:x.itemId,description:'',category:'',source:'collector-index',similarity:x.similarity}));}
export function computeDatasetStats(rows){const items=Array.isArray(rows)?rows:[],prices=items.map(x=>x.price).filter(Number.isFinite).sort((a,b)=>a-b),sold=items.map(x=>Number(x.sold)||0),median=prices.length?(prices.length%2?prices[(prices.length-1)/2]:(prices[prices.length/2-1]+prices[prices.length/2])/2):null,top=[...items].sort((a,b)=>(Number(b.sold)||0)-(Number(a.sold)||0)).slice(0,10);return{total:items.length,shops:new Set(items.map(x=>x.shopId).filter(Boolean)).size,medianPrice:median,minPrice:prices[0]??null,maxPrice:prices.at(-1)??null,totalHistoricalSold:sold.reduce((a,b)=>a+b,0),top,updatedAt:new Date().toISOString()};}
export async function getCollectorStats(){const r=await chrome.storage.local.get([COLLECTOR_STATS_KEY,COLLECTOR_INDEX_KEY]);if(r[COLLECTOR_STATS_KEY])return r[COLLECTOR_STATS_KEY];return computeDatasetStats(Object.values(r[COLLECTOR_INDEX_KEY]||{}));}
export async function clearCollectorIndex(){await chrome.storage.local.remove([COLLECTOR_INDEX_KEY,COLLECTOR_STATS_KEY]);}
