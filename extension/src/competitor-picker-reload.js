(() => {
  'use strict';
  const params=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  if(!params.get('gs_competitor_picker'))return;

  function install(){
    const bar=document.getElementById('gs-competitor-picker-bar');if(!bar)return false;
    const actions=document.getElementById('gs-competitor-picker-actions');if(!actions||document.getElementById('gs-competitor-picker-reload'))return true;
    const btn=document.createElement('button');btn.id='gs-competitor-picker-reload';btn.type='button';btn.textContent='↻ Recarregar';btn.title='Use se os botões “Selecionar” não aparecerem nos anúncios da busca.';
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();btn.disabled=true;btn.textContent='Recarregando…';location.reload();});
    const cancel=document.getElementById('gs-competitor-picker-cancel');actions.insertBefore(btn,cancel||actions.firstChild);return true;
  }
  if(!install()){
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),30000);
  }
})();
