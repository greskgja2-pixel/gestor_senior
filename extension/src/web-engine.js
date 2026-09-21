import {gestorApi} from './lib/gestor-api.js';
import {analyze} from './lib/super-anuncio-engine.js';
import {computeProfit,DEFAULT_FINANCE} from './lib/profit-engine.js';

const RESULT_KEY='gsCompetitorPickerResultV1';
const SESSION_KEY='gsWebAuditPickerV1';
const LOCAL_COST_KEY='gsProductCostsV1';
const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const timeout=(promise,ms,fallback=null)=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);

function parseIds(url=''){
  const s=String(url||'');let m=s.match(/\/product\/(\d+)\/(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};
  m=s.match(/-i\.(\d+)\.(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};return{shopId:null,itemId:null};
}
async function waitTab(tabId,ms=20000){const start=Date.now();while(Date.now()-start<ms){const t=await chrome.tabs.get(tabId).catch(()=>null);if(!t)throw new Error('A aba temporária foi fechada.');if(t.status==='complete')return t;await wait(300);}throw new Error('A Shopee demorou demais para carregar.');}
async function parseCurrent(tabId){let last=null;for(let i=0;i<20;i++){try{const r=await chrome.tabs.sendMessage(tabId,{type:'GS_PARSE_CURRENT_PRODUCT'});if(r?.ok&&r.product?.title)return r.product;last=new Error(r?.error||'Anúncio ainda não disponível.');}catch(e){last=e;}await wait(450);}throw last||new Error('Não consegui ler o anúncio.');}
function normalizeModels(raw){const list=raw?.response?.model||raw?.response?.model_list||raw?.model||raw?.models||[];return(Array.isArray(list)?list:[]).map((m,i)=>({modelId:n(m.model_id??m.id),name:m.model_name||m.name||m.model_sku||`Variação ${i+1}`,sku:m.model_sku||'',price:n(m.price_info?.current_price??m.price),stock:n(m.stock_info_v2?.summary_info?.total_available_stock??m.stock_info?.normal_stock??m.stock)})).filter(x=>x.modelId!=null);}
function normalizeCategories(raw){const roots=raw?.response?.category_list||raw?.category_list||raw?.response?.list||[],out=[],seen=new Set();function walk(x,parent=''){if(!x)return;if(Array.isArray(x)){x.forEach(v=>walk(v,parent));return;}if(typeof x!=='object')return;const id=x.category_id??x.id,name=x.display_category_name||x.original_category_name||x.category_name||x.name;if(id&&name&&!seen.has(String(id))){seen.add(String(id));const label=parent?`${parent} > ${name}`:String(name);out.push({id:Number(id),name:String(name),label,parentId:n(x.parent_category_id)});for(const k of ['children','child_list','category_list','sub_categories'])if(Array.isArray(x[k]))walk(x[k],label);}else for(const v of Object.values(x))if(Array.isArray(v))walk(v,parent);}walk(roots);return out;}
function categoryName(categories,id){return categories.find(x=>String(x.id)===String(id))?.label||`Categoria ${id||'não identificada'}`;}
function productPrice(p){return n(p?.price_info?.[0]?.current_price??p?.price_info?.[0]?.original_price??p?.price_min??p?.price);}
function imageList(p){return p?.image?.image_url_list||p?.imageUrls||[];}
function campaignForItem(ads,itemId){const v=ads?.v7||ads?.v5||ads||{};return(v.campaigns||[]).find(c=>String(c.itemId??c.item_id)===String(itemId))||null;}
function searchQuery(title=''){const noise=new Set(['tema','folha','folhas','a4','melhor','shopee','oficial','original','promoção','promocao','frete','grátis','gratis']);return String(title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>1&&!noise.has(w.toLowerCase())).slice(0,7).join(' ');}
function grossMargin(price,cost){const p=n(price),c=n(cost);if(p==null||p<=0||c==null)return{profit:null,marginPct:null};const profit=p-c;return{profit,marginPct:(profit/p)*100};}

async function collectProduct(url){
  if(!/^https:\/\/(?:www\.)?shopee\.com\.br\//i.test(String(url||'')))throw new Error('Cole um link válido de anúncio da Shopee Brasil.');
  const tab=await chrome.tabs.create({url,active:false});
  try{
    await waitTab(tab.id);await wait(500);const dom=await parseCurrent(tab.id);const final=await chrome.tabs.get(tab.id);const ids={...parseIds(final.url),...parseIds(dom.url)};const itemId=String(dom.itemId||ids.itemId||'');if(!itemId)throw new Error('Não consegui identificar o ID do anúncio.');
    const products=await timeout(gestorApi.products(),12000,{items:[]});const cached=(products?.items||[]).find(x=>String(x.item_id)===itemId)||{};
    const [cats,pub,costRaw,adsRaw]=await Promise.all([
      timeout(gestorApi.categories().catch(()=>null),12000,null),
      timeout(gestorApi.publicProduct(itemId).catch(()=>null),12000,null),
      timeout(gestorApi.productCosts().catch(()=>({costs:[]})),10000,{costs:[]}),
      timeout(gestorApi.ads(7).catch(()=>null),10000,null)
    ]);
    const categories=normalizeCategories(cats),categoryId=cached.category_id??dom.categoryId??null;
    const models=cached.has_model?normalizeModels(await timeout(gestorApi.models(itemId).catch(()=>null),12000,null)):[];
    const publicRow=pub?.results?.find(x=>String(x.item_id)===itemId&&x.ok)||null,imgs=imageList(cached),costs=Array.isArray(costRaw?.costs)?costRaw.costs:[];
    const base=costs.find(x=>String(x.item_id)===itemId&&Number(x.model_id)===0),variationCosts=models.map(m=>({modelId:m.modelId,name:m.name,cost:n(costs.find(x=>String(x.item_id)===itemId&&String(x.model_id)===String(m.modelId))?.cost)}));
    const allVariationCosts=models.length>0&&variationCosts.every(x=>x.cost!=null&&x.cost>=0);
    const product={...dom,url:final.url||url,itemId,shopId:String(ids.shopId||dom.shopId||''),title:cached.item_name||dom.title,description:cached.description||dom.description||'',categoryId,category:categoryName(categories,categoryId),imageUrls:imgs.length?imgs:(dom.imageUrls||[]),imageUrl:imgs[0]||dom.imageUrl||null,imageCount:imgs.length||dom.imageCount||0,hasVideo:Boolean(dom.hasVideo||cached.video_info),rating:n(publicRow?.rating)??n(dom.rating),reviewCount:n(publicRow?.reviewCount)??n(dom.reviewCount),sold:n(dom.sold)??n(publicRow?.historicalSold),stock:n(publicRow?.stock)??n(dom.stock),attributesCount:Array.isArray(cached.attribute_list)?cached.attribute_list.length:n(dom.attributesCount)??0,variationCount:models.length,price:productPrice(cached)??n(publicRow?.price)??n(dom.price),priceBeforeDiscount:n(publicRow?.priceBeforeDiscount)??n(cached.price_info?.[0]?.original_price)??n(dom.priceBeforeDiscount)};
    const campaign=campaignForItem(adsRaw,itemId);
    const campaignSpend=n(campaign?.spend),campaignOrders=n(campaign?.orders),campaignCostPerSale=n(campaign?.costPerSale??campaign?.cost_per_sale??campaign?.cpa)??(campaignSpend!=null&&campaignOrders>0?campaignSpend/campaignOrders:null);
    return{product,models,ads:campaign?{roas:n(campaign.roas),targetRoas:n(campaign.targetRoas),spend:campaignSpend,gmv:n(campaign.gmv),costPerSale:campaignCostPerSale,ctr:n(campaign.ctr),orders:campaignOrders,campaignId:campaign.campaignId}:null,baseCost:n(base?.cost),variationCosts,needsBaseCost:!allVariationCosts,adsTimedOut:adsRaw==null};
  }finally{chrome.tabs.remove(tab.id).catch(()=>{});}
}

async function saveCosts(payload={}){
  const itemId=Number(payload.itemId),models=Array.isArray(payload.models)?payload.models:[],rows=Array.isArray(payload.variationCosts)?payload.variationCosts:[];
  const allVariationCosts=models.length>0&&models.every(m=>{const row=rows.find(x=>String(x.modelId)===String(m.modelId));return n(row?.cost)!=null&&n(row.cost)>=0;});
  const base=n(payload.baseCost);
  if(!allVariationCosts&&(base==null||base<0))throw new Error('Informe o custo padrão ou preencha o custo de todas as variações.');
  const jobs=[];
  if(base!=null&&base>=0)jobs.push(gestorApi.saveProductCost({item_id:itemId,model_id:0,cost:base}));
  for(const row of rows){const cost=n(row.cost);if(cost==null||cost<0)continue;jobs.push(gestorApi.saveProductCost({item_id:itemId,model_id:Number(row.modelId),cost}));}
  await Promise.all(jobs);
  if(base!=null&&base>=0){const x=await chrome.storage.local.get(LOCAL_COST_KEY),map=x[LOCAL_COST_KEY]&&typeof x[LOCAL_COST_KEY]==='object'?x[LOCAL_COST_KEY]:{};map[String(itemId)]={cost:base,updatedAt:new Date().toISOString()};await chrome.storage.local.set({[LOCAL_COST_KEY]:map});}
  return{ok:true,baseCost:base,variationCosts:rows,allVariationCosts};
}

async function focusGestor(session={}){
  let tab=null;
  if(session.gestorTabId)tab=await chrome.tabs.get(Number(session.gestorTabId)).catch(()=>null);
  if(!tab){
    const candidates=await chrome.tabs.query({url:['https://shopeeos-real.vercel.app/super-analise*','https://shopeeos-real-greskgja.vercel.app/super-analise*']}).catch(()=>[]);
    tab=candidates[0]||null;
  }
  if(!tab?.id)return false;
  await chrome.tabs.update(tab.id,{active:true}).catch(()=>{});
  if(tab.windowId!=null)await chrome.windows.update(tab.windowId,{focused:true}).catch(()=>{});
  return true;
}
async function notifyPicker(session,message,current=0,total=0){if(!session?.tabId)return;await chrome.tabs.sendMessage(session.tabId,{type:'GS_PICKER_COLLECT_PROGRESS',requestId:session.requestId,message,current,total}).catch(()=>{});}

async function openPicker({title,itemId,gestorTabId}){
  const requestId=crypto.randomUUID(),query=searchQuery(title)||String(title||'').slice(0,80),url=`https://shopee.com.br/search?keyword=${encodeURIComponent(query)}#gs_competitor_picker=${encodeURIComponent(requestId)}&gs_own_item=${encodeURIComponent(itemId)}`;
  await chrome.storage.local.remove([RESULT_KEY,SESSION_KEY]);const tab=await chrome.tabs.create({url,active:true});
  await chrome.storage.local.set({[SESSION_KEY]:{requestId,tabId:tab.id,gestorTabId:Number(gestorTabId)||null,url,createdAt:Date.now(),itemId:String(itemId)}});
  return{requestId,tabId:tab.id,query};
}
async function pickerResult({requestId}){
  const x=await chrome.storage.local.get([RESULT_KEY,SESSION_KEY]),r=x[RESULT_KEY],s=x[SESSION_KEY];
  if(!r||String(r.requestId)!==String(requestId))return{done:false};
  await focusGestor(s||{});
  if(s?.tabId)chrome.tabs.remove(s.tabId).catch(()=>{});
  await chrome.storage.local.remove([RESULT_KEY,SESSION_KEY]);
  return{done:true,cancelled:!!r.cancelled,collected:!!r.collected,items:Array.isArray(r.items)?r.items.slice(0,3):[]};
}
async function reloadPicker({requestId}){const x=await chrome.storage.local.get(SESSION_KEY),s=x[SESSION_KEY];if(!s||String(s.requestId)!==String(requestId))throw new Error('A seleção de concorrentes não está mais ativa.');const tab=await chrome.tabs.get(s.tabId).catch(()=>null);if(tab){await chrome.tabs.reload(s.tabId);return{ok:true};}const t=await chrome.tabs.create({url:s.url,active:true});s.tabId=t.id;await chrome.storage.local.set({[SESSION_KEY]:s});return{ok:true};}

async function deepCompetitor(c){
  if(!c?.link)return c;const tab=await chrome.tabs.create({url:c.link,active:false});
  try{
    await waitTab(tab.id,22000);await wait(700);let last=null;
    for(let i=0;i<16;i++){try{const r=await chrome.tabs.sendMessage(tab.id,{type:'GS_PARSE_COMPETITOR_DEEP',shopId:c.shopId,itemId:c.itemId});if(r?.ok)return{...c,...r,link:c.link,imageUrl:r.imageUrls?.[0]||c.imageUrl||null,source:'manual-shopee-picker+deep'};last=r?.error;}catch(e){last=String(e?.message||e);}await wait(450);}
    try{const fallback=await parseCurrent(tab.id);return{...c,...fallback,link:c.link,imageUrl:fallback.imageUrl||fallback.imageUrls?.[0]||c.imageUrl||null,source:'manual-shopee-picker+fallback',deepError:last||null};}catch(e){return{...c,deepError:last||String(e?.message||e)||'Não foi possível aprofundar a coleta.'};}
  }finally{chrome.tabs.remove(tab.id).catch(()=>{});}
}

async function collectPickerSelection({requestId,items}){
  const selected=Array.isArray(items)?items.slice(0,3):[];
  if(selected.length<1||selected.length>3)throw new Error('Selecione de 1 até 3 concorrentes.');
  const x=await chrome.storage.local.get(SESSION_KEY),session=x[SESSION_KEY];
  if(!session||String(session.requestId)!==String(requestId))throw new Error('A seleção de concorrentes não está mais ativa.');
  const deep=[];
  for(let i=0;i<selected.length;i++){
    const c=selected[i];
    await notifyPicker(session,`Coletando concorrente ${i+1}/${selected.length}: ${String(c?.title||'anúncio').slice(0,80)}…`,i+1,selected.length);
    deep.push(await deepCompetitor(c));
  }
  await notifyPicker(session,'Coleta concluída. Voltando para a Super Análise…',selected.length,selected.length);
  const result={requestId,createdAt:Date.now(),cancelled:false,collected:true,items:deep};
  await chrome.storage.local.set({[RESULT_KEY]:result});
  await focusGestor(session);
  return{...result,pickerTabId:session.tabId};
}

async function cancelPicker(requestId){
  const x=await chrome.storage.local.get(SESSION_KEY),session=x[SESSION_KEY];
  if(!session||String(session.requestId)!==String(requestId))throw new Error('A seleção de concorrentes não está mais ativa.');
  const result={requestId,createdAt:Date.now(),cancelled:true,collected:false,items:[]};
  await chrome.storage.local.set({[RESULT_KEY]:result});
  await focusGestor(session);
  return{...result,pickerTabId:session.tabId};
}

async function analyzeAll(payload={}){
  const p=payload.product;if(!p?.itemId)throw new Error('Produto não carregado.');
  const selected=Array.isArray(payload.competitors)?payload.competitors.slice(0,3):[];
  if(selected.length<1||selected.length>3)throw new Error('Selecione de 1 até 3 concorrentes.');
  const deep=[];
  for(const c of selected){
    const alreadyDeep=Boolean(c?.deepSource||String(c?.source||'').includes('+deep')||String(c?.source||'').includes('+fallback'));
    deep.push(alreadyDeep?c:await deepCompetitor(c));
  }
  const ads={roas:n(payload.ads?.roas),targetRoas:n(payload.ads?.targetRoas),spend:n(payload.ads?.spend),gmv:n(payload.ads?.gmv),costPerSale:n(payload.ads?.costPerSale??payload.ads?.cpa),ctr:n(payload.ads?.ctr),orders:n(payload.ads?.orders)};
  const baseCost=n(payload.baseCost),models=Array.isArray(payload.models)?payload.models:[],variationCosts=Array.isArray(payload.variationCosts)?payload.variationCosts:[];
  const adsCostPerSale=ads.costPerSale??(ads.orders&&ads.spend!=null?ads.spend/ads.orders:0);
  const finance=baseCost!=null&&n(p.price)!=null?computeProfit({price:n(p.price),productCost:baseCost,adsCostPerSale,...DEFAULT_FINANCE}):null;
  const variationMargins=models.map(m=>{const row=variationCosts.find(x=>String(x.modelId)===String(m.modelId));const calc=grossMargin(m.price,row?.cost);return{modelId:m.modelId,name:m.name,price:n(m.price),cost:n(row?.cost),profit:calc.profit,marginPct:calc.marginPct};});
  const analysis=analyze({url:p.url,title:p.title,description:p.description,category:p.category,price:p.price,adsActive:ads.roas!=null||ads.spend!=null,roas7d:ads.roas,roasTarget:ads.targetRoas,adsSpend7d:ads.spend,productCost:baseCost,product:{...p,models,variationCosts,variationMargins},competitors:deep});
  const metrics={visitors:n(p.views??p.viewCount??p.view_count),sales:ads.orders,gmv:ads.gmv,spend:ads.spend,costPerSale:ads.costPerSale,roas:ads.roas,targetRoas:ads.targetRoas,ctr:ads.ctr,sold:n(p.sold),price:n(p.price),marginR:finance?.valid?finance.profit:null,marginPct:finance?.valid?finance.marginPct:null};
  const next=new Date(Date.now()+10*86400000);
  const reportPayload={item_id:Number(p.itemId),analyzed_at:new Date().toISOString(),next_reanalysis_at:next.toISOString(),frequency_days:10,mode:'approve',extension_version:chrome.runtime.getManifest().version,source:'motor-senior',objective:payload.objective||'',situation:payload.situation||'',bottleneck:payload.bottleneck||'',score:analysis.score,product_snapshot:{...p,models,variationCosts,variationMargins},ads_snapshot:{...payload.ads,manual:ads},finance_snapshot:{productCost:baseCost,profit:finance?.valid?finance.profit:null,marginPct:finance?.valid?finance.marginPct:null,breakEvenRoas:finance?.valid?finance.breakEvenRoas:null,variationMargins},competitors:deep,report:{score:analysis.score,summary:analysis.summary,dimensions:analysis.dimensions,lessons:analysis.lessons,priceInsight:analysis.priceInsight,roasStrategy:analysis.roasStrategy},suggestions:{},metrics,schedule_settings:{objective:payload.objective||'',situation:payload.situation||'',bottleneck:payload.bottleneck||''}};
  const saved=await gestorApi.saveAnalysisReport(reportPayload);return{ok:true,reportId:saved?.report?.id||saved?.id||null,itemId:String(p.itemId),score:analysis.score,competitors:deep};
}


async function syncProtectionStates(payload={}){
  const campaignIds=[...new Set((Array.isArray(payload.campaignIds)?payload.campaignIds:[]).map(Number).filter(Number.isSafeInteger))].filter(x=>x>0);
  if(!campaignIds.length){
    const current=await gestorApi.protection().catch(()=>({states:[]}));
    return{checked:0,synced:0,failed:0,states:Array.isArray(current?.states)?current.states:[]};
  }
  let tab=null,created=false;
  const existing=await chrome.tabs.query({url:['https://seller.shopee.com.br/*']}).catch(()=>[]);
  tab=existing.find(t=>t?.id)||null;
  if(!tab){
    tab=await chrome.tabs.create({url:'https://seller.shopee.com.br/portal/marketing/pas',active:false});
    created=true;
  }
  try{
    if(!tab?.id)throw new Error('Não consegui abrir o Seller Center para verificar a Proteção ROAS.');
    await waitTab(tab.id,22000);
    await wait(700);
    const injected=await chrome.scripting.executeScript({
      target:{tabId:tab.id},
      world:'MAIN',
      func:async(ids)=>{
        const rows=[];
        const pageUrl=new URL(location.href);
        const api=new URL('/api/pas/v1/rebate/campaign_get/',location.origin);
        for(const key of ['SPC_CDS','SPC_CDS_VER']){const value=pageUrl.searchParams.get(key);if(value)api.searchParams.set(key,value);}
        const cookieMap=Object.fromEntries(document.cookie.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i>0?[x.slice(0,i),x.slice(i+1)]:[x,''];}));
        const csrf=cookieMap.csrftoken||cookieMap.CSRF_TOKEN||cookieMap._csrf||'';
        for(const campaignId of ids){
          let json=null,statusCode=null,error=null;
          const attempts=[
            {headers:{'content-type':'application/json'},body:JSON.stringify({campaign_id:campaignId})},
            {headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'campaign_id='+encodeURIComponent(campaignId)}
          ];
          for(const attempt of attempts){
            try{
              const headers={accept:'application/json, text/plain, */*',...attempt.headers};
              if(csrf)headers['x-csrftoken']=csrf;
              const response=await fetch(api.href,{method:'POST',credentials:'include',headers,body:attempt.body});
              statusCode=response.status;
              const text=await response.text();
              try{json=JSON.parse(text)}catch{json=null}
              const s=String(json?.data?.rebate_campaign_status||'');
              if(['valid','invalid','unsupported'].includes(s))break;
            }catch(e){error=String(e?.message||e);}
          }
          rows.push({
            campaignId,
            status:String(json?.data?.rebate_campaign_status||''),
            invalidReason:json?.data?.invalid_reason??null,
            totalAmount:json?.data?.total_amount??null,
            httpStatus:statusCode,
            error
          });
        }
        return rows;
      },
      args:[campaignIds]
    });
    const rows=Array.isArray(injected?.[0]?.result)?injected[0].result:[];
    let synced=0;
    for(const row of rows){
      if(!['valid','invalid','unsupported'].includes(String(row?.status||'')))continue;
      try{
        await gestorApi.syncProtection({campaignId:Number(row.campaignId),status:String(row.status),invalidReason:row.invalidReason||null,totalAmount:row.totalAmount??null});
        synced++;
      }catch{}
    }
    const current=await gestorApi.protection().catch(()=>({states:[]}));
    return{checked:campaignIds.length,synced,failed:Math.max(0,campaignIds.length-synced),states:Array.isArray(current?.states)?current.states:[],probe:rows};
  }finally{
    if(created&&tab?.id)chrome.tabs.remove(tab.id).catch(()=>{});
  }
}

async function handleAction(action,payload={}){
  switch(action){
    case'ping':return{ok:true,version:chrome.runtime.getManifest().version};
    case'syncShopeeAds':return{ok:true,data:await gestorApi.ads(Math.max(1,Math.min(90,Number(payload?.days||30))))};
    case'syncProtectionStates':return{ok:true,data:await syncProtectionStates(payload||{})};
    case'collectProduct':return{ok:true,data:await collectProduct(payload?.url)};
    case'saveCosts':return{ok:true,data:await saveCosts(payload)};
    case'openCompetitorPicker':return{ok:true,data:await openPicker(payload||{})};
    case'pickerResult':return{ok:true,data:await pickerResult(payload||{})};
    case'reloadCompetitorPicker':return{ok:true,data:await reloadPicker(payload||{})};
    case'analyzeAll':return{ok:true,data:await analyzeAll(payload||{})};
    default:throw new Error('Ação do Motor Senior não reconhecida.');
  }
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type==='GS_PICKER_COLLECT_REQUEST'){
    collectPickerSelection({requestId:msg.requestId,items:msg.items}).then(result=>{
      sendResponse({ok:true,items:result.items});
      const tabId=result.pickerTabId||sender?.tab?.id;if(tabId)setTimeout(()=>chrome.tabs.remove(tabId).catch(()=>{}),650);
    }).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
    return true;
  }
  if(msg?.type==='GS_PICKER_CANCEL_REQUEST'){
    cancelPicker(msg.requestId).then(result=>{
      sendResponse({ok:true,cancelled:true});
      const tabId=result.pickerTabId||sender?.tab?.id;if(tabId)setTimeout(()=>chrome.tabs.remove(tabId).catch(()=>{}),350);
    }).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
    return true;
  }
});

chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='GS_WEB_ENGINE_PORT')return;
  port.onMessage.addListener(msg=>{
    const requestId=String(msg?.requestId||'');
    const payload={...(msg?.payload||{})};
    if(String(msg?.action||'')==='openCompetitorPicker'&&port.sender?.tab?.id)payload.gestorTabId=port.sender.tab.id;
    handleAction(String(msg?.action||''),payload).then(result=>port.postMessage({requestId,result})).catch(e=>port.postMessage({requestId,result:{ok:false,error:String(e?.message||e)}}));
  });
});