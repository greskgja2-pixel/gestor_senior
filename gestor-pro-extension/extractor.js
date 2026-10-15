// Gestor Pro — normalizador experimental T01: timestamps não comprovados
const GP_TIME_MIN = Date.UTC(2015,0,1)/1000;
const GP_TIME_MAX = Date.UTC(2100,0,1)/1000;
function normalizeTimestamp(input) {
  if (input === null || input === undefined || input === '') return null;
  const raw = typeof input === 'string' && /^\d+$/.test(input) ? Number(input) : input;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const seconds=raw>1e12?raw/1000:raw;
    return seconds>=GP_TIME_MIN && seconds<=GP_TIME_MAX?Math.floor(seconds):null;
  }
  return null;
}
function candidateProducts(payload) {
  const buckets = [
    payload?.data?.item_cards,
    payload?.data?.items,
    payload?.data?.sections,
    payload?.items,
    payload?.data?.search_result?.items
  ];
  const result=[];
  const seen=new Set();
  function walk(value,depth) {
    if(depth>6||!value||typeof value!=='object') return;
    if(Array.isArray(value)) { for(const x of value.slice(0,200))walk(x,depth+1);return; }
    const item = value.item_data || value.item_basic || value;
    const itemId = item.itemid ?? item.item_id;
    const shopId = item.shopid ?? item.shop_id;
    if(itemId!=null && shopId!=null){
      const key=String(shopId)+':'+String(itemId);
      if(!seen.has(key)){seen.add(key);result.push({itemId:String(itemId),shopId:String(shopId),creationTimestamp:normalizeTimestamp(item.ctime ?? item.create_time ?? item.created_at),sourceField:item.ctime!=null?'ctime':item.create_time!=null?'create_time':item.created_at!=null?'created_at':null});}
    }
    for(const [k,v] of Object.entries(value))if(['item_cards','item_data','item_basic','items','sections','item','data','search_result','item_list'].includes(k))walk(v,depth+1);
  }
  for(const b of buckets)walk(b,0);
  return result;
}
function formatCreation(timestamp) {
  return timestamp==null ? 'Não disponível' : new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(timestamp*1000));
}
if(typeof module!=='undefined') module.exports={normalizeTimestamp,candidateProducts,formatCreation};
