(function(){
'use strict';
const VERSION='20260914-03';
if(window.__gsAdsProductScopeFix===VERSION)return;
window.__gsAdsProductScopeFix=VERSION;
const content=document.getElementById('content');
if(!content)return;
let cache=null,cacheAt=0,inflight=null,timer=null;
const money=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'sem dados';
const num=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2}):'sem dados';
const pct=n=>Number.isFinite(Number(n))?`${Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'sem dados';
async function load(){
  if(cache&&Date.now()-cacheAt<30000)return cache;
  if(inflight)return inflight;
  inflight=fetch('/api/shopee/ads?days=7',{cache:'no-store'}).then(async r=>{
    const j=await r.json();
    if(!r.ok||j?.error)throw new Error(j?.error||`HTTP ${r.status}`);
    cache=j;cacheAt=Date.now();return j;
  }).finally(()=>{inflight=null});
  return inflight;
}
function setKpi(container,label,value){
  for(const kpi of container.querySelectorAll('.lm-kpi')){
    const key=kpi.querySelector('.k')?.textContent?.trim();
    if(key!==label)continue;
    const v=kpi.querySelector('.v');
    if(v)v.textContent=value;
  }
}
function patchHome(summary){
  for(const card of content.querySelectorAll('.lm-card')){
    const h3=card.querySelector('.lm-card-head h3')?.textContent?.trim()||'';
    if(!h3.startsWith('Shopee Ads'))continue;
    const tag=card.querySelector('.lm-card-head span');
    if(tag)tag.textContent='Anúncios de Produtos • dados oficiais';
    setKpi(card,'Investimento',money(summary.spend));
    setKpi(card,'GMV via Ads',money(summary.gmv));
    setKpi(card,'ROAS',num(summary.roas));
  }
}
function patchAdsPage(summary){
  const title=content.querySelector('.lm-head h1')?.textContent?.trim();
  if(title!=='Shopee Ads')return;
  const desc=content.querySelector('.lm-head p');
  if(desc)desc.textContent='Desempenho dos Anúncios de Produtos — mesmo escopo da aba “Todos os Anúncios de Produtos” da Shopee.';
  setKpi(content,'Impressões',num(summary.impressions));
  setKpi(content,'Cliques',num(summary.clicks));
  setKpi(content,'CTR',pct(summary.ctr));
  setKpi(content,'Pedidos atribuídos',num(summary.orders));
  setKpi(content,'Itens vendidos',num(summary.sold));
  setKpi(content,'Vendas / GMV',money(summary.gmv));
  setKpi(content,'Investimento',money(summary.spend));
  setKpi(content,'ROAS',num(summary.roas));
}
async function patch(){
  try{
    const data=await load();
    if(data?.v5?.scope!=='product_ads'||!data?.v5?.summary)return;
    patchHome(data.v5.summary);
    patchAdsPage(data.v5.summary);
  }catch(error){console.warn('Gestor Senior: falha ao sincronizar escopo de Ads',error);}
}
function schedule(){clearTimeout(timer);timer=setTimeout(patch,120);}
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
setTimeout(patch,350);
})();
