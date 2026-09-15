import {gestorApi} from './src/lib/gestor-api.js';
import {analyze} from './src/lib/super-anuncio-engine.js';
import {computeProfit,DEFAULT_FINANCE} from './src/lib/profit-engine.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const send=m=>chrome.runtime.sendMessage(m);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const money=v=>num(v)==null?'N/A':num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VERSION='0.9.1';
const PENDING_KEY='gsPendingGuidedAuditV1';

const state={step:1,product:null,cached:null,models:[],categories:[],ads:null,costs:[],competitors:[],selected:new Set(),analysis:null,finance:null,suggestions:null,sourceUrl:null};

function toast(text){const t=$('#toast');if(!t)return;t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);}
function openTab(name){document.querySelector(`nav button[data-tab="${name}"]`)?.click();}
function setStep(n){state.step=n;$$('.wizard-step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===n));const dots=$$('#auditSteps span');dots.forEach((x,i)=>{const k=i+1;x.classList.toggle('active',k===n);x.classList.toggle('done',k<n);});}
function resetWizard(){state.step=1;state.product=null;state.cached=null;state.models=[];state.ads=null;state.costs=[];state.competitors=[];state.selected.clear();state.analysis=null;state.finance=null;state.suggestions=null;state.sourceUrl=null;$('#auditUrl').value='';$('#auditLoading').hidden=true;$('#productValidation').hidden=true;$('#step1Next').disabled=true;$('#competitorList').innerHTML='';$('#competitorStatus').classList.remove('searching-status');$('#competitorStatus').textContent='Preparando busca…';$('#finishResult').hidden=true;setStep(1);}

// ----- Theme/settings -----
async function loadTheme(){const x=await chrome.storage.local.get('gsExtTheme');applyTheme(x.gsExtTheme||'dark');}
function applyTheme(theme){document.body.dataset.extTheme=theme;$$('[data-ext-theme]').forEach(b=>b.classList.toggle('active',b.dataset.extTheme===theme));}
$('#settingsBtn').onclick=()=>{$('#settingsPanel').hidden=false;};
$('#closeSettings').onclick=()=>{$('#settingsPanel').hidden=true;};
$('#settingsPanel').addEventListener('click',e=>{if(e.target===$('#settingsPanel'))$('#settingsPanel'].hidden=true;});
$$('[data-ext-theme]').forEach(b=>b.onclick=async()=>{await chrome.storage.local.set({gsExtTheme:b.dataset.extTheme});applyTheme(b.dataset.extTheme);});
loadTheme();

// ----- Helpers -----
function parseIds(url){const s=String(url||'');let m=s.match(/\/product\/(\d+)\/(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};m=s.match(/-i\.(\d+)\.(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};return{shopId:null,itemId:null};}
function validShopeeUrl(value){try{const u=new URL(value);return /(^|\.)shopee\.com\.br$/i.test(u.hostname);}catch{return false;}}
async function waitTab(tabId,timeout=20000){const start=Date.now();while(Date.now()-start<timeout){const t=await chrome.tabs.get(tabId).catch(()=>null);if(!t)throw new Error('A aba temporária foi fechada.');if(t.status==='complete')return t;await wait(350);}throw new Error('A Shopee demorou demais para carregar o anúncio.');}
async function readTabProduct(tabId){let last=null;for(let i=0;i<24;i++){try{const r=await chrome.tabs.sendMessage(tabId,{type:'GS_PARSE_CURRENT_PRODUCT'});if(r?.ok&&r.product?.title)return r.product;last=new Error(r?.error||'Anúncio ainda não disponível.');}catch(e){last=e;}await wait(450);}throw last||new Error('Não consegui ler o anúncio.');}
function productPrice(p){return num(p?.price_info?.[0]?.current_price??p?.price_info?.[0]?.original_price??p?.price);}
function imagesOf(p){return p?.image?.image_url_list||p?.imageUrls||[];}
function stockOf(p){return num(p?.stock_info_v2?.summary_info?.total_available_stock??p?.stock);}
function normalizeCategoryList(raw){
  const roots=raw?.response?.category_list||raw?.category_list||raw?.response?.list||[];const out=[],seen=new Set();
  function walk(x,parent=''){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(v=>walk(v,parent));return;}const id=x.category_id??x.id;const name=x.display_category_name||x.original_category_name||x.category_name||x.name;if(id&&name&&!seen.has(String(id))){seen.add(String(id));const label=parent?`${parent} > ${name}`:String(name);out.push({id:Number(id),name:String(name),label,parentId:num(x.parent_category_id)});for(const key of ['children','child_list','category_list','sub_categories'])if(Array.isArray(x[key]))walk(x[key],label);}else{for(const v of Object.values(x))if(Array.isArray(v))walk(v,parent);}}
  walk(roots);
  if(out.length&&out.some(x=>x.parentId)){const map=new Map(out.map(x=>[x.id,x]));for(const row of out){const parts=[row.name];let p=map.get(row.parentId),guard=0;while(p&&guard++<8){parts.unshift(p.name);p=map.get(p.parentId);}row.label=parts.join(' > ');}}
  return out.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
}
function normalizeModels(raw){const list=raw?.response?.model||raw?.response?.model_list||raw?.model||raw?.models||[];return(Array.isArray(list)?list:[]).map((m,i)=>({modelId:num(m.model_id??m.id),name:m.model_name||m.name||m.model_sku||`Variação ${i+1}`,sku:m.model_sku||'',price:num(m.price_info?.current_price??m.price),stock:num(m.stock_info_v2?.summary_info?.total_available_stock??m.stock_info?.normal_stock??m.stock)})).filter(x=>x.modelId!=null);}
function sumModelStock(models){const values=(models||[]).map(m=>num(m.stock)).filter(v=>v!=null);return values.length?values.reduce((a,b)=>a+b,0):null;}
function categoryName(id){return state.categories.find(x=>String(x.id)===String(id))?.label||`Categoria ${id||'não identificada'}`;}
function campaignForItem(ads,itemId){const v=ads?.v7||ads?.v5||ads||{};return(v.campaigns||[]).find(c=>String(c.itemId??c.item_id)===String(itemId))||null;}

async function collectFromLink(url){
  const tab=await chrome.tabs.create({url,active:false});
  try{
    await waitTab(tab.id);await wait(450);const dom=await readTabProduct(tab.id);const finalTab=await chrome.tabs.get(tab.id),ids={...parseIds(finalTab.url),...parseIds(dom.url)};const itemId=dom.itemId||ids.itemId;if(!itemId)throw new Error('Não consegui identificar o ID do produto.');
    const [products,cats,pub]=await Promise.all([gestorApi.products(),gestorApi.categories().catch(()=>null),gestorApi.publicProduct(itemId).catch(()=>null)]);
    const cached=(products.items||[]).find(x=>String(x.item_id)===String(itemId));if(!cached)throw new Error('O produto não foi encontrado na loja conectada ao Gestor Sênior.');
    state.categories=normalizeCategoryList(cats);state.cached=cached;
    let models=[];if(cached.has_model)models=normalizeModels(await gestorApi.models(itemId).catch(()=>null));state.models=models;
    const publicRow=pub?.results?.find(x=>String(x.item_id)===String(itemId)&&x.ok)||null;
    const imgs=imagesOf(cached),categoryId=cached.category_id,modelStock=sumModelStock(models);
    const product={...dom,url:finalTab.url||url,itemId:String(itemId),shopId:ids.shopId,title:cached.item_name||dom.title,description:cached.description||dom.description||'',categoryId,category:categoryName(categoryId),imageUrls:imgs.length?imgs:dom.imageUrls||[],imageUrl:imgs[0]||dom.imageUrl||null,imageCount:imgs.length||dom.imageCount||0,hasVideo:Boolean(dom.hasVideo||cached.video_info),rating:num(publicRow?.rating)??num(dom.rating),reviewCount:num(publicRow?.reviewCount)??num(dom.reviewCount),sold:num(dom.sold)??num(publicRow?.historicalSold),stock:modelStock??num(publicRow?.stock)??stockOf(cached)??num(dom.stock),attributesCount:Array.isArray(cached.attribute_list)?cached.attribute_list.length:0,variationCount:models.length,price:productPrice(cached)??num(publicRow?.price)??num(dom.price),priceBeforeDiscount:num(publicRow?.priceBeforeDiscount)??num(cached.price_info?.[0]?.original_price)};
    return product;
  }finally{chrome.tabs.remove(tab.id).catch(()=>{});}
}

function renderProductValidation(p){
  const val=(v,suffix='')=>v===null||v===undefined||v===''?'N/A':`${v}${suffix}`;
  $('#productValidation').innerHTML=`<div class="product-check"><div class="product-check-head">${p.imageUrl?`<img src="${esc(p.imageUrl)}" alt="">`:''}<div><strong>${esc(p.title)}</strong><small>ID ${esc(p.itemId)} · ${esc(p.category)}</small></div></div><div class="validation-grid"><div><span>Categoria oficial</span><b>${esc(p.category)}</b></div><div><span>Imagens</span><b>${val(p.imageCount)}</b></div><div><span>Vídeo</span><b>${p.hasVideo?'Sim':'Não'}</b></div><div><span>Avaliação</span><b>${val(p.rating,' ★')}</b></div><div><span>Qtd. avaliações</span><b>${val(p.reviewCount)}</b></div><div><span>Itens vendidos</span><b>${val(p.sold)}</b></div><div><span>Estoque</span><b>${val(p.stock)}</b></div><div><span>Variações</span><b>${val(p.variationCount)}</b></div><div><span>Preço</span><b>${money(p.price)}</b></div><div><span>Preço anterior</span><b>${money(p.priceBeforeDiscount)}</b></div></div><div class="description-preview"><b>Descrição:</b><br>${esc((p.description||'Sem descrição identificada.').slice(0,700))}${(p.description||'').length>700?'…':''}</div></div>`;
  $('#productValidation').hidden=false;$('#step1Next').disabled=false;
}

async function startAudit(url){
  if(!validShopeeUrl(url))return toast('Cole um link válido da Shopee Brasil.');
  const b=$('#startAudit');b.disabled=true;$('#productValidation').hidden=true;$('#step1Next').disabled=true;$('#auditLoading').hidden=false;
  try{state.sourceUrl=url;state.product=await collectFromLink(url);renderProductValidation(state.product);}
  catch(e){toast(String(e?.message||e));}
  finally{$('#auditLoading').hidden=true;b.disabled=false;}
}

async function loadAdsAndCosts(){
  const p=state.product;$('#adsAutoStatus').textContent='Buscando…';
  const [ads,costData]=await Promise.all([gestorApi.ads(7).catch(()=>null),gestorApi.productCosts().catch(()=>({costs:[]}))]);
  state.ads=campaignForItem(ads,p.itemId);state.costs=costData.costs||[];
  if(state.ads){$('#auditRoas').value=num(state.ads.roas)??'';$('#auditTargetRoas').value=num(state.ads.targetRoas)??'';$('#auditSpend').value=num(state.ads.spend)??'';$('#adsAutoStatus').textContent='Automático';}
  else{$('#auditRoas').value='';$('#auditTargetRoas').value='';$('#auditSpend').value='';$('#adsAutoStatus').textContent='Preenchimento manual';}
  const base=state.costs.find(x=>String(x.item_id)===String(p.itemId)&&Number(x.model_id)===0);$('#auditBaseCost').value=base?.cost??'';
  const box=$('#variationCosts');if(!state.models.length){box.innerHTML='<small class="muted">Este anúncio não possui variações cadastradas.</small>';return;}
  box.innerHTML=`<div class="variation-costs"><b>Custos por variação</b><small class="muted">Se ficar vazio, o cálculo usa o custo padrão acima.</small>${state.models.map(m=>{const row=state.costs.find(x=>String(x.item_id)===String(p.itemId)&&String(x.model_id)===String(m.modelId));return`<div class="variation-row"><div><strong>${esc(m.name)}</strong><small>${m.sku?`SKU ${esc(m.sku)} · `:''}${m.stock==null?'estoque N/A':`estoque ${m.stock}`}</small></div><label>R$<input data-model-cost="${m.modelId}" type="number" min="0" step="0.01" value="${row?.cost??''}" placeholder="padrão"></label></div>`}).join('')}</div>`;
}

async function saveCosts(){
  const base=num($('#auditBaseCost').value);if(base==null||base<0)throw new Error('Informe o custo unitário do produto para calcular a margem com segurança.');
  await Promise.all([gestorApi.saveProductCost({item_id:Number(state.product.itemId),model_id:0,cost:base}),send({type:'GS_SAVE_COST',itemId:state.product.itemId,cost:base})]);
  for(const input of $$('[data-model-cost]')){const cost=num(input.value);if(cost==null)continue;await gestorApi.saveProductCost({item_id:Number(state.product.itemId),model_id:Number(input.dataset.modelCost),cost});}
  return base;
}

async function loadCompetitors(){
  const status=$('#competitorStatus');status.classList.add('searching-status');status.textContent='Pesquisando pelo título do anúncio e cruzando com a Shopee…';$('#competitorList').innerHTML='';state.selected.clear();$('#step3Next').disabled=true;
  let server=null,fallback=null,items=[];
  try{server=await gestorApi.competitors(state.product.itemId);items=(server?.competitors||[]).map(c=>({...c,imageUrl:c.imageUrl||c.image,link:c.link||c.url,reviewCount:c.reviewCount??c.reviews,source:'gestor-search'}));}catch{}
  if(items.length<3){try{fallback=await send({type:'GS_SEARCH_COMPETITORS',title:state.product.title,ownItemId:state.product.itemId});if(fallback?.ok){const seen=new Set(items.map(x=>String(x.itemId)));for(const c of fallback.items||[]){if(!seen.has(String(c.itemId))){seen.add(String(c.itemId));items.push(c);}}}}catch{}}
  state.competitors=items.slice(0,16);status.classList.remove('searching-status');
  const liveCount=server?.competitors?.length||0,localCount=fallback?.source?.indexed||0;status.textContent=`${state.competitors.length} candidato(s) encontrado(s) · busca Shopee ${liveCount} · base local ${localCount}`;
  if(!state.competitors.length){const detail=server?.attempts?.map(a=>`${a.query}: ${a.ok?a.count+' resultado(s)':a.error}`).join(' · ');$('#competitorList').innerHTML=`<div class="empty">Nenhum concorrente foi retornado automaticamente.${detail?`<br><small>${esc(detail)}</small>`:''}</div>`;return;}
  $('#competitorList').innerHTML=state.competitors.map((c,i)=>`<label class="competitor" data-comp="${i}"><input type="checkbox" value="${i}">${c.imageUrl?`<img src="${esc(c.imageUrl)}" alt="">`:'<span></span>'}<div><strong>${esc(c.title||'Produto')}</strong><small>${money(c.price)}${num(c.rating)!=null?` · ${num(c.rating).toFixed(1)}★`:''}${num(c.sold)!=null?` · ${c.sold} vendidos`:''}</small></div></label>`).join('');
  $$('#competitorList input').forEach(input=>input.onchange=()=>{const i=Number(input.value);if(input.checked&&state.selected.size>=3){input.checked=false;toast('Selecione no máximo 3 concorrentes.');return;}input.checked?state.selected.add(i):state.selected.delete(i);input.closest('.competitor').classList.toggle('selected',input.checked);$('#step3Next').disabled=state.selected.size===0;status.textContent=`${state.selected.size}/3 selecionado(s)`;});
}

function selectedCompetitors(){return[...state.selected].map(i=>state.competitors[i]).filter(Boolean);}
function currentAdsInput(){return{roas:num($('#auditRoas').value),targetRoas:num($('#auditTargetRoas').value),spend:num($('#auditSpend').value)};}
function categoryOptions(selected){return state.categories.map(c=>`<option value="${c.id}" ${String(c.id)===String(selected)?'selected':''}>${esc(c.label)}</option>`).join('');}

function generateRayX(){
  const p=state.product,ads=currentAdsInput(),cost=num($('#auditBaseCost').value),comps=selectedCompetitors();
  const input={url:p.url,title:p.title,description:p.description,category:p.category,price:p.price,adsActive:ads.roas!=null||ads.spend!=null,roas7d:ads.roas,roasTarget:ads.targetRoas,adsSpend7d:ads.spend,productCost:cost,product:p,competitors:comps};
  state.analysis=analyze(input);
  const campaignOrders=num(state.ads?.orders),cpa=campaignOrders&&ads.spend!=null?ads.spend/campaignOrders:0;
  state.finance=computeProfit({price:p.price,productCost:cost,adsCostPerSale:cpa,...DEFAULT_FINANCE});
  state.suggestions={title:state.analysis.optimizedTitle,description:state.analysis.optimizedDescription,categoryId:p.categoryId,category:p.category};
  $('#raySummary').innerHTML=`<div class="ray-top"><div><div class="gauge" style="--score:${state.analysis.score}"></div><div class="gauge-score">${state.analysis.score}/100</div></div><div><h3>${esc(state.analysis.summary)}</h3><p>${comps.length} concorrente(s) confirmado(s) · margem estimada ${state.finance.valid?`${state.finance.marginPct.toFixed(1)}% / ${money(state.finance.profit)}`:'N/A'} · ROAS ${ads.roas==null?'N/A':ads.roas.toFixed(2)}</p></div></div>`;
  $('#rayDimensions').innerHTML=`<div class="dimension-accordion">${(state.analysis.dimensions||[]).map(d=>`<details><summary><b>${esc(d.name)}</b><span>${d.score}/${d.maxScore}</span></summary><div class="dim-body"><b>Diagnóstico:</b> ${esc(d.reason)}<br><br><b>Ação:</b> ${esc(d.action)}</div></details>`).join('')}</div>`;
  $('#beforeAfter').innerHTML=`<div class="before-after"><h3>Como era × Como vai ficar</h3>
    <div class="ba-card"><div class="ba-head"><b>Título</b><span class="pill">sugestão</span></div><div class="ba-cols"><div class="ba-col"><small>COMO ERA</small><p>${esc(p.title)}</p></div><div class="ba-col"><small>COMO VAI FICAR</small><p id="suggestTitleText">${esc(state.suggestions.title)}</p></div></div><div class="ba-actions"><button data-copy-suggestion="title">Copiar</button><button class="primary" data-approve-suggestion="title">Aplicar Sugestão</button></div></div>
    <div class="ba-card"><div class="ba-head"><b>Descrição</b><span class="pill">sugestão</span></div><div class="ba-cols"><div class="ba-col"><small>COMO ERA</small><p>${esc((p.description||'').slice(0,900))}</p></div><div class="ba-col"><small>COMO VAI FICAR</small><p id="suggestDescriptionText">${esc((state.suggestions.description||'').slice(0,1200))}</p></div></div><div class="ba-actions"><button data-copy-suggestion="description">Copiar</button><button class="primary" data-approve-suggestion="description">Aplicar Sugestão</button></div></div>
    <div class="ba-card"><div class="ba-head"><b>Categoria Shopee</b><span class="pill">oficial</span></div><div class="ba-cols"><div class="ba-col"><small>COMO ERA</small><p>${esc(p.category)}</p></div><div class="ba-col"><small>COMO VAI FICAR</small><select id="suggestCategory">${categoryOptions(p.categoryId)}</select></div></div><div class="ba-actions"><button class="primary" data-approve-suggestion="category">Aplicar Sugestão</button></div></div>
    <div class="write-warning">A edição direta de título, descrição e categoria ainda não foi liberada: o Gestor não possui um endpoint Shopee de escrita validado para esses campos. O botão salva/aprova a sugestão e copia o conteúdo, sem alterar o anúncio silenciosamente.</div></div>`;
  $$('[data-copy-suggestion]').forEach(b=>b.onclick=()=>{const key=b.dataset.copySuggestion,value=key==='title'?state.suggestions.title:state.suggestions.description;navigator.clipboard.writeText(value||'').then(()=>toast('Sugestão copiada.'));});
  $$('[data-approve-suggestion]').forEach(b=>b.onclick=()=>{const key=b.dataset.approveSuggestion;if(key==='category'){const id=$('#suggestCategory').value;const c=state.categories.find(x=>String(x.id)===String(id));state.suggestions.categoryId=Number(id);state.suggestions.category=c?.label||p.category;}const value=key==='title'?state.suggestions.title:key==='description'?state.suggestions.description:state.suggestions.category;navigator.clipboard.writeText(String(value||'')).catch(()=>{});b.textContent='✓ Sugestão aprovada';toast('Sugestão salva para o relatório. A edição direta na Shopee permanece bloqueada por segurança.');});
}

function finishPreview(){const next=new Date(Date.now()+10*86400000);$('#finishPreview').innerHTML=`<div class="finish-card"><b>Auditoria pronta para salvar</b><p>Nota ${state.analysis?.score??'—'}/100. O relatório completo, os concorrentes selecionados, dados de Ads, custo e diagnóstico serão enviados para o histórico do Gestor Sênior.</p></div><div class="card compact-card"><div class="row"><span>Próxima reanálise sugerida</span><b>${next.toLocaleDateString('pt-BR')}</b></div><div class="row"><span>Frequência padrão</span><b>10 dias</b></div></div>`;}

async function finalizeAudit(){
  const btn=$('#finishAudit');btn.disabled=true;btn.textContent='Sincronizando…';
  try{
    const p=state.product,ads=currentAdsInput(),selected=selectedCompetitors(),cost=await saveCosts(),schedule=$('#scheduleTenDays').checked,next=schedule?new Date(Date.now()+10*86400000):null;
    const orders=num(state.ads?.orders),metrics={visitors:num(p.views??p.viewCount??p.view_count),sales:orders,gmv:num(state.ads?.gmv),spend:ads.spend,roas:ads.roas,targetRoas:ads.targetRoas,ctr:num(state.ads?.ctr),sold:num(p.sold),price:num(p.price),marginR:state.finance?.valid?state.finance.profit:null,marginPct:state.finance?.valid?state.finance.marginPct:null};
    const payload={item_id:Number(p.itemId),analyzed_at:new Date().toISOString(),next_reanalysis_at:next?.toISOString()||null,frequency_days:10,mode:'approve',extension_version:VERSION,source:'chrome-extension-guided',objective:$('#auditObjective').selectedOptions[0]?.textContent||$('#auditObjective').value,situation:$('#auditSituation').selectedOptions[0]?.textContent||$('#auditSituation').value,bottleneck:$('#auditBottleneck').selectedOptions[0]?.textContent||$('#auditBottleneck').value,score:state.analysis.score,product_snapshot:{...p,variationCosts:$$('[data-model-cost]').map(x=>({modelId:Number(x.dataset.modelCost),cost:num(x.value)})).filter(x=>x.cost!=null)},ads_snapshot:{...state.ads,manual:{...ads}},finance_snapshot:{productCost:cost,profit:state.finance?.profit??null,marginPct:state.finance?.marginPct??null,breakEvenRoas:state.finance?.breakEvenRoas??null},competitors:selected.slice(0,3),report:{score:state.analysis.score,summary:state.analysis.summary,dimensions:state.analysis.dimensions,lessons:state.analysis.lessons,priceInsight:state.analysis.priceInsight,roasStrategy:state.analysis.roasStrategy},suggestions:{title:state.suggestions.title,description:state.suggestions.description,category:state.suggestions.category,categoryId:state.suggestions.categoryId},metrics,schedule_settings:{objective:$('#auditObjective').value,situation:$('#auditSituation').value,bottleneck:$('#auditBottleneck').value}};
    const saved=await gestorApi.saveAnalysisReport(payload);
    if(schedule){await send({type:'GS_CREATE_JOB',job:{itemId:p.itemId,title:p.title,url:p.url,frequencyDays:10,policy:{enabled:true,mode:'approve',maxRoasChangePct:10,allowRoas:true,allowBudget:true,allowProtectionReset:false,allowPrice:true,allowTitle:true,allowDescription:true,scheduledLiveCompetitors:true,rollbackOnWorsePerformance:true,finance:{minMarginPct:20,minProfit:8,maxWeeklyAdsSpend:300}}}});await chrome.notifications.create({type:'basic',iconUrl:chrome.runtime.getURL('icons/icon128.png'),title:'Gestor Sênior — Reanálise agendada',message:`${p.title.slice(0,60)} será reavaliado em 10 dias.`}).catch(()=>{});}
    $('#finishResult').hidden=false;$('#finishResult').innerHTML=`<div class="finish-card"><b>✓ Super Análise concluída</b><p>Relatório ${esc(saved.report?.id||'')} sincronizado com o Gestor Sênior${schedule?' e reanálise de 10 dias agendada.':'.'}</p><a class="primary big analysis-link" target="_blank" href="https://shopeeos-real-greskgja.vercel.app/extensao-shopee-intelligence">Abrir histórico no Gestor</a></div>`;
    $('#homeLast').innerHTML=`<b>${esc(p.title)}</b><br>Nota ${state.analysis.score}/100 · ${selected.length} concorrente(s) · sincronizado`;
    refreshManager().catch(()=>{});toast('Análise salva no Gestor Sênior.');
  }catch(e){toast(String(e?.message||e));}finally{btn.disabled=false;btn.textContent='✓ Concluir e sincronizar com o Gestor';}
}

// ----- Manager -----
async function refreshManager(){
  const box=$('#analysisManagerList');box.innerHTML='<div class="empty">Atualizando histórico central…</div>';
  try{const data=await gestorApi.analysisReports(),reports=data.reports||[],schedules=data.schedules||[],groups=new Map();for(const r of reports){const k=String(r.item_id);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}const items=[...groups.entries()].map(([itemId,h])=>({itemId,latest:h[0],history:h,schedule:schedules.find(s=>String(s.item_id)===itemId)}));const avg=items.length?items.reduce((s,x)=>s+(num(x.latest.score)||0),0)/items.length:null,due=schedules.filter(s=>s.enabled&&s.next_run_at&&new Date(s.next_run_at)<=new Date(Date.now()+3*86400000)).length;$('#mgrProducts').textContent=items.length;$('#mgrSchedules').textContent=schedules.filter(s=>s.enabled).length;$('#mgrDue').textContent=due;$('#mgrScore').textContent=avg==null?'—':avg.toFixed(1);
    if(!items.length){box.innerHTML='<div class="empty">Nenhuma Super Análise concluída ainda.</div>';return;}
    box.innerHTML=items.map(x=>{const r=x.latest,p=r.product_snapshot||{},m=r.metrics||{},f=r.finance_snapshot||{},sch=x.schedule;return`<div class="manager-item" data-manager-item="${x.itemId}"><div class="manager-item-head"><div><h3>${esc(p.title||p.item_name||`Produto ${x.itemId}`)}</h3><div class="manager-status">Última análise ${new Date(r.analyzed_at).toLocaleString('pt-BR')} · ${x.history.length} relatório(s)</div></div><b>${r.score??'—'}/100</b></div><div class="metrics"><div><span>Visitantes</span><b>${num(m.visitors)==null?'sem dados':m.visitors}</b></div><div><span>Vendas</span><b>${num(m.sales)==null?'sem dados':m.sales}</b></div><div><span>GMV</span><b>${money(m.gmv)}</b></div><div><span>Gasto Ads</span><b>${money(m.spend)}</b></div><div><span>ROAS</span><b>${num(m.roas)==null?'N/A':num(m.roas).toFixed(2)}</b></div><div><span>Margem</span><b>${num(f.marginPct??m.marginPct)==null?'N/A':`${num(f.marginPct??m.marginPct).toFixed(1)}% · ${money(f.profit??m.marginR)}`}</b></div></div><div class="schedule-controls"><select data-freq><option value="3" ${sch?.frequency_days===3?'selected':''}>3 dias</option><option value="7" ${sch?.frequency_days===7?'selected':''}>7 dias</option><option value="10" ${!sch||sch?.frequency_days===10?'selected':''}>10 dias</option><option value="14" ${sch?.frequency_days===14?'selected':''}>14 dias</option><option value="30" ${sch?.frequency_days===30?'selected':''}>30 dias</option></select><button data-save-schedule class="primary">${sch?.enabled?'Atualizar':'Ativar'} reanálise</button></div>${sch?.enabled?`<div class="manager-status">Próxima: ${sch.next_run_at?new Date(sch.next_run_at).toLocaleString('pt-BR'):'—'} · ${sch.mode==='automatic'?'Ads automático':'aprovação'}</div>`:''}</div>`}).join('');
    box.querySelectorAll('[data-save-schedule]').forEach(b=>b.onclick=async()=>{const card=b.closest('[data-manager-item]'),itemId=card.dataset.managerItem,freq=Number(card.querySelector('[data-freq]').value),x=items.find(i=>i.itemId===itemId),p=x.latest.product_snapshot||{};b.disabled=true;try{await gestorApi.saveSchedule({item_id:Number(itemId),title:p.title||p.item_name,product_url:p.url,frequency_days:freq,mode:'approve',enabled:true});await send({type:'GS_CREATE_JOB',job:{itemId,title:p.title||p.item_name,url:p.url||'',frequencyDays:freq,policy:{enabled:true,mode:'approve',allowRoas:true,allowPrice:true,allowTitle:true,allowDescription:true,scheduledLiveCompetitors:true,rollbackOnWorsePerformance:true,finance:{minMarginPct:20,minProfit:8,maxWeeklyAdsSpend:300}}}});toast('Reanálise atualizada.');refreshManager();}catch(e){toast(String(e?.message||e));}finally{b.disabled=false;}});
  }catch(e){box.innerHTML=`<div class="empty">${esc(String(e?.message||e))}</div>`;}
}

// ----- Event wiring -----
$('#homeAnalyze').onclick=()=>{openTab('analyze');resetWizard();};
$('#resetWizard').onclick=resetWizard;
$('#startAudit').onclick=()=>startAudit($('#auditUrl').value.trim());
$('#step1Next').onclick=async()=>{setStep(2);try{await loadAdsAndCosts();}catch(e){toast(String(e?.message||e));}};
$$('[data-back]').forEach(b=>b.onclick=()=>setStep(Number(b.dataset.back)));
$('#step2Next').onclick=async()=>{try{await saveCosts();setStep(3);await loadCompetitors();}catch(e){$('#competitorStatus').classList.remove('searching-status');toast(String(e?.message||e));}};
$('#step3Next').onclick=()=>{try{generateRayX();setStep(4);}catch(e){toast(String(e?.message||e));}};
$('#step4Next').onclick=()=>{finishPreview();setStep(5);};
$('#finishAudit').onclick=finalizeAudit;
$('#refreshAnalysisManager').onclick=()=>refreshManager();
document.querySelector('nav button[data-tab="auto"]')?.addEventListener('click',()=>setTimeout(()=>refreshManager(),50));

async function consumePendingAudit(){
  try{const x=await chrome.storage.local.get(PENDING_KEY),p=x[PENDING_KEY];if(!p?.url)return;if(Date.now()-Number(p.createdAt||0)>120000){await chrome.storage.local.remove(PENDING_KEY);return;}await chrome.storage.local.remove(PENDING_KEY);openTab('analyze');resetWizard();$('#auditUrl').value=p.url;await wait(80);startAudit(p.url);}catch(e){console.warn('GS pending audit',e)}
}
resetWizard();
consumePendingAudit();
