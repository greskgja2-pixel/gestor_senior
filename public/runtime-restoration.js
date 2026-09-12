(function(){
'use strict';
const THEMES=[
  {id:'xp',name:'Windows XP',era:'2001 · Luna Blue',c1:'#2A66C9',c2:'#ECE9D8'},
  {id:'vista',name:'Windows Vista',era:'2007 · Aero Glass',c1:'#1E7BC2',c2:'#EEF4FA'},
  {id:'win10',name:'Windows 10',era:'2015 · Fluent flat',c1:'#0078D4',c2:'#1F1F1F'},
  {id:'win11',name:'Windows 11',era:'2021 · Mica rounded',c1:'#0067C0',c2:'#F3F3F3'},
  {id:'ubuntu',name:'Ubuntu',era:'Yaru · Aubergine',c1:'#E95420',c2:'#2C0027'},
  {id:'aurora',name:'Aurora',era:'2026 · Autoral · Recomendado',c1:'#C4623F',c2:'#2A2622'},
  {id:'gestor',name:'Gestor Senior',era:'Couro azul-marinho · Dourado',c1:'#071728',c2:'#D7AE58'}
];
const ALIAS={dark:'gestor',warm:'aurora',classic:'xp'};
const LIVE_IDS=new Set(['dashboard','dashboard-geral','estrategias','ads','historico','preco','financeiro','impostos','estoque','logistica','saude','conteudo','promocoes','loja','concorrencia','melhoria','seo','crescimento','avaliacoes','atendimento','config']);
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function canonical(id){id=ALIAS[id]||id;return THEMES.some(t=>t.id===id)?id:'gestor';}
function getTheme(){let t='gestor';try{t=canonical(localStorage.getItem('gs_theme')||'gestor');}catch(e){}return t;}
function applyTheme(id,save=true){const t=canonical(id);document.body.dataset.gsTheme=t;document.documentElement.dataset.gsTheme=t;if(save){try{localStorage.setItem('gs_theme',t);}catch(e){}}return t;}
function currentMode(){try{return localStorage.getItem('shopeeos_mode')||'avancado';}catch(e){return'avancado'}}
function setMode(mode){const btn=document.querySelector('[data-mode="'+mode+'"]');if(btn){btn.click();return}try{localStorage.setItem('shopeeos_mode',mode);}catch(e){}location.reload();}
function renderSettings(){const c=document.getElementById('content'),top=document.getElementById('topTitle');if(!c)return;if(top)top.textContent='Configurações';const cur=getTheme(),mode=currentMode();c.innerHTML='<div class="lm-wrap"><div class="lm-head"><div><h1>Configurações</h1><p>Temas visuais originais do ShopeeOS e modo de exibição.</p></div><span class="lm-live">Restaurado</span></div><div class="lm-card"><div class="lm-card-head"><h3>🎨 Tema visual</h3><span>7 temas originais</span></div><div class="lm-card-body"><div class="lm-theme-grid">'+THEMES.map(t=>'<button class="lm-theme '+(cur===t.id?'active':'')+'" data-restored-theme="'+t.id+'"><div class="lm-theme-preview" style="background:linear-gradient(135deg,'+t.c1+' 0 52%,'+t.c2+' 52% 100%)"></div><strong>'+esc(t.name)+'</strong><div class="adv-theme-note">'+esc(t.era)+'</div></button>').join('')+'</div></div></div><div class="lm-card" style="margin-top:14px"><div class="lm-card-head"><h3>🖥️ Modo de exibição</h3><span>mesmo sistema do painel original</span></div><div class="lm-card-body"><div class="runtime-mode-grid"><button class="runtime-mode '+(mode==='simples'?'active':'')+'" data-restored-mode="simples"><strong>Simples</strong><span>Mostra somente as áreas essenciais.</span></button><button class="runtime-mode '+(mode==='avancado'?'active':'')+'" data-restored-mode="avancado"><strong>Avançado</strong><span>Libera as ~22 categorias do Gestor Senior.</span></button></div></div></div><div class="lm-note">Os temas XP, Vista, Windows 10, Windows 11, Ubuntu, Aurora e Gestor Senior vieram do painel antigo. A escolha fica salva neste navegador.</div></div>';
 c.querySelectorAll('[data-restored-theme]').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.restoredTheme);renderSettings()}));
 c.querySelectorAll('[data-restored-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.restoredMode)));
 activate('config');markLiveNav();
}
function patchModules(){const g=window.GestorLiveModules;if(!g||g.__runtimeRestorationPatched)return false;const oldSupports=typeof g.supports==='function'?g.supports.bind(g):()=>false;const oldRender=typeof g.render==='function'?g.render.bind(g):()=>{};g.supports=id=>id==='config'||oldSupports(id);g.render=(id,arg)=>id==='config'?renderSettings():oldRender(id,arg);g.__runtimeRestorationPatched=true;return true;}
function closeDrawer(){document.querySelector('.sidebar')?.classList.remove('shell-open');document.querySelector('.shell-backdrop')?.classList.remove('open');}
function activate(id){document.querySelectorAll('#nav .shell-page').forEach(b=>b.classList.toggle('active',b.dataset.shellId===id));}
function markLiveNav(){LIVE_IDS.forEach(id=>{const b=document.querySelector('#nav [data-shell-id="'+id+'"]');if(!b)return;const s=b.querySelector('.shell-state');if(s){s.classList.add('live');s.textContent='LIVE';}})}
function tryLiveNavigation(id,arg){patchModules();const g=window.GestorLiveModules;if(g&&typeof g.supports==='function'&&g.supports(id)&&typeof g.render==='function'){activate(id);g.render(id,arg);closeDrawer();return true}return false;}
function renderWhenReady(id,arg,attempt=0){if(tryLiveNavigation(id,arg))return;if(attempt<30){setTimeout(()=>renderWhenReady(id,arg,attempt+1),40);return}const c=document.getElementById('content'),top=document.getElementById('topTitle');if(top)top.textContent='Módulo';if(c)c.innerHTML='<div class="lm-wrap"><div class="lm-note warn">O módulo não terminou de carregar. Atualize a página e tente novamente.</div></div>';}
/* Registered before shell-enhancements.js so a LIVE page can never fall into the generic placeholder because of script timing on mobile. */
document.addEventListener('click',function(e){const b=e.target.closest('#nav .shell-page');if(!b)return;const id=b.dataset.shellId;if(!LIVE_IDS.has(id))return;e.preventDefault();e.stopImmediatePropagation();renderWhenReady(id);},true);
function boot(){applyTheme(getTheme(),false);let tries=0;const timer=setInterval(()=>{patchModules();markLiveNav();if(++tries>50)clearInterval(timer)},40);const mo=new MutationObserver(markLiveNav);mo.observe(document.documentElement,{subtree:true,childList:true});}
window.GestorThemeSystem={themes:THEMES,apply:applyTheme,current:getTheme,renderSettings};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();