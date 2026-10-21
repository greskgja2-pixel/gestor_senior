import {fetchJsonWithTimeout} from './client-async';

// Lista oficial de categorias da Shopee (Open Platform, via /api/shopee/catalog?resource=categories).
// A lista é grande, então fica em cache por alguns minutos e uma única busca atende todas as telas.
const TTL_MS=10*60*1000;
let cache={at:0,promise:null};

export function loadCategoryTree(){
  const now=Date.now();
  if(cache.promise&&now-cache.at<TTL_MS)return cache.promise;
  const promise=fetchJsonWithTimeout('/api/shopee/catalog?resource=categories',{cache:'no-store'},30000).then(data=>{
    const list=data?.response?.category_list||data?.category_list||[];
    const byId=new Map();
    for(const c of Array.isArray(list)?list:[]){
      const id=Number(c?.category_id);
      if(!Number.isSafeInteger(id)||id<=0)continue;
      byId.set(id,{id,parent:Number(c?.parent_category_id)||0,name:String(c?.display_category_name||c?.original_category_name||'').trim(),hasChildren:Boolean(c?.has_children)});
    }
    if(!byId.size)throw new Error('A Shopee não devolveu a lista de categorias.');
    return byId;
  });
  promise.catch(()=>{if(cache.promise===promise)cache={at:0,promise:null}});
  cache={at:now,promise};
  return promise;
}

// "Beleza › Maquiagem › Rosto › Blush"
export function categoryPath(byId,id){
  const parts=[];
  let current=byId?.get(Number(id)),guard=0;
  while(current&&guard++<8){parts.unshift(current.name);current=current.parent?byId.get(current.parent):null}
  return parts.join(' › ');
}

export const normalizeText=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const flat=v=>normalizeText(v).replace(/[^a-z0-9]/g,'');

// Compara duas categorias por ID quando os dois existem; senão pelo texto sem separadores
// (a coleta às vezes traz "BelezaMaquiagemRosto" em vez de "Beleza > Maquiagem > Rosto"). null = não dá para comparar.
export function sameCategory({textA,idA,textB,idB}){
  if(idA&&idB)return String(idA)===String(idB);
  const a=flat(textA),b=flat(textB);
  if(!a||!b)return null;
  // A coleta pode trazer menos níveis que o caminho completo (ex.: 3 de 4): se um caminho contém o outro, é a mesma ramificação.
  return a===b||a.startsWith(b)||b.startsWith(a)||a.endsWith(b)||b.endsWith(a);
}

// Categorias finais (sem subcategorias) cujo caminho contém o texto buscado. Só estas podem ser usadas em um anúncio.
export function searchLeafCategories(byId,query,limit=40){
  const q=normalizeText(query).trim();
  if(!byId||q.length<2)return[];
  const out=[];
  for(const c of byId.values()){
    if(c.hasChildren)continue;
    const path=categoryPath(byId,c.id);
    if(normalizeText(path).includes(q)){out.push({id:c.id,path});if(out.length>=limit)break}
  }
  return out;
}
export function countLeafCategories(byId){let total=0;for(const c of byId?.values?.()||[])if(!c.hasChildren)total++;return total}
