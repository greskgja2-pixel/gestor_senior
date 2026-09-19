export class TimeoutError extends Error{
  constructor(message='A operação demorou mais do que o esperado.'){
    super(message);this.name='TimeoutError';this.code='timeout';
  }
}

export function classifyAsyncError(error){
  if(error?.code==='timeout'||error?.name==='AbortError'||error?.name==='TimeoutError')return'timeout';
  if(error?.code==='engine-unavailable')return'error';
  return'error';
}

export async function fetchJsonWithTimeout(url,options={},timeoutMs=20000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const err=new Error(data?.error||`HTTP ${response.status}`);
      err.code='http';err.status=response.status;err.data=data;throw err;
    }
    return data;
  }catch(error){
    if(error?.name==='AbortError')throw new TimeoutError(`A operação excedeu ${Math.ceil(timeoutMs/1000)} segundos.`);
    throw error;
  }finally{clearTimeout(timer)}
}

export function motorRequest(action,payload={},timeoutMs=22000){
  if(typeof window==='undefined'){
    const error=new Error('Motor Senior indisponível fora do navegador.');
    error.code='engine-unavailable';
    return Promise.reject(error);
  }
  return new Promise((resolve,reject)=>{
    const requestId=`gs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let done=false;
    const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('message',onMessage);fn(value)};
    const onMessage=event=>{
      if(event.source!==window||event.data?.source!=='GS_EXTENSION'||event.data?.type!=='GS_ENGINE_RESPONSE'||String(event.data?.requestId)!==requestId)return;
      const result=event.data?.result||{};
      if(result?.ok===false){
        const error=new Error(result?.error||'O Motor Senior retornou uma falha.');
        error.code='engine';finish(reject,error);return;
      }
      finish(resolve,result);
    };
    const timer=setTimeout(()=>finish(reject,new TimeoutError(`O Motor Senior não respondeu em ${Math.ceil(timeoutMs/1000)} segundos.`)),timeoutMs);
    window.addEventListener('message',onMessage);
    window.postMessage({source:'GS_GESTOR',type:'GS_ENGINE_REQUEST',requestId,action,payload},location.origin);
  });
}

export async function motorData(action,payload={},timeoutMs=22000){
  const result=await motorRequest(action,payload,timeoutMs);
  return result?.data??result;
}
