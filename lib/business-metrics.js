const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
export const numberOrNull=v=>finite(v)?Number(v):null;

export function grossMargin({price,cost,packaging=0}={}){
  const p=numberOrNull(price),c=numberOrNull(cost),pack=numberOrNull(packaging)??0;
  if(p==null||p<=0||c==null)return{amount:null,percent:null,source:null};
  const amount=p-(c+pack);
  return{amount,percent:amount/p*100,source:'bruta · preço atual × custo cadastrado'};
}

// Margem estimada padrão do Gestor: comissão de 20% + taxa fixa de R$ 4,50 (vigente desde 01/10/2026
// para anúncios de R$ 8–79,99). Implementação única: Super Análise, Super Anúncio e Reanálise usam esta função
// para nunca divergir (antes, o Super Anúncio lia um marginPct salvo em 25/09, quando a taxa fixa era R$ 4,00).
export const SHOPEE_COMMISSION_RATE=0.2;
export const SHOPEE_FIXED_FEE=4.5;
export function shopeeMarginCalc(price,cost){
  const p=numberOrNull(price),c=numberOrNull(cost);
  if(p==null||p<=0||c==null)return null;
  const commission=p*SHOPEE_COMMISSION_RATE,profit=p-c-commission-SHOPEE_FIXED_FEE;
  return{price:p,cost:c,commissionRate:SHOPEE_COMMISSION_RATE,fixedFee:SHOPEE_FIXED_FEE,commission,profit,marginPct:profit/p*100};
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
