const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const val=x=>num(x?.value??x);
const arr=v=>Array.isArray(v)?v:[];

export function deriveStoreFunnel(seller){
  const s=seller||{},k=s.keyMetrics||{},rt=s.realtime?.key_metrics||{},overview=s.productOverview||{};
  const products=arr(s.products);
  const productImpressions=products.length?products.reduce((a,p)=>a+(num(p.product_card_impressions)||0),0):null;
  const productClicks=products.length?products.reduce((a,p)=>a+(num(p.product_card_clicks)||0),0):null;
  const totals={
    impressions:productImpressions,
    clicks:productClicks??val(k.product_clicks),
    visitors:val(k.shop_uv)??val(overview.uv)??num(rt.uv),
    carts:val(overview.atc_uv),
    placed:val(k.place_orders)??val(overview.placed_order)??num(rt.orders),
    paid:val(k.paid_orders)??val(overview.paid_order),
    confirmed:val(k.confirmed_orders)??val(overview.confirmed_order),
    paidGmv:val(k.paid_gmv)??val(overview.paid_gmv)??num(rt.sales)
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
    totals,rates,
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
      sellerErrors:arr(s.errors).map(x=>String(x).slice(0,300)).slice(0,20)
    }
  };
}
