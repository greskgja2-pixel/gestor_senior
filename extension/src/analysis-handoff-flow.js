import { gestorApi, getSettings } from './lib/gestor-api.js';

const DEEP_KEY='gsCompetitorDeepProfilesV1';
const VERSION='0.13.0';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>finite(v)==null?'—':finite(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

function toast(text){const t=$('#toast');if(!t)return;t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3600);}
function numText(raw){const s=String(raw??'').trim().replace(/[^\d,.-]/g,'');if(!s)return null;let n;if(s.includes(',')&&s.includes('.'))n=Number(s.replace(/\./g,'').replace(',','.'));else if(s.includes(','))n=Number(s.replace(',','.'));else n=Number(s);return Number.isFinite(n)?n:null;}
function cellValue(label){const target=String(label).toLowerCase();const cell=[...document.querySelectorAll('#productValidation .validation-grid > div')].find(x=>String(x.querySelector('span')?.textContent||'').trim().toLowerCase()===target);return cell?.querySelector('b')?.textContent?.trim()||'';}
function currentItemId(){const text=$('#productValidation')?.textContent||'';return text.match(/\bID\s+(\d{6,})\b/i)?.[1]||null;}
function currentTitle(){return $('#productValidation .product-check-head strong')?.textContent?.trim()||'';}
function currentDescription(){return ($('#productValidation .description-preview')?.textContent||'').replace(/^Descrição:\s*/i,'').trim();}
function activateStep(n){$$('.wizard-step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===n));const dots=$$('#auditSteps span');dots.forEach((x,i)=>{const k=i+1;x.classList.toggle('active',k===n);x.classList.toggle('done',k<n);});}

function injectStyles(){
  if($('#gsAnalysisHandoffStyle'))return;
  const style=document.createElement('style');style.id='gsAnalysisHandoffStyle';style.textContent=`
    #tab-analyze{--gs-gap:14px}.wizard-step{padding-top:10px}.wizard-head{gap:14px}.step-title{margin-bottom:14px}
    .gs-help{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:5px;border:1px solid #7890a9;border-radius:50%;font-size:11px;font-weight:900;color:#7ea1c4;cursor:help;vertical-align:middle}
    .gs-flow-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:12px 0}.gs-flow-card{border:1px solid var(--wizard-line);border-radius:12px;padding:12px;background:var(--wizard-card);min-width:0}.gs-flow-card small{display:block;color:var(--wizard-muted);margin-bottom:5px}.gs-flow-card b{display:block;overflow-wrap:anywhere}.gs-flow-card .ok{color:#27ae60}.gs-flow-card .warn{color:#d69b28}
    .gs-handoff-banner{border:1px solid #3977bd55;background:#2466b31a;border-radius:12px;padding:12px;margin:10px 0;line-height:1.45}.gs-handoff-banner b{display:block;margin-bottom:4px}.gs-handoff-banner small{color:var(--wizard-muted)}
    .gs-competitor-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;margin:12px 0}.gs-comp-card{display:grid;grid-template-columns:52px 1fr;gap:9px;align-items:start;border:1px solid var(--wizard-line);border-radius:12px;padding:10px;background:var(--wizard-card)}.gs-comp-card img{width:52px;height:52px;object-fit:cover;border-radius:8px}.gs-comp-card strong{font-size:11px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.gs-comp-card small{display:block;color:var(--wizard-muted);margin-top:4px;line-height:1.35}
    .gs-cost-ok{border:1px solid #2db56d66;background:#1f9d5b16;border-radius:10px;padding:10px;margin:8px 0;color:#35b975}.gs-base-hidden{display:none!important}.variation-costs{margin-top:8px}.variation-row{gap:12px}
    #step4Next{min-width:180px}.gs-analysis-result{border:1px solid #2db56d66;background:#1f9d5b14;border-radius:13px;padding:14px;margin:12px 0}.gs-analysis-result a{display:block;text-align:center;text-decoration:none;margin-top:10px}
    @media(min-width:620px){#tab-analyze .grid3{grid-template-columns:repeat(3,minmax(0,1fr))}.product-check .validation-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
  `;document.head.appendChild(style);
}
function addHelp(anchor,text){if(!anchor||anchor.querySelector?.('.gs-help'))return;const h=document.createElement('span');h.className='gs-help';h.textContent='?';h.title=text;h.setAttribute('aria-label',text);anchor.appendChild(h);}
function installHelp(){
  const step2=$('.wizard-step[data-step="2"]');if(step2){const labels=[...step2.querySelectorAll(':scope > label')];addHelp(labels[0],'Define o que a análise deve priorizar: vendas, margem, Ads, visibilidade ou validação do produto.');addHelp(labels[1],'Contextualiza o momento do anúncio para a IA não tratar um produto novo como um produto já maduro.');addHelp(labels[2],'Ajuda a IA a investigar primeiro o problema que você percebe. Se não souber, escolha “Não sei”.');addHelp(step2.querySelector('.compact-card .row'),'ROAS e gasto são buscados automaticamente. Você pode corrigir manualmente se necessário.');}
  const step3=$('.wizard-step[data-step="3"] .step-title');addHelp(step3,'Escolha exatamente 3 anúncios realmente comparáveis. Depois a extensão abre cada um em segundo plano e coleta os dados necessários.');
  const step4=$('.wizard-step[data-step="4"] .step-title');addHelp(step4,'“Analisar Tudo” envia os dados brutos para o Gestor Sênior. As sugestões do Gemini serão exibidas no site, não na extensão.');
}

function variationRows(){return $$('[data-model-cost]').map(input=>{const row=input.closest('.variation-row');const name=row?.querySelector('strong')?.textContent?.trim()||`Variação ${input.dataset.modelCost}`;const stock=numText(row?.querySelector('small')?.textContent?.match(/estoque\s+([\d.,]+)/i)?.[1]);return{input,modelId:Number(input.dataset.modelCost),name,cost:finite(input.value),stock};});}
function referenceCost(rows){const valid=rows.filter(x=>x.cost!=null);if(!valid.length)return null;const weighted=valid.filter(x=>x.stock!=null&&x.stock>0);if(weighted.length===valid.length){const total=weighted.reduce((s,x)=>s+x.stock,0);return total?weighted.reduce((s,x)=>s+x.cost*x.stock,0)/total:null;}return valid.reduce((s,x)=>s+x.cost,0)/valid.length;}
function refreshCostMode(){
  const base=$('#auditBaseCost');if(!base)return;
  const baseLabel=base.closest('label'),box=$('#variationCosts');const rows=variationRows();
  let note=$('#gsVariationCostMode');if(note)note.remove();
  const complete=rows.length>0&&rows.every(x=>x.cost!=null&&x.cost>=0);
  if(complete){const ref=referenceCost(rows);if(ref!=null)base.value=ref.toFixed(2);baseLabel?.classList.add('gs-base-hidden');note=document.createElement('div');note.id='gsVariationCostMode';note.className='gs-cost-ok';note.innerHTML=`✓ Custos das ${rows.length} variações já estão preenchidos. <b>Não é necessário informar custo unitário padrão.</b><br><small>O Gestor usará o custo exato de cada variação. Um custo de referência é calculado apenas para compatibilidade com rotinas antigas.</small>`;box?.prepend(note);}else{baseLabel?.classList.remove('gs-base-hidden');if(rows.length){note=document.createElement('div');note.id='gsVariationCostMode';note.className='muted';note.style.margin='8px 0';note.textContent='Algumas variações estão sem custo. O custo unitário padrão será usado somente como fallback para elas.';box?.prepend(note);}}
}
function validateCosts(){const rows=variationRows();const complete=rows.length>0&&rows.every(x=>x.cost!=null&&x.cost>=0);const base=finite($('#auditBaseCost')?.value);if(complete)return true;if(base==null||base<0){toast(rows.length?'Preencha o custo das variações ou informe um custo padrão para as que estiverem vazias.':'Informe o custo unitário do produto.');return false;}return true;}
async function persistCosts(){const itemId=Number(currentItemId());if(!itemId)return;const rows=variationRows();const base=finite($('#auditBaseCost')?.value);const jobs=[];if(base!=null&&base>=0)jobs.push(gestorApi.saveProductCost({item_id:itemId,model_id:0,cost:base}));for(const r of rows)if(r.cost!=null&&r.cost>=0)jobs.push(gestorApi.saveProductCost({item_id:itemId,model_id:r.modelId,cost:r.cost}));await Promise.allSettled(jobs);}

async function waitTab(tabId,timeout=24000){const start=Date.now();while(Date.now()-start<timeout){const t=await chrome.tabs.get(tabId).catch(()=>null);if(!t)throw new Error('A aba de coleta foi fechada.');if(t.status==='complete')return t;await wait(350);}throw new Error('A Shopee demorou demais para carregar.');}
async function readDeep(tabId,item={}){let last=null;for(let i=0;i<20;i++){try{const r=await chrome.tabs.sendMessage(tabId,{type:'GS_PARSE_COMPETITOR_DEEP',itemId:item.itemId,shopId:item.shopId});if(r?.ok)return r;last=new Error(r?.error||'Dados ainda indisponíveis.');}catch(e){last=e;}await wait(450);}throw last||new Error('Não consegui coletar o anúncio.');}
async function collectDeepUrl(url,item={}){const tab=await chrome.tabs.create({url,active:false});try{await waitTab(tab.id);await wait(550);return await readDeep(tab.id,item);}finally{await chrome.tabs.remove(tab.id).catch(()=>{});}}
async function ownDeepSnapshot(){const url=$('#auditUrl')?.value?.trim();if(!url)throw new Error('Link do anúncio não encontrado.');return collectDeepUrl(url,{itemId:currentItemId()});}
async function competitorDeepSnapshots(){const stored=await chrome.storage.local.get(DEEP_KEY),box=stored?.[DEEP_KEY];let items=Array.isArray(box?.items)?box.items.slice(0,3):[];for(let i=0;i<items.length;i++){if(items[i]?.deepCollected)continue;if(!items[i]?.link)continue;try{const deep=await collectDeepUrl(items[i].link,items[i]);items[i]={...items[i],...deep,deepCollected:true,deepCollectedAt:new Date().toISOString()};}catch(e){items[i]={...items[i],deepCollected:false,deepError:String(e?.message||e)};}}await chrome.storage.local.set({[DEEP_KEY]:{...(box||{}),createdAt:Date.now(),items}}).catch(()=>{});return items;}
function selectedCompetitorCards(deep=[]){return deep.slice(0,3).map((c,i)=>`<div class="gs-comp-card">${c.imageUrl||c.imageUrls?.[0]?`<img src="${esc(c.imageUrl||c.imageUrls?.[0])}" alt="">`:'<span></span>'}<div><strong>${esc(c.title||`Concorrente ${i+1}`)}</strong><small>${money(c.price)}${finite(c.sold)!=null?` · ${Number(c.sold).toLocaleString('pt-BR')} vendidos`:''}${finite(c.rating)!=null?` · ${Number(c.rating).toFixed(1)}★`:''}<br>${c.deepCollected?'✓ leitura profunda':'⚠ leitura básica'}</small></div></div>`).join('');}

async function showReadyStep(){
  activateStep(4);const step=$('.wizard-step[data-step="4"]');if(!step)return;
  step.querySelector('.step-title b').textContent='4. Dados prontos para análise';step.querySelector('.step-title small').textContent='Confira o que foi coletado. As sugestões da IA aparecerão somente no Gestor Sênior.';
  $('#rayDimensions').innerHTML='';$('#beforeAfter').innerHTML='';
  const deep=(await chrome.storage.local.get(DEEP_KEY).catch(()=>({})))?.[DEEP_KEY]?.items||[];const rows=variationRows();const ads=[finite($('#auditRoas')?.value),finite($('#auditTargetRoas')?.value),finite($('#auditSpend')?.value)];
  $('#raySummary').innerHTML=`<div class="gs-handoff-banner"><b>🧠 A análise do Gemini foi movida para o Gestor Sênior</b><small>A extensão agora funciona como coletora: reúne anúncio, contexto, Ads, custos por variação e os 3 concorrentes. Nenhuma sugestão é exibida aqui antes da análise completa no site.</small></div><div class="gs-flow-grid"><div class="gs-flow-card"><small>Anúncio</small><b>${esc(currentTitle()||'Produto identificado')}</b><span class="ok">✓ coletado</span></div><div class="gs-flow-card"><small>Ads</small><b>ROAS ${ads[0]??'N/A'} · alvo ${ads[1]??'N/A'}</b><span>${ads[2]!=null?`Gasto ${money(ads[2])}`:'Gasto N/A'}</span></div><div class="gs-flow-card"><small>Custos</small><b>${rows.length?`${rows.filter(x=>x.cost!=null).length}/${rows.length} variações`:(finite($('#auditBaseCost')?.value)!=null?'Custo informado':'Pendente')}</b><span class="${validateCosts()?'ok':'warn'}">${rows.length&&rows.every(x=>x.cost!=null)?'✓ por variação':'fallback padrão'}</span></div><div class="gs-flow-card"><small>Concorrentes</small><b>${deep.length}/3 selecionados</b><span class="${deep.filter(x=>x.deepCollected).length===3?'ok':'warn'}">${deep.filter(x=>x.deepCollected).length}/3 leitura profunda</span></div></div><div class="gs-competitor-summary">${selectedCompetitorCards(deep)}</div>`;
  const btn=$('#step4Next');btn.textContent='✨ Analisar Tudo';btn.title='Salva todos os dados e abre a análise completa no Gestor Sênior.';
  const step5=$('.wizard-step[data-step="5"]');if(step5)step5.hidden=true;const dots=$$('#auditSteps span');if(dots[4]){dots[4].style.display='none';const prev=dots[4].previousElementSibling;if(prev?.tagName==='I')prev.style.display='none';}
  let sched=$('#scheduleTenDays')?.closest('label');if(sched&&!step.contains(sched)){sched.style.margin='12px 0';step.insertBefore(sched,step.querySelector('.wizard-actions'));}
}

function normalizeModels(raw){const list=raw?.response?.model||raw?.response?.model_list||raw?.model||raw?.models||[];return(Array.isArray(list)?list:[]).map((m,i)=>({modelId:finite(m.model_id??m.id),name:m.model_name||m.name||m.model_sku||`Variação ${i+1}`,sku:m.model_sku||'',price:finite(m.price_info?.current_price??m.price),stock:finite(m.stock_info_v2?.summary_info?.total_available_stock??m.stock_info?.normal_stock??m.stock)})).filter(x=>x.modelId!=null);}
async function postReport(payload){const s=await getSettings();const base=String(s.gestorBaseUrl||'https://shopeeos-real.vercel.app').replace(/\/$/,'');const r=await fetch(`${base}/api/extension-intelligence/reports`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});let j={};try{j=await r.json();}catch{}if(!r.ok||j?.error)throw new Error(j?.error||`HTTP ${r.status}`);return{data:j,base};}
function optionInfo(id){const el=$(id);return{value:el?.value||null,label:el?.selectedOptions?.[0]?.textContent?.trim()||null};}
async function analyzeAll(){
  const btn=$('#step4Next');if(!validateCosts())return;btn.disabled=true;const original=btn.textContent;btn.textContent='Coletando tudo…';
  try{
    await persistCosts();const itemId=Number(currentItemId());if(!itemId)throw new Error('ID do anúncio não encontrado.');
    const status=$('#competitorStatus');if(status)status.textContent='Preparando pacote completo para o Gemini…';
    const [ownDeep,competitors,adsRaw,modelRaw]=await Promise.all([ownDeepSnapshot(),competitorDeepSnapshots(),gestorApi.ads(7).catch(()=>null),gestorApi.models(itemId).catch(()=>null)]);
    const models=normalizeModels(modelRaw),costRows=variationRows(),costMap=new Map(costRows.map(x=>[String(x.modelId),x.cost]));
    const modelEconomics=models.map(m=>({...m,cost:costMap.get(String(m.modelId))??finite($('#auditBaseCost')?.value)}));
    const objective=optionInfo('#auditObjective'),situation=optionInfo('#auditSituation'),bottleneck=optionInfo('#auditBottleneck');
    const ads={roas:finite($('#auditRoas')?.value),targetRoas:finite($('#auditTargetRoas')?.value),spend:finite($('#auditSpend')?.value)};
    const campaign=(adsRaw?.v7?.campaigns||adsRaw?.v5?.campaigns||adsRaw?.campaigns||[]).find(c=>String(c.itemId??c.item_id)===String(itemId))||null;
    const allVariationCosts=costRows.length>0&&costRows.every(x=>x.cost!=null);const baseCost=finite($('#auditBaseCost')?.value);const schedule=$('#scheduleTenDays')?.checked!==false,next=schedule?new Date(Date.now()+10*86400000):null;
    const product={...ownDeep,itemId:String(itemId),title:ownDeep.title||currentTitle(),description:ownDeep.description||currentDescription(),category:cellValue('Categoria oficial'),currentPrice:numText(cellValue('Preço')),variationCosts:costRows.map(x=>({modelId:x.modelId,name:x.name,cost:x.cost,stock:x.stock})),models:modelEconomics,costMode:allVariationCosts?'per_variation':'base_fallback',referenceCost:baseCost};
    const analysisInput={schemaVersion:2,engine:'gemini-site',status:'awaiting_gemini',collectedAt:new Date().toISOString(),objective,situation,bottleneck,product,ads:{...campaign,manual:ads},competitors,requirements:{compareOriginalVsSuggestion:true,visualCompetitorImageAnalysis:true,explainSuggestionsWithSeoAidaCompetitors:true,officialShopeeCategoryOnly:true,praiseUserWhenStronger:true,inferCausesOnlyWithEvidence:true,marginByVariation:true}};
    const payload={item_id:itemId,analyzed_at:new Date().toISOString(),next_reanalysis_at:next?.toISOString()||null,frequency_days:10,mode:'approve',extension_version:VERSION,source:'chrome-extension-collector',objective:objective.label,situation:situation.label,bottleneck:bottleneck.label,score:null,product_snapshot:product,ads_snapshot:{...campaign,manual:ads},finance_snapshot:{costMode:product.costMode,productCost:allVariationCosts?null:baseCost,variationCosts:product.variationCosts,profit:null,marginPct:null,breakEvenRoas:null},competitors,report:{status:'awaiting_gemini',analysisEngine:'gemini-site',analysisInput,summary:'Dados coletados pela extensão. A análise e as sugestões serão geradas no Gestor Sênior.'},suggestions:{status:'pending_gemini_site_analysis'},metrics:{gmv:finite(campaign?.gmv),spend:ads.spend,roas:ads.roas,targetRoas:ads.targetRoas,sales:finite(campaign?.orders),sold:finite(ownDeep.sold),price:finite(ownDeep.price??product.currentPrice),marginR:null,marginPct:null},schedule_settings:{objective:objective.value,situation:situation.value,bottleneck:bottleneck.value,analysisEngine:'gemini-site'}};
    btn.textContent='Sincronizando com o Gestor…';const {data,base}=await postReport(payload);const reportId=data?.report?.id||'';
    if(schedule){chrome.runtime.sendMessage({type:'GS_CREATE_JOB',job:{itemId:String(itemId),title:product.title,url:product.url||$('#auditUrl')?.value||'',frequencyDays:10,policy:{enabled:true,mode:'approve',allowRoas:true,allowPrice:true,allowTitle:true,allowDescription:true,scheduledLiveCompetitors:true,rollbackOnWorsePerformance:true,finance:{useVariationCosts:true}}}}).catch(()=>{});}
    $('#raySummary').insertAdjacentHTML('afterend',`<div class="gs-analysis-result" id="gsAnalysisSent"><b>✓ Dados enviados com sucesso</b><p>A extensão terminou o trabalho de coleta. O Gemini fará a análise completa no Gestor Sênior usando o anúncio, contexto, custos e os 3 concorrentes.</p><a class="primary big" target="_blank" href="${esc(base)}/extensao-shopee-intelligence?item_id=${itemId}${reportId?`&report_id=${encodeURIComponent(reportId)}`:''}&view=super-analysis">Abrir Super Análise no Gestor</a></div>`);
    const last=$('#homeLast');if(last)last.innerHTML=`<b>${esc(product.title)}</b><br>Dados completos enviados · 3 concorrentes · aguardando Gemini no Gestor`;
    btn.textContent='✓ Dados enviados';toast('Coleta concluída. Abra o Gestor Sênior para ver a análise da IA.');
  }catch(e){toast(String(e?.message||e));btn.textContent=original;}finally{btn.disabled=false;}
}

function setupFlow(){
  injectStyles();const version=$('.version');if(version)version.textContent=`v${VERSION}`;const info=$('#tab-analyze .wizard-head .muted');if(info)info.textContent='Fluxo de coleta: anúncio → contexto/Ads/custos → 3 concorrentes → análise completa no Gestor Sênior.';
  const step3=$('.wizard-step[data-step="3"]');if(step3){step3.querySelector('.step-title small').textContent='A extensão abre a pesquisa da Shopee; escolha exatamente 3 anúncios comparáveis.';const guide=step3.querySelector('.guide span');if(guide)guide.textContent='Marque os 3 anúncios mais parecidos e clique em “Voltar para Análise”. A extensão fará a leitura profunda de cada concorrente em segundo plano.';}
  const step4=$('.wizard-step[data-step="4"]');if(step4){step4.querySelector('.step-title b').textContent='4. Dados prontos para análise';step4.querySelector('.step-title small').textContent='As sugestões da IA serão exibidas no Gestor Sênior, com mais espaço e comparação completa.';}
  installHelp();
  const varBox=$('#variationCosts');if(varBox){new MutationObserver(refreshCostMode).observe(varBox,{childList:true,subtree:true,attributes:true,attributeFilter:['value']});varBox.addEventListener('input',refreshCostMode);}
  $('#step2Next')?.addEventListener('click',()=>{refreshCostMode();if(!validateCosts())event?.stopImmediatePropagation?.();},true);
  const step3Next=$('#step3Next');if(step3Next)step3Next.onclick=()=>showReadyStep().catch(e=>toast(String(e?.message||e)));
  const step4Next=$('#step4Next');if(step4Next)step4Next.onclick=()=>analyzeAll();
  setTimeout(refreshCostMode,300);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupFlow,{once:true});else setupFlow();
