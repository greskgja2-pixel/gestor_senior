// Fontes de Tráfego — validação e diagnóstico (lógica pura, testada em tests/traffic-sources-diagnosis.test.mjs).
//
// Regras:
// 1. Ausência (null) ≠ zero real ≠ valor reservado/inválido. Os três nunca se misturam.
// 2. A Shopee devolve -1000000 em campos que não foram solicitados (ver SENTINEL e docs no CLAUDE.md).
//    Qualquer número negativo em GMV/pedidos/cliques/impressões/taxas é tratado como inválido.
// 3. Não se somam fontes (definições podem se sobrepor, ex.: Ads dentro de Card de produto) e não há "total geral".
// 4. Rankings só usam valores válidos e com amostra mínima; comparações são relativas às outras fontes da PRÓPRIA loja.

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);

export const SENTINEL=-1000000;
export const MIN_CLICKS_FOR_CONVERSION=100;
export const MIN_IMPRESSIONS_FOR_CTR=1000;

export const TRAFFIC_SOURCES=Object.freeze([
  {key:'product_card',label:'Card de produto / Busca',short:'Busca',icon:'search',
    what:'Vendas que começam no card do produto, na busca e nas vitrines da Shopee.'},
  {key:'live',label:'Live',short:'Live',icon:'live',what:'Vendas atribuídas a transmissões ao vivo.'},
  {key:'video',label:'Vídeo',short:'Vídeo',icon:'play',what:'Vendas atribuídas a vídeos curtos.'},
  {key:'affiliate',label:'Afiliados',short:'Afiliados',icon:'users',what:'Vendas atribuídas a links de afiliados.'},
  {key:'paid_ads',label:'Shopee Ads',short:'Ads',icon:'ads',what:'Vendas atribuídas a anúncios pagos. Pode se sobrepor ao Card de produto/Busca.'}
]);

// Lê um campo e classifica: ok (número válido ≥ 0), missing (ausente) ou invalid (negativo/reservado).
export function readField(total,keys){
  for(const key of keys){
    const raw=num(total?.[key]);
    if(raw==null)continue;
    if(raw<0)return{state:'invalid',value:null,raw,sentinel:raw===SENTINEL};
    return{state:'ok',value:raw,raw,sentinel:false};
  }
  return{state:'missing',value:null,raw:null,sentinel:false};
}

const PAID_ADS_NOTE='Confirmado em teste de leitura no Seller Center (17/10/2026): nesta API a Shopee devolve -1.000.000 em todos os detalhes de Ads (pedidos, cliques, impressões, ROAS), com need_paid_ads_data=false ou true. Só o GMV de Ads vem, no resumo (overview). Pedidos, gasto e ROAS de campanhas estão na aba Histórico Ads (outra fonte, outra definição).';

export function normalizeSource(def,total,overview){
  // Resumo (overview): GMV por fonte, participação no GMV total e variação vs período anterior (fração).
  // Nos campos *_pct_diff a Shopee também usa -1.000.000 como "sem dado"; negativos legítimos são variações reais.
  const ovSales=readField(overview,[def.key]);
  const ovRatio=readField(overview,[def.key+'_ratio']);
  const rawDiff=num(overview?.[def.key+'_pct_diff']);
  const pctDiff=rawDiff==null||rawDiff===SENTINEL?null:rawDiff;
  const base={key:def.key,share:ovRatio.value,pctDiff,salesOrigin:null,label:def.label,short:def.short,icon:def.icon,what:def.what,
    status:'missing',reason:'',hypothesis:'',sales:null,orders:null,clicks:null,impressions:null,
    ctr:null,ctrNote:'',conversion:null,conversionNote:'',conversionOrigin:null,salesPerOrder:null,invalidFields:[],sentinel:false};
  if(!total||typeof total!=='object'){
    if(ovSales.value!=null)return{...base,status:'partial',sales:ovSales.value,salesOrigin:'resumo',reason:'Só o GMV do resumo da Shopee está disponível para esta fonte.'};
    return{...base,status:'missing',reason:'A Shopee não enviou esta fonte neste período.'};
  }
  const f={
    sales:readField(total,['sales']),orders:readField(total,['orders']),
    clicks:readField(total,['product_clicks']),impressions:readField(total,['product_impressions']),
    ctr:readField(total,['ctr']),conversion:readField(total,['product_clicks_to_orders_rate','conversion'])
  };
  const labels={sales:'GMV',orders:'pedidos',clicks:'cliques',impressions:'impressões',ctr:'CTR',conversion:'conversão'};
  const invalidFields=Object.entries(f).filter(([,r])=>r.state==='invalid').map(([k])=>labels[k]);
  const sentinel=Object.values(f).some(r=>r.sentinel);
  const out={...base,sales:f.sales.value,orders:f.orders.value,clicks:f.clicks.value,impressions:f.impressions.value,invalidFields,sentinel};

  // CTR só existe com impressões e cliques válidos na MESMA fonte (não confia num ctr isolado).
  if(out.impressions>0&&out.clicks!=null)out.ctr=out.clicks/out.impressions;
  else out.ctrNote=out.impressions===0?'Sem impressões para calcular o CTR.':'Impressões ou cliques indisponíveis; CTR não calculado.';

  // Conversão = pedidos ÷ cliques da própria fonte (conferido nos valores reais: 75/5.498=1,4%, 2/42=4,8%, 1/19=5,3%).
  if(out.clicks>0&&out.orders!=null){
    const fromShopee=f.conversion.value;
    out.conversion=fromShopee!=null&&fromShopee<=1?fromShopee:out.orders/out.clicks;
    out.conversionOrigin=fromShopee!=null&&fromShopee<=1?'Shopee':'calculada';
    if(out.conversion>1){out.conversionNote='Pedidos maiores que cliques: a atribuição não é um funil contínuo; taxa não usada em rankings.'}
  }else out.conversionNote=out.clicks===0?'Sem cliques para calcular a conversão.':'Pedidos ou cliques indisponíveis; conversão não calculada.';
  if(out.sales!=null&&out.orders>0)out.salesPerOrder=out.sales/out.orders;

  // GMV inválido no detalhe, mas válido no resumo: usa o resumo (mesma definição de GMV da Shopee) e descarta o resto.
  if(out.sales==null&&ovSales.value!=null){out.sales=ovSales.value;out.salesOrigin='resumo'}
  else if(out.sales!=null)out.salesOrigin='detalhe';
  const core=[f.sales.state,f.orders.state];
  if(out.salesOrigin==='resumo'&&out.orders==null){
    out.status='partial';
    out.reason=def.key==='paid_ads'?PAID_ADS_NOTE:'O detalhe desta fonte veio inválido; só o GMV do resumo da Shopee foi usado.';
    out.sentinel=out.sentinel||sentinel;
  }else if(core.every(s=>s==='invalid')){
    out.status='unavailable';
    out.reason=sentinel?'A Shopee devolveu o valor reservado -1.000.000 (código de "sem dado"), não um resultado comercial. Nada foi exibido como GMV, pedidos ou taxas.':'A Shopee devolveu valores negativos, que não são resultados comerciais válidos. Nada foi exibido como GMV, pedidos ou taxas.';
    if(def.key==='paid_ads')out.hypothesis=PAID_ADS_NOTE;
  }else if(core.every(s=>s==='missing')){
    out.status='missing';out.reason='A Shopee enviou esta fonte sem GMV nem pedidos neste período.';
  }else if(core.every(s=>s==='ok')&&invalidFields.length===0){
    out.status='ok';
  }else{
    out.status='partial';
    out.reason=invalidFields.length?`Campos inválidos descartados: ${invalidFields.join(', ')}.`:'Alguns campos não vieram da Shopee neste período.';
  }
  return out;
}

export function normalizeTraffic(traffic){
  return TRAFFIC_SOURCES.map(def=>normalizeSource(def,traffic?.[def.key]?.total,traffic?.overview));
}

// GMV total da loja segundo o resumo da Shopee. É a soma das fontes NÃO pagas (Card/Busca + Live + Vídeo + Afiliados);
// Shopee Ads é uma parte que se sobrepõe a elas (conferido: 2.196,64 + 0 + 53,96 + 19,99 = 2.270,59 e Ads = 1.853,47).
export function storeTotals(traffic){
  const t=readField(traffic?.overview,['total_sales']);
  const d=num(traffic?.overview?.total_sales_pct_diff);
  return{sales:t.value,pctDiff:d==null||d===SENTINEL?null:d};
}

export const RANK_METRICS=Object.freeze([
  {id:'sales',label:'GMV',format:'money'},
  {id:'orders',label:'Pedidos',format:'int'},
  {id:'ctr',label:'CTR',format:'pct'},
  {id:'conversion',label:'Conversão',format:'pct'}
]);
export const SHARE_NOTE='Participação = parte do GMV total da loja segundo a Shopee. Ads se sobrepõe às outras fontes, então as participações não somam 100%.';

// Elegibilidade por métrica: valor válido e amostra mínima nas taxas.
export function eligibleFor(source,metric){
  if(source.status==='unavailable'||source.status==='missing')return false;
  if(metric==='sales')return source.sales!=null;
  if(metric==='orders')return source.orders!=null;
  if(metric==='ctr')return source.ctr!=null&&source.impressions>=MIN_IMPRESSIONS_FOR_CTR;
  if(metric==='conversion')return source.conversion!=null&&source.conversion<=1&&source.clicks>=MIN_CLICKS_FOR_CONVERSION;
  return false;
}
export function rankBy(sources,metric){
  const ranked=sources.filter(s=>eligibleFor(s,metric)).map(s=>({source:s,value:s[metric]})).sort((a,b)=>b.value-a.value);
  const excluded=sources.filter(s=>!eligibleFor(s,metric)).map(s=>{
    let why='Dados indisponíveis';
    if(s.status==='ok'||s.status==='partial'){
      if(metric==='ctr')why=s.ctr==null?'Sem impressões/cliques válidos':'Amostra pequena (menos de '+MIN_IMPRESSIONS_FOR_CTR.toLocaleString('pt-BR')+' impressões)';
      else if(metric==='conversion')why=s.conversion==null?'Sem cliques/pedidos válidos':s.conversion>1?'Pedidos maiores que cliques':'Amostra pequena (menos de '+MIN_CLICKS_FOR_CONVERSION+' cliques)';
    }
    return{source:s,why};
  });
  return{ranked,excluded};
}

const median=a=>{const v=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2};

// Resumo + recomendações. Fato = número calculado; hipótese = possível causa; ação = o que investigar.
export function diagnoseTraffic(sources){
  const usable=sources.filter(s=>s.status==='ok'||s.status==='partial');
  const top=m=>rankBy(sources,m).ranked[0]||null;
  const summary={topSales:top('sales'),topOrders:top('orders'),bestConversion:top('conversion'),bestCtr:top('ctr')};
  const insights=[];
  const withSales=usable.filter(s=>s.sales!=null);

  if(summary.topSales&&summary.topSales.value>0){
    const s=summary.topSales.source;
    insights.push({id:'top-sales',tone:'good',title:`${s.label} lidera o GMV`,
      fact:`${s.label} tem o maior GMV entre as ${withSales.length} fonte(s) com dados válidos neste período, e as fontes não são somadas (podem se sobrepor).`,
      hypothesis:null,
      action:'Abra o Funil por Produto e veja quais anúncios mais aparecem e vendem por essa fonte; proteja o que já funciona antes de mexer em muita coisa.'});
  }
  const ads=sources.find(x=>x.key==='paid_ads');
  if(ads&&ads.share!=null&&ads.sales!=null&&ads.share>=.5){
    insights.push({id:'ads-share',tone:'warn',title:`Shopee Ads responde por ${(ads.share*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% do GMV`,
      fact:`O GMV atribuído a Shopee Ads foi ${ads.sales.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}, ${(ads.share*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% do GMV da loja. Ads se sobrepõe ao Card/Busca, então esse valor não é somado às outras fontes.`,
      hypothesis:'Uma fatia grande atribuída a Ads pode indicar dependência de anúncios pagos, mas a Shopee também atribui a Ads vendas que poderiam ocorrer sem anúncio. Não comprovado.',
      action:'Veja o gasto e o ROAS na aba Histórico Ads antes de aumentar investimento, e compare quais produtos vendem sem Ads no Funil por Produto.'});
  }
  // Volume alto com conversão relativamente baixa
  const convEligible=usable.filter(s=>eligibleFor(s,'conversion'));
  if(convEligible.length>=3){
    const med=median(convEligible.map(s=>s.conversion)),medClicks=median(convEligible.map(s=>s.clicks));
    for(const s of convEligible){
      if(s.clicks>=medClicks&&s.conversion<med*.6){
        insights.push({id:'low-conv-'+s.key,tone:'warn',title:`${s.short}: muito clique para poucos pedidos`,
          fact:`${s.label} tem ${s.clicks.toLocaleString('pt-BR')} cliques e conversão de ${(s.conversion*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%, abaixo de 60% da mediana das outras fontes da loja (${(med*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%).`,
          hypothesis:'Pode estar relacionado a preço pouco competitivo, página do produto que não convence ou diferença entre a expectativa do clique e o anúncio. Nada disso foi comprovado.',
          action:'Investigue os anúncios com mais cliques nessa fonte e compare preço final, imagens e avaliações com os concorrentes.'});
      }
      if(med>0&&s.conversion>=med*1.5&&s.clicks<medClicks*.5){
        insights.push({id:'high-conv-'+s.key,tone:'good',title:`${s.short}: converte bem, mas com pouco volume`,
          fact:`${s.label} converte ${(s.conversion*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% (mediana das fontes: ${(med*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%), porém com apenas ${s.clicks.toLocaleString('pt-BR')} cliques.`,
          hypothesis:'Amostra pequena pode exagerar a taxa; só dá para saber se escala acompanhando por mais tempo.',
          action:'Veja se é possível ampliar a exposição nessa fonte mantendo o desempenho e acompanhe por mais dias antes de decidir.'});
      }
    }
  }else if(usable.length){
    insights.push({id:'few-sources',tone:'data',title:'Poucas fontes comparáveis',
      fact:`Só ${convEligible.length} fonte(s) tem(êm) cliques suficientes (${MIN_CLICKS_FOR_CONVERSION}+) para comparar conversão.`,
      hypothesis:null,action:'Use um período maior (30 dias) para ter volume e tente de novo antes de tirar conclusões.'});
  }
  // Cliques sem pedidos
  for(const s of usable){
    if(s.orders===0&&s.clicks>=MIN_CLICKS_FOR_CONVERSION){
      insights.push({id:'no-orders-'+s.key,tone:'warn',title:`${s.short}: cliques sem nenhum pedido`,
        fact:`${s.label} registrou ${s.clicks.toLocaleString('pt-BR')} cliques e 0 pedidos no período.`,
        hypothesis:'Pode ser atribuição (a venda ter sido creditada a outra fonte) ou oferta pouco convincente. Não comprovado.',
        action:'Confira os produtos mais clicados dessa fonte antes de concluir que ela não funciona.'});
    }
  }
  // Fontes sem dados
  for(const s of sources.filter(x=>x.status==='unavailable'||x.status==='missing')){
    insights.push({id:'nodata-'+s.key,tone:'data',title:`${s.short}: não foi possível avaliar`,
      fact:s.reason,hypothesis:s.hypothesis||null,
      action:s.key==='paid_ads'?'Veja a aba Histórico Ads para os números de campanhas e atualize a coleta depois.':'Atualize a coleta ou teste outro período; o Gestor não avalia fontes sem dados.'});
  }
  return{summary,insights,usableCount:usable.length,unavailable:sources.filter(s=>s.status==='unavailable'||s.status==='missing')};
}
