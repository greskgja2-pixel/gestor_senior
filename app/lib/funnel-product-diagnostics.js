const num=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);
const arr=value=>Array.isArray(value)?value:[];
const idOf=value=>String(value??'').trim();

// Métricas objetivas de um anúncio no Seller Center, sem estimativas.
export const PRODUCT_FUNNEL_FIELDS=Object.freeze([
  ['product_card_impressions','Impressões'],
  ['product_card_clicks','Cliques'],
  ['uv','Visitas'],
  ['add_to_cart_buyers','Carrinho'],
  ['placed_buyers','Pedido'],
  ['paid_buyers','Pago'],
  ['confirmed_buyers','Confirmado']
]);

export function productMetricCoverage(seller){
  const products=arr(seller?.products);
  const present=products.reduce((total,p)=>total+PRODUCT_FUNNEL_FIELDS.filter(([field])=>num(p?.[field])!=null).length,0);
  return {productCount:products.length,present,total:products.length*PRODUCT_FUNNEL_FIELDS.length};
}

export function needsFunnelRetry(seller){
  // Campos do panorama geral não provam que o Motor conseguiu ler os anúncios.
  // Um zero retornado é um valor real e não deve disparar uma nova leitura.
  const products=arr(seller?.products);
  return !products.some(p=>num(p?.product_card_impressions)!=null||num(p?.uv)!=null);
}

export function chooseBestFunnelResponse(first,second){
  const a=productMetricCoverage(first),b=productMetricCoverage(second);
  const firstScore=a.present*10+a.productCount;
  const secondScore=b.present*10+b.productCount;
  return secondScore>firstScore?second:first;
}

export function diagnoseFunnelProducts(seller,context,now=Date.now()){
  const allProducts=arr(seller?.products);
  const index=new Map();
  for(const p of allProducts){
    const id=idOf(p?.id??p?.item_id??p?.itemId);
    if(id&&!index.has(id))index.set(id,p);
  }
  const rows=[];
  for(const ctx of Object.values(context||{})){
    const id=idOf(ctx?.itemId);
    if(!id||!ctx?.analyzedAt)continue;
    const age=(now-new Date(ctx.analyzedAt).getTime())/86400000;
    if(!Number.isFinite(age)||age>30||age<0)continue;
    const p=index.get(id)||null;
    const fields=Object.fromEntries(PRODUCT_FUNNEL_FIELDS.map(([field])=>[field,p?num(p[field])!=null:false]));
    const present=Object.values(fields).filter(Boolean).length;
    const primaryReady=fields.product_card_impressions&&fields.uv;
    rows.push({
      id,
      status:!p?'not_returned':present===0?'no_metrics':!primaryReady||present<PRODUCT_FUNNEL_FIELDS.length?'partial':'complete',
      returned:!!p,
      present,
      total:PRODUCT_FUNNEL_FIELDS.length,
      fields
    });
  }
  return {
    periodReported:idOf(seller?.period?.type)||null,
    returnedProductCount:allProducts.length,
    analyzedProductCount:rows.length,
    matchedCount:rows.filter(p=>p.returned).length,
    completeCount:rows.filter(p=>p.status==='complete').length,
    products:rows
  };
}


// O Motor Sênior atualmente oferece sellerFunnel como coleta do período da loja.
// A ação individual lê essa fonte e atualiza somente o produto solicitado.
export function mergeRecollectedFunnelProduct(previous,refreshed,itemId,requestedPeriod){
  const id=idOf(itemId),actualPeriod=idOf(refreshed?.period?.type);
  const unchanged=status=>({seller:previous,status,metrics:0});
  if(!id||!previous||!refreshed)return unchanged('no_response');
  if(!actualPeriod)return unchanged('period_unconfirmed');
  if(actualPeriod!==requestedPeriod)return {...unchanged('period_mismatch'),actualPeriod};
  const candidate=arr(refreshed?.products).find(p=>idOf(p?.id??p?.item_id??p?.itemId)===id);
  if(!candidate)return unchanged('not_returned');
  const count=p=>PRODUCT_FUNNEL_FIELDS.filter(([field])=>num(p?.[field])!=null).length;
  const received=count(candidate);
  if(received===0)return unchanged('no_metrics');
  const oldProducts=arr(previous?.products);
  const existing=oldProducts.find(p=>idOf(p?.id??p?.item_id??p?.itemId)===id);
  if(existing&&count(existing)>received)return {...unchanged('less_complete'),metrics:received};
  const updated={
    ...(existing||{}),
    ...candidate,
    id,
    name:candidate?.name||candidate?.title||candidate?.product_name||existing?.name||existing?.title||null,
    image:candidate?.image||candidate?.image_url||existing?.image||null
  };
  // Não combinar métricas de duas coletas: todas as etapas vêm do mesmo snapshot.
  // Números antigos de etapas ausentes na resposta nova devem permanecer ausentes.
  for(const [field] of PRODUCT_FUNNEL_FIELDS){
    updated[field]=num(candidate[field]);
  }
  // Taxas calculadas também pertencem ao snapshot novo: descartar taxas antigas.
  for(const field of ['ctr','uv_to_add_to_cart_rate','uv_to_placed_buyers_rate','uv_to_paid_buyers_rate']){
    updated[field]=num(candidate[field]);
  }
  const products=oldProducts.filter(p=>idOf(p?.id??p?.item_id??p?.itemId)!==id).concat(updated);
  return {seller:{...previous,products},status:'updated',metrics:received,complete:received===PRODUCT_FUNNEL_FIELDS.length};
}
