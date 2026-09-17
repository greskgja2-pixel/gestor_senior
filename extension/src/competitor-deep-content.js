(() => {
  'use strict';
  if(window.__GS_COMPETITOR_DEEP_V1__)return;window.__GS_COMPETITOR_DEEP_V1__=true;

  const text=el=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
  const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const apiPrice=v=>{const n=Number(v);if(!Number.isFinite(n))return null;return Math.abs(n)>=100000?n/100000:n;};
  const unique=a=>[...new Set((a||[]).filter(Boolean))];
  const imageUrl=id=>{
    const s=String(id||'').trim();if(!s)return null;
    if(/^https?:/i.test(s))return s;
    return `https://down-br.img.susercontent.com/file/${s}`;
  };
  function parseIds(url=location.href){
    const s=String(url||'');let m=s.match(/-i\.(\d+)\.(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};
    m=s.match(/\/product\/(\d+)\/(\d+)(?:[/?#]|$)/i);if(m)return{shopId:m[1],itemId:m[2]};
    m=s.match(/[?&]shopid=(\d+).*?[?&]itemid=(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};
    return{shopId:null,itemId:null};
  }
  function domDescription(){
    const selectors=['[data-testid="pdp-product-description"]','.product-detail','.shopee-product-detail','[class*="product-detail" i]'];
    let best='';for(const s of selectors){for(const e of document.querySelectorAll(s)){const t=text(e);if(t.length>best.length)best=t;}}
    return best;
  }
  function domImages(){
    const imgs=[...document.querySelectorAll('img')].map(i=>i.currentSrc||i.src).filter(u=>/^https?:/i.test(u)&&/(shopee|susercontent|cf\.s)/i.test(u));
    return unique(imgs).slice(0,20);
  }
  function offerSignals(source){
    const s=String(source||'').toLowerCase();const out=[];
    const tests=[
      ['frete grátis',/frete\s*gr[aá]tis/],['cupom',/cupom|voucher/],['desconto',/desconto|promo[cç][aã]o|oferta/],['kit/combo',/\bkit\b|\bcombo\b|conjunto|pacote/],['brinde',/brinde|gr[aá]tis na compra/],['garantia',/garantia/],['personalização',/personalizad[oa]|personaliza[cç][aã]o/],['pronta entrega',/pronta?\s*entrega|envio\s*imediato/],['atacado',/atacado|quantidade|lote/],['benefício educacional',/educativ[oa]|pedag[oó]gic[oa]|aprendizado/]
    ];
    for(const [name,re] of tests)if(re.test(s))out.push(name);
    const q=[...s.matchAll(/\b\d{1,4}\s*(?:unidades?|folhas?|p[aá]ginas?|pe[cç]as?|itens?|pares?|cores?)\b/gi)].map(m=>m[0]).slice(0,4);
    return unique([...out,...q]);
  }
  function compositionLines(description,title=''){
    const raw=String(description||'').replace(/\r/g,'\n');
    const parts=raw.split(/\n+|(?<=[.!?;:])\s+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x.length>=8&&x.length<=220);
    const scored=parts.map((line,i)=>{let score=0;if(/\d/.test(line))score+=3;if(/(cont[eé]m|inclui|acompanha|kit|combo|unidade|folha|p[aá]gina|tamanho|material|medida|cor|garantia|brinde|frete|personaliz)/i.test(line))score+=4;if(line.length>=20&&line.length<=140)score+=2;return{line,score,i};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,8).sort((a,b)=>a.i-b.i).map(x=>x.line);
    if(!scored.length&&title)return[String(title).slice(0,180)];
    return unique(scored);
  }
  function attributesFrom(item){
    const list=Array.isArray(item?.attributes)?item.attributes:[];
    return list.map(a=>{
      const name=a?.name||a?.display_name||a?.attribute_name||'';
      const vals=Array.isArray(a?.values)?a.values.map(v=>v?.name||v?.value||v).filter(Boolean):[];
      const value=vals.length?vals.join(', '):(a?.value||a?.display_value||'');
      return{name:String(name||'').trim(),value:String(value||'').trim()};
    }).filter(x=>x.name||x.value).slice(0,20);
  }
  function variationsFrom(item){
    const tiers=Array.isArray(item?.tier_variations)?item.tier_variations:(Array.isArray(item?.tier_variation)?item.tier_variation:[]);
    const tierDetails=tiers.map(t=>({name:String(t?.name||'Variação'),options:(Array.isArray(t?.options)?t.options:[]).map(o=>String(o?.option||o?.name||o||'')).filter(Boolean).slice(0,30)}));
    const models=Array.isArray(item?.models)?item.models:(Array.isArray(item?.model)?item.model:[]);
    let count=models.length;
    if(!count&&tierDetails.length){count=tierDetails.reduce((acc,t)=>acc*Math.max(1,t.options.length),1);}
    return{variationCount:count||0,variationDetails:tierDetails,modelCount:models.length};
  }
  async function apiData(ids){
    if(!ids.shopId||!ids.itemId)return null;
    const url=`/api/v4/item/get?itemid=${encodeURIComponent(ids.itemId)}&shopid=${encodeURIComponent(ids.shopId)}`;
    const r=await fetch(url,{credentials:'include',headers:{accept:'application/json, text/plain, */*','x-api-source':'pc'}});
    if(!r.ok)throw new Error(`item/get HTTP ${r.status}`);
    const j=await r.json();const item=j?.data?.item||j?.data||j?.item;if(!item||typeof item!=='object')return null;
    const rc=item?.item_rating?.rating_count;
    const variations=variationsFrom(item),attributes=attributesFrom(item);
    const apiImages=unique((item?.images||[]).map(imageUrl));
    const description=String(item?.description||'').trim();
    return{
      title:String(item?.name||'').trim(),description,
      price:apiPrice(item?.price??item?.price_min),priceBeforeDiscount:apiPrice(item?.price_before_discount),
      rating:finite(item?.item_rating?.rating_star??item?.rating_star),
      reviewCount:Array.isArray(rc)?finite(rc[0]):finite(rc??item?.rating_count??item?.review_count),
      sold:finite(item?.historical_sold??item?.sold),stock:finite(item?.stock??item?.stock_info_v2?.summary_info?.total_available_stock),
      imageUrls:apiImages,imageCount:apiImages.length,hasVideo:Boolean(item?.video_info||item?.video||item?.video_url),
      attributes,attributesCount:attributes.length,brand:String(item?.brand||item?.brand_name||'').trim(),categoryId:finite(item?.catid??item?.category_id),
      discount:String(item?.discount||'').trim(),...variations
    };
  }
  async function collect(msg={}){
    const ids={...parseIds(),shopId:String(msg.shopId||parseIds().shopId||''),itemId:String(msg.itemId||parseIds().itemId||'')};
    let api=null,apiError=null;try{api=await apiData(ids);}catch(e){apiError=String(e?.message||e);}
    const title=api?.title||text(document.querySelector('h1'))||document.title.split('|')[0].trim();
    const description=api?.description||domDescription();
    const domImgs=domImages(),imageUrls=(api?.imageUrls?.length?api.imageUrls:domImgs).slice(0,20);
    const near=(document.querySelector('h1')?.parentElement?.parentElement?.innerText||'').replace(/\s+/g,' ').trim();
    const source=`${title}\n${description}\n${near}`;
    const signals=offerSignals(source),composition=compositionLines(description,title);
    const hasVideo=api?.hasVideo??Boolean(document.querySelector('video,[class*="video" i]'));
    return{
      ok:true,url:location.href,shopId:ids.shopId,itemId:ids.itemId,title,description,
      descriptionLength:description.length,descriptionSections:description?Math.max(1,description.split(/\n{2,}|\n(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).filter(Boolean).length):0,
      price:api?.price??null,priceBeforeDiscount:api?.priceBeforeDiscount??null,rating:api?.rating??null,reviewCount:api?.reviewCount??null,sold:api?.sold??null,stock:api?.stock??null,
      imageUrls,imageCount:api?.imageCount||imageUrls.length,hasVideo,
      variationCount:api?.variationCount||0,variationDetails:api?.variationDetails||[],modelCount:api?.modelCount||0,
      attributes:api?.attributes||[],attributesCount:api?.attributesCount||0,brand:api?.brand||'',categoryId:api?.categoryId??null,discount:api?.discount||'',
      offerSignals:signals,offerComposition:composition,deepSource:api?'api+dom':'dom',apiError
    };
  }

  chrome.runtime.onMessage.addListener((msg,_sender,reply)=>{
    if(msg?.type!=='GS_PARSE_COMPETITOR_DEEP')return;
    collect(msg).then(data=>reply(data)).catch(e=>reply({ok:false,error:String(e?.message||e),url:location.href}));
    return true;
  });
})();
