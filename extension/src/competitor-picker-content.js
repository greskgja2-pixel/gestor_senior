(() => {
  'use strict';
  const RESULT_KEY='gsCompetitorPickerResultV1';
  const params=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  const requestId=params.get('gs_competitor_picker');
  const ownItemId=String(params.get('gs_own_item')||'');
  if(!requestId||!/^\/search(?:$|\/|\?)/i.test(location.pathname+location.search))return;

  const selected=new Map();
  const marked=new Set();
  let scheduled=false;

  const css=`
    #gs-competitor-picker-bar{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483646;width:min(760px,calc(100vw - 28px));background:#07111df5;color:#edf5fd;border:2px solid #d7b33d;border-radius:14px;box-shadow:0 14px 40px #0007;padding:12px 14px;font:13px/1.35 system-ui,Segoe UI,sans-serif;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
    #gs-competitor-picker-bar b{display:block;font-size:14px;color:#f2d36d}#gs-competitor-picker-bar small{display:block;color:#b9c9d8;margin-top:2px}
    #gs-competitor-picker-actions{display:flex;gap:7px;align-items:center}#gs-competitor-picker-count{font-weight:900;color:#f2d36d;white-space:nowrap}
    #gs-competitor-picker-bar button{border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer;border:1px solid #38516a;background:#17283a;color:#edf5fd}
    #gs-competitor-picker-bar button.primary{background:linear-gradient(135deg,#b28b18,#e0bd47);border-color:#e1bd43;color:#191305}#gs-competitor-picker-bar button:disabled{opacity:.5;cursor:not-allowed}
    .gs-competitor-pick-anchor{position:relative!important;outline-offset:2px}.gs-competitor-pick-anchor.gs-selected{outline:3px solid #d7b33d!important;border-radius:8px}
    .gs-competitor-pick-btn{position:absolute!important;top:7px!important;right:7px!important;z-index:2147483000!important;border:1px solid #d7b33d!important;background:#07111df2!important;color:#f2d36d!important;border-radius:999px!important;padding:7px 10px!important;font:800 12px/1 system-ui!important;box-shadow:0 4px 14px #0007!important;cursor:pointer!important;white-space:nowrap!important}
    .gs-competitor-pick-btn.selected{background:#d7b33d!important;color:#17120a!important}
    @media(max-width:700px){#gs-competitor-picker-bar{grid-template-columns:1fr;top:8px}#gs-competitor-picker-actions{justify-content:space-between}}
  `;

  function parseIds(href){
    const s=String(href||'');
    let m=s.match(/\/product\/(\d+)\/(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};
    m=s.match(/-i\.(\d+)\.(\d+)/i);if(m)return{shopId:m[1],itemId:m[2]};
    return{shopId:null,itemId:null};
  }
  function brNumber(raw){const s=String(raw||'').replace(/[^\d.,]/g,'');if(!s)return null;const n=Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);return Number.isFinite(n)?n:null;}
  function soldNumber(text){const m=String(text||'').match(/([\d.,]+)\s*(mil|k)?\s*\+?\s*vendid[oa]s?/i);if(!m)return null;let n=brNumber(m[1]);if(n==null)return null;if(m[2])n*=1000;return Math.round(n);}
  function cleanTitle(text){return String(text||'').replace(/R\$\s*[\d.,]+/gi,' ').replace(/[\d.,]+\s*(?:mil|k)?\s*\+?\s*vendid[oa]s?/gi,' ').replace(/\s+/g,' ').trim().slice(0,220);}
  function candidateData(anchor){
    const ids=parseIds(anchor.href);if(!ids.itemId||String(ids.itemId)===ownItemId)return null;
    const root=anchor.closest('[data-sqe="item"]')||anchor.closest('.shopee-search-item-result__item')||anchor.parentElement||anchor;
    const text=String(root.innerText||anchor.innerText||'').trim();
    const img=root.querySelector('img')||anchor.querySelector('img');
    const alt=img?.getAttribute('alt')||'';
    const priceMatch=text.match(/R\$\s*([\d.]+,\d{2}|\d+[.,]\d{2})/i);
    const ratingMatch=text.match(/(?:^|\s)([0-5](?:[.,]\d))(?:\s|$)/);
    let title=cleanTitle(alt)||cleanTitle(anchor.getAttribute('aria-label'))||cleanTitle(text.split('\n').find(x=>x.trim().length>8)||text);
    if(!title)title=`Produto ${ids.itemId}`;
    return{itemId:String(ids.itemId),shopId:String(ids.shopId||''),title,price:priceMatch?brNumber(priceMatch[1]):null,rating:ratingMatch?brNumber(ratingMatch[1]):null,sold:soldNumber(text),imageUrl:img?.currentSrc||img?.src||null,link:anchor.href,source:'manual-shopee-picker'};
  }

  function updateBar(){
    const count=document.getElementById('gs-competitor-picker-count'),done=document.getElementById('gs-competitor-picker-done');
    if(count)count.textContent=`${selected.size}/3 selecionados`;
    if(done)done.disabled=selected.size!==3;
  }
  function syncAnchor(anchor,itemId){
    const on=selected.has(String(itemId));anchor.classList.toggle('gs-selected',on);const b=anchor.querySelector(':scope > .gs-competitor-pick-btn');if(b){b.classList.toggle('selected',on);b.textContent=on?'✓ Selecionado':'＋ Selecionar';}
  }
  function toggle(anchor,data,e){
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const id=String(data.itemId);
    if(selected.has(id))selected.delete(id);else{if(selected.size>=3){const bar=document.getElementById('gs-competitor-picker-bar');bar?.animate([{transform:'translateX(-50%) scale(1)'},{transform:'translateX(-50%) scale(1.02)'},{transform:'translateX(-50%) scale(1)'}],{duration:220});return;}selected.set(id,data);}
    document.querySelectorAll('.gs-competitor-pick-anchor').forEach(a=>{const x=parseIds(a.href);if(x.itemId)syncAnchor(a,x.itemId);});updateBar();
  }
  function decorate(){
    scheduled=false;
    const anchors=[...document.querySelectorAll('a[href*="-i."],a[href*="/product/"]')];
    for(const anchor of anchors){
      const data=candidateData(anchor);if(!data||marked.has(data.itemId))continue;
      if(anchor.querySelector('.gs-competitor-pick-btn')){marked.add(data.itemId);continue;}
      marked.add(data.itemId);anchor.classList.add('gs-competitor-pick-anchor');anchor.dataset.gsPickerItem=data.itemId;
      const btn=document.createElement('button');btn.type='button';btn.className='gs-competitor-pick-btn';btn.textContent='＋ Selecionar';btn.title='Adicionar como concorrente da Super Análise';
      btn.addEventListener('click',e=>toggle(anchor,candidateData(anchor)||data,e),true);anchor.appendChild(btn);syncAnchor(anchor,data.itemId);
    }
  }
  function scheduleDecorate(){if(scheduled)return;scheduled=true;setTimeout(decorate,120);}

  async function finish(cancelled=false){
    const done=document.getElementById('gs-competitor-picker-done');if(done)done.disabled=true;
    const payload={requestId,createdAt:Date.now(),cancelled,items:cancelled?[]:[...selected.values()].slice(0,3)};
    await chrome.storage.local.set({[RESULT_KEY]:payload});
    const bar=document.getElementById('gs-competitor-picker-bar');if(bar){bar.querySelector('small').textContent=cancelled?'Voltando para a análise…':'Enviando os 3 concorrentes para a Super Análise…';}
  }

  function install(){
    if(document.getElementById('gs-competitor-picker-bar'))return;
    const style=document.createElement('style');style.textContent=css;document.documentElement.appendChild(style);
    const bar=document.createElement('div');bar.id='gs-competitor-picker-bar';bar.innerHTML=`<div><b>Escolha 3 concorrentes para a Super Análise</b><small>Selecione os 3 anúncios mais comparáveis. A extensão enviará os dados de volta automaticamente.</small></div><div id="gs-competitor-picker-actions"><span id="gs-competitor-picker-count">0/3 selecionados</span><button id="gs-competitor-picker-cancel">Cancelar</button><button id="gs-competitor-picker-done" class="primary" disabled>Voltar para Análise</button></div>`;
    document.documentElement.appendChild(bar);
    bar.querySelector('#gs-competitor-picker-done').addEventListener('click',()=>finish(false));
    bar.querySelector('#gs-competitor-picker-cancel').addEventListener('click',()=>finish(true));
    const fab=document.getElementById('gs-senior-fab');if(fab)fab.style.display='none';
    decorate();new MutationObserver(scheduleDecorate).observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('scroll',scheduleDecorate,{passive:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();