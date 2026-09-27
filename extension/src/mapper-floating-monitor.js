(()=>{
'use strict';
const STATE_KEY='gsAutoMapperStateV1';
const HOST_ID='gs-mapper-floating-monitor';
let lastLive=null,lastState=null,hideTimer=null;

function statusLabel(s){
  return ({running:'Mapeando',paused:'Pausado',stopping:'Parando',stopped:'Parado',completed:'Concluído',error:'Erro',interrupted:'Interrompido'})[s]||'Mapeador';
}

const enc=new TextEncoder();
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function u16(n){return[n&255,(n>>>8)&255]}function u32(n){return[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
function concat(parts){const size=parts.reduce((a,p)=>a+p.length,0),out=new Uint8Array(size);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function dataUrlBytes(dataUrl){const b64=String(dataUrl||'').split(',')[1]||'',bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function zipStore(files){
  const locals=[],centrals=[];let offset=0;
  for(const f of files){
    const name=enc.encode(f.name),data=f.bytes instanceof Uint8Array?f.bytes:enc.encode(String(f.text||'')),crc=crc32(data);
    const local=concat([new Uint8Array([80,75,3,4]),new Uint8Array(u16(20)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u32(crc)),new Uint8Array(u32(data.length)),new Uint8Array(u32(data.length)),new Uint8Array(u16(name.length)),new Uint8Array(u16(0)),name,data]);locals.push(local);
    const central=concat([new Uint8Array([80,75,1,2]),new Uint8Array(u16(20)),new Uint8Array(u16(20)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u32(crc)),new Uint8Array(u32(data.length)),new Uint8Array(u32(data.length)),new Uint8Array(u16(name.length)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u32(0)),new Uint8Array(u32(offset)),name]);centrals.push(central);offset+=local.length;
  }
  const body=concat(locals),central=concat(centrals),end=concat([new Uint8Array([80,75,5,6]),new Uint8Array(u16(0)),new Uint8Array(u16(0)),new Uint8Array(u16(files.length)),new Uint8Array(u16(files.length)),new Uint8Array(u32(central.length)),new Uint8Array(u32(body.length)),new Uint8Array(u16(0))]);
  return new Blob([body,central,end],{type:'application/zip'});
}
async function exportZip(auto=false){
  const host=document.getElementById(HOST_ID),root=host?.shadowRoot,btn=root?.getElementById('export');
  if(btn){btn.disabled=true;btn.textContent=auto?'Preparando download…':'Montando ZIP…';}
  try{
    const r=await chrome.runtime.sendMessage({type:'GS_MAPPER_EXPORT'});
    if(!r?.ok)throw new Error(r?.error||'Falha ao exportar');
    const {state,screens,apis}=r.data||{};
    if(!state)throw new Error('Nenhuma sessão de mapeamento encontrada');
    const summary={sessionId:state.sessionId,status:state.status,startedAt:state.startedAt,finishedAt:state.updatedAt,progress:state.percent,regionMode:state.settings?.regionMode||'all',searchProducts:state.searchResearch?.products?.length||0,discovered:state.discovered,processed:state.processed,skipped:state.skipped,screenshots:screens?.length||0,pages:state.pages?.length||0,apis:apis?.length||0,errors:state.errors?.length||0};
    const files=[
      {name:'resumo.json',text:JSON.stringify(summary,null,2)},
      {name:'mapa.json',text:JSON.stringify({...state,queue:state.queue||[]},null,2)},
      {name:'apis.json',text:JSON.stringify(apis||[],null,2)},
      {name:'logs/execucao.json',text:JSON.stringify(state.logs||[],null,2)},
      {name:'logs/erros.json',text:JSON.stringify(state.errors||[],null,2)}
    ];
    if(state.searchResearch)files.push({name:'pesquisa-shopee/resultados-pesquisa.json',text:JSON.stringify(state.searchResearch,null,2)});
    for(const s of screens||[])if(s.dataUrl)files.push({name:s.name||('screenshots/'+Date.now()+'.png'),bytes:dataUrlBytes(s.dataUrl)});
    const blob=zipStore(files),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='Motor-Senior-Mapeamento-'+new Date().toISOString().slice(0,10)+'.zip';
    (document.body||document.documentElement).appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    await chrome.storage.local.set({gsMapperLastExportedSessionV1:state.sessionId});
    if(btn){btn.textContent='✓ ZIP baixado — baixar novamente';btn.disabled=false;}
    text('sub','Exportação concluída. A coleta continua salva até você limpar a sessão.');
    return true;
  }catch(e){
    if(btn){btn.textContent='⬇ Exportar ZIP';btn.disabled=false;}
    text('sub','Falha no download automático. Toque em Exportar ZIP.');
    return false;
  }
}

function ensure(){
  let host=document.getElementById(HOST_ID);
  if(host)return host;
  host=document.createElement('div');host.id=HOST_ID;
  host.style.cssText='all:initial;position:fixed;z-index:2147483647;right:10px;bottom:12px;width:min(360px,calc(100vw - 20px));font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#eaf4ff;pointer-events:auto;';
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`
    <style>
      *{box-sizing:border-box}button{font:inherit}
      .box{background:rgba(5,20,35,.97);border:1px solid #2d5475;border-radius:16px;box-shadow:0 14px 45px rgba(0,0,0,.38);overflow:hidden;backdrop-filter:blur(10px)}
      .head{display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid #17344d}
      .logo{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#0f2e49;color:#68d4ff;font-weight:900;font-size:12px}
      .titles{min-width:0;flex:1}.titles b{display:block;font-size:13px;color:#f5faff}.titles span{display:block;font-size:10px;color:#8ea9bd;margin-top:1px}
      .mini{border:0;background:#173650;color:#c9eaff;width:31px;height:31px;border-radius:9px;font-size:18px;font-weight:900}
      .body{padding:12px}.status{display:flex;align-items:center;justify-content:space-between;gap:8px}.badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:900;color:#72dbff}.dot{width:8px;height:8px;border-radius:99px;background:#48d68c;box-shadow:0 0 0 4px rgba(72,214,140,.12);animation:pulse 1s infinite alternate}.paused .dot{background:#f0b84a}.error .dot{background:#ff6d7b}.completed .dot{background:#63dca0;animation:none}
      .pct{font-size:18px;font-weight:900}.action{margin:8px 0 9px;font-size:12px;line-height:1.35;color:#dcecff;min-height:32px}.sub{font-size:10px;color:#8ca5b9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bar{height:7px;background:#102b40;border-radius:99px;overflow:hidden;margin:9px 0}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#1b76ff,#43d2ff);border-radius:99px;transition:width .25s ease}
      .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}.stat{padding:7px;border-radius:9px;background:#0c2940;text-align:center}.stat b{display:block;font-size:14px}.stat span{display:block;font-size:8px;color:#89a4b9;margin-top:1px}
      .buttons{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.buttons button{flex:1;border:1px solid #2d5475;background:#12334d;color:#e9f6ff;border-radius:9px;padding:8px;font-size:10px;font-weight:800}.buttons .stop{border-color:#693846;background:#3d202a;color:#ffdce2}.buttons .export{display:none;flex-basis:100%;background:#1769e8;border-color:#2c83ff;color:#fff;padding:10px}.completed .buttons .export{display:block}
      .done{color:#7fe2aa}.hiddenBody .body{display:none}.hiddenBody .head{border-bottom:0}
      @keyframes pulse{from{opacity:.55;transform:scale(.88)}to{opacity:1;transform:scale(1.08)}}
      @media(max-width:520px){.box{border-radius:14px}.head{padding:9px 10px}.body{padding:10px}.stats{gap:4px}.stat{padding:6px 4px}}
    </style>
    <div class="box">
      <div class="head"><div class="logo">GS</div><div class="titles"><b>Mapeador Motor Sênior</b><span id="region">Acompanhamento ao vivo</span></div><button class="mini" id="mini" aria-label="Minimizar">−</button></div>
      <div class="body">
        <div class="status"><span class="badge"><i class="dot"></i><span id="status">Mapeando</span></span><b class="pct" id="pct">0%</b></div>
        <div class="action" id="action">Preparando mapeamento…</div>
        <div class="sub" id="sub">Aguarde enquanto a página é analisada.</div>
        <div class="bar"><i id="bar"></i></div>
        <div class="stats">
          <div class="stat"><b id="products">0</b><span>PRODUTOS</span></div>
          <div class="stat"><b id="apis">0</b><span>APIs</span></div>
          <div class="stat"><b id="screens">0</b><span>CAPTURAS</span></div>
        </div>
        <div class="buttons"><button id="pause">Pausar</button><button class="stop" id="stop">Parar</button><button class="export" id="export">⬇ Exportar ZIP</button></div>
      </div>
    </div>`;
  document.documentElement.appendChild(host);
  const box=root.querySelector('.box');
  root.getElementById('mini').onclick=()=>{box.classList.toggle('hiddenBody');root.getElementById('mini').textContent=box.classList.contains('hiddenBody')?'＋':'−';};
  root.getElementById('pause').onclick=async()=>{
    const s=lastState?.status;
    if(s==='paused')chrome.runtime.sendMessage({type:'GS_MAPPER_RESUME'}).catch(()=>{});
    else chrome.runtime.sendMessage({type:'GS_MAPPER_PAUSE'}).catch(()=>{});
  };
  root.getElementById('stop').onclick=()=>chrome.runtime.sendMessage({type:'GS_MAPPER_STOP'}).catch(()=>{});
  root.getElementById('export').onclick=()=>exportZip(false);
  return host;
}
function remove(){const h=document.getElementById(HOST_ID);if(h)h.remove();}
function text(id,v){const h=document.getElementById(HOST_ID),el=h?.shadowRoot?.getElementById(id);if(el)el.textContent=String(v??'');}
function render(state,live=null){
  lastState=state||lastState;if(live)lastLive=live;
  const s=state?.status||'idle';
  if(!['running','paused','stopping','completed','error','interrupted'].includes(s)){remove();return;}
  const host=ensure(),root=host.shadowRoot,box=root.querySelector('.box');
  box.classList.toggle('paused',s==='paused');box.classList.toggle('error',s==='error'||s==='interrupted');box.classList.toggle('completed',s==='completed');
  const basePct=Number(state?.percent)||0;
  const livePct=Number(lastLive?.percent);
  const pct=s==='completed'?100:(Number.isFinite(livePct)?Math.max(basePct,Math.min(99,livePct)):basePct);
  text('status',statusLabel(s));text('pct',pct+'%');root.getElementById('bar').style.width=pct+'%';
  const region=state?.settings?.regionMode==='shopee-search-results'?'Resultados de pesquisa Shopee':'Mapeamento da página';
  text('region',region);
  const action=lastLive?.label||state?.currentAction?.label||(s==='completed'?'Mapeamento concluído':s==='paused'?'Mapeamento pausado':'Analisando página…');
  text('action',action);
  text('sub',lastLive?.detail||(s==='completed'?'Dados prontos para exportar na extensão.':'Você pode continuar vendo a página enquanto o Motor trabalha.'));
  const products=lastLive?.products??state?.searchResearch?.products?.length??state?.searchResearch?.productCount??0;
  text('products',products);text('apis',state?.apiCount||0);text('screens',state?.screenshots||0);
  const pause=root.getElementById('pause');pause.textContent=s==='paused'?'Continuar':'Pausar';pause.disabled=!['running','paused'].includes(s);
  root.getElementById('stop').disabled=!['running','paused'].includes(s);
  if(s==='completed'){
    root.querySelector('.badge').classList.add('done');
    clearTimeout(hideTimer);
    text('sub','Mapeamento concluído. O ZIP será baixado automaticamente e continuará disponível aqui.');
    chrome.storage.local.get('gsMapperLastExportedSessionV1').then(x=>{
      if(x.gsMapperLastExportedSessionV1!==state?.sessionId)exportZip(true);
      else{
        const btn=root.getElementById('export');
        if(btn)btn.textContent='⬇ Baixar ZIP novamente';
      }
    }).catch(()=>{});
  }
}
async function sync(){
  try{const x=await chrome.storage.local.get(STATE_KEY);render(x[STATE_KEY]||null);}catch{}
}
document.addEventListener('GS_MAPPER_LIVE_PROGRESS',e=>{if(e?.detail)render(lastState,e.detail);});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[STATE_KEY]){lastLive=null;render(changes[STATE_KEY].newValue||null);}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})();