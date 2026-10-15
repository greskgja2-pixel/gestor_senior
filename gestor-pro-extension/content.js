// Gestor Pro T01 — painel experimental. Não envia dados a servidores.
(() => {
  if(window.__gestorProContentLoaded)return;
  window.__gestorProContentLoaded=true;
  const MAX=500;
  const records=new Map();
  const script=document.createElement('script');
  script.src=chrome.runtime.getURL('intercept.js');
  script.onload=()=>script.remove();
  (document.documentElement||document.head).appendChild(script);
  const min=Date.UTC(2015,0,1)/1000,max=Date.UTC(2100,0,1)/1000;
  const norm=x=>{if(x==null||x==='')return null;let n=Number(x);if(!Number.isFinite(n))return null;if(n>1e12)n/=1000;return n>=min&&n<=max?Math.floor(n):null};
  function ingest(d) {
    const queue=[d?.data?.item_cards,d?.data?.items,d?.data?.sections,d?.items,d?.data?.search_result?.items];
    const visited=new Set();
    let examined=0;
    while(queue.length && examined<1200) {
      const node=queue.shift();if(!node||typeof node!=='object'||visited.has(node))continue;
      visited.add(node);examined++;
      if(Array.isArray(node)){queue.push(...node.slice(0,150));continue;}
      const item=node.item_data||node.item_basic||node;
      const id=item.itemid??item.item_id,shop=item.shopid??item.shop_id;
      if(id!=null&&shop!=null){
        const ts=norm(item.ctime??item.create_time??item.created_at);
        const key=String(shop)+':'+String(id);
        records.set(key,{id:String(id),shop:String(shop),ts,field:item.ctime!=null?'ctime':item.create_time!=null?'create_time':item.created_at!=null?'created_at':null});
        if(records.size>MAX) records.delete(records.keys().next().value);
      }
      for(const k of ['item_cards','item_data','item_basic','items','sections','item','data','search_result','item_list']) if(node[k])queue.push(node[k]);
    }
    render();
  }
  const date=ts=>ts?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}).format(ts*1000):'Não disponível';
  function render(){
    for(const a of document.querySelectorAll('a[href*="-i."]')){
      const href=a.getAttribute('href')||'';
      const m=href.match(/-i\\.(\\d+)\\.(\\d+)/);if(!m)continue;
      const rec=records.get(m[1]+':'+m[2]);if(!rec)continue;
      let host=a.closest('[data-sqe="item"]')||a.parentElement;
      if(!host||host.querySelector('[data-gestor-pro-t01]'))continue;
      const el=document.createElement('div');el.dataset.gestorProT01='true';
      el.style.cssText='font:12px system-ui,sans-serif;padding:6px 8px;margin-top:3px;background:#14253a;color:#fff;border-radius:6px;border-left:3px solid #4ade80;line-height:1.5';
      const label=document.createElement('strong');label.textContent='Gestor Pro · Criado em: ';
      const value=document.createElement('span');value.textContent=date(rec.ts);
      el.append(label,value);el.title=rec.field?'Fonte experimental: busca Shopee / '+rec.field+' — data ainda não validada':'Campo de criação não localizado';
      host.appendChild(el);
    }
  }
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.source!=='GESTOR_PRO_LAB'||e.data.type!=='SEARCH_RESPONSE')return;
    ingest(e.data.data);
  });
  const obs=new MutationObserver(()=>render());
  const start=()=>obs.observe(document.body,{childList:true,subtree:true});
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
