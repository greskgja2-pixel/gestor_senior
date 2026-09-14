(function(){
'use strict';
const VERSION='20260914-persist-v8-02';
if(window.__gsPersistenceFixV8===VERSION)return;
window.__gsPersistenceFixV8=VERSION;

const $=s=>document.querySelector(s);
const content=()=>document.getElementById('content');
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'sem dados';
const num=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2}):'sem dados';
const pct=n=>Number.isFinite(Number(n))?`${Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'sem dados';

function activeId(){return $('#nav .shell-page.active')?.dataset.shellId||'';}
function isHome(){const id=activeId();return !id||id==='dashboard'||id==='dashboard-geral';}
function campaignName(c){return c?.title||c?.productName||(c?.itemId?`Produto ${c.itemId}`:'')||(c?.campaignId?`Campanha ${c.campaignId}`:'')||'sem dados';}
function campaignLine(c,type){
  if(!c)return '<b>sem dados</b><span>Nenhuma campanha com dados suficientes</span>';
  if(type==='waste'){
    const detail=Number(c.orders)===0?`${money(c.spend)} gastos · 0 pedidos`:`${money(c.spend)} · ${num(c.orders)} pedidos · ${money(c.costPerOrder)}/pedido`;
    return `<b>${esc(campaignName(c))}</b><span>${esc(detail)}</span>`;
  }
  if(type==='roas')return `<b>${esc(campaignName(c))}</b><span>ROAS ${num(c.roas)} · ${money(c.gmv)} em vendas</span>`;
  return `<b>${esc(campaignName(c))}</b><span>${money(c.spend)} investidos · ROAS ${num(c.roas)}</span>`;
}

let homeCache=null,homeCacheAt=0,homePromise=null;
async function fetchJson(url){const r=await fetch(url,{cache:'no-store'});let j={};try{j=await r.json()}catch{}return r.ok?j:null;}
async function homeData(){
  if(homeCache&&Date.now()-homeCacheAt<30000)return homeCache;
  if(homePromise)return homePromise;
  homePromise=(async()=>{
    const [orders,ads,health,products]=await Promise.allSettled([
      fetchJson('/api/shopee/orders'),fetchJson('/api/shopee/ads?days=7'),fetchJson('/api/shopee/health'),fetchJson('/api/shopee/products')
    ]);
    homeCache={
      orders:orders.status==='fulfilled'?orders.value:null,
      ads:ads.status==='fulfilled'?ads.value:null,
      health:health.status==='fulfilled'?health.value:null,
      products:products.status==='fulfilled'?products.value:null
    };
    homeCacheAt=Date.now();
    return homeCache;
  })().finally(()=>{homePromise=null;});
  return homePromise;
}

function appendHomeCards(d){
  const c=content();
  if(!c||!isHome()||c.querySelector('.gs-ency-home'))return;
  const anchor=c.querySelector('.lm-wrap');
  if(!anchor)return;
  const os=d?.orders?.orders||[];
  const ps=d?.products?.items||[];
  const adsView=d?.ads?.v7||d?.ads?.v5||{};
  const summary=adsView.summary||{};
  const ins=adsView.insights||{};
  const rating=d?.health?.data?.response?.overall_performance?.rating;
  const active=ps.filter(p=>p.item_status==='NORMAL').length;

  const box=document.createElement('div');
  box.className='gs-ency-home';
  box.dataset.persisted='v8';
  box.innerHTML=`<div class="gs-ency-title"><div><strong>Central de Gestão</strong><span>Indicadores organizados com os mapeamentos confirmados da Enciclopédia Shopee Seller Center.</span></div><span class="gs-ency-live">DADOS REAIS</span></div><div class="gs-ency-grid"><div><small>Pedidos carregados</small><b>${num(os.length)}</b><span>Operação / pedidos</span></div><div><small>Produtos ativos</small><b>${num(active)}</b><span>${num(ps.length)} anúncios carregados</span></div><div><small>GMV via Ads</small><b>${money(summary.gmv)}</b><span>Últimos 7 dias</span></div><div><small>Investimento Ads</small><b>${money(summary.spend)}</b><span>Últimos 7 dias</span></div><div><small>ROAS Ads</small><b>${num(summary.roas)}</b><span>GMV ÷ investimento</span></div><div><small>Saúde da loja</small><b>${rating!=null?esc(rating)+'/4':'sem dados'}</b><span>Account Health</span></div></div><div class="gs-ency-note"><strong>Mapeamentos confirmados:</strong> Visitantes = <code>hybrid_uv</code>, Cliques = <code>product_clicks</code>, Conversão = <code>product_clicks_to_orders_rate</code>. Nenhum número é estimado quando a fonte não responde.</div>`;
  anchor.appendChild(box);

  const gold=document.createElement('div');
  gold.className='gs-ency-ads-v5 gs-ency-gold';
  gold.dataset.persisted='v8';
  gold.innerHTML=`<div class="gs-v5-head"><div><span class="gs-v5-kicker">ENCICLOPÉDIA v7</span><strong>Inteligência Shopee Ads</strong><small>Performance, campanhas, eficiência e base técnica da Proteção de ROAS.</small></div><span class="gs-v5-period">7 dias</span></div><div class="gs-v5-metrics"><div><small>Investimento</small><b>${money(summary.spend)}</b></div><div><small>Vendas Ads</small><b>${money(summary.gmv)}</b></div><div><small>ROAS</small><b>${num(summary.roas)}</b></div><div><small>CTR</small><b>${pct(summary.ctr)}</b></div><div><small>CPC</small><b>${money(summary.cpc)}</b></div><div><small>Conversão</small><b>${pct(summary.conversionRate)}</b></div></div><div class="gs-v5-insights"><div><small>⚠ Maior gasto / menor eficiência</small>${campaignLine(ins.highestSpendLowConversion,'waste')}</div><div><small>★ Melhor ROAS</small>${campaignLine(ins.bestRoas,'roas')}</div><div><small>↑ Maior investimento</small>${campaignLine(ins.topSpend,'spend')}</div><div><small>Campanhas com gasto e 0 pedidos</small><b>${num(ins.zeroOrderSpendCount)}</b><span>Prioridade para revisão</span></div></div><div class="gs-v5-foot">Dados reais da conexão Shopee. O Gestor não inventa números quando a fonte não responde.</div>`;
  anchor.appendChild(gold);
}

let homeBusy=false;
async function ensureHome(){
  if(!isHome())return;
  const c=content();
  if(!c||c.querySelector('.gs-ency-home')||!c.querySelector('.lm-wrap')||homeBusy)return;
  homeBusy=true;
  try{
    const d=await homeData();
    if(isHome()&&content()?.querySelector('.lm-wrap')&&!content()?.querySelector('.gs-ency-home'))appendHomeCards(d);
  }catch(e){}finally{homeBusy=false;}
}

// IMPORTANTE: este módulo cuida SOMENTE da página Início.
// Shopee Ads é responsabilidade exclusiva do ads-control-v7.js.
// Não chamamos GestorLiveModules.render('ads') aqui para evitar dois renderizadores
// disputando #content e alternando a tela em loop.
let scheduled=false;
function run(){scheduled=false;ensureHome();}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(run,220);}
const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{childList:true,subtree:true});
setInterval(run,1800);
setTimeout(run,250);
setTimeout(run,900);
})();
