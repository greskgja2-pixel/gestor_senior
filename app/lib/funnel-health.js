const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const val=x=>num(x?.value??x);
const arr=v=>Array.isArray(v)?v:[];
// Erros do Motor vêm como {source,error}; String(objeto) virava "[object Object]" e escondia a causa real.
function describeSellerError(x){
  if(x&&typeof x==='object'&&!Array.isArray(x)){
    const source=x.source!=null?String(x.source):null;
    const message=x.error!=null?String(x.error):(x.message!=null?String(x.message):null);
    const text=message||(()=>{try{return JSON.stringify(x)}catch{return'[erro sem descrição]'}})();
    return(source?source+': ':'')+text.slice(0,280);
  }
  return String(x).slice(0,300);
}

export function deriveStoreFunnel(seller){
  const s=seller||{},k=s.keyMetrics||{},rt=s.realtime?.key_metrics||{},overview=s.productOverview||{};
  const products=arr(s.products);
  // Não transformar campo ausente em zero nem apresentar subtotal como total da loja.
  const completeProductTotal=field=>products.length&&products.every(p=>num(p?.[field])!=null)
    ?products.reduce((sum,p)=>sum+num(p[field]),0):null;
  const productImpressions=completeProductTotal('product_card_impressions');
  const productClicks=completeProductTotal('product_card_clicks');
  const totals={
    impressions:productImpressions??val(k.product_impressions),
    clicks:productClicks??val(k.product_clicks),
    visitors:val(k.shop_uv)??val(overview.uv)??num(rt.uv),
    carts:val(overview.atc_uv),
    placed:val(k.place_orders)??val(overview.placed_order)??num(rt.orders),
    paid:val(k.paid_orders)??val(overview.paid_order),
    confirmed:val(k.confirmed_orders)??val(overview.confirmed_order),
    paidGmv:val(k.paid_gmv)??val(overview.paid_gmv)??num(rt.sales)
  };
  // Origem de cada total (mesma ordem de prioridade acima) para a UI não tratar fontes diferentes como um percurso único.
  const pick=(...opts)=>{for(const [value,label] of opts)if(value!=null)return label;return null};
  const sources={
    impressions:pick([productImpressions,'Soma dos anúncios · ranking de produtos'],[val(k.product_impressions),'Resumo da loja · key-metrics']),
    clicks:pick([productClicks,'Soma dos anúncios · ranking de produtos'],[val(k.product_clicks),'Resumo da loja · key-metrics']),
    visitors:pick([val(k.shop_uv),'Visitantes da loja · key-metrics (shop_uv)'],[val(overview.uv),'Visão geral de produtos (uv)'],[num(rt.uv),'Tempo real (uv)']),
    carts:pick([val(overview.atc_uv),'Visão geral de produtos (atc_uv)']),
    placed:pick([val(k.place_orders),'Pedidos criados · key-metrics'],[val(overview.placed_order),'Visão geral de produtos (placed_order)'],[num(rt.orders),'Tempo real (pedidos)']),
    paid:pick([val(k.paid_orders),'Pedidos pagos · key-metrics'],[val(overview.paid_order),'Visão geral de produtos (paid_order)']),
    confirmed:pick([val(k.confirmed_orders),'Pedidos confirmados · key-metrics'],[val(overview.confirmed_order),'Visão geral de produtos (confirmed_order)'])
  };
  const rates={
    ctr:totals.impressions>0&&totals.clicks!=null?totals.clicks/totals.impressions:null,
    clickVisit:totals.clicks>0&&totals.visitors!=null?totals.visitors/totals.clicks:null,
    visitCart:totals.visitors>0&&totals.carts!=null?totals.carts/totals.visitors:null,
    cartPlaced:totals.carts>0&&totals.placed!=null?totals.placed/totals.carts:null,
    placedPaid:totals.placed>0&&totals.paid!=null?totals.paid/totals.placed:null,
    paidConfirmed:totals.paid>0&&totals.confirmed!=null?totals.confirmed/totals.paid:null
  };
  const stageEntries=[
    ['impressions','Impressões'],['clicks','Cliques'],['visitors','Visitantes'],['carts','Carrinho'],
    ['placed','Pedido'],['paid','Pago'],['confirmed','Confirmado']
  ];
  const transitionEntries=[
    ['ctr','Impressões → Cliques'],['clickVisit','Cliques → Visitantes'],['visitCart','Visitantes → Carrinho'],
    ['cartPlaced','Carrinho → Pedido'],['placedPaid','Pedido → Pago'],['paidConfirmed','Pago → Confirmado']
  ];
  const presentStages=stageEntries.filter(([key])=>totals[key]!=null).map(([,label])=>label);
  const missingStages=stageEntries.filter(([key])=>totals[key]==null).map(([,label])=>label);
  const validTransitions=transitionEntries.filter(([key])=>rates[key]!=null).map(([,label])=>label);
  return{
    totals,rates,sources,
    coverage:{
      presentStages,missingStages,validTransitions,
      stageCount:presentStages.length,
      transitionCount:validTransitions.length,
      canDiagnose:validTransitions.length>0,
      healthy:presentStages.length>=5&&validTransitions.length>=3
    },
    evidence:{
      period:s?.period?.type||null,
      productCount:products.length,
      // Catálogo relatado pela Shopee (rankings.total) vs. produtos que realmente chegaram no Gestor.
      // Divergência aqui aponta coleta incompleta (ex.: página do ranking que falhou), não "poucos dados".
      productsExpected:num(s.totalProducts),
      rankingsPagesFailed:arr(s.errors).filter(e=>/^product-rankings-page-/.test(String(e?.source||''))).length,
      productFields:{
        impressions:products.filter(p=>num(p?.product_card_impressions)!=null).length,
        clicks:products.filter(p=>num(p?.product_card_clicks)!=null).length
      },
      keyMetrics:{
        product_clicks:val(k.product_clicks)!=null,
        shop_uv:val(k.shop_uv)!=null,
        place_orders:val(k.place_orders)!=null,
        paid_orders:val(k.paid_orders)!=null,
        confirmed_orders:val(k.confirmed_orders)!=null,
        paid_gmv:val(k.paid_gmv)!=null
      },
      productOverview:{
        uv:val(overview.uv)!=null,
        atc_uv:val(overview.atc_uv)!=null,
        placed_order:val(overview.placed_order)!=null,
        paid_order:val(overview.paid_order)!=null,
        confirmed_order:val(overview.confirmed_order)!=null,
        paid_gmv:val(overview.paid_gmv)!=null
      },
      realtime:{
        uv:num(rt.uv)!=null,
        orders:num(rt.orders)!=null,
        sales:num(rt.sales)!=null
      },
      sellerErrors:arr(s.errors).map(describeSellerError).slice(0,20)
    }
  };
}
