const txt=(el)=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
const numberPt=(s)=>{const m=String(s||'').replace(/\s/g,'').match(/-?[\d.]+(?:,\d+)?/);if(!m)return null;const raw=m[0].includes(',')?m[0].replace(/\./g,'').replace(',','.') : m[0];const n=Number(raw);return Number.isFinite(n)?n:null;};
export function parseIds(url=location.href){const s=String(url);let m=s.match(/-i\.(\d+)\.(\d+)/);if(m)return{shopId:m[1],itemId:m[2]};m=s.match(/\/product\/(\d+)\/(\d+)(?:[/?#]|$)/i);if(m)return{shopId:m[1],itemId:m[2]};m=s.match(/[?&]shopid=(\d+).*?[?&]itemid=(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};return{shopId:null,itemId:null};}
export function parseCurrentProduct(){
  const ids=parseIds();const title=txt(document.querySelector('h1'))||document.title.split('|')[0].trim();
  const descSelectors=['[data-testid="pdp-product-description"]','.product-detail','.shopee-product-detail','[class*="product-detail"]'];let description='';for(const s of descSelectors){const e=document.querySelector(s);if(e&&txt(e).length>description.length)description=txt(e)}
  const images=[...document.images].map(i=>i.currentSrc||i.src).filter(u=>/^https?:/.test(u));const uniqueImages=[...new Set(images)].filter(u=>/shopee|cf\.s/i.test(u));
  const body=txt(document.body);const rating=numberPt(body.match(/([0-5][.,]\d)\s*(?:de\s*5|avalia)/i)?.[1]);const sold=numberPt(body.match(/([\d.,]+)\s*vendid[oa]s?/i)?.[1]);
  let price=null;for(const e of document.querySelectorAll('[class*="price" i],[data-testid*="price" i]')){const t=txt(e);if(/R\$/.test(t)){const p=numberPt(t);if(Number.isFinite(p)&&p>0){price=p;break;}}}
  const hasVideo=!!document.querySelector('video, [class*="video" i]');
  return {url:location.href,...ids,title,description,category:'',price,imageUrl:uniqueImages[0]||null,imageUrls:uniqueImages.slice(0,12),imageCount:uniqueImages.length,hasVideo,rating,reviewCount:null,sold,stock:null,attributesCount:0,variationCount:0};
}
function cardFromLink(a){const card=a.closest('[data-sqe="item"],li,div')||a.parentElement;const title=a.getAttribute('title')||txt(card?.querySelector('[title]'))||txt(card).split('R$')[0].slice(0,240);const link=new URL(a.getAttribute('href'),location.href).href;const ids=parseIds(link);let price=null;for(const e of card?.querySelectorAll?.('*')||[]){const t=txt(e);if(/^R\$\s*[\d.]+(?:,\d+)?$/.test(t)){price=numberPt(t);break;}}const sold=numberPt(txt(card).match(/([\d.,]+)\s*vendid/i)?.[1]);const rating=numberPt(txt(card).match(/([0-5][.,]\d)/)?.[1]);const img=card?.querySelector('img');return {title,link,...ids,price,imageUrl:img?.currentSrc||img?.src||null,sold,rating};}
export async function collectSearchResults({max=20,scrollSteps=8,delayMs=650}={}){
  const seen=new Map();let stable=0,last=0;
  for(let step=0;step<scrollSteps;step++){
    for(const a of document.querySelectorAll('a[href*="-i."],a[href*="/product/"]')){try{const row=cardFromLink(a);if(row.itemId&&row.title.length>=4&&!seen.has(row.itemId))seen.set(row.itemId,row);}catch{}}
    if(seen.size===last)stable++;else stable=0;last=seen.size;if(seen.size>=max||stable>=3)break;window.scrollBy({top:Math.max(600,innerHeight*.85),behavior:'smooth'});await new Promise(r=>setTimeout(r,delayMs));
  }
  return [...seen.values()].slice(0,max);
}
