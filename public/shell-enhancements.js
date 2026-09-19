(function(){
'use strict';

// MENU OFICIAL DO GESTOR SENIOR — mesma ordem usada em todas as telas.
const PAGES=[
  {id:'dashboard',page:'home',icon:'⌂',tone:'violet',label:'Dashboard',live:true,desc:'Resumo da operação e dos resultados das Super Análises.'},
  {id:'produtos',icon:'▱',tone:'blue',label:'Produtos',href:'/produtos',group:'products',parent:true,desc:'Escolha o anúncio que será enviado para a Super Análise.'},
  {id:'super-analise',icon:'▤',tone:'indigo',label:'Super Análise',href:'/super-analise',group:'products',child:true,desc:'Fluxo guiado, Original × IA e Antes × Depois.'},
  {id:'super-anuncio',icon:'▣',tone:'cyan',label:'Super Anúncio',href:'/extensao-shopee-intelligence?section=super-anuncio',group:'products',child:true,desc:'Histórico completo dos anúncios já analisados.'},
  {id:'concorrentes',icon:'⌘',tone:'orange',label:'Concorrentes',href:'/extensao-shopee-intelligence?section=concorrentes',group:'products',child:true,desc:'Concorrentes vinculados, snapshots e rechecagens.'},
  {id:'reanálises',icon:'↻',tone:'purple',label:'Reanálises',href:'/extensao-shopee-intelligence?section=reanalises',group:'products',child:true,desc:'Anúncios que precisam passar por uma nova análise.'},
  {id:'prioridades',icon:'☆',tone:'amber',label:'Prioridades',href:'/extensao-shopee-intelligence?section=prioridades',group:'products',child:true,desc:'Central de tarefas e ações recomendadas.'},
  {id:'relatorios',icon:'▤',tone:'teal',label:'Relatórios',href:'/extensao-shopee-intelligence?section=relatorios',group:'products',child:true,desc:'Relatórios consolidados, históricos e comparativos.'},
  {id:'shopee-ads',icon:'◎',tone:'coral',label:'Shopee Ads',href:'/extensao-shopee-intelligence?section=shopee-ads',group:'ads',parent:true,desc:'ROAS, ROAS alvo, GMV, gasto e custo por venda.'},
  {id:'protecao-roas',icon:'◈',tone:'green',label:'Proteção ROAS',href:'/protecao-roas',group:'ads',child:true,desc:'Status interno e desativação da proteção de ROAS.'},
  {id:'temas',icon:'◐',tone:'pink',label:'Temas',desc:'Escolha a aparência do Gestor Sênior.'},
  {id:'config',icon:'⚙',tone:'slate',label:'Configurações',desc:'Preferências gerais do Gestor Sênior.'}
];
const pageMap=new Map(PAGES.map(x=>[x.id,x]));
let summaryTimer=null;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function navButton(p){const real=p.page?' data-page="'+esc(p.page)+'"':'';const child=p.child?' data-shell-child="true"':'';return '<button class="shell-page" data-shell-id="'+esc(p.id)+'" data-shell-tone="'+esc(p.tone||'blue')+'"'+real+child+' title="'+esc(p.desc||'')+'"><span class="shell-icon">'+p.icon+'</span><span class="shell-label">'+esc(p.label)+'</span>'+(p.parent?'<span class="shell-chevron">›</span>':'')+'</button>';}
function buildGroup(id){
  const parent=PAGES.find(p=>p.group===id&&p.parent),children=PAGES.filter(p=>p.group===id&&p.child);
  return '<div class="shell-menu-group" data-shell-group="'+esc(id)+'">'+navButton(parent)+'<div class="shell-submenu">'+children.map(navButton).join('')+'</div></div>';
}
function buildNav(){
  const nav=document.getElementById('nav');if(!nav)return;
  const dashboard=PAGES.find(p=>p.id==='dashboard'),themes=PAGES.find(p=>p.id==='temas'),config=PAGES.find(p=>p.id==='config');
  nav.innerHTML='<div class="shell-nav-title">Gestor Sênior</div>'+navButton(dashboard)+buildGroup('products')+buildGroup('ads')+'<div class="shell-nav-title shell-system-title">Sistema</div>'+navButton(themes)+navButton(config);
}
function updateActive(id){document.querySelectorAll('#nav .shell-page').forEach(b=>b.classList.toggle('active',b.dataset.shellId===id));document.querySelectorAll('#nav .shell-menu-group').forEach(g=>{const active=!!g.querySelector('.shell-page.active');g.classList.toggle('expanded',active);});}
function closeDrawer(){document.querySelector('.sidebar')?.classList.remove('shell-open');document.querySelector('.shell-backdrop')?.classList.remove('open');}
function addMobile(){const bar=document.querySelector('.topbar');if(!bar||bar.querySelector('.shell-menu-btn'))return;const btn=document.createElement('button');btn.className='shell-menu-btn';btn.type='button';btn.textContent='☰';btn.title='Abrir menu';bar.insertBefore(btn,bar.firstChild);let bd=document.querySelector('.shell-backdrop');if(!bd){bd=document.createElement('div');bd.className='shell-backdrop';document.body.appendChild(bd);}btn.addEventListener('click',()=>{document.querySelector('.sidebar')?.classList.toggle('shell-open');bd.classList.toggle('open');});bd.addEventListener('click',closeDrawer);}
function liveModule(id){return window.GestorLiveModules&&window.GestorLiveModules.supports&&window.GestorLiveModules.supports(id);}
function goOuter(href){try{window.parent.location.href=href;}catch{window.location.href=href;}}

function latestByItem(reports){const map=new Map();for(const r of reports||[]){const id=String(r.item_id||'');if(id&&!map.has(id))map.set(id,r);}return [...map.values()];}
async function injectAnalysisSummary(){
  if(!document.querySelector('#nav .shell-page.active[data-shell-id="dashboard"]'))return;
  const wrap=document.querySelector('#content .lm-wrap');if(!wrap||document.getElementById('gs-super-analysis-summary'))return;
  try{
    const response=await fetch('/api/extension-intelligence/reports?limit=200',{cache:'no-store'});const data=await response.json();if(!response.ok||data.error)return;
    const latest=latestByItem(data.reports||[]),now=Date.now();
    const scores=latest.map(r=>Number(r.score)).filter(Number.isFinite),avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
    const withAi=latest.filter(r=>Number.isFinite(Number(r?.report?.ai_analysis?.afterScore))&&Number.isFinite(Number(r.score)));
    const avgGain=withAi.length?withAi.reduce((s,r)=>s+(Number(r.report.ai_analysis.afterScore)-Number(r.score)),0)/withAi.length:null;
    const due=(data.schedules||[]).filter(s=>s.enabled&&s.next_run_at&&new Date(s.next_run_at).getTime()<=now).length;
    const compCount=latest.filter(r=>Array.isArray(r.competitors)&&r.competitors.length===3).length;
    const box=document.createElement('section');box.id='gs-super-analysis-summary';box.className='lm-card';box.style.marginBottom='14px';
    box.innerHTML=`<div class="lm-card-head"><h3>Super Análises — resumo</h3><span>última análise de cada produto</span></div><div class="lm-card-body"><div class="lm-grid">${kpiHtml('Anúncios analisados',latest.length,'Histórico consolidado')}${kpiHtml('Nota média',avg==null?'—':avg.toFixed(1)+'/100','Notas atuais')}${kpiHtml('Ganho projetado pela IA',avgGain==null?'—':(avgGain>=0?'+':'')+avgGain.toFixed(1)+' pts',withAi.length+' com comparação Antes × Depois')}${kpiHtml('3 concorrentes coletados',compCount,latest.length?Math.round(compCount/latest.length*100)+'% dos analisados':'Sem análises')}${kpiHtml('Reanálises vencidas',due,'Itens que pedem nova conferência')}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="lm-btn" data-gs-go="/produtos">Escolher produto</button><button class="lm-btn" data-gs-go="/super-analise">Abrir Super Análise</button><button class="lm-btn" data-gs-go="/extensao-shopee-intelligence">Ver histórico</button></div></div>`;
    const head=wrap.querySelector('.lm-head');if(head)head.insertAdjacentElement('afterend',box);else wrap.prepend(box);
  }catch{}
}
function kpiHtml(label,value,sub){return `<div class="lm-kpi"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div><div class="s">${esc(sub)}</div></div>`;}
function scheduleSummary(){clearTimeout(summaryTimer);summaryTimer=setTimeout(injectAnalysisSummary,350);}

document.addEventListener('click',function(e){
  const jump=e.target.closest('[data-gs-go]');if(jump){e.preventDefault();e.stopImmediatePropagation();goOuter(jump.dataset.gsGo);return;}
  const b=e.target.closest('#nav .shell-page');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=b.dataset.shellId,p=pageMap.get(id);if(!p)return;
  updateActive(id);
  if(p.href){goOuter(p.href);return;}
  if(liveModule(id)){window.GestorLiveModules.render(id);closeDrawer();scheduleSummary();return;}
},true);

function renderInitial(attempt=0){
  const section=new URLSearchParams(location.search).get('section')||'';
  const target=(section==='temas'||section==='config')?section:'dashboard';
  if(liveModule(target)){updateActive(target);window.GestorLiveModules.render(target);if(target==='dashboard')scheduleSummary();return true;}
  if(attempt<300){setTimeout(()=>renderInitial(attempt+1),100);return false;}
  console.warn('Gestor Senior: initial module was not ready after 30s');return false;
}
function normalizeShellIdentity(){
  const mark=document.querySelector('.logoMark');if(mark)mark.textContent='GS';
  document.querySelectorAll('.logo .live').forEach(el=>el.remove());
}
let systemStatusTimer=null;
function motorReady(){
  try{
    if(document.documentElement?.dataset?.gsExtensionBridge==='ready'||document.getElementById('gs-extension-bridge-marker'))return true;
    return window.parent!==window&&(window.parent.document?.documentElement?.dataset?.gsExtensionBridge==='ready'||!!window.parent.document?.getElementById('gs-extension-bridge-marker'));
  }catch{return false;}
}
function ensureSystemStatus(){
  const sidebar=document.querySelector('.sidebar');if(!sidebar)return null;
  let box=sidebar.querySelector('[data-shell-system-status]');
  if(!box){box=document.createElement('div');box.dataset.shellSystemStatus='true';sidebar.appendChild(box);}
  return box;
}
function statusLine(icon,title,value,ok){return '<div class="shell-status-line"><span class="shell-status-icon '+(ok?'ok':'')+'">'+icon+'</span><div><b>'+esc(title)+'</b><small>'+esc(value)+'</small></div></div>';}
async function refreshSystemStatus(){
  const box=ensureSystemStatus();if(!box)return;
  let conn={connected:false};
  try{const r=await fetch('/api/shopee/connection',{cache:'no-store'});const j=await r.json();if(r.ok)conn=j;}catch{}
  const ext=motorReady(),shop=!!conn.connected;
  box.innerHTML=statusLine('●','Motor Senior',ext?'Extensão conectada':'Extensão não detectada',ext)+statusLine('◆','Loja Shopee',shop?(conn.shopName||('Loja #'+(conn.shopId||''))):'Loja desconectada',shop)+(shop?'<button type="button" data-shell-logout>Sair da loja</button>':'<a href="/api/shopee/authorize" target="_top">Conectar loja</a>');
  box.querySelector('[data-shell-logout]')?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Saindo…';try{const r=await fetch('/api/shopee/logout',{method:'POST'});if(!r.ok)throw new Error();window.top.location.href='/';}catch{b.disabled=false;b.textContent='Tentar sair novamente';}});
}
function init(){buildNav();normalizeShellIdentity();addMobile();renderInitial();refreshSystemStatus();clearInterval(systemStatusTimer);systemStatusTimer=setInterval(refreshSystemStatus,5000);}
window.addEventListener('gestor-live-modules-ready',()=>renderInitial(0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();