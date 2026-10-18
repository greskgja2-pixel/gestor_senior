// Histórico Ads — normalização e diagnóstico (lógica pura, testada em tests/ads-history-diagnosis.test.mjs).
//
// Dados = campanhas de Shopee Ads (publicidade PAGA), vindas de /api/shopee/ads (v7.campaigns). NÃO representam o funil
// geral da loja (que inclui tráfego orgânico). Regras:
//  - ausente (null) ≠ zero real; negativos/sentinelas são descartados (-1000000 aparece em APIs da Shopee).
//  - CTR = cliques ÷ impressões; clique→pedido = pedidos ÷ cliques (mesmas fórmulas que a tela já usava).
//  - Amostra pequena não ganha destaque nem recebe diagnóstico forte; limiares são HEURÍSTICAS do projeto (ajustáveis aqui).
//  - Comparações são relativas à mediana dos PRÓPRIOS anúncios do histórico, não a um padrão da Shopee.

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const valid=v=>{const n=num(v);return n==null||n<0?null:n};
export const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};

export const ADS_THRESHOLDS=Object.freeze({
  minImpressions:1000,   // abaixo disso o CTR não é comparável
  minClicks:100,         // abaixo disso a conversão clique→pedido não é comparável
  lowRatio:.6,           // "abaixo da referência" = menos de 60% da mediana
  goodRatio:1,           // "na referência ou acima"
  minReferenceAds:3      // mínimo de anúncios com amostra para formar uma mediana
});

export const AD_STATES=Object.freeze({
  limited:{id:'limited',label:'Amostra limitada',icon:'help',level:'data',tip:'Os dados deste anúncio ainda são pequenos para uma conclusão forte.'},
  waste:{id:'waste',label:'Muito clique, pouco pedido',icon:'alert',level:'bad',tip:'Há cliques suficientes, mas poucos pedidos em relação aos seus outros anúncios (ou nenhum).'},
  lowCtr:{id:'lowCtr',label:'Muita exibição, poucos cliques',icon:'alert',level:'warn',tip:'O anúncio aparece bastante, mas é clicado proporcionalmente menos que os seus outros anúncios.'},
  promising:{id:'promising',label:'Boa CTR, alcance limitado',icon:'target',level:'info',tip:'Taxa de clique acima da referência, porém com volume de impressões ainda baixo.'},
  strong:{id:'strong',label:'Boa tração',icon:'check',level:'good',tip:'Volume razoável e pedidos atribuídos, com taxas na referência ou acima.'},
  neutral:{id:'neutral',label:'Dentro do padrão',icon:'info',level:'info',tip:'Sem sinal forte, para melhor ou pior, em relação aos seus outros anúncios.'},
  nodata:{id:'nodata',label:'Sem dados',icon:'help',level:'data',tip:'A Shopee não enviou impressões nem cliques deste anúncio no período.'}
});

const STATE_LABELS={ongoing:'Ativa',paused:'Pausada',scheduled:'Agendada',closed:'Encerrada',ended:'Encerrada',deleted:'Removida'};

export function normalizeAd(c){
  const impressions=valid(c?.impressions??c?.impression),clicks=valid(c?.clicks??c?.click),orders=valid(c?.orders??c?.order);
  const spend=valid(c?.spend),gmv=valid(c?.gmv);
  const ctr=impressions>0&&clicks!=null?clicks/impressions:null;
  const cvr=clicks>0&&orders!=null?orders/clicks:null;
  const stateRaw=c?.state==null?null:String(c.state).toLowerCase();
  return{
    id:String(c?.campaignId??c?.campaign_id??c?.id??c?.title??c?.productName??Math.random()),
    campaignId:c?.campaignId??null,
    itemId:c?.itemId!=null&&c.itemId!==''?String(c.itemId):null,
    title:String(c?.productName||c?.title||c?.campaignName||'Campanha'),
    stateLabel:stateRaw?(STATE_LABELS[stateRaw]||null):null,
    impressions,clicks,orders,ctr,cvr,spend,gmv,
    roas:spend>0&&gmv!=null?gmv/spend:null,
    costPerOrder:orders>0&&spend!=null?spend/orders:null,
    cpc:clicks>0&&spend!=null?spend/clicks:null
  };
}

export function referenceOf(ads){
  const T=ADS_THRESHOLDS;
  const ctrs=ads.filter(a=>a.ctr!=null&&a.impressions>=T.minImpressions);
  const cvrs=ads.filter(a=>a.cvr!=null&&a.clicks>=T.minClicks);
  return{
    ctr:ctrs.length>=T.minReferenceAds?median(ctrs.map(a=>a.ctr)):null,
    cvr:cvrs.length>=T.minReferenceAds?median(cvrs.map(a=>a.cvr)):null,
    impressions:median(ads.filter(a=>a.impressions!=null).map(a=>a.impressions)),
    ctrCount:ctrs.length,cvrCount:cvrs.length
  };
}

// Classifica UM anúncio. Ordem: sem dados → amostra limitada → desperdício → CTR baixo → promissor → forte → neutro.
export function classifyAd(a,ref){
  const T=ADS_THRESHOLDS;
  if(a.impressions==null&&a.clicks==null)return AD_STATES.nodata;
  const bigImpr=a.impressions>=T.minImpressions,bigClicks=a.clicks>=T.minClicks;
  if(!bigImpr&&!bigClicks)return AD_STATES.limited;
  if(bigClicks&&a.orders===0)return AD_STATES.waste;
  if(bigClicks&&ref.cvr!=null&&a.cvr!=null&&a.cvr<ref.cvr*T.lowRatio)return AD_STATES.waste;
  if(bigImpr&&ref.ctr!=null&&a.ctr!=null&&a.ctr<ref.ctr*T.lowRatio)return AD_STATES.lowCtr;
  if(bigImpr&&ref.ctr!=null&&a.ctr>=ref.ctr&&ref.impressions!=null&&a.impressions<ref.impressions*.5)return AD_STATES.promising;
  if(a.orders>0&&bigClicks&&(ref.cvr==null||a.cvr>=ref.cvr*T.goodRatio*.9))return AD_STATES.strong;
  return AD_STATES.neutral;
}

// Oportunidade = pedidos "perdidos" em relação à conversão de referência (cliques × distância). Só para ordenar investigação.
export function opportunityOf(a,ref){
  if(ref.cvr!=null&&a.cvr!=null&&a.clicks>=ADS_THRESHOLDS.minClicks)return Math.max(0,(ref.cvr-a.cvr)*a.clicks);
  if(a.orders===0&&a.clicks>=ADS_THRESHOLDS.minClicks&&ref.cvr!=null)return ref.cvr*a.clicks;
  return 0;
}

// Fato / hipótese / ação por estado. Hipóteses nunca afirmam causa (a tela só tem impressões, cliques e pedidos).
export function interpret(a,state,ref){
  const pc=v=>v==null?'—':(v*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  const n=v=>v==null?'—':Math.round(v).toLocaleString('pt-BR');
  const out={
    per100ctr:a.ctr!=null?`De cada 100 impressões, cerca de ${a.ctr*100>=10?Math.round(a.ctr*100):(Math.round(a.ctr*1000)/10).toLocaleString('pt-BR')} geraram clique.`:'CTR não calculável (sem impressões ou cliques válidos).',
    per100cvr:a.cvr!=null?`De cada 100 cliques, cerca de ${a.cvr*100>=10?Math.round(a.cvr*100):(Math.round(a.cvr*1000)/10).toLocaleString('pt-BR')} geraram pedido.`:'Clique → pedido não calculável (sem cliques ou pedidos válidos).',
    fact:'',hypothesis:null,action:''
  };
  if(state.id==='nodata'){out.fact='A Shopee não enviou impressões nem cliques deste anúncio no período.';out.action='Atualize a coleta ou teste outro período; sem dados o Gestor não avalia o anúncio.';return out}
  if(state.id==='limited'){out.fact=`${n(a.impressions)} impressões e ${n(a.clicks)} cliques: volume pequeno.`;out.hypothesis='Com tão poucos dados, qualquer taxa pode ser sorte ou azar. Não há conclusão confiável.';out.action='Acompanhe por mais dias (ou 30 dias) antes de mexer neste anúncio.';return out}
  if(state.id==='waste'){
    out.fact=a.orders===0?`${n(a.clicks)} cliques e nenhum pedido atribuído no período.`:`${n(a.clicks)} cliques e ${n(a.orders)} pedido(s): clique → pedido de ${pc(a.cvr)}, abaixo de 60% da mediana dos seus anúncios (${pc(ref.cvr)}).`;
    out.hypothesis='Há cliques, mas poucos pedidos. Pode estar relacionado a preço, oferta, prova social, apresentação da página ou condições do anúncio; nada disso foi comprovado.';
    out.action='Abra o Funil por Produto deste anúncio e compare preço final, imagens e avaliações com os concorrentes antes de aumentar investimento.';return out}
  if(state.id==='lowCtr'){
    out.fact=`${n(a.impressions)} impressões com CTR de ${pc(a.ctr)}, abaixo de 60% da mediana dos seus anúncios (${pc(ref.ctr)}).`;
    out.hypothesis='O anúncio aparece, mas atrai menos cliques. Imagem principal, título ou preço exibido podem merecer revisão; não comprovado.';
    out.action='Compare a capa e o título com os anúncios que aparecem junto e teste uma mudança por vez.';return out}
  if(state.id==='promising'){
    out.fact=`CTR de ${pc(a.ctr)} (mediana ${pc(ref.ctr)}), porém com ${n(a.impressions)} impressões, abaixo da metade da mediana de alcance.`;
    out.hypothesis='Bom desempenho proporcional, mas alcance ainda limitado; uma amostra pequena pode exagerar a taxa.';
    out.action='Se a margem permitir, avalie ampliar a exposição de forma controlada e acompanhe se a taxa se mantém.';return out}
  if(state.id==='strong'){
    out.fact=`${n(a.orders)} pedido(s) em ${n(a.clicks)} cliques (${pc(a.cvr)}) e CTR de ${pc(a.ctr)}.`;
    out.hypothesis=null;out.action='Use como referência para os outros anúncios e evite mudanças grandes sem motivo.';return out}
  out.fact=`CTR ${pc(a.ctr)} e clique → pedido ${pc(a.cvr)}, próximos da referência dos seus anúncios.`;
  out.action='Sem prioridade agora; acompanhe a evolução no próximo período.';return out;
}

export function buildAds(campaigns){
  const ads=(Array.isArray(campaigns)?campaigns:[]).map(normalizeAd);
  const ref=referenceOf(ads);
  const rows=ads.map(a=>{const state=classifyAd(a,ref);return{ad:a,state,opportunity:opportunityOf(a,ref),interpretation:interpret(a,state,ref)}});
  const best=(key,min)=>[...rows].filter(r=>r.ad[key]!=null&&min(r.ad)).sort((x,y)=>y.ad[key]-x.ad[key])[0]||null;
  const sum=key=>{const v=ads.filter(a=>a[key]!=null);return v.length?{value:v.reduce((s,a)=>s+a[key],0),count:v.length}:null};
  const spend=sum('spend'),gmv=sum('gmv');
  return{
    rows,ref,
    summary:{
      total:ads.length,
      topOrders:best('orders',a=>a.orders>0),
      topClicks:best('clicks',a=>a.clicks>0),
      bestCtr:best('ctr',a=>a.impressions>=ADS_THRESHOLDS.minImpressions),
      bestCvr:best('cvr',a=>a.clicks>=ADS_THRESHOLDS.minClicks&&a.orders>0),
      zeroOrders:ads.filter(a=>a.orders===0).length,
      waste:rows.filter(r=>r.state.id==='waste').length,
      limited:rows.filter(r=>r.state.id==='limited').length,
      spend,gmv,
      // ROAS agregado só entre anúncios com gasto > 0 e GMV válido (GMV sem gasto inflaria o resultado).
      roas:(()=>{const w=ads.filter(a=>a.spend>0&&a.gmv!=null);const sp=w.reduce((t,a)=>t+a.spend,0);return w.length&&sp>0?w.reduce((t,a)=>t+a.gmv,0)/sp:null})()
    }
  };
}

export const AD_FILTERS=Object.freeze([
  {id:'all',label:'Todos'},{id:'withOrders',label:'Com pedidos'},{id:'noOrders',label:'Sem pedidos'},
  {id:'highCtr',label:'CTR alta'},{id:'wasteClicks',label:'Muito clique, pouco pedido'},{id:'opportunity',label:'Maior oportunidade'}
]);
export function adMatches(row,filter,ref){
  const a=row.ad;
  if(filter==='withOrders')return a.orders>0;
  if(filter==='noOrders')return a.orders===0;
  if(filter==='highCtr')return ref.ctr!=null&&a.ctr!=null&&a.impressions>=ADS_THRESHOLDS.minImpressions&&a.ctr>=ref.ctr;
  if(filter==='wasteClicks')return row.state.id==='waste';
  if(filter==='opportunity')return row.opportunity>0||row.state.id==='lowCtr';
  return true;
}
export const AD_SORTS=Object.freeze([
  {id:'orders',label:'Pedidos'},{id:'impressions',label:'Impressões'},{id:'clicks',label:'Cliques'},
  {id:'ctr',label:'CTR'},{id:'cvr',label:'Clique → pedido'},{id:'opportunity',label:'Oportunidade'}
]);
// Valores ausentes e taxas de amostra pequena vão sempre para o fim (nunca "melhor" por acaso).
export function sortAds(rows,sort){
  const T=ADS_THRESHOLDS;
  const val=r=>{
    const a=r.ad;
    if(sort==='opportunity')return r.opportunity>0?r.opportunity:null;
    if(sort==='ctr')return a.impressions>=T.minImpressions?a.ctr:null;
    if(sort==='cvr')return a.clicks>=T.minClicks?a.cvr:null;
    return a[sort]??null;
  };
  return [...rows].sort((x,y)=>{const a=val(x),b=val(y);if(a==null&&b==null)return 0;if(a==null)return 1;if(b==null)return -1;return b-a});
}
