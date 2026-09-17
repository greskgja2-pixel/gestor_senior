(function(){
'use strict';

// MENU OFICIAL DO GESTOR SENIOR — mesma ordem usada em todas as telas.
const PAGES=[
  {id:'dashboard',page:'home',icon:'⌂',label:'Dashboard',live:true,desc:'Resumo da operação e dos resultados das Super Análises.'},
  {id:'produtos',icon:'▱',label:'Produtos',href:'/produtos',desc:'Escolha o anúncio que será enviado para a Super Análise.'},
  {id:'super-analise',icon:'▤',label:'Super Análise',href:'/super-analise',desc:'Fluxo guiado, Original × IA e Antes × Depois.'},
  {id:'super-anuncio',icon:'▣',label:'Super Anúncio',href:'/extensao-shopee-intelligence',desc:'Histórico completo dos anúncios já analisados.'},
  {id:'concorrentes',icon:'⌘',label:'Concorrentes',href:'/extensao-shopee-intelligence#concorrentes',desc:'Concorrentes vinculados, snapshots e rechecagens.'},
  {id:'shopee-ads',icon:'◎',label:'Shopee Ads',href:'/extensao-shopee-intelligence#shopee-ads',desc:'ROAS, ROAS alvo, GMV, gasto e custo por venda.'},
  {id:'reanálises',icon:'↻',label:'Reanálises',href:'/extensao-shopee-intelligence#reanálises',desc:'Anúncios que precisam passar por uma nova análise.'},
  {id:'prioridades',icon:'☆',label:'Prioridades',href:'/extensao-shopee-intelligence#prioridades',desc:'Central de tarefas e ações recomendadas.'},
  {id:'relatorios',icon:'▤',label:'Relatórios',href:'/extensao-shopee-intelligence#relatorios',desc:'Relatórios consolidados, históricos e comparativos.'}
];
const pageMap=new Map(PAGES.map(x=>[x.id,x]));
let summaryTimer=null;

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function navButton(p){const real=p.page?' data-page="'+esc(p.page)+'"':'';return '<button class="shell-page" data-shell-id="'+esc(p.id)+'"'+real+' title="'+esc(p.desc||'')+'"><span class="shell-icon">'+p.icon+'</span><span class="shell-label">'+esc(p.label)+'</span></button>';}
function buildNav(){const nav=document.getElementById('nav');if(!nav)return;nav.innerHTML='<div class="shell-nav-title">Gestor Sênior</div>'+PAGES.map(navButton).join('');}
function updateActive(id){document.querySelectorAll('#nav .shell-page').forEach(b=>b.classList.toggle('active',b.dataset.shellId===id));}
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
  if(liveModule('dashboard')){updateActive('dashboard');window.GestorLiveModules.render('dashboard');scheduleSummary();return true;}
  if(attempt<300){setTimeout(()=>renderInitial(attempt+1),100);return false;}
  console.warn('Gestor Senior: dashboard module was not ready after 30s');return false;
}
function init(){buildNav();addMobile();renderInitial();}
window.addEventListener('gestor-live-modules-ready',()=>renderInitial(0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();