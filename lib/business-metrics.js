const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
export const numberOrNull=v=>finite(v)?Number(v):null;

export function grossMargin({price,cost,packaging=0}={}){
  const p=numberOrNull(price),c=numberOrNull(cost),pack=numberOrNull(packaging)??0;
  if(p==null||p<=0||c==null)return{amount:null,percent:null,source:null};
  const amount=p-(c+pack);
  return{amount,percent:amount/p*100,source:'bruta · preço atual × custo cadastrado'};
}

export function adsDerivedMetrics({spend,gmv,impressions,clicks,orders,cartAdds}={}){
  const s=numberOrNull(spend),g=numberOrNull(gmv),i=numberOrNull(impressions),cl=numberOrNull(clicks),o=numberOrNull(orders),ca=numberOrNull(cartAdds);
  return{
    roas:s!=null&&s>0&&g!=null?g/s:null,
    ctr:i!=null&&i>0&&cl!=null?cl/i*100:null,
    cpc:cl!=null&&cl>0&&s!=null?s/cl:null,
    conversionRate:cl!=null&&cl>0&&o!=null?o/cl*100:null,
    costPerOrder:o!=null&&o>0&&s!=null?s/o:null,
    cartRate:cl!=null&&cl>0&&ca!=null?ca/cl*100:null
  };
}
