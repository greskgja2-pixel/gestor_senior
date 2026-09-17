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

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function navButton(p){const real=p.page?' data-page="'+esc(p.page)+'"':'';return '<button class="shell-page" data-shell-id="'+esc(p.id)+'"'+real+' title="'+esc(p.desc||'')+'"><span class="shell-icon">'+p.icon+'</span><span class="shell-label">'+esc(p.label)+'</span></button>';}
function buildNav(){const nav=document.getElementById('nav');if(!nav)return;nav.innerHTML='<div class="shell-nav-title">Gestor Sênior</div>'+PAGES.map(navButton).join('');}
function updateActive(id){document.querySelectorAll('#nav .shell-page').forEach(b=>b.classList.toggle('active',b.dataset.shellId===id));}
function closeDrawer(){document.querySelector('.sidebar')?.classList.remove('shell-open');document.querySelector('.shell-backdrop')?.classList.remove('open');}
function addMobile(){const bar=document.querySelector('.topbar');if(!bar||bar.querySelector('.shell-menu-btn'))return;const btn=document.createElement('button');btn.className='shell-menu-btn';btn.type='button';btn.textContent='☰';btn.title='Abrir menu';bar.insertBefore(btn,bar.firstChild);let bd=document.querySelector('.shell-backdrop');if(!bd){bd=document.createElement('div');bd.className='shell-backdrop';document.body.appendChild(bd);}btn.addEventListener('click',()=>{document.querySelector('.sidebar')?.classList.toggle('shell-open');bd.classList.toggle('open');});bd.addEventListener('click',closeDrawer);}
function liveModule(id){return window.GestorLiveModules&&window.GestorLiveModules.supports&&window.GestorLiveModules.supports(id);}

function goOuter(href){
  try{window.parent.location.href=href;}catch{window.location.href=href;}
}

document.addEventListener('click',function(e){
  const b=e.target.closest('#nav .shell-page');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=b.dataset.shellId,p=pageMap.get(id);if(!p)return;
  updateActive(id);
  if(p.href){goOuter(p.href);return;}
  if(liveModule(id)){window.GestorLiveModules.render(id);closeDrawer();return;}
},true);

function renderInitial(attempt=0){
  if(liveModule('dashboard')){updateActive('dashboard');window.GestorLiveModules.render('dashboard');return true;}
  if(attempt<300){setTimeout(()=>renderInitial(attempt+1),100);return false;}
  console.warn('Gestor Senior: dashboard module was not ready after 30s');return false;
}
function init(){buildNav();addMobile();renderInitial();}
window.addEventListener('gestor-live-modules-ready',()=>renderInitial(0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();