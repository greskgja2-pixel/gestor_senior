(function(){
'use strict';
const VERSION='20260914-ads-cleanup-v9-01';
if(window.__gsAdsCleanupV9===VERSION)return;
window.__gsAdsCleanupV9=VERSION;

const content=()=>document.getElementById('content');
const blocked=new Set(['Desempenho diário','Investimento diário','Campanhas da conta']);

function isAds(){
  const active=document.querySelector('#nav .shell-page.active')?.dataset.shellId;
  if(active==='ads')return true;
  return content()?.querySelector('.lm-head h1')?.textContent?.trim()==='Shopee Ads';
}

function clean(){
  if(!isAds())return;
  const c=content();
  if(!c)return;
  c.querySelectorAll('.lm-card').forEach(card=>{
    const title=card.querySelector('.lm-card-head h3')?.textContent?.trim();
    if(blocked.has(title))card.remove();
  });
  // Remove contêiner de duas colunas se ficou vazio após tirar os dois gráficos.
  c.querySelectorAll('.lm-cols').forEach(cols=>{
    if(!cols.querySelector('.lm-card'))cols.remove();
  });
}

let timer=null;
function schedule(){clearTimeout(timer);timer=setTimeout(clean,40);}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(clean,100);
setTimeout(clean,500);
})();
