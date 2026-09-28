'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {motorData} from '../lib/client-async';
import styles from './funil.module.css';

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');
const pct=v=>num(v)==null?'—':(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const val=x=>num(x?.value??x);
const arr=v=>Array.isArray(v)?v:[];
const median=values=>{const a=values.filter(v=>Number.isFinite(v)).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const cleanText=v=>String(v||'').replace(/\s+/g,' ').trim();
const pickSuggestion=(list,re)=>arr(list).map(cleanText).find(x=>re.test(x))||null;
const PERIODS=[
  {id:'past7days',label:'7 dias',days:7},
  {id:'past30days',label:'30 dias',days:30},
  {id:'real_time',label:'Hoje',days:1}
];
const periodMeta=id=>PERIODS.find(x=>x.id===id)||PERIODS[1];
const signedPct=v=>num(v)==null?'—':(Number(v)>=0?'+':'')+(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';

async function getJson(url){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j?.error)throw new Error(j?.error||('HTTP '+r.status));
    return j;
  }finally{clearTimeout(timer)}
}

function Step({label,value,sub,rate,tone='blue'}){
  return <div className={styles.step} data-tone={tone} data-missing={value==null?'true':'false'}>
    <div className={styles.stepTop}><span>{label}</span><strong>{int(value)}</strong></div>
    <div className={styles.stepMeta}><small>{sub}</small>{rate!=null&&<b>{pct(rate)}</b>}</div>
  </div>
}

function funnelSummary(totals,rates){
  const transitions=[
    {id:'ctr',from:'Impressões',to:'Cliques',rate:num(rates.ctr)},
    {id:'clickVisit',from:'Cliques',to:'Visitantes',rate:num(rates.clickVisit)},
    {id:'visitCart',from:'Visitantes',to:'Carrinho',rate:num(rates.visitCart)},
    {id:'cartPlaced',from:'Carrinho',to:'Pedido',rate:num(rates.cartPlaced)},
    {id:'placedPaid',from:'Pedido',to:'Pago',rate:num(rates.placedPaid)},
    {id:'paidConfirmed',from:'Pago',to:'Confirmado',rate:num(rates.paidConfirmed)}
  ];
  const valid=transitions.filter(x=>x.rate!=null&&x.rate>=0&&x.rate<=1);
  const worst=valid.length?[...valid].sort((a,b)=>a.rate-b.rate)[0]:null;
  const stages=[
    {key:'impressions',label:'Impressões',value:totals.impressions,icon:'◉'},
    {key:'clicks',label:'Cliques',value:totals.clicks,icon:'↗'},
    {key:'visitors',label:'Visitantes',value:totals.visitors,icon:'●'},
    {key:'carts',label:'Carrinho',value:totals.carts,icon:'▣'},
    {key:'placed',label:'Pedido criado',value:totals.placed,icon:'▤'},
    {key:'paid',label:'Pago',value:totals.paid,icon:'▰'},
    {key:'confirmed',label:'Confirmado',value:totals.confirmed,icon:'✓'}
  ];
  return{stages,transitions,worst};
}

function FunnelVisual({totals,rates}){
  const {stages,transitions,worst}=funnelSummary(totals,rates);
  return <section className={styles.visualFunnelCard}>
    <div className={styles.funnelVisualWrap}>
      <div className={styles.realFunnel} aria-label="Funil de vendas">
        {stages.map((stage,index)=><div key={stage.key} className={styles.funnelLayer} data-index={index} data-missing={stage.value==null?'true':'false'}>
          <span className={styles.funnelIcon}>{stage.icon}</span>
          <span><small>{stage.label}</small><strong>{int(stage.value)}</strong></span>
        </div>)}
      </div>
      <div className={styles.conversionRail}>
        {transitions.map(t=><div key={t.id} className={styles.conversionRow} data-worst={worst?.id===t.id?'true':'false'}>
          <span className={styles.conversionArrow}>↓</span>
          <div><strong>{pct(t.rate)}</strong><small>de {t.from.toLowerCase()} → {t.to.toLowerCase()}</small></div>
          {worst?.id===t.id&&<em>Maior gargalo</em>}
        </div>)}
      </div>
    </div>
    <aside className={styles.bottleneckCallout} data-empty={!worst?'true':'false'}>
      <span className={styles.bottleneckIcon}>↗</span>
      {worst?<div><small>MAIOR PERDA DO FUNIL</small><h3>{worst.from} → {worst.to}</h3><strong>Perda de {pct(1-worst.rate)}</strong><p>Esta é a etapa com menor passagem entre as métricas disponíveis agora. Comece a investigação por aqui.</p></div>:<div><small>GARGALO</small><h3>Dados insuficientes</h3><p>Assim que as etapas estiverem disponíveis, o Gestor destaca automaticamente onde há a maior perda.</p></div>}
    </aside>
  </section>
}

function KpiStrip({totals,rates}){
  const worst=funnelSummary(totals,rates).worst;
  const cards=[
    {id:'ctr',label:'CTR',sub:'Impressão → Clique',rate:rates.ctr,desc:rates.ctr!=null?`A cada 100 impressões, cerca de ${Math.round(rates.ctr*100)} viram cliques.`:'Sem dados suficientes.'},
    {id:'visitCart',label:'Visita → Carrinho',sub:'Intenção de compra',rate:rates.visitCart,desc:rates.visitCart!=null?`A cada 100 visitantes, cerca de ${Math.round(rates.visitCart*100)} adicionam ao carrinho.`:'Sem dados suficientes.'},
    {id:'cartPlaced',label:'Carrinho → Pedido',sub:'Fechamento do carrinho',rate:rates.cartPlaced,desc:rates.cartPlaced!=null?`A cada 100 carrinhos, cerca de ${Math.round(rates.cartPlaced*100)} viram pedido.`:'Sem dados suficientes.'},
    {id:'placedPaid',label:'Pedido → Pago',sub:'Pagamento',rate:rates.placedPaid,desc:rates.placedPaid!=null?`A cada 100 pedidos, cerca de ${Math.round(rates.placedPaid*100)} são pagos.`:'Sem dados suficientes.'},
    {id:'paidConfirmed',label:'Pago → Confirmado',sub:'Confirmação final',rate:rates.paidConfirmed,desc:rates.paidConfirmed!=null?`A cada 100 pagos, cerca de ${Math.round(rates.paidConfirmed*100)} são confirmados.`:'Sem dados suficientes.'}
  ];
  return <section className={styles.kpiStrip}>{cards.map(card=><article key={card.id} data-worst={worst?.id===card.id?'true':'false'}>
    <span className={styles.kpiDot}>{card.id==='ctr'?'◉':card.id==='visitCart'?'●':card.id==='cartPlaced'?'▣':card.id==='placedPaid'?'▤':'✓'}</span>
    <div><small>{card.label}</small><b>{pct(card.rate)}</b><em>{card.sub}</em><p>{card.desc}</p></div>
  </article>)}</section>
}

function ComparisonStrip({comparison}){
  const cards=[
    ['Visitantes',comparison.visitors],
    ['Pedidos pagos',comparison.paidOrders],
    ['GMV pago',comparison.paidGmv],
    ['Confirmados',comparison.confirmedOrders]
  ];
  return <section className={styles.comparisonStrip}>
    <div><strong>Comparação com o período anterior</strong><small>A Shopee calcula a variação usando uma janela anterior de mesmo tamanho.</small></div>
    {cards.map(([label,value])=><article key={label} data-direction={value==null?'none':value>=0?'up':'down'}><span>{label}</span><b>{signedPct(value)}</b></article>)}
  </section>
}

function Sparkline({points=[]}){
  const vals=arr(points).map(x=>num(x?.value)).filter(x=>x!=null);
  if(vals.length<2)return <span className={styles.sparkEmpty}>Sem série</span>;
  const min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
  const coords=vals.map((v,i)=>`${(i/(vals.length-1))*100},${36-((v-min)/span)*30}`).join(' ');
  return <svg className={styles.sparkline} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={coords}/></svg>;
}

function TrendPanel({trends,periodLabel}){
  const metrics=[
    ['Visitantes',trends?.uv],
    ['Carrinho',trends?.atc_uv],
    ['Pedidos',trends?.placed_order],
    ['Pagos',trends?.paid_order],
    ['Confirmados',trends?.confirmed_order]
  ];
  const available=metrics.filter(([,points])=>arr(points).length>1);
  if(!available.length)return null;
  return <section className={styles.trendPanel}>
    <div className={styles.trendHead}><div><h2>Evolução diária</h2><p>Série histórica enviada pela Shopee no período de {periodLabel.toLowerCase()}.</p></div><span>{arr(available[0]?.[1]).length} pontos</span></div>
    <div className={styles.trendGrid}>{available.map(([label,points])=><article key={label}><div><span>{label}</span><b>{int(arr(points).reduce((a,x)=>a+(num(x?.value)||0),0))}</b></div><Sparkline points={points}/></article>)}</div>
    <small className={styles.trendNote}>Os totais acima são somas dos pontos da série. Taxas não são somadas; o funil principal continua usando os agregados oficiais quando disponíveis.</small>
  </section>
}

function PostOrderPanel({orderPerformance}){
  const cancelledOrders=val(orderPerformance?.cancelled_orders),refundOrders=val(orderPerformance?.return_refund_orders);
  const cancelledSales=val(orderPerformance?.cancelled_sales),refundSales=val(orderPerformance?.return_refund_sales);
  if([cancelledOrders,refundOrders,cancelledSales,refundSales].every(x=>x==null))return null;
  return <section className={styles.postOrderPanel}>
    <div><strong>Pós-venda do período</strong><small>Ajuda a separar problema de anúncio de problema operacional depois do pedido.</small></div>
    <article><span>Pedidos cancelados</span><b>{int(cancelledOrders)}</b><small>{money(cancelledSales)}</small></article>
    <article><span>Devolução/Reembolso</span><b>{int(refundOrders)}</b><small>{money(refundSales)}</small></article>
  </section>
}

function productPlan(p,med){
  const impressions=num(p.product_card_impressions),clicks=num(p.product_card_clicks),uv=num(p.uv),carts=num(p.add_to_cart_buyers),placed=num(p.placed_buyers),paid=num(p.paid_buyers),confirmed=num(p.confirmed_buyers);
  const ctr=num(p.ctr),cartRate=num(p.uv_to_add_to_cart_rate),placedRate=num(p.uv_to_placed_buyers_rate),paidRate=num(p.uv_to_paid_buyers_rate);
  const cartPlaced=carts>0&&placed!=null?placed/carts:null,placedPaid=placed>0&&paid!=null?paid/placed:null,paidConfirmed=paid>0&&confirmed!=null?confirmed/paid:null;
  const low=(value,medianValue,minBase)=>value!=null&&medianValue!=null&&minBase&&value<medianValue*.6;
  if((impressions??0)<100||(uv??0)<10)return{
    priority:'data',rank:4,label:'POUCOS DADOS',title:'Ainda não dá para culpar uma etapa',
    why:'O volume deste produto ainda é pequeno para separar um problema real de uma oscilação normal.',
    evidence:`${int(impressions)} impressões · ${int(uv)} visitantes`,
    actions:['Espere mais tráfego antes de mudar várias coisas ao mesmo tempo.','Se estiver usando Ads, confira se a campanha está realmente entregando impressões.','Faça uma alteração por vez para saber o que funcionou.'],
    href:'/extensao-shopee-intelligence?section=shopee-ads',action:'Ver Shopee Ads'
  };
  if(low(ctr,med.ctr,impressions>=100))return{
    priority:'bad',rank:0,label:'FAÇA AGORA',title:'Está travando antes do clique',
    why:'O produto aparece, mas recebe proporcionalmente menos cliques que o padrão da sua própria loja.',
    evidence:`CTR ${pct(ctr)} · mediana da loja ${pct(med.ctr)} · ${int(impressions)} impressões`,
    actions:['Troque ou melhore a imagem principal antes de mexer na descrição.','Compare título, preço e oferta com os concorrentes que aparecem junto na busca.','Veja se o benefício principal do produto fica claro já na capa e no começo do título.'],
    href:'/extensao-shopee-intelligence?section=super-anuncio',action:'Revisar capa e título'
  };
  if(low(cartRate,med.cart,uv>=10))return{
    priority:'bad',rank:0,label:'FAÇA AGORA',title:'O cliente entra, mas não coloca no carrinho',
    why:'A vitrine consegue trazer visitantes, porém o anúncio perde força quando a pessoa vê os detalhes.',
    evidence:`Visita→carrinho ${pct(cartRate)} · mediana ${pct(med.cart)} · ${int(uv)} visitantes`,
    actions:['Revise as imagens secundárias: medidas, quantidade, variações e benefícios precisam ficar óbvios.','Confira preço, frete, prazo, estoque das variações e avaliações recentes.','Melhore a descrição para responder dúvidas que aparecem nas avaliações e nos concorrentes.'],
    href:'/extensao-shopee-intelligence?section=super-anuncio',action:'Revisar o anúncio'
  };
  if(low(cartPlaced,med.cartPlaced,carts>=5))return{
    priority:'bad',rank:0,label:'FAÇA AGORA',title:'O cliente coloca no carrinho e desiste antes do pedido',
    why:'Existe intenção de compra, mas uma parte grande não transforma o carrinho em pedido.',
    evidence:`Carrinho→pedido ${pct(cartPlaced)} · mediana ${pct(med.cartPlaced)} · ${int(carts)} compradores no carrinho`,
    actions:['Compare o preço final com os concorrentes, não só o preço de vitrine.','Revise frete, prazo e possibilidade de cupom/oferta; aqui eles pesam mais do que trocar título.','Confirme estoque e disponibilidade das variações mais procuradas.'],
    href:'/pesquisa-produtos',action:'Comparar mercado'
  };
  if(low(placedPaid,med.placedPaid,placed>=5))return{
    priority:'warn',rank:1,label:'REVISAR',title:'Muitos pedidos são criados, mas poucos viram pagamento',
    why:'O gargalo está depois da intenção e da criação do pedido, perto do fechamento.',
    evidence:`Pedido→pago ${pct(placedPaid)} · mediana ${pct(med.placedPaid)} · ${int(placed)} compradores com pedido`,
    actions:['Não comece pela capa: o cliente já chegou longe no funil.','Revise preço final, cupom, frete/prazo e possíveis motivos de cancelamento do pedido.','Acompanhe se o problema se repete por alguns dias antes de fazer mudanças grandes.'],
    href:'/insights',action:'Ver outros sinais'
  };
  if(low(paidConfirmed,med.paidConfirmed,paid>=5))return{
    priority:'warn',rank:1,label:'REVISAR',title:'A venda é paga, mas perde força antes da confirmação',
    why:'A aquisição funcionou; o ponto de atenção está na etapa operacional depois do pagamento.',
    evidence:`Pago→confirmado ${pct(paidConfirmed)} · mediana ${pct(med.paidConfirmed)} · ${int(paid)} compradores pagos`,
    actions:['Cheque cancelamentos, ruptura de estoque e problemas de expedição antes de mudar o anúncio.','Confirme se as variações vendidas realmente têm estoque disponível.','Priorize a operação; mexer em título ou capa não resolve este gargalo.'],
    href:'/produtos',action:'Ver produto'
  };
  return{
    priority:'good',rank:3,label:'SAUDÁVEL',title:'Nenhum gargalo forte apareceu agora',
    why:'As principais taxas deste produto estão próximas ou acima do padrão da sua própria loja.',
    evidence:`CTR ${pct(ctr)} · visita→carrinho ${pct(cartRate)} · visita→pago ${pct(paidRate)}`,
    actions:['Evite mudanças grandes sem motivo.','Use este anúncio como referência para comparar produtos que estão travando.','Se houver margem e estoque, avalie aumentar tráfego de forma controlada.'],
    href:'/extensao-shopee-intelligence?section=shopee-ads',action:'Avaliar tráfego'
  };
}

function specificPlan(p,med,context){
  const base=productPlan(p,med),ctx=context?.[String(p.id)]||null;
  if(!ctx)return{...base,specific:false,specificNote:'Ainda não há Super Análise/concorrentes vinculados para deixar esta orientação específica.'};

  const competitors=arr(ctx.competitors).filter(x=>x&&((x.price!=null)||x.url));
  const prices=competitors.map(x=>num(x.price)).filter(x=>x!=null);
  const marketMedian=median(prices),ownPrice=num(ctx.price),margin=num(ctx.marginPct),cost=num(ctx.cost);
  const priceGap=ownPrice!=null&&marketMedian>0?(ownPrice-marketMedian)/marketMedian:null;
  const imageSuggestion=pickSuggestion(ctx.suggestions,/imagem|foto|capa|thumbnail|visual/i);
  const titleSuggestion=pickSuggestion(ctx.suggestions,/t[ií]tulo|palavra.?chave|keyword/i);
  const offerSuggestion=pickSuggestion(ctx.suggestions,/pre[cç]o|cupom|frete|oferta|desconto/i);
  const actions=[...base.actions];
  const facts=[];

  if(ownPrice!=null)facts.push('Seu preço: '+money(ownPrice));
  if(marketMedian!=null)facts.push('Mediana dos concorrentes vinculados: '+money(marketMedian));
  if(margin!=null)facts.push('Margem cadastrada: '+margin.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%');
  if(cost!=null)facts.push('Custo cadastrado: '+money(cost));

  if(base.title.includes('antes do clique')){
    if(imageSuggestion)actions[0]='Imagem principal: '+imageSuggestion;
    else actions[0]='Imagem principal: abra os concorrentes abaixo e compare enquadramento, quantidade visível, texto e benefício principal; use a estrutura mais clara como referência, sem copiar a arte.';
    if(titleSuggestion)actions[1]='Título: '+titleSuggestion;
    if(priceGap!=null&&priceGap>.05)actions[2]=`Preço: você está ${(priceGap*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% acima da mediana dos concorrentes. Antes de mexer em outras áreas, teste uma oferta próxima de ${money(marketMedian)} se a margem continuar positiva.`;
  }else if(base.title.includes('não coloca no carrinho')){
    if(offerSuggestion)actions[0]='Oferta: '+offerSuggestion;
    if(imageSuggestion)actions[1]='Imagens internas: '+imageSuggestion;
    if(priceGap!=null&&priceGap>.05)actions[2]=`Teste de preço: aproxime a oferta de ${money(marketMedian)} e acompanhe Visita→Carrinho. Não aplique se o custo/margem não comportar.`;
  }else if(base.title.includes('desiste antes do pedido')){
    if(priceGap!=null&&priceGap>.05){
      const safeExact=cost!=null&&margin!=null&&margin>=20&&marketMedian>=ownPrice*.9;
      actions[0]=safeExact
        ?`Teste específico: reduza temporariamente de ${money(ownPrice)} para ${money(marketMedian)} e acompanhe Carrinho→Pedido por 3 dias. A margem cadastrada atual é ${margin.toLocaleString('pt-BR',{maximumFractionDigits:1})}%.`
        :`Seu preço está acima da mediana (${money(ownPrice)} vs. ${money(marketMedian)}). Use ${money(marketMedian)} como alvo de mercado, mas confirme custo e margem antes de aplicar.`;
    }else if(ownPrice!=null&&marketMedian!=null){
      actions[0]=`Preço não aparece como principal suspeito: ${money(ownPrice)} está próximo da mediana ${money(marketMedian)}. Priorize frete, prazo, cupom e disponibilidade.`;
    }
    if(offerSuggestion)actions[1]='Ação de oferta: '+offerSuggestion;
  }else if(base.title.includes('poucos viram pagamento')){
    actions[0]='Não altere capa nem título agora: o cliente já criou o pedido.';
    if(offerSuggestion)actions[1]='Revise no fechamento: '+offerSuggestion;
  }else if(base.title.includes('antes da confirmação')){
    actions[0]='Não mexa no anúncio para tentar resolver esta etapa. Priorize estoque, cancelamentos, separação e expedição.';
  }

  return{...base,actions,specific:true,specificNote:facts.join(' · '),competitors,marketMedian,ownPrice};
}

function ProductActionCard({p,med,mode,context}){
  const plan=mode==='specific'?specificPlan(p,med,context):productPlan(p,med);
  return <article className={styles.actionCard} data-priority={plan.priority}>
    <div className={styles.actionTop}>
      <div className={styles.product}><img src={p.image||'/favicon.ico'} alt=""/><div><b>{p.name||'Produto'}</b><small>ID {p.id||'—'}</small></div></div>
      <span>{plan.label}</span>
    </div>
    <div className={styles.actionBody}>
      <div><h3>{plan.title}</h3><p>{plan.why}</p><small className={styles.evidence}>{plan.evidence}</small>
        {mode==='specific'&&<div className={styles.specificEvidence}><strong>Base da sugestão específica</strong><p>{plan.specificNote}</p></div>}
      </div>
      <div className={styles.actionSteps}><strong>{mode==='specific'?'Faça assim':'O que fazer primeiro'}</strong><ol>{plan.actions.map((a,i)=><li key={i}>{a}</li>)}</ol></div>
    </div>
    {mode==='specific'&&arr(plan.competitors).length>0&&<div className={styles.competitorRefs}><strong>Concorrentes usados como referência</strong><div>{plan.competitors.map((comp,i)=><a key={i} href={comp.url||'#'} target={comp.url?'_blank':undefined} rel={comp.url?'noreferrer':undefined} data-disabled={!comp.url?'true':'false'}>{comp.image?<img src={comp.image} alt=""/>:null}<span><b>{comp.title||('Concorrente '+(i+1))}</b><small>{comp.price!=null?money(comp.price):'Preço não coletado'}{comp.sold!=null?' · '+int(comp.sold)+' vendidos':''}</small></span></a>)}</div></div>}
    <div className={styles.actionFooter}><Link href={plan.href}>{plan.action} →</Link><small>{mode==='specific'?'Siga como teste controlado e confira o funil depois; nenhuma mudança é aplicada automaticamente.':'Recomendação baseada no gargalo observado, não em promessa de resultado.'}</small></div>
  </article>
}

function productBottleneck(plan){
  if(plan.priority==='good')return{title:'Funil saudável',tone:'good',detail:'As principais taxas deste produto estão próximas ou acima do padrão da sua loja.'};
  if(plan.priority==='data')return{title:'Dados insuficientes',tone:'data',detail:'Ainda falta volume para apontar um gargalo com segurança.'};
  if(plan.title.includes('antes do clique'))return{title:'Maior gargalo: Impressões → Cliques',tone:'bad',detail:'O produto aparece, mas proporcionalmente poucas pessoas clicam para conhecer o anúncio.'};
  if(plan.title.includes('não coloca no carrinho'))return{title:'Maior gargalo: Visitas → Carrinho',tone:'bad',detail:'O cliente entra no anúncio, mas a oferta ainda não convence o suficiente para gerar intenção de compra.'};
  if(plan.title.includes('desiste antes do pedido'))return{title:'Maior gargalo: Carrinho → Pedido',tone:'bad',detail:'Os clientes demonstram intenção de compra, mas muitos não finalizam o pedido.'};
  if(plan.title.includes('poucos viram pagamento'))return{title:'Maior gargalo: Pedido → Pago',tone:'warn',detail:'O pedido chega a ser criado, mas parte dos clientes não conclui o pagamento.'};
  if(plan.title.includes('antes da confirmação'))return{title:'Maior gargalo: Pago → Confirmado',tone:'warn',detail:'A aquisição funcionou; a perda acontece depois do pagamento e pede atenção operacional.'};
  return{title:plan.title,tone:plan.priority,detail:plan.why};
}

function MiniProductFunnel({p}){
  const impressions=num(p.product_card_impressions),clicks=num(p.product_card_clicks),visits=num(p.uv),carts=num(p.add_to_cart_buyers),placed=num(p.placed_buyers),paid=num(p.paid_buyers);
  const values=[impressions,clicks,visits,carts,placed,paid];
  const labels=['Impressões','Cliques','Visitas','Carrinho','Pedido','Pago'];
  const rates=values.map((v,i)=>i===0?(v!=null?1:null):(values[i-1]>0&&v!=null?v/values[i-1]:null));
  return <div className={styles.productMiniFunnel} aria-label="Funil do produto">
    {labels.map((label,index)=><div className={styles.productMiniStage} data-index={index} data-missing={values[index]==null?'true':'false'} key={label}>
      <div className={styles.productMiniBar}><span>{label}</span></div>
      <strong>{int(values[index])}</strong>
      <small>{pct(rates[index])}</small>
    </div>)}
  </div>
}

function normalizedVariationName(value){return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function shopeeProfit(price,cost,adsPerOrder=0){const p=num(price),c=num(cost),ads=num(adsPerOrder)??0;if(!(p>0)||c==null)return null;const commission=p*.20,fixedFee=4.5,profit=p-c-commission-fixedFee-ads;return{profit,marginPct:profit/p*100,commission,fixedFee}}
function matchCompetitorVariation(own,competitorVariations){
  const key=normalizedVariationName(own?.name);
  if(!key)return null;
  const exact=arr(competitorVariations).find(v=>normalizedVariationName(v?.name)===key);
  if(exact)return exact;
  const ownTokens=new Set(key.split(' ').filter(Boolean));
  let best=null,bestScore=0;
  for(const v of arr(competitorVariations)){
    const tokens=normalizedVariationName(v?.name).split(' ').filter(Boolean);
    const common=tokens.filter(t=>ownTokens.has(t)).length,score=common/Math.max(ownTokens.size,tokens.length,1);
    if(score>.55&&score>bestScore){best=v;bestScore=score}
  }
  return best;
}

function PriceCalculator({p,context,onClose}){
  const ctx=context?.[String(p.id)]||{};
  const [loading,setLoading]=useState(true);
  const [flash,setFlash]=useState(null);
  const [selectedOffer,setSelectedOffer]=useState('');
  const [draft,setDraft]=useState({});
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    let alive=true;
    setLoading(true);setMessage('');
    getJson('/api/shopee/flash-sale?item_id='+encodeURIComponent(p.id)+'&days=30')
      .then(data=>{if(!alive)return;setFlash(data);const offers=[...arr(data?.activeOffers),...arr(data?.scheduledOffers)];if(offers.length)setSelectedOffer(String(offers[0].flash_sale_id||''));})
      .catch(error=>{if(alive)setMessage('Oferta/campanha: '+String(error?.message||error))})
      .finally(()=>alive&&setLoading(false));
    return()=>{alive=false};
  },[p.id]);

  const competitors=arr(ctx.competitors);
  const leader=competitors.length?[...competitors].sort((a,b)=>(num(b.sold)??-1)-(num(a.sold)??-1))[0]:null;
  const competitorVariations=arr(leader?.variations);
  const ownVariations=(arr(flash?.productModels).length?arr(flash.productModels):arr(ctx.variations)).map((v,index)=>({
    modelId:v?.model_id??v?.modelId??v?.id??null,
    name:v?.name||v?.model_name||('Variação '+(index+1)),
    price:num(v?.current_price??v?.price),
    promoPrice:num(v?.promoPrice??v?.promotion_price),
    cost:num(v?.cost??arr(ctx.variations).find(x=>String(x?.modelId??x?.model_id)===String(v?.model_id??v?.modelId))?.cost)
  }));
  const offers=[...arr(flash?.activeOffers),...arr(flash?.scheduledOffers)];
  const activeOffer=offers.find(x=>String(x?.flash_sale_id||'')===selectedOffer)||null;
  const currentPrice=num(ctx.price);
  const finalPrice=num(activeOffer?.price??ctx.finalPrice??currentPrice);
  const cost=num(ctx.cost);
  const adsCost=num(ctx.adsCost),adsOrders=num(ctx.adsOrders);
  const adsPerOrder=adsCost!=null&&adsOrders>0?adsCost/adsOrders:null;
  const leaderPrice=num(leader?.price);
  const marketPrices=competitors.map(x=>num(x.price)).filter(x=>x!=null);
  const marketMedian=median(marketPrices);
  const baseCandidate=leaderPrice??marketMedian;
  const baseCalc=shopeeProfit(baseCandidate,cost,adsPerOrder);
  const suggested=baseCandidate!=null&&baseCalc?.profit>0?baseCandidate:null;
  const displayedPrice=num(draft.base??suggested??finalPrice);
  const displayedCalc=shopeeProfit(displayedPrice,cost,adsPerOrder);

  useEffect(()=>{
    if(loading)return;
    const next={};
    if(!ownVariations.length){if(suggested!=null)next.base=String(suggested.toFixed(2)).replace('.',',');}
    else for(const row of ownVariations){
      const comp=matchCompetitorVariation(row,competitorVariations);
      const candidate=num(comp?.price);
      const calc=shopeeProfit(candidate,row.cost??cost,adsPerOrder);
      if(candidate!=null&&calc?.profit>0)next[String(row.modelId??row.name)]=String(candidate.toFixed(2)).replace('.',',');
    }
    setDraft(d=>Object.keys(d).length?d:next);
  },[loading]);

  const parseInput=value=>{const x=String(value??'').replace(/[^0-9,.-]/g,'').replace(',','.');const n=Number(x);return Number.isFinite(n)?n:null};
  async function savePrice(){
    const rows=ownVariations.length?ownVariations.map(row=>({model_id:row.modelId,price:parseInput(draft[String(row.modelId??row.name)]??row.price)})).filter(x=>x.model_id!=null&&x.price>0):[{model_id:0,price:parseInput(draft.base??displayedPrice)}];
    if(!rows.length||rows.some(x=>!(x.price>0))){setMessage('Revise os preços antes de salvar.');return}
    const summary=rows.length===1?money(rows[0].price):rows.length+' preços de variação';
    if(!window.confirm('Confirmar '+summary+' na Shopee?'))return;
    setSaving(true);setMessage('');
    try{
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
      const response=await fetch('/api/shopee/product-price',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:p.id,prices:rows}),signal:ctrl.signal});
      clearTimeout(timer);
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.error)throw new Error(data?.error||('HTTP '+response.status));
      setMessage('Preço salvo e confirmado na Shopee.');
    }catch(error){setMessage(String(error?.message||error))}finally{setSaving(false)}
  }

  return <section className={styles.inlinePriceCalculator}>
    <header className={styles.calcHeader}><div><span className={styles.calcIcon}>▦</span><div><h4>Calculadora de preço</h4><p>Dados carregados automaticamente do Gestor, Shopee Ads, ofertas e concorrentes.</p></div><em>Ação contextual inline</em></div><button type="button" onClick={onClose}>Recolher</button></header>
    {loading?<div className={styles.calcLoading}>Carregando preço, campanhas e variações…</div>:<>
      <div className={styles.calcSummaryGrid}>
        <label><span>Campanha / Oferta</span><select value={selectedOffer} onChange={e=>setSelectedOffer(e.target.value)}><option value="">Sem oferta identificada</option>{offers.map(o=><option key={o.flash_sale_id} value={String(o.flash_sale_id)}>{Number(o.start_time)*1000<=Date.now()?'Ativa':'Agendada'} · Oferta #{o.flash_sale_id} · {money(o.price)}</option>)}</select></label>
        <div><span>Custo do produto</span><b>{money(cost)}</b><small>{cost==null?'Custo ainda não cadastrado.':'Salvo no Gestor.'}</small></div>
        <div><span>Ads por pedido</span><b>{money(adsPerOrder)}</b><small>{adsPerOrder==null?'Sem atribuição suficiente.':money(adsCost)+' ÷ '+int(adsOrders)+' pedidos Ads'}</small></div>
        <div><span>Preço atual</span><b>{money(currentPrice)}</b></div>
        <div><span>Preço final em oferta</span><b>{money(finalPrice)}</b><small>{activeOffer?'Oferta selecionada.':'Sem oferta ativa identificada.'}</small></div>
        <div><span>Média/mediana concorrentes</span><b>{money(marketMedian)}</b></div>
        <div><span>Concorrente que mais vende</span><b>{money(leaderPrice)}</b><small>{leader?.sold!=null?int(leader.sold)+' vendidos':'Vendas não coletadas'}</small></div>
      </div>

      <div className={styles.variationCompare}>
        <section><h5>Concorrente que mais vende</h5>{leader?<><a href={leader.url||'#'} target={leader.url?'_blank':undefined} rel={leader.url?'noreferrer':undefined}>{leader.title||'Concorrente líder'} {leader.url?'↗':''}</a>{competitorVariations.length?<div className={styles.variationRows}>{competitorVariations.map((v,i)=><div key={i}><span>{v.name||('Variação '+(i+1))}</span><b>{money(v.price)}</b></div>)}</div>:<p className={styles.calcMissing}>As variações desse concorrente ainda não foram coletadas.</p>}</>:<p className={styles.calcMissing}>Nenhum concorrente vinculado.</p>}</section>
        <section><h5>Minhas variações</h5>{ownVariations.length?<div className={styles.variationRows}>{ownVariations.map((v,i)=>{const comp=matchCompetitorVariation(v,competitorVariations);const key=String(v.modelId??v.name);const price=parseInput(draft[key]??v.price);const calc=shopeeProfit(price,v.cost??cost,adsPerOrder);return <div className={styles.ownVariationRow} key={key}><span><b>{v.name}</b><small>Atual {money(v.price)}{comp?' · concorrente '+money(comp.price):''}</small></span><label><small>Novo preço</small><input inputMode="decimal" value={draft[key]??(v.price??'')} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></label><span className={styles.variationMargin}>{calc?calc.marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}<small>margem</small></span></div>})}</div>:<div className={styles.singlePriceRow}><label><span>Novo preço</span><input inputMode="decimal" value={draft.base??(displayedPrice??'')} onChange={e=>setDraft(d=>({...d,base:e.target.value}))}/></label><div><span>Margem estimada</span><b>{displayedCalc?displayedCalc.marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}</b></div><div><span>Lucro estimado/venda</span><b>{displayedCalc?money(displayedCalc.profit):'—'}</b></div></div>}</section>
      </div>

      <div className={styles.calcRecommendation}><div><span>Preço competitivo de referência</span><strong>{money(suggested)}</strong></div><p>{suggested!=null?'Referência baseada no concorrente líder/mediana e validada para não ficar com lucro negativo usando custo e Ads disponíveis.':'Não há dados suficientes para sugerir preço com segurança. Preencha custo ou vincule concorrentes.'}</p></div>
      {activeOffer&&<div className={styles.calcOfferWarning}>O produto está em uma oferta. Alterar o preço normal não substitui automaticamente o preço promocional dessa campanha.</div>}
      {message&&<div className={styles.calcMessage}>{message}</div>}
      <footer className={styles.calcFooter}><button type="button" className={styles.calcPrimary} onClick={savePrice} disabled={saving}>{saving?'Salvando…':'Salvar novo preço'}</button>{leader?.url&&<a href={leader.url} target="_blank" rel="noreferrer">Ver concorrente líder</a>}<button type="button" onClick={onClose}>Cancelar</button></footer>
    </>}
  </section>;
}

function titleKeywordEvidence(currentTitle,suggestedTitle,competitors,explicit=[]){
  const stop=new Set(['para','com','sem','dos','das','de','do','da','e','em','no','na','um','uma','kit','livro']);
  const explicitClean=arr(explicit).map(x=>cleanText(x)).filter(Boolean);
  const titles=[...arr(competitors).map(x=>cleanText(x?.title)),cleanText(suggestedTitle),cleanText(currentTitle)].filter(Boolean);
  const freq=new Map();
  for(const title of titles){
    const words=normalizedVariationName(title).split(' ').filter(w=>w.length>=3&&!stop.has(w));
    const seen=new Set();
    for(const word of words){
      if(seen.has(word))continue;seen.add(word);
      freq.set(word,(freq.get(word)||0)+1);
    }
  }
  const common=[...freq.entries()].sort((a,b)=>b[1]-a[1]||b[0].length-a[0].length).map(([word])=>word);
  const capital=value=>value.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
  return [...new Set([...explicitClean,...common.map(capital)])].slice(0,10);
}

function TitleEditor({p,context,onClose}){
  const ctx=context?.[String(p.id)]||{};
  const currentTitle=cleanText(ctx.title||p.name||'');
  const suggested=cleanText(ctx.titleSuggestion||'');
  const competitors=arr(ctx.competitors).filter(x=>cleanText(x?.title));
  const keywords=titleKeywordEvidence(currentTitle,suggested,competitors,ctx.titleKeywords);
  const [draft,setDraft]=useState(suggested||currentTitle);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [copied,setCopied]=useState(false);

  useEffect(()=>{setDraft(suggested||currentTitle);setMessage('');setCopied(false)},[p.id,suggested,currentTitle]);

  const hasSuggestion=!!suggested;
  const changed=cleanText(draft)!==currentTitle&&cleanText(draft).length>0;
  const competitorTerms=keywords.slice(0,4).join(', ');

  async function saveTitle(){
    const value=cleanText(draft);
    if(!value){setMessage('O título não pode ficar vazio.');return}
    if(value.length>120){setMessage('O título ultrapassa o limite de 120 caracteres aceito pelo Gestor para a Shopee.');return}
    if(!changed){setMessage('Faça uma alteração no título antes de salvar.');return}
    if(!window.confirm('Aplicar este novo título no anúncio da Shopee?'))return;
    setSaving(true);setMessage('');
    try{
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
      const response=await fetch('/api/shopee/product-update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:p.id,changes:{title:value}}),signal:ctrl.signal});
      clearTimeout(timer);
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.error)throw new Error(data?.error||('HTTP '+response.status));
      setMessage('Título salvo e confirmado na Shopee.');
    }catch(error){setMessage(String(error?.message||error))}finally{setSaving(false)}
  }

  async function copySuggestion(){
    const value=suggested||draft;
    if(!value)return;
    try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1800)}
    catch{setMessage('Não foi possível copiar automaticamente neste navegador.')}
  }

  return <section className={styles.inlineTitleEditor}>
    <header className={styles.titleEditorHeader}>
      <div><span className={styles.titleEditorIcon}>✎</span><div><h4>Editor de título</h4><p>Sugestão baseada na Super Análise, concorrentes e termos encontrados nos títulos de referência.</p></div></div>
      <button type="button" onClick={onClose}>⌃ Recolher editor</button>
    </header>

    <div className={styles.titleCompareGrid}>
      <article><div><span>Título atual</span><em data-tone="bad">Atual</em></div><p>{currentTitle||'Título não disponível'}</p></article>
      <article data-suggested="true"><div><span>Título sugerido pelo Motor Sênior</span><em data-tone={hasSuggestion?'good':'data'}>{hasSuggestion?'Otimizado':'Sem sugestão'}</em></div><p>{hasSuggestion?suggested:'Ainda não existe uma sugestão estruturada de título nesta Super Análise.'}</p>{hasSuggestion&&<button type="button" onClick={copySuggestion} title="Copiar sugestão">{copied?'✓':'⧉'}</button>}</article>
    </div>

    <section className={styles.titleReasonBox}>
      <strong>💡 Por que sugerimos isso?</strong>
      {hasSuggestion?<div>
        <span>✓ A sugestão foi salva pela última Super Análise deste produto.</span>
        <span>✓ Usa como evidência os concorrentes vinculados ao anúncio.</span>
        {competitorTerms&&<span>✓ Termos recorrentes encontrados nas referências: {competitorTerms}.</span>}
        {ctx.titleReason&&<span>✓ {ctx.titleReason}</span>}
      </div>:<p>O Gestor não vai inventar um título. Faça ou atualize a Super Análise para gerar uma sugestão SEO baseada no anúncio e nos concorrentes.</p>}
    </section>

    <div className={styles.titleKeywords}>
      <div><strong>Palavras-chave encontradas</strong><small>Extraídas da sugestão e dos títulos dos concorrentes vinculados.</small></div>
      {keywords.length?<div>{keywords.map((word,index)=><span key={index}>{word}</span>)}</div>:<p>Sem palavras-chave estruturadas disponíveis.</p>}
    </div>

    <section className={styles.titleCompetitors}>
      <div><strong>Concorrentes usados como base</strong><Link href="/pesquisa-produtos">Ver todos os concorrentes →</Link></div>
      {competitors.length?<div>{competitors.slice(0,3).map((comp,index)=><a key={index} href={comp.url||'#'} target={comp.url?'_blank':undefined} rel={comp.url?'noreferrer':undefined} data-disabled={!comp.url?'true':'false'}>
        {comp.image?<img src={comp.image} alt=""/>:<span className={styles.titleCompPlaceholder}>◎</span>}
        <div><b>{comp.title}</b><small>{comp.price!=null?money(comp.price):'Preço não coletado'}{comp.sold!=null?' · '+int(comp.sold)+' vendidos':''}</small></div>
      </a>)}</div>:<p>Este produto ainda não possui concorrentes vinculados.</p>}
    </section>

    <label className={styles.titleDraftField}>
      <div><span>Editar título</span><small>{cleanText(draft).length}/120</small></div>
      <textarea value={draft} onChange={e=>setDraft(e.target.value.slice(0,120))} rows={3} placeholder="Digite o novo título do anúncio"/>
    </label>

    {message&&<div className={styles.titleEditorMessage}>{message}</div>}
    <footer className={styles.titleEditorFooter}>
      <button type="button" className={styles.titlePrimary} onClick={saveTitle} disabled={saving||!changed}>{saving?'Aplicando…':'✓ Aplicar no anúncio'}</button>
      <button type="button" onClick={copySuggestion} disabled={!hasSuggestion}>{copied?'✓ Copiado':'⧉ Copiar sugestão'}</button>
      <Link href="/super-analise">⌕ Ver Super Análise</Link>
      <Link href="/pesquisa-produtos">▥ Comparar concorrentes</Link>
    </footer>
  </section>;
}

function ProductFunnelCard({p,med,mode,context}){
  const [priceOpen,setPriceOpen]=useState(false);
  const [titleOpen,setTitleOpen]=useState(false);
  const plan=mode==='specific'?specificPlan(p,med,context):productPlan(p,med);
  const bottleneck=productBottleneck(plan);
  const status=plan.priority==='bad'?'CRÍTICO':plan.priority==='warn'?'ATENÇÃO':plan.priority==='good'?'SAUDÁVEL':'POUCOS DADOS';
  const competitor=arr(context?.[String(p.id)]?.competitors)[0]||null;
  const evidence=plan.evidence||'';
  const titleActionIndex=plan.actions.findIndex(action=>/t[ií]tulo|palavra.?chave|keyword/i.test(String(action)));
  const priceActionIndex=plan.actions.findIndex((action,index)=>index!==titleActionIndex&&/pre[cç]o|oferta/i.test(String(action)));
  return <article className={styles.productFunnelCard} data-priority={plan.priority}>
    <header className={styles.productFunnelHeader}>
      <div className={styles.productIdentity}>
        <img src={p.image||'/favicon.ico'} alt=""/>
        <div><h3>{p.name||'Produto'}</h3><small>ID {p.id||'—'}</small></div>
      </div>
      <span className={styles.productStatus} data-priority={plan.priority}>{status}</span>
    </header>

    <div className={styles.productFunnelBody}>
      <div className={styles.productFunnelLeft}>
        <MiniProductFunnel p={p}/>
        <div className={styles.productCompetitorBox}>
          <strong>Concorrente de referência</strong>
          {competitor?<a href={competitor.url||'#'} target={competitor.url?'_blank':undefined} rel={competitor.url?'noreferrer':undefined} data-disabled={!competitor.url?'true':'false'}>
            {competitor.image?<img src={competitor.image} alt=""/>:<span className={styles.productCompetitorPlaceholder}>◎</span>}
            <div><b>{competitor.title||'Concorrente vinculado'}</b><small>{competitor.price!=null?money(competitor.price):'Preço não coletado'}{competitor.sold!=null?' · '+int(competitor.sold)+' vendidos':''}</small></div>
          </a>:<div className={styles.productCompetitorEmpty}>Ainda não há concorrente vinculado para este produto.</div>}
        </div>
      </div>

      <div className={styles.productFunnelRight}>
        <section className={styles.productDiagnosis} data-tone={bottleneck.tone}>
          <h4>{bottleneck.title}</h4>
          <strong>{evidence}</strong>
          <p>{bottleneck.detail}</p>
          {mode==='specific'&&plan.specificNote&&<small>{plan.specificNote}</small>}
        </section>

        <section className={styles.productActionBox}>
          <strong>Faça assim</strong>
          <ol>{plan.actions.slice(0,3).map((action,index)=><li key={index}><span>{index+1}</span><p>{action}</p>
            {index===titleActionIndex&&<button type="button" className={styles.inlineActionButton} onClick={()=>{setTitleOpen(v=>!v);setPriceOpen(false)}}>{titleOpen?'Fechar editor':'✎ Editar título'}</button>}
            {index===priceActionIndex&&<button type="button" className={styles.inlineActionButton} onClick={()=>{setPriceOpen(v=>!v);setTitleOpen(false)}}>{priceOpen?'Fechar calculadora':'▦ Abrir calculadora'}</button>}
          </li>)}</ol>
        </section>

        <div className={styles.productFunnelFooter}>
          <Link href={plan.href}>{plan.action} →</Link>
          <span className={styles.productChartGlyph}>▥</span>
        </div>
      </div>
    </div>
    {titleOpen&&<TitleEditor p={p} context={context} onClose={()=>setTitleOpen(false)}/>}
    {priceOpen&&<PriceCalculator p={p} context={context} onClose={()=>setPriceOpen(false)}/>}
  </article>;
}

function ProductRow({p,med}){
  const plan=productPlan(p,med);
  return <tr>
    <td><div className={styles.product}><img src={p.image||'/favicon.ico'} alt=""/><div><b>{p.name||'Produto'}</b><small>ID {p.id||'—'}</small></div></div></td>
    <td>{int(p.product_card_impressions)}</td><td>{int(p.product_card_clicks)}</td><td>{pct(num(p.ctr))}</td>
    <td>{int(p.uv)}</td><td>{int(p.add_to_cart_buyers)}</td><td>{int(p.placed_buyers)}</td><td>{int(p.paid_buyers)}</td><td>{int(p.confirmed_buyers)}</td>
    <td><span className={styles.flag} data-priority={plan.priority}>{plan.label}</span></td>
  </tr>
}

function normalizeAdsCampaign(c){
  const impressions=num(c?.impressions??c?.impression),clicks=num(c?.clicks??c?.click),orders=num(c?.orders??c?.order);
  return{name:c?.productName||c?.title||c?.campaignName||'Campanha',impressions,clicks,orders,ctr:impressions>0&&clicks!=null?clicks/impressions:null,cvr:clicks>0&&orders!=null?orders/clicks:null};
}

export default function FunilPage(){
  const searchParams=useSearchParams();
  const requestedItem=String(searchParams.get('item_id')||'');
  const [tab,setTab]=useState(searchParams.get('tab')==='produto'?'produto':'loja');
  const [guidanceMode,setGuidanceMode]=useState('standard');
  const [period,setPeriod]=useState('past30days');
  const [context,setContext]=useState({});
  const [state,setState]=useState({loading:true,error:'',seller:null,ads:null});
  const load=async(selectedPeriod=period)=>{
    setState(s=>({...s,loading:true,error:''}));
    const meta=periodMeta(selectedPeriod);
    const [sellerR,adsR]=await Promise.allSettled([
      motorData('sellerFunnel',{period:selectedPeriod},60000),
      getJson('/api/shopee/ads?days='+meta.days)
    ]);
    const seller=sellerR.status==='fulfilled'?sellerR.value:null;
    const ads=adsR.status==='fulfilled'?(adsR.value?.v7||adsR.value?.v5||adsR.value):null;
    const errors=[];
    if(sellerR.status==='rejected')errors.push('Funil completo: '+String(sellerR.reason?.message||sellerR.reason));
    if(adsR.status==='rejected')errors.push('Shopee Ads: '+String(adsR.reason?.message||adsR.reason));
    if(seller&&seller?.period?.type&&seller.period.type!==selectedPeriod)errors.push('O Motor Sênior respondeu '+periodMeta(seller.period.type).label+' em vez de '+periodMeta(selectedPeriod).label+'. Atualize a extensão para v0.17.4+ para usar o histórico mapeado.');
    if(seller){
      const ids=arr(seller.products).map(x=>String(x?.id||'').trim()).filter(Boolean).slice(0,100);
      if(ids.length){
        try{
          const extra=await getJson('/api/funnel/context?item_ids='+encodeURIComponent(ids.join(',')));
          setContext(extra?.items||{});
        }catch(error){
          errors.push('Contexto específico: '+String(error?.message||error));
          setContext({});
        }
      }else setContext({});
    }else setContext({});
    setState({loading:false,error:errors.join(' · '),seller,ads});
  };
  useEffect(()=>{
    try{
      const saved=localStorage.getItem('gs_funnel_guidance_mode');
      if(saved==='standard'||saved==='specific')setGuidanceMode(saved);
    }catch{}
    load('past30days');
  },[]);
  const changePeriod=next=>{
    if(next===period)return;
    setPeriod(next);
    load(next);
  };
  const chooseGuidance=mode=>{
    setGuidanceMode(mode);
    try{localStorage.setItem('gs_funnel_guidance_mode',mode)}catch{}
  };

  const model=useMemo(()=>{
    const s=state.seller||{},k=s.keyMetrics||{},rt=s.realtime?.key_metrics||{},overview=s.productOverview||{};
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
    const med={
      ctr:median(products.map(p=>num(p.ctr))),
      cart:median(products.map(p=>num(p.uv_to_add_to_cart_rate))),
      paid:median(products.map(p=>num(p.uv_to_paid_buyers_rate))),
      cartPlaced:median(products.map(p=>{const a=num(p.add_to_cart_buyers),b=num(p.placed_buyers);return a>0&&b!=null?b/a:null})),
      placedPaid:median(products.map(p=>{const a=num(p.placed_buyers),b=num(p.paid_buyers);return a>0&&b!=null?b/a:null})),
      paidConfirmed:median(products.map(p=>{const a=num(p.paid_buyers),b=num(p.confirmed_buyers);return a>0&&b!=null?b/a:null}))
    };
    const sources=[];
    const tr=s.traffic||{};
    for(const [key,label] of [['product_card','Card de produto / Busca'],['live','Live'],['video','Vídeo'],['affiliate','Afiliados'],['paid_ads','Shopee Ads']]){
      const t=tr?.[key]?.total;
      if(t)sources.push({key,label,sales:num(t.sales),orders:num(t.orders),clicks:num(t.product_clicks),impressions:num(t.product_impressions),ctr:num(t.ctr),conversion:num(t.product_clicks_to_orders_rate??t.conversion)});
    }
    const campaigns=arr(state.ads?.campaigns).map(normalizeAdsCampaign);
    const comparison={
      visitors:num(k?.shop_uv?.chain_ratio),
      paidOrders:num(k?.paid_orders?.chain_ratio),
      paidGmv:num(k?.paid_gmv?.chain_ratio),
      confirmedOrders:num(k?.confirmed_orders?.chain_ratio)
    };
    return{totals,rates,products,med,sources,campaigns,comparison,trends:s.productMetricTrends||{},orderPerformance:s.orderPerformance||{},key:k,realtime:rt,period:s.period||null,errors:arr(s.errors)};
  },[state]);

  if(state.loading)return <div className={styles.page}><div className={styles.loading}>Lendo Informações Gerenciais da Shopee e montando o funil…</div></div>;

  const analyzedProducts=model.products.filter(p=>{
    const ctx=context?.[String(p.id)];
    if(!ctx?.analyzedAt)return false;
    const age=(Date.now()-new Date(ctx.analyzedAt).getTime())/86400000;
    return Number.isFinite(age)&&age<=30;
  });
  const orderedAnalyzed=[...analyzedProducts].sort((a,b)=>{
    if(requestedItem&&String(a.id)===requestedItem)return -1;
    if(requestedItem&&String(b.id)===requestedItem)return 1;
    return productPlan(a,model.med).rank-productPlan(b,model.med).rank;
  });
  const unavailableForFunnel=Math.max(0,model.products.length-analyzedProducts.length);

  const full=!!state.seller;
  const actualPeriod=state.seller?.period?.type||period;
  const actualPeriodMeta=periodMeta(actualPeriod);
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>GESTOR SÊNIOR · CONVERSÃO</span><h1>Análise de Funil</h1><p>Descubra em qual etapa suas vendas estão travando e o que fazer primeiro.</p></div>
      <div className={styles.headerActions}>
        <div className={styles.periodPicker} role="group" aria-label="Período do funil">{PERIODS.map(x=><button type="button" key={x.id} data-active={period===x.id} onClick={()=>changePeriod(x.id)} disabled={state.loading}>{x.label}</button>)}</div>
        <span className={styles.periodBadge}>◷ {actualPeriodMeta.label}{actualPeriod==='real_time'?' · tempo real':''}</span>
        <button type="button" onClick={()=>load(period)} disabled={state.loading}>↻ Atualizar agora</button>
      </div>
    </header>

    {state.error&&<div className={styles.warning}>{state.error}</div>}
    {!full&&<div className={styles.warning}><b>Funil completo indisponível.</b> Atualize o Motor Sênior para a versão 0.17.4 ou superior e mantenha uma sessão ativa no Seller Center. Enquanto isso, a aba “Histórico Ads” continua usando os dados já disponíveis.</div>}

    <nav className={styles.tabs}>
      <button data-active={tab==='loja'} onClick={()=>setTab('loja')}>Funil da Loja</button>
      <button data-active={tab==='produto'} onClick={()=>setTab('produto')}>Por Produto</button>
      <button data-active={tab==='trafego'} onClick={()=>setTab('trafego')}>Fontes de Tráfego</button>
      <button data-active={tab==='ads'} onClick={()=>setTab('ads')}>Histórico Ads</button>
    </nav>

    {tab==='loja'&&<>
      <FunnelVisual totals={model.totals} rates={model.rates}/>
      <KpiStrip totals={model.totals} rates={model.rates}/>
      <ComparisonStrip comparison={model.comparison}/>
      <TrendPanel trends={model.trends} periodLabel={actualPeriodMeta.label}/>
      <PostOrderPanel orderPerformance={model.orderPerformance}/>
      <section className={styles.unlockPanel}>
        <div className={styles.unlockHead}>
          <div><span className={styles.targetIcon}>◎</span><div><h2>Plano de Destrave</h2><p>Ações para atacar primeiro os produtos com maior gargalo.</p></div></div>
          <div className={styles.compactGuidance}><span>Modo de orientação:</span><button type="button" data-active={guidanceMode==='standard'} onClick={()=>chooseGuidance('standard')}>Padrão</button><button type="button" data-active={guidanceMode==='specific'} onClick={()=>chooseGuidance('specific')}>Específico · me diga o que fazer</button></div>
        </div>
        {orderedAnalyzed.length?<ProductActionCard
          p={orderedAnalyzed[0]}
          med={model.med}
          mode={guidanceMode}
          context={context}
        />:<div className={styles.empty}>Nenhum produto está liberado para o Plano de Destrave. Faça a Super Análise para liberar o diagnóstico por produto.</div>}
        {orderedAnalyzed.length>1&&<button type="button" className={styles.allProductsBtn} onClick={()=>setTab('produto')}>Ver plano de todos os produtos →</button>}
      </section>
      <section className={styles.education}>
        <div><b>1</b><h3>Impressão → clique</h3><p>Queda forte aqui aponta para capa, título, preço percebido ou competitividade na busca.</p></div>
        <div><b>2</b><h3>Visita → carrinho</h3><p>Se a pessoa entra e não adiciona, revise oferta, prova social, imagens, variações, frete e descrição.</p></div>
        <div><b>3</b><h3>Carrinho → pedido/pago</h3><p>O desejo existe, mas algo trava o fechamento: preço final, cupom, frete, prazo ou confiança.</p></div>
      </section>
    </>}

    {tab==='produto'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>Funil por Produto</h2><p>Apenas anúncios com Super Análise recente entram aqui, porque preço, concorrentes e sugestões dependem desse contexto.</p></div><span>{analyzedProducts.length} disponíveis</span></div>
      <div className={styles.funnelEligibilityNotice}><b>Super Análise obrigatória</b><span>{unavailableForFunnel>0?`${unavailableForFunnel} produto(s) ainda estão indisponíveis no Funil ou precisam ser reanalisados.`:'Todos os produtos com dados de funil já estão liberados.'}</span><Link href="/super-analise">Gerenciar na Super Análise →</Link></div>
      <div className={styles.guidanceMode}>
        <div><strong>Como você quer receber as sugestões?</strong><small>Sua escolha fica salva neste navegador.</small></div>
        <div role="group" aria-label="Modo de orientação">
          <button type="button" data-active={guidanceMode==='standard'} onClick={()=>chooseGuidance('standard')}><b>Padrão</b><span>Mostre o problema e o que revisar</span></button>
          <button type="button" data-active={guidanceMode==='specific'} onClick={()=>chooseGuidance('specific')}><b>Específico · me diga o que fazer</b><span>Cruze concorrentes, preço, margem e Super Análise</span></button>
        </div>
      </div>
      <div className={styles.productPlanBanner}><b>Plano de destrave</b><span>As sugestões são testes orientados por evidências; nenhuma alteração é aplicada automaticamente.</span></div>
      {!orderedAnalyzed.length?<div className={styles.empty}>Nenhum produto disponível. Faça a Super Análise dos anúncios que deseja acompanhar no Funil.</div>:<>
        <div className={styles.productFunnelList}>
          {orderedAnalyzed.map(p=><ProductFunnelCard key={'funnel-'+p.id} p={p} med={model.med} mode={guidanceMode} context={context}/>)}
        </div>
        <details className={styles.rawDetails}><summary>Ver tabela completa dos produtos liberados</summary><div className={styles.tableWrap}><table><thead><tr><th>Produto</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Visitantes</th><th>Carrinho</th><th>Pedido</th><th>Pago</th><th>Confirmado</th><th>Status</th></tr></thead><tbody>{orderedAnalyzed.map(p=><ProductRow key={p.id} p={p} med={model.med}/>)}</tbody></table></div></details>
      </>}
    </section>}

    {tab==='trafego'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>De onde vêm suas vendas?</h2><p>Contribuição das fontes de tráfego carregadas pela própria Shopee.</p></div></div>
      <div className={styles.sourceGrid}>{model.sources.length?model.sources.map(s=><article key={s.key}><h3>{s.label}</h3><strong>{money(s.sales)}</strong><span>{int(s.orders)} pedidos</span><div><small>{int(s.impressions)} impressões</small><small>{int(s.clicks)} cliques</small><small>CTR {pct(s.ctr)}</small><small>Conv. {pct(s.conversion)}</small></div></article>):<div className={styles.empty}>Sem fontes de tráfego disponíveis.</div>}</div>
    </section>}

    {tab==='ads'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>Histórico Shopee Ads · 7 dias</h2><p>Camada complementar para enxergar campanhas fora do recorte em tempo real.</p></div></div>
      {!model.campaigns.length?<div className={styles.empty}>Sem campanhas disponíveis.</div>:<div className={styles.adsList}>{model.campaigns.slice(0,12).map((c,i)=><div key={i}><b>{c.name}</b><span>{int(c.impressions)} impressões · {int(c.clicks)} cliques · {int(c.orders)} pedidos</span><small>CTR {pct(c.ctr)} · clique→pedido {pct(c.cvr)}</small></div>)}</div>}
    </section>}

    <section className={styles.sourceNote}><strong>Fonte e confiabilidade</strong><p>O funil completo usa os endpoints estruturados de “Informações Gerenciais” lidos pela extensão dentro da sessão normal do Seller Center. Nenhum cookie ou token é enviado ao Gestor. Quando uma métrica não existe na resposta, ela aparece como “—”. Não encontramos uma etapa explícita de “início de checkout”; por isso o fluxo usa Carrinho → Pedido criado → Pago → Confirmado.</p>{model.errors.length>0&&<small>{model.errors.map(x=>x.source+': '+x.error).join(' · ')}</small>}</section>
  </div>
}
