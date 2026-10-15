// Gestor Pro — observação passiva da busca, sem alterar a resposta original
(() => {
  if (window.__gestorProSearchObserver) return;
  window.__gestorProSearchObserver = true;
  const isSearch = url => /\/api\/v[234]\/search\/|\/api\/v[234]\/search_items|\/api\/v[234]\/search\/search_items|\/api\/v[234]\/recommend/.test(String(url || ''));
  const emit = (url, data) => {
    try {
      if (!isSearch(url)) return;
      window.postMessage({ source:'GESTOR_PRO_LAB', type:'SEARCH_RESPONSE', url: String(url).split('?')[0], data }, location.origin);
    } catch (_) {}
  };
  const oldFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await oldFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (isSearch(url)) response.clone().json().then(data=>emit(url,data)).catch(()=>{});
    } catch (_) {}
    return response;
  };
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method,url,...rest){
    this.__gpUrl=url;
    return origOpen.call(this,method,url,...rest);
  };
  XMLHttpRequest.prototype.send = function(...args){
    if(isSearch(this.__gpUrl)) this.addEventListener('load',function(){
      try { if(this.responseType===''||this.responseType==='text') emit(this.__gpUrl,JSON.parse(this.responseText)); } catch(_){}
    },{once:true});
    return origSend.apply(this,args);
  };
})();
