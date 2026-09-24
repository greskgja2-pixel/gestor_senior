import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getProducts } from "../../../../lib/products";

export const dynamic = "force-dynamic";

const STOP = new Set([
  "para","com","sem","de","da","do","das","dos","em","no","na","nos","nas","e","ou","a","o","as","os",
  "um","uma","kit","produto","novo","nova","original","pronta","pronto","mais","super","tipo","modelo","unidade",
  "unidades","un","cm","mm","kg","g","ml"
]);
function norm(v="") {return String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim();}
function tokens(v="") {return [...new Set(norm(v).split(" ").filter(x => x.length >= 3 && !STOP.has(x) && !/^\d+$/.test(x)))];}
function productPrice(item) {const p = item?.price_info?.[0];return Number(p?.current_price ?? p?.original_price ?? 0) || 0;}
function unwrap(raw) {
  const ib = raw?.item_basic || raw?.item || raw; const itemid = ib?.itemid ?? ib?.item_id; const shopid = ib?.shopid ?? ib?.shop_id;
  if (!itemid || !shopid) return null;
  const scaled = Number(ib?.price ?? ib?.price_min ?? 0); const price = scaled > 10000 ? scaled / 100000 : scaled;
  const beforeScaled = Number(ib?.price_before_discount ?? ib?.original_price ?? 0); const before = beforeScaled > 10000 ? beforeScaled / 100000 : beforeScaled;
  const image = ib?.image || ib?.image_id || null; const rating = Number(ib?.item_rating?.rating_star ?? ib?.rating_star ?? 0) || null;
  const counts = ib?.item_rating?.rating_count; const reviews = Array.isArray(counts) ? Number(counts[0] || 0) : Number(ib?.rating_count || 0);
  const cumulativeRaw = ib?.historical_sold ?? ib?.sold;
  const monthlyRaw = ib?.monthly_sold ?? ib?.sold_30d;
  const cumulativeSold = cumulativeRaw===null||cumulativeRaw===undefined||cumulativeRaw===''?null:Number(cumulativeRaw);
  const monthlySold = monthlyRaw===null||monthlyRaw===undefined||monthlyRaw===''?null:Number(monthlyRaw);
  const preferredKeys=['is_preferred_plus_seller','is_preferred_shop','is_preferred_seller'];
  const preferredPresent=preferredKeys.some(k=>Object.prototype.hasOwnProperty.call(ib,k));
  const preferred=preferredPresent?preferredKeys.some(k=>ib?.[k]===true||ib?.[k]===1||ib?.[k]==='1'):null;
  return {
    itemId:String(itemid),shopId:String(shopid),title:ib?.name||ib?.item_name||"",
    price:price||null,originalPrice:before||null,categoryId:Number(ib?.catid??ib?.category_id??0)||null,
    image:image?(String(image).startsWith("http")?String(image):`https://down-br.img.susercontent.com/file/${image}`):null,
    rating,reviews:Number.isFinite(reviews)?reviews:null,
    sold:Number.isFinite(cumulativeSold)?cumulativeSold:null,
    monthlySold:Number.isFinite(monthlySold)?monthlySold:null,
    official:Boolean(ib?.is_official_shop),preferred,
    location:ib?.shop_location||ib?.location||ib?.shop_location_name||null,
    url:`https://shopee.com.br/product/${shopid}/${itemid}`
  };
}
function similarity(own,c){
  const a=tokens(own.item_name),b=tokens(c.title),A=new Set(a),B=new Set(b);const inter=[...A].filter(x=>B.has(x)).length;const union=new Set([...a,...b]).size||1;
  const jaccard=inter/union,containment=inter/Math.max(1,Math.min(A.size,B.size));const ownPrice=productPrice(own),cp=Number(c.price||0);const priceScore=ownPrice>0&&cp>0?Math.max(0,1-Math.abs(cp-ownPrice)/Math.max(ownPrice,cp)):.35;const categoryScore=own.category_id&&c.categoryId?(Number(own.category_id)===Number(c.categoryId)?1:0):.45;const phraseBonus=a.slice(0,4).filter((t,i)=>i<a.length-1&&norm(c.title).includes(`${t} ${a[i+1]}`)).length?1:0;return{score:.42*jaccard+.23*containment+.15*priceScore+.15*categoryScore+.05*phraseBonus,matchedTokens:[...A].filter(x=>B.has(x))};
}
async function shopeeSearch(keyword,limit=50){
  const q=new URLSearchParams({by:"relevancy",keyword,limit:String(limit),newest:"0",order:"desc",page_type:"search",scenario:"PAGE_GLOBAL_SEARCH",version:"2"});
  const res=await fetch(`https://shopee.com.br/api/v4/search/search_items?${q}`,{cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(18000),headers:{accept:"application/json, text/plain, */*","accept-language":"pt-BR,pt;q=0.9,en;q=0.7",referer:`https://shopee.com.br/search?keyword=${encodeURIComponent(keyword)}`,"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36","x-api-source":"pc"}});
  const text=await res.text();if(!res.ok)throw new Error(`Busca pública Shopee respondeu HTTP ${res.status}`);let json;try{json=JSON.parse(text)}catch{throw new Error("Shopee bloqueou a busca pública ou devolveu resposta não-JSON.")}if(json?.error)throw new Error(`Busca Shopee: ${json.error}${json.message?` — ${json.message}`:""}`);return Array.isArray(json?.items)?json.items:[];
}

export async function GET(request){
  try{
    const u=new URL(request.url),itemId=u.searchParams.get("item_id");if(!itemId)return NextResponse.json({error:"Informe item_id."},{status:400});
    const shop=await getActiveShop();if(!shop)return NextResponse.json({error:"Nenhuma loja autorizada."},{status:400});
    const result=await getProducts(shop),own=(result.items||[]).find(x=>String(x.item_id)===String(itemId));if(!own)return NextResponse.json({error:"Produto não encontrado no catálogo da loja."},{status:404});

    const fullTitle=String(own.item_name||"").replace(/\s+/g," ").trim();
    const tokenQuery=tokens(fullTitle).slice(0,7).join(" ");
    const compact=tokens(fullTitle).slice(0,4).join(" ");
    const queries=[...new Set([fullTitle,tokenQuery,compact].filter(Boolean))];
    const all=[],attempts=[];
    for(const q of queries){try{const rows=await shopeeSearch(q,50);attempts.push({query:q,ok:true,count:rows.length});all.push(...rows);if(rows.length>=15)break}catch(e){attempts.push({query:q,ok:false,error:String(e.message||e)})}}
    if(!all.length)return NextResponse.json({itemId:String(itemId),query:fullTitle,attempts,source:"shopee_public_search",competitors:[],warning:"A Shopee não liberou resultados pela busca pública nesta tentativa. Nenhum concorrente fictício foi criado."});

    const seen=new Set(),comps=[];
    for(const raw of all){const c=unwrap(raw);if(!c)continue;if(c.itemId===String(own.item_id)||c.shopId===String(shop.shop_id))continue;const key=`${c.shopId}:${c.itemId}`;if(seen.has(key))continue;seen.add(key);const sim=similarity(own,c);if(sim.score<.15||sim.matchedTokens.length<1)continue;comps.push({...c,similarity:Number((sim.score*100).toFixed(1)),matchedTokens:sim.matchedTokens})}
    comps.sort((a,b)=>b.similarity-a.similarity||(b.sold||0)-(a.sold||0));
    return NextResponse.json({itemId:String(itemId),own:{itemId:String(own.item_id),shopId:String(shop.shop_id),title:own.item_name,price:productPrice(own),categoryId:own.category_id,image:own.image?.image_url_list?.[0]||null},query:fullTitle,attempts,source:"shopee_public_search",competitors:comps.slice(0,20)});
  }catch(e){return NextResponse.json({error:String(e.message||e),competitors:[]},{status:500})}
}
