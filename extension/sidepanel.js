const $=s=>document.querySelector(s);
const send=m=>chrome.runtime.sendMessage(m);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000)}

document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');$('#tab-'+b.dataset.tab).classList.add('active');
  if(b.dataset.tab==='automacao')loadJobs();
  if(b.dataset.tab==='revenda')initCollector();
});

$('#analyze').onclick=async()=>{
  const b=$('#analyze');b.disabled=true;b.textContent='Analisando anúncio + concorrentes…';
  try{const r=await send({type:'GS_ANALYZE_CURRENT'});if(!r.ok)throw new Error(r.error);renderAnalysis(r.data)}
  catch(e){toast(e.message)}finally{b.disabled=false;b.textContent='✨ Analisar anúncio atual'}
};

function renderAnalysis(d){
  $('#analysisEmpty').hidden=true;const a=$('#analysis');a.hidden=false;const r=d.result||{};
  a.innerHTML=`<div class="score"><div><strong>${esc(d.product?.title||'Anúncio')}</strong><small style="display:block;color:#8fa1b5">${d.competitors?.length||0} concorrente(s) coletado(s)</small></div><b>${r.score}/100</b></div><div class="card"><b>${esc(r.summary)}</b>${(r.dimensions||[]).map(x=>`<div class="dimension"><div><strong>${esc(x.name)}</strong><b>${x.score}/${x.maxScore}</b></div><small>${esc(x.reason)}</small></div>`).join('')}</div>${r.roasStrategy?`<div class="card"><b>Ads: ${esc(r.roasStrategy.title)}</b><p>${esc(r.roasStrategy.message)}</p>${Number.isFinite(Number(r.roasStrategy.suggestedTarget))?`<div class="proposal">Meta sugerida: <b>${Number(r.roasStrategy.suggestedTarget).toFixed(2)}</b></div>`:''}</div>`:''}<div class="card"><b>Correções sugeridas</b><div class="proposal"><small>Título</small><br>${esc(r.optimizedTitle)}</div><div class="proposal"><small>Descrição</small><br>${esc(String(r.optimizedDescription||'').slice(0,500))}${String(r.optimizedDescription||'').length>500?'…':''}</div></div>`;
  if(d.product?.itemId){$('#jobItem').value=d.product.itemId;$('#jobTitle').value=d.product.title||''}
}

$('#createJob').onclick=async()=>{
  const itemId=$('#jobItem').value.trim();if(!itemId)return toast('Informe o ID do item.');
  const cost=Number($('#jobCost').value);if(Number.isFinite(cost))await send({type:'GS_SAVE_COST',itemId,cost});
  const job={itemId,title:$('#jobTitle').value.trim(),frequencyDays:Number($('#jobFreq').value),policy:{enabled:true,mode:$('#jobMode').value,maxRoasChangePct:Number($('#maxRoas').value)||10,allowRoas:true,allowBudget:true,allowProtectionReset:$('#allowProtection').checked,allowPrice:false,allowTitle:false,allowDescription:false,finance:{minMarginPct:Number($('#minMargin').value)||20,minProfit:Number($('#minProfit').value)||8,maxWeeklyAdsSpend:Number($('#maxSpend').value)||300}}};
  const r=await send({type:'GS_CREATE_JOB',job});if(r.ok){toast('Manutenção criada.');loadJobs()}else toast(r.error)
};

async function loadJobs(){
  const r=await send({type:'GS_LIST_JOBS'});const box=$('#jobs');
  box.innerHTML=(r.jobs||[]).filter(j=>j.status!=='cancelled').map(j=>`<div class="job"><b>${esc(j.title||j.itemId)}</b><small style="display:block;color:#8fa1b5">a cada ${j.frequencyDays} dias · ${esc(j.policy?.mode||'approve')}</small><div class="actions"><button data-run="${esc(j.id)}">Executar agora</button><button data-cancel="${esc(j.id)}">Cancelar</button></div></div>`).join('')||'<div class="empty">Nenhuma manutenção ativa.</div>';
  box.querySelectorAll('[data-run]').forEach(b=>b.onclick=async()=>{b.disabled=true;const x=await send({type:'GS_RUN_JOB_NOW',id:b.dataset.run});toast(x.ok?'Ciclo concluído.':x.error);b.disabled=false});
  box.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{await send({type:'GS_CANCEL_JOB',id:b.dataset.cancel});loadJobs()});
}

// Coletor Shopee v3.1.0 — portado do popup original para a aba Revenda.
const collector={tabId:null,categories:[],selected:new Set(),state:'idle',initialized:false,loading:false};
const collectorMode=()=>document.querySelector('input[name="collectorMode"]:checked')?.value||'category';

async function waitTabComplete(tabId,timeout=15000){
  const started=Date.now();
  while(Date.now()-started<timeout){const tab=await chrome.tabs.get(tabId).catch(()=>null);if(tab?.status==='complete')return tab;await new Promise(r=>setTimeout(r,350))}
  return chrome.tabs.get(tabId);
}

async function findOrOpenShopeeTab(){
  const [active]=await chrome.tabs.query({active:true,currentWindow:true});
  if(active?.url?.startsWith('https://shopee.com.br/'))return active;
  const tabs=await chrome.tabs.query({url:'https://shopee.com.br/*'});if(tabs[0])return tabs[0];
  const tab=await chrome.tabs.create({url:'https://shopee.com.br/',active:false});return waitTabComplete(tab.id);
}

async function collectorMessage(message,retry=true){
  const tab=collector.tabId?await chrome.tabs.get(collector.tabId).catch(()=>null):null;
  const use=tab||await findOrOpenShopeeTab();collector.tabId=use.id;
  try{return await chrome.tabs.sendMessage(use.id,message)}catch(e){
    if(!retry)throw e;
    await chrome.tabs.reload(use.id);await waitTabComplete(use.id);return collectorMessage(message,false);
  }
}

function renderCollectorCategories(){
  const box=$('#collectorCategoryList'),q=$('#collectorCategoryFilter').value.trim().toLowerCase();
  const visible=collector.categories.filter(c=>`${c.label} ${c.parent||''} ${c.id}`.toLowerCase().includes(q));box.replaceChildren();
  for(const c of visible){const label=document.createElement('label');label.className='category-item';label.dataset.id=c.id;const input=document.createElement('input');input.type='checkbox';input.checked=collector.selected.has(c.id);input.onchange=()=>{input.checked?collector.selected.add(c.id):collector.selected.delete(c.id);updateCollectorSelected()};const span=document.createElement('span');span.textContent=c.label;const small=document.createElement('small');small.textContent=`${c.parent?c.parent+' · ':''}ID ${c.id}`;span.appendChild(small);label.append(input,span);box.appendChild(label)}
  if(!visible.length)box.innerHTML='<p class="muted" style="padding:10px">Nenhuma categoria encontrada.</p>';
}
function updateCollectorSelected(){$('#collectorSelectedCount').textContent=collector.selected.size?`${collector.selected.size} categoria(s) selecionada(s)`:'Nenhuma categoria selecionada'}

function renderCollectorStatus(status={}){
  collector.state=status.state||collector.state||'idle';const completed=status.completed||0,total=status.total||0;
  $('#collectorBar').style.width=total?`${Math.min(100,completed/total*100)}%`:(completed?'12%':'0');
  $('#collectorProgressCount').textContent=total?`${completed} / ${total} arquivos`:`${completed} arquivo(s)`;
  $('#collectorErrorCount').textContent=`${status.errors||0} erro(s)`;$('#collectorStatus').textContent=status.message||'Pronto para iniciar.';
  const active=['running','pausing','paused'].includes(collector.state);$('#collectorStart').disabled=active;$('#collectorCancel').disabled=!active;$('#collectorPause').disabled=!active||collector.state==='pausing';$('#collectorPause').textContent=collector.state==='paused'?'Continuar':'Pausar';
  for(const el of ['collectorCategoryFilter','collectorSearchTerm','collectorPageMode','collectorDelay']){const node=$('#'+el);if(node)node.disabled=active}
}

async function initCollector(){
  if(collector.loading)return;collector.loading=true;const warn=$('#collectorWarning');warn.hidden=true;
  try{
    const tab=await findOrOpenShopeeTab();collector.tabId=tab.id;
    const [catRes,jobRes]=await Promise.all([collectorMessage({type:'GET_CATEGORIES'}),collectorMessage({type:'GET_JOB'})]);
    if(!catRes?.ok)throw new Error(catRes?.error||'A Shopee não retornou as categorias.');collector.categories=catRes.categories||[];renderCollectorCategories();updateCollectorSelected();collector.initialized=true;
    if(jobRes?.job)renderCollectorStatus({state:jobRes.job.state,completed:jobRes.job.completed,total:jobRes.job.total,errors:jobRes.job.failures?.length,message:jobRes.job.state==='paused'?'Coleta pausada.':`${jobRes.job.completed||0} arquivo(s) salvo(s) na última execução.`});
    else{const st=(await chrome.storage.local.get('collectorStatus')).collectorStatus;if(st)renderCollectorStatus(st)}
  }catch(e){warn.hidden=false;warn.textContent=`Não consegui iniciar o Coletor 3.1: ${e.message}`}
  finally{collector.loading=false}
}

document.querySelectorAll('input[name="collectorMode"]').forEach(r=>r.onchange=()=>{const cat=collectorMode()==='category';$('#collectorCategoryPanel').hidden=!cat;$('#collectorSearchPanel').hidden=cat});
$('#collectorCategoryFilter').oninput=renderCollectorCategories;
$('#collectorSelectVisible').onclick=()=>{document.querySelectorAll('#collectorCategoryList .category-item').forEach(el=>collector.selected.add(el.dataset.id));renderCollectorCategories();updateCollectorSelected()};
$('#collectorClearSelection').onclick=()=>{collector.selected.clear();renderCollectorCategories();updateCollectorSelected()};

$('#collectorStart').onclick=async()=>{
  try{
    if(!collector.initialized)await initCollector();let targets=[];
    if(collectorMode()==='category'){targets=collector.categories.filter(c=>collector.selected.has(c.id));if(!targets.length)return toast('Selecione pelo menos uma categoria.')}
    else{const term=$('#collectorSearchTerm').value.trim();if(!term)return toast('Digite o termo que deseja pesquisar.');targets=[{type:'search',term,name:term,slug:term.toLowerCase().replace(/\s+/g,'_')}]}
    const response=await collectorMessage({type:'START_COLLECTION',targets,pageMode:$('#collectorPageMode').value,delayMs:Number($('#collectorDelay').value)});if(!response?.ok)throw new Error(response?.error||'Não foi possível iniciar.');
    renderCollectorStatus({state:'running',completed:0,total:$('#collectorPageMode').value==='all'?0:targets.length,message:'Iniciando coleta…'});toast('Coleta iniciada em uma aba da Shopee.')
  }catch(e){toast(e.message)}
};
$('#collectorPause').onclick=async()=>{try{const type=collector.state==='paused'?'CONTINUE_COLLECTION':'PAUSE_COLLECTION';const r=await collectorMessage({type});if(!r?.ok)throw new Error('Não foi possível alterar o estado da coleta.')}catch(e){toast(e.message)}};
$('#collectorCancel').onclick=async()=>{try{await collectorMessage({type:'CANCEL_COLLECTION'});renderCollectorStatus({state:'cancelled',message:'Coleta cancelada.'})}catch(e){toast(e.message)}};

chrome.runtime.onMessage.addListener(message=>{if(message?.type==='COLLECTOR_STATUS')renderCollectorStatus(message)});

$('#researchCapture').onchange=async e=>{const r=await send({type:'GS_SET_RESEARCH_CAPTURE',enabled:e.target.checked});toast(r.ok?'Configuração salva.':r.error)};
$('#clearCapture').onclick=async()=>{await chrome.storage.local.remove('gsAutoMapperCapturesV1');toast('Capturas locais apagadas.')};

(async()=>{const r=await send({type:'GS_GET_STATE'});$('#researchCapture').checked=r.state?.gsResearchCapture===true;if(r.state?.collectorStatus)renderCollectorStatus(r.state.collectorStatus)})();
