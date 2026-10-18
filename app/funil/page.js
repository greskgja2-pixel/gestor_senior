'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {motorData} from '../lib/client-async';
import {deriveStoreFunnel} from '../lib/funnel-health';
import {transitionById,stageByKey,rankProductsForStage} from '../lib/funnel-store-diagnosis';
import {classifyProduct} from '../lib/funnel-product-state';
import ProductList from './ProductList';
import {PRODUCT_FUNNEL_FIELDS,chooseBestFunnelResponse,needsFunnelRetry,diagnoseFunnelProducts,mergeRecollectedFunnelProduct} from '../lib/funnel-product-diagnostics';
import TrafficSources from './TrafficSources';
import StoreOverview,{Icon,GuidanceSwitch,imageFallback,IMAGE_PLACEHOLDER} from './StoreOverview';
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

async function getJsonWithPost(url,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||data?.error)throw new Error(data?.error||'HTTP '+r.status);
    return data;
  }finally{clearTimeout(timer)}
}

async function getJson(url){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j?.error)throw new Error(j?.error||('HTTP '+r.status));
    return j;
  }finally{clearTimeout(timer)}
}

function productPlan(p,med){
  const impressions=num(p.product_card_impressions),clicks=num(p.product_card_clicks),uv=num(p.uv),carts=num(p.add_to_cart_buyers),placed=num(p.placed_buyers),paid=num(p.paid_buyers),confirmed=num(p.confirmed_buyers);
  const ctr=num(p.ctr)??(impressions>0&&clicks!=null?clicks/impressions:null);
  const cartRate=num(p.uv_to_add_to_cart_rate)??(uv>0&&carts!=null?carts/uv:null);
  const paidRate=num(p.uv_to_paid_buyers_rate)??(uv>0&&paid!=null?paid/uv:null);
  const cartPlaced=carts>0&&placed!=null?placed/carts:null,placedPaid=placed>0&&paid!=null?paid/placed:null,paidConfirmed=paid>0&&confirmed!=null?confirmed/paid:null;
  const low=(value,medianValue,minBase)=>value!=null&&medianValue!=null&&minBase&&value<medianValue*.6;
  if(impressions==null||uv==null)return{
    priority:'missing',rank:5,
    label:impressions==null&&uv==null?'DADOS NÃO COLETADOS':'COLETA PARCIAL',
    title:'Métricas do funil não coletadas',
    why:'O Motor Sênior não entregou impressões e/ou visitantes para este anúncio no período selecionado. Isso não significa que o produto tenha pouco tráfego.',
    evidence:`Impressões: ${impressions==null?'não coletadas':int(impressions)} · Visitantes: ${uv==null?'não coletados':int(uv)}`,
    actions:['Use “Atualizar agora” para tentar coletar novamente no período escolhido.','Teste também “Hoje” para conferir se o Motor consegue ler as métricas em tempo real, sem misturar os períodos.','Se persistir, acesse Configurações → Saúde do Sistema e execute o diagnóstico do Motor Sênior.'],
    href:'/?section=config',action:'Ver Saúde do Sistema'
  };
  if(impressions<100||uv<10)return{
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
    actions:['Pesquise na Shopee o nome do seu produto e abra os anúncios que mais vendem. Compare a capa deles com a sua (fundo, enquadramento, quantidade de itens à mostra, texto na imagem) e refaça a sua seguindo o padrão que se repete, sem copiar a imagem.','Reescreva o começo do título com o que o cliente digita (produto + principal característica) e compare com os títulos dos mais vendidos.','Compare seu preço com anúncios iguais ao seu: se estiver bem acima, avalie oferta ou cupom antes de baixar o preço, conferindo a margem.'],
    href:'/extensao-shopee-intelligence?section=super-anuncio',action:'Revisar capa e título'
  };
  if(low(cartRate,med.cart,uv>=10))return{
    priority:'bad',rank:0,label:'FAÇA AGORA',title:'O cliente entra, mas não coloca no carrinho',
    why:'A vitrine consegue trazer visitantes, porém o anúncio perde força quando a pessoa vê os detalhes.',
    evidence:`Visita→carrinho ${pct(cartRate)} · mediana ${pct(med.cart)} · ${int(uv)} visitantes`,
    actions:['Abra o anúncio no celular, como o cliente, e veja se nas primeiras telas dá para entender o que é, a quantidade/tamanho e o preço. Se não der, reorganize as imagens.','Adicione imagens que os concorrentes mostram e você não: medidas, o que vem na embalagem, produto em uso e tabela de variações.','Compare preço final (com frete) e prazo com 3 concorrentes diretos e leia as avaliações negativas deles para responder as dúvidas na sua descrição.'],
    href:'/extensao-shopee-intelligence?section=super-anuncio',action:'Revisar o anúncio'
  };
  if(low(cartPlaced,med.cartPlaced,carts>=5))return{
    priority:'bad',rank:0,label:'FAÇA AGORA',title:'O cliente coloca no carrinho e desiste antes do pedido',
    why:'Existe intenção de compra, mas uma parte grande não transforma o carrinho em pedido.',
    evidence:`Carrinho→pedido ${pct(cartPlaced)} · mediana ${pct(med.cartPlaced)} · ${int(carts)} compradores no carrinho`,
    actions:['Simule a compra: coloque no carrinho e vá até o fechamento. Veja o preço final com frete e taxas; um valor que muda no fim costuma gerar desistência.','Compare o preço final com anúncios iguais ao seu. Se estiver acima, teste cupom ou oferta pequena, conferindo antes a margem na calculadora do Gestor.','Confira o estoque das variações mais procuradas e o prazo de envio: variação sem estoque ou prazo longo fazem o cliente desistir.'],
    href:'/pesquisa-produtos',action:'Comparar mercado'
  };
  if(low(placedPaid,med.placedPaid,placed>=5))return{
    priority:'warn',rank:1,label:'REVISAR',title:'Muitos pedidos são criados, mas poucos viram pagamento',
    why:'O gargalo está depois da intenção e da criação do pedido, perto do fechamento.',
    evidence:`Pedido→pago ${pct(placedPaid)} · mediana ${pct(med.placedPaid)} · ${int(placed)} compradores com pedido`,
    actions:['No Seller Center, abra os pedidos não pagos ou expirados do período e procure um padrão: mesmo produto, mesma variação ou valores altos.','Não comece pela capa: o cliente já criou o pedido. Reveja o preço final e o prazo mostrados no fechamento.','Acompanhe por alguns dias antes de fazer mudanças grandes e mude uma coisa por vez.'],
    href:'/insights',action:'Ver outros sinais'
  };
  if(low(paidConfirmed,med.paidConfirmed,paid>=5))return{
    priority:'warn',rank:1,label:'REVISAR',title:'A venda é paga, mas perde força antes da confirmação',
    why:'A aquisição funcionou; o ponto de atenção está na etapa operacional depois do pagamento.',
    evidence:`Pago→confirmado ${pct(paidConfirmed)} · mediana ${pct(med.paidConfirmed)} · ${int(paid)} compradores pagos`,
    actions:['No Seller Center, abra os pedidos cancelados deste produto e leia o motivo (sem estoque, atraso no envio, pedido do comprador).','Se for estoque: atualize a quantidade real e desative variações zeradas. Se for atraso: confira se o prazo de preparo configurado é possível de cumprir.','Despache dentro do prazo e confira as devoluções: se o motivo é produto diferente do anúncio, ajuste fotos e descrição.'],
    href:'/produtos',action:'Ver produto'
  };
  if([ctr,cartRate,cartPlaced,placedPaid,paidConfirmed].every(rate=>rate==null))return{
    priority:'missing',rank:5,label:'COLETA PARCIAL',title:'Taxas de conversão não coletadas',
    why:'Existem dados de alcance, mas faltam as etapas seguintes para concluir se o funil deste produto está saudável.',
    evidence:`${int(impressions)} impressões · ${int(uv)} visitantes · taxas indisponíveis`,
    actions:['Atualize os dados para coletar cliques, carrinhos e pedidos.','Confira se o Motor está lendo o período selecionado nas Informações Gerenciais.','Evite alterar preço, título ou ROAS por um diagnóstico incompleto.'],
    href:'/?section=config',action:'Ver Saúde do Sistema'
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
      <div className={styles.product}><img src={p.image||IMAGE_PLACEHOLDER} alt="" onError={imageFallback}/><div><b>{p.name||'Produto'}</b><small>ID {p.id||'—'}</small></div></div>
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
  if(plan.priority==='missing')return{title:plan.title,tone:'missing',detail:plan.why};
  if(plan.priority==='data')return{title:'Amostra pequena',tone:'data',detail:'Há números reais, mas o volume ainda é baixo para apontar um gargalo com segurança.'};
  if(plan.title.includes('antes do clique'))return{title:'Maior gargalo: Impressões → Cliques',tone:'bad',detail:'O produto aparece, mas proporcionalmente poucas pessoas clicam para conhecer o anúncio.'};
  if(plan.title.includes('não coloca no carrinho'))return{title:'Maior gargalo: Visitas → Carrinho',tone:'bad',detail:'O cliente entra no anúncio, mas a oferta ainda não convence o suficiente para gerar intenção de compra.'};
  if(plan.title.includes('desiste antes do pedido'))return{title:'Maior gargalo: Carrinho → Pedido',tone:'bad',detail:'Os clientes demonstram intenção de compra, mas muitos não finalizam o pedido.'};
  if(plan.title.includes('poucos viram pagamento'))return{title:'Maior gargalo: Pedido → Pago',tone:'warn',detail:'O pedido chega a ser criado, mas parte dos clientes não conclui o pagamento.'};
  if(plan.title.includes('antes da confirmação'))return{title:'Maior gargalo: Pago → Confirmado',tone:'warn',detail:'A aquisição funcionou; a perda acontece depois do pagamento e pede atenção operacional.'};
  return{title:plan.title,tone:plan.priority,detail:plan.why};
}

function MiniProductFunnel({p}){
  const [sel,setSel]=useState(null);
  const impressions=num(p.product_card_impressions),clicks=num(p.product_card_clicks),visits=num(p.uv),carts=num(p.add_to_cart_buyers),placed=num(p.placed_buyers),paid=num(p.paid_buyers);
  const values=[impressions,clicks,visits,carts,placed,paid];
  const labels=['Impressões','Cliques','Visitas','Carrinho','Pedido','Pago'];
  const keys=['impressions','clicks','visitors','carts','placed','paid'];
  // Taxa só com as duas pontas coletadas; acima de 100% é incompatibilidade de bases, não conversão.
  const rawRates=values.map((v,i)=>i===0?(v!=null?1:null):(values[i-1]>0&&v!=null?v/values[i-1]:null));
  const rates=rawRates.map(r=>r!=null&&r>1?null:r);
  const over=rawRates.map(r=>r!=null&&r>1);
  let readout='Toque numa etapa para ver o que ela significa e como a taxa foi calculada.';
  if(sel!=null){
    const v=values[sel];
    if(v==null)readout=labels[sel]+': não coletado. Isso não é tratado como zero.';
    else if(sel===0)readout='Este anúncio recebeu '+int(v)+' impressões no período.';
    else if(values[sel-1]==null)readout=int(v)+' '+labels[sel].toLowerCase()+'. A etapa anterior não foi coletada, então a taxa não é calculada.';
    else if(over[sel])readout=int(v)+' '+labels[sel].toLowerCase()+' para '+int(values[sel-1])+' '+labels[sel-1].toLowerCase()+': a taxa passaria de 100% (métricas de bases diferentes), por isso não é exibida como conversão.';
    else readout=int(v)+' '+labels[sel].toLowerCase()+' para '+int(values[sel-1])+' '+labels[sel-1].toLowerCase()+(rates[sel]!=null?': '+pct(rates[sel])+' de passagem'+(sel===1?' (CTR calculada)':'')+'.':'.');
  }
  return <div className={styles.productMiniFunnel} aria-label="Funil do produto">
    {labels.map((label,index)=><div className={styles.productMiniStage} data-index={index} data-missing={values[index]==null?'true':'false'} data-selected={sel===index?'true':'false'} key={label}>
      <button type="button" className={styles.productMiniBar} aria-pressed={sel===index} onClick={()=>setSel(sel===index?null:index)}><span>{label}</span></button>
      <strong>{int(values[index])}</strong>
      <small>{pct(rates[index])}</small>
    </div>)}
    <p className={styles.miniReadout} aria-live="polite">{readout}</p>
  </div>
}

function normalizedVariationName(value){return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
const DEFAULT_FUNNEL_FEES={lowCommissionPct:20,lowFixedFee:Date.now()>=new Date('2026-10-01T00:00:00-03:00').getTime()?4.5:4,microFixedPct:50,highCommissionPct:14,fixed80:16,fixed100:20,fixed200:26,campaignExtraPct:0};
function shopeeProfit(price,cost,adsPerOrder=0,fees=DEFAULT_FUNNEL_FEES,hasCampaign=false){
  const p=num(price),c=num(cost),ads=num(adsPerOrder)??0;if(!(p>0)||c==null)return null;
  let commissionPct,fixedFee;
  if(p<8){commissionPct=Number(fees.lowCommissionPct||0);fixedFee=p*(Number(fees.microFixedPct||0)/100);}
  else if(p<80){commissionPct=Number(fees.lowCommissionPct||0);fixedFee=Number(fees.lowFixedFee||0);}
  else if(p<100){commissionPct=Number(fees.highCommissionPct||0);fixedFee=Number(fees.fixed80||0);}
  else if(p<200){commissionPct=Number(fees.highCommissionPct||0);fixedFee=Number(fees.fixed100||0);}
  else{commissionPct=Number(fees.highCommissionPct||0);fixedFee=Number(fees.fixed200||0);}
  const campaignExtraPct=hasCampaign?Number(fees.campaignExtraPct||0):0;
  const commission=p*(commissionPct/100),campaignExtra=p*(campaignExtraPct/100),profit=p-c-commission-campaignExtra-fixedFee-ads;
  return{profit,marginPct:profit/p*100,commission,fixedFee,campaignExtra,commissionPct,campaignExtraPct};
}
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
  const [live,setLive]=useState(null);
  const [offer,setOffer]=useState(null);
  const [sellerOffer,setSellerOffer]=useState(null);
  const [fees,setFees]=useState(DEFAULT_FUNNEL_FEES);
  const [draft,setDraft]=useState({});
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    try{const saved=JSON.parse(localStorage.getItem('gs_shopee_fee_config_v1')||'null');if(saved)setFees({...DEFAULT_FUNNEL_FEES,...saved});}catch{}
  },[]);

  useEffect(()=>{
    let alive=true;
    setLoading(true);setMessage('');
    Promise.allSettled([
      getJson('/api/products/manage?item_id='+encodeURIComponent(p.id)),
      getJson('/api/shopee/marketing-discounts?item_ids='+encodeURIComponent(p.id)),
      motorData('sellerDiscounts',{itemIds:[String(p.id)]},30000)
    ]).then(results=>{
      if(!alive)return;
      const [productR,offerR,sellerOfferR]=results;
      if(productR.status==='fulfilled')setLive(productR.value);
      else setMessage('Dados atuais do produto: '+String(productR.reason?.message||productR.reason));
      if(offerR.status==='fulfilled')setOffer(offerR.value?.items?.[String(p.id)]||null);
      else setMessage(prev=>[prev,'Campanha oficial: '+String(offerR.reason?.message||offerR.reason)].filter(Boolean).join(' · '));
      if(sellerOfferR.status==='fulfilled')setSellerOffer(sellerOfferR.value?.items?.[String(p.id)]||null);
      else console.warn('[Funil] detalhamento de desconto do Motor indisponível; mantendo fonte oficial.',sellerOfferR.reason);
    }).finally(()=>alive&&setLoading(false));
    return()=>{alive=false};
  },[p.id]);

  const activeOffer=sellerOffer||offer||ctx.marketingDiscount||null;
  const competitors=arr(ctx.competitors);
  const leader=competitors.length?[...competitors].sort((a,b)=>(num(b.sold)??-1)-(num(a.sold)??-1))[0]:null;
  const competitorVariations=arr(leader?.variations);
  const liveModels=arr(live?.models);
  const hasModels=Boolean(live?.has_model);
  const ownVariations=(hasModels?liveModels:arr(ctx.variations)).map((v,index)=>{
    const saved=arr(ctx.variations).find(x=>String(x?.modelId??x?.model_id)===String(v?.model_id??v?.modelId));
    const rawCost=num(v?.cost??saved?.cost),packaging=num(v?.packaging_cost)??0;
    return{
      modelId:v?.model_id??v?.modelId??v?.id??null,
      name:v?.name||v?.model_name||('Variação '+(index+1)),
      price:num(v?.current_price??v?.price),
      promoPrice:num(v?.promoPrice??v?.promotion_price),
      cost:rawCost==null?null:rawCost+packaging
    };
  });
  const simpleModel=!hasModels?liveModels[0]||null:null;
  const simpleRawCost=num(simpleModel?.cost),simplePackaging=num(simpleModel?.packaging_cost)??0;
  const simpleCost=simpleRawCost==null?num(ctx.cost):simpleRawCost+simplePackaging;
  const costValues=hasModels?ownVariations.map(v=>num(v.cost)).filter(v=>v!=null):[simpleCost].filter(v=>v!=null);
  const cost=hasModels?null:simpleCost;
  const costSummary=costValues.length?(costValues.length===1?money(costValues[0]):money(Math.min(...costValues))+'–'+money(Math.max(...costValues))):'—';
  const livePrices=liveModels.map(v=>num(v?.price)).filter(v=>v!=null);
  const currentPrice=livePrices.length?Math.min(...livePrices):num(ctx.price);
  const finalPrice=num(activeOffer?.offer_price??ctx.finalPrice??currentPrice);
  const adsCost=num(ctx.adsCost),adsOrders=num(ctx.adsOrders);
  const adsPerOrder=adsCost!=null&&adsOrders>0?adsCost/adsOrders:null;
  const leaderPrice=num(leader?.price);
  const marketPrices=competitors.map(x=>num(x.price)).filter(x=>x!=null);
  const marketMedian=median(marketPrices);
  const baseCandidate=leaderPrice??marketMedian;
  const baseCalc=shopeeProfit(baseCandidate,cost,adsPerOrder,fees,Boolean(activeOffer));
  const suggested=baseCandidate!=null&&baseCalc?.profit>0?baseCandidate:null;
  const displayedPrice=num(draft.base??suggested??finalPrice);
  const displayedCalc=shopeeProfit(displayedPrice,cost,adsPerOrder,fees,Boolean(activeOffer));

  useEffect(()=>{
    if(loading)return;
    const next={};
    if(!hasModels){if(suggested!=null)next.base=String(suggested.toFixed(2)).replace('.',',');}
    else for(const row of ownVariations){
      const comp=matchCompetitorVariation(row,competitorVariations);
      const candidate=num(comp?.price);
      const calc=shopeeProfit(candidate,row.cost,adsPerOrder,fees,Boolean(activeOffer));
      if(candidate!=null&&calc?.profit>0)next[String(row.modelId??row.name)]=String(candidate.toFixed(2)).replace('.',',');
    }
    setDraft(d=>Object.keys(d).length?d:next);
  },[loading,hasModels,activeOffer?.discount_id,activeOffer?.promotion_id]);

  const parseInput=value=>{const x=String(value??'').replace(/[^0-9,.-]/g,'').replace(',','.');const n=Number(x);return Number.isFinite(n)?n:null};
  async function savePrice(){
    const rows=hasModels?ownVariations.map(row=>({model_id:row.modelId,price:parseInput(draft[String(row.modelId??row.name)]??row.price)})).filter(x=>x.model_id!=null&&x.price>0):[{model_id:0,price:parseInput(draft.base??displayedPrice)}];
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
    <header className={styles.calcHeader}><div><span className={styles.calcIcon}>▦</span><div><h4>Calculadora de preço</h4><p>Preço e custo atuais da Shopee/Gestor + Ads, campanha ativa e concorrentes.</p></div><em>Dados atuais</em></div><button type="button" onClick={onClose}>Recolher</button></header>
    {loading?<div className={styles.calcLoading}>Carregando preço, custo, campanha e variações atuais…</div>:<>
      <div className={styles.calcSummaryGrid}>
        <div><span>Campanha de marketing</span><b>{activeOffer?.discount_name||'Sem campanha ativa'}</b><small>{activeOffer?.offer_price!=null?'Oferta '+money(activeOffer.offer_price)+(activeOffer?.offer_price_max&&activeOffer.offer_price_max!==activeOffer.offer_price?'–'+money(activeOffer.offer_price_max):''):'Nenhum desconto ativo identificado.'}</small></div>
        <div><span>Custo do produto</span><b>{costSummary}</b><small>{costValues.length?(hasModels?'Custos cadastrados por variação.':'Custo atual salvo no Gestor.'):'Custo ainda não cadastrado.'}</small></div>
        <div><span>Ads por pedido</span><b>{money(adsPerOrder)}</b><small>{adsPerOrder==null?'Sem atribuição suficiente.':money(adsCost)+' ÷ '+int(adsOrders)+' pedidos Ads'}</small></div>
        <div><span>Preço atual</span><b>{money(currentPrice)}</b><small>{live?'Consultado agora na Shopee.':'Última Super Análise disponível.'}</small></div>
        <div><span>Preço final vigente</span><b>{money(finalPrice)}</b><small>{activeOffer?'Campanha ativa considerada'+(sellerOffer?' · detalhada pelo Motor.':'.'):'Sem campanha ativa identificada.'}</small></div>
        <div><span>Mediana concorrentes</span><b>{money(marketMedian)}</b><small>{marketPrices.length?marketPrices.length+' referência(s) com preço.':'Sem preços comparáveis.'}</small></div>
        <div><span>Concorrente que mais vende</span><b>{money(leaderPrice)}</b><small>{leader?.sold!=null?int(leader.sold)+' vendidos':'Vendas não coletadas'}</small></div>
      </div>

      <details className={styles.calcDetails}>
        <summary>Ver comparação por variação e editar preços</summary>
        {arr(activeOffer?.models).length>0&&<div className={styles.offerVariationStrip}>{arr(activeOffer.models).map((v,i)=><div key={String(v.model_id??i)}><span>{v.name||('Variação '+(i+1))}</span><b>{money(v.original_price)} → {money(v.promotion_price)}</b><small>{v.promotion_stock!=null?'Estoque promocional '+int(v.promotion_stock):''}</small></div>)}</div>}
        <div className={styles.variationCompare}>
          <section><h5>Concorrente que mais vende</h5>{leader?<><a href={leader.url||'#'} target={leader.url?'_blank':undefined} rel={leader.url?'noreferrer':undefined}>{leader.title||'Concorrente líder'} {leader.url?'↗':''}</a>{competitorVariations.length?<div className={styles.variationRows}>{competitorVariations.map((v,i)=><div key={i}><span>{v.name||('Variação '+(i+1))}</span><b>{money(v.price)}</b></div>)}</div>:<p className={styles.calcMissing}>As variações desse concorrente ainda não foram coletadas.</p>}</>:<p className={styles.calcMissing}>Nenhum concorrente vinculado.</p>}</section>
          <section><h5>Minhas variações</h5>{hasModels&&ownVariations.length?<div className={styles.variationRows}>{ownVariations.map(v=>{const comp=matchCompetitorVariation(v,competitorVariations);const key=String(v.modelId??v.name);const price=parseInput(draft[key]??v.price);const calc=shopeeProfit(price,v.cost,adsPerOrder,fees,Boolean(activeOffer));return <div className={styles.ownVariationRow} key={key}><span><b>{v.name}</b><small>Atual {money(v.price)}{comp?' · concorrente '+money(comp.price):''}</small></span><label><small>Novo preço</small><input inputMode="decimal" value={draft[key]??(v.price??'')} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/></label><span className={styles.variationMargin}>{calc?calc.marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}<small>margem</small></span></div>})}</div>:<div className={styles.singlePriceRow}><label><span>Novo preço</span><input inputMode="decimal" value={draft.base??(displayedPrice??'')} onChange={e=>setDraft(d=>({...d,base:e.target.value}))}/></label><div><span>Margem estimada</span><b>{displayedCalc?displayedCalc.marginPct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}</b></div><div><span>Lucro estimado/venda</span><b>{displayedCalc?money(displayedCalc.profit):'—'}</b></div></div>}</section>
        </div>
      </details>

      <div className={styles.calcRecommendation}><div><span>Preço competitivo de referência</span><strong>{money(suggested)}</strong></div><p>{suggested!=null?'Referência baseada no concorrente líder/mediana e validada com custo, taxas configuradas e Ads disponíveis.':'Não há dados suficientes para sugerir preço com segurança. Cadastre o custo ou vincule concorrentes comparáveis.'}</p></div>
      {activeOffer&&<div className={styles.calcOfferWarning}>Existe uma campanha de marketing ativa. Alterar o preço normal não substitui automaticamente o preço promocional da campanha.</div>}
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

function causesForPlan(plan){
  const t=/antes do clique/.test(plan.title)?'ctr':/não coloca no carrinho/.test(plan.title)?'visitCart':/desiste antes do pedido/.test(plan.title)?'cartPlaced':/poucos viram pagamento/.test(plan.title)?'placedPaid':/antes da confirmação/.test(plan.title)?'paidConfirmed':null;
  return t?transitionById(t):null;
}

// Detalhe expandido de UM anúncio (a lista compacta fica em ProductList.js). Visão resumida = diagnóstico + 1 ação;
// Passo a passo = hipóteses, 3 passos, como verificar e base da sugestão. Ambos usam o MESMO cálculo (productPlan/specificPlan).
function ProductFunnelCard({p,med,mode,context,onRecollect,recollecting,recollectDisabled,recollectFeedback,focused,state}){
  const [priceOpen,setPriceOpen]=useState(false);
  const [titleOpen,setTitleOpen]=useState(false);
  const plan=mode==='specific'?specificPlan(p,med,context):productPlan(p,med);
  const bottleneck=productBottleneck(plan);
  const stateId=state?.id||'ready';
  const noData=stateId==='missing'||stateId==='failed';
  const small=stateId==='small';
  // Selo do detalhe: desempenho só quando há dados suficientes; nos demais casos mostra o estado da coleta (nunca um "CRÍTICO" sem dados).
  const status=stateId==='ready'?(plan.priority==='bad'?'CRÍTICO':plan.priority==='warn'?'ATENÇÃO':plan.priority==='good'?'SAUDÁVEL':plan.label):state.label;
  const statusPriority=stateId==='ready'?plan.priority:stateId==='failed'?'bad':stateId==='small'?'data':'missing';
  const productContext=context?.[String(p.id)]||null;
  const competitor=arr(productContext?.competitors)[0]||null;
  const evidence=plan.evidence||'';
  const transition=causesForPlan(plan);
  const specific=mode==='specific';
  const titleActionIndex=plan.actions.findIndex(action=>/t[ií]tulo|palavra.?chave|keyword/i.test(String(action)));
  const priceActionIndex=plan.actions.findIndex((action,index)=>index!==titleActionIndex&&/pre[cç]o|oferta/i.test(String(action)));
  const actions=specific?plan.actions.slice(0,3):plan.actions.slice(0,1);
  const diagTitle=noData?'Dados do funil indisponíveis':small?'Amostra pequena — conclusão limitada':bottleneck.title;
  const diagDetail=noData?'O Motor Sênior ainda não forneceu as métricas deste anúncio para o período selecionado.':small?'Os números disponíveis ainda não permitem identificar com segurança o principal gargalo. Os dados existentes continuam visíveis, mas sem recomendação categórica.':bottleneck.detail;
  return <article className={styles.productFunnelCard} data-priority={plan.priority} data-state={stateId} data-focused={focused?'true':'false'}>
    <header className={styles.productFunnelHeader}>
      <div className={styles.productIdentity}><div><h3>Análise do anúncio</h3><small>{p.name||'Produto'} · ID {p.id||'—'}</small></div></div>
      <div className={styles.productHeaderActions}>
        <span className={styles.productStatus} data-priority={statusPriority}>{status}</span>
        <button type="button" className={styles.productRecollectButton}
          onClick={()=>onRecollect(String(p.id))}
          disabled={recollectDisabled}
          title="O Motor consulta o relatório da Shopee para este período e o Gestor atualiza apenas este anúncio."
          aria-label={'Recoletar dados do anúncio '+(p.name||p.id)}>
          {recollecting?'↻ Coletando…':'↻ Recoletar dados'}
        </button>
      </div>
    </header>
    {recollectFeedback?.message&&<div className={styles.productRecollectFeedback} data-tone={recollectFeedback.tone} role="status" aria-live="polite">{recollectFeedback.message}</div>}

    <div className={styles.productFunnelBody} data-nodata={noData?'true':'false'}>
      {!noData&&<div className={styles.productFunnelLeft}><MiniProductFunnel p={p}/></div>}

      <div className={styles.productFunnelRight}>
        <section className={styles.productDiagnosis} data-tone={noData?'missing':small?'data':bottleneck.tone}>
          <h4>{diagTitle}</h4>
          {!noData&&<strong>{evidence}</strong>}
          <p>{diagDetail}</p>
          {specific&&plan.specificNote&&<small>{plan.specificNote}</small>}
          {noData&&<details className={styles.techFold}><summary>Detalhes da coleta</summary><p>{plan.evidence||'Sem métricas retornadas.'} Preço e concorrentes vêm da Super Análise, outra fonte. Isso não comprova baixo tráfego.</p></details>}
        </section>

        {specific&&transition&&transition.causes.length>0&&!small&&!noData&&<section className={styles.causesBox}>
          <strong>Possíveis causas · hipóteses</strong>
          <ul>{transition.causes.map((c,i)=><li key={i}>{c}</li>)}</ul>
          <small>Hipóteses para investigar; nenhuma foi comprovada.</small>
        </section>}

        <section className={styles.productActionBox}>
          <strong>{specific?'Faça assim':'Principal ação'}</strong>
          <ol>{actions.map((action,index)=><li key={index}><span>{index+1}</span><p>{action}</p>
            {index===titleActionIndex&&<button type="button" className={styles.inlineActionButton} onClick={()=>{setTitleOpen(v=>!v);setPriceOpen(false)}}>{titleOpen?'Fechar editor':'✎ Editar título'}</button>}
            {index===priceActionIndex&&<button type="button" className={styles.inlineActionButton} onClick={()=>{setPriceOpen(v=>!v);setTitleOpen(false)}}>{priceOpen?'Fechar calculadora':'▦ Abrir calculadora'}</button>}
          </li>)}</ol>
          {specific&&transition&&!small&&!noData&&<p className={styles.verifyLine}><b>Como verificar:</b> acompanhe {transition.kpiLabel} deste anúncio no mesmo período depois de mudar uma coisa por vez.</p>}
          {!specific&&plan.actions.length>1&&<small className={styles.verifyLine}>Mais {plan.actions.length-1} passo(s) no modo “Passo a passo”.</small>}
        </section>

        <details className={styles.competitorFold}>
          <summary>Comparar concorrente<small>Fonte: Super Análise{productContext?.analyzedAt?' · coletado em '+new Date(productContext.analyzedAt).toLocaleDateString('pt-BR'):''}</small></summary>
          <div className={styles.productCompetitorBox}>
            <strong>Concorrente de referência</strong>
            {competitor?<a href={competitor.url||'#'} target={competitor.url?'_blank':undefined} rel={competitor.url?'noreferrer':undefined} data-disabled={!competitor.url?'true':'false'}>
              {competitor.image?<img src={competitor.image} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>:<span className={styles.productCompetitorPlaceholder}>◎</span>}
              <div><b>{competitor.title||'Concorrente vinculado'}</b><small>{competitor.price!=null?money(competitor.price):'Preço não coletado'}{competitor.sold!=null?' · '+int(competitor.sold)+' vendidos (período não informado)':''}</small></div>
            </a>:<div className={styles.productCompetitorEmpty}>Ainda não há concorrente vinculado para este produto.</div>}
          </div>
        </details>

        <div className={styles.productFunnelFooter}>
          {!noData&&<Link href={plan.href}>{plan.action} →</Link>}
          {noData&&<Link href="/?section=config">Ver Saúde do Sistema →</Link>}
          {productContext&&<Link className={styles.productSecondaryLink} href={`/super-analise?item_id=${encodeURIComponent(p.id)}${productContext.reportId?`&report_id=${encodeURIComponent(productContext.reportId)}`:''}`}>Abrir Super Análise deste anúncio</Link>}
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
    <td><div className={styles.product}><img src={p.image||IMAGE_PLACEHOLDER} alt=""/><div><b>{p.name||'Produto'}</b><small>ID {p.id||'—'}</small></div></div></td>
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
  const [tab,setTab]=useState('loja');
  const [requestedItem,setRequestedItem]=useState('');
  const [guidanceMode,setGuidanceMode]=useState('standard');
  const [stageFocus,setStageFocus]=useState('');
  const [expandedId,setExpandedId]=useState('');
  const [lastUpdated,setLastUpdated]=useState(null);
  const [period,setPeriod]=useState('past30days');
  const [context,setContext]=useState({});
  const [state,setState]=useState({loading:true,error:'',seller:null,ads:null});
  const latestRequest=useRef(0);
  const [diagnosticUpload,setDiagnosticUpload]=useState({saving:false,message:'',error:false});
  const [recollection,setRecollection]=useState({busyId:'',feedback:{}});
  const recollectInFlight=useRef(null);
  const recollectSequence=useRef(0);
  const load=async(selectedPeriod=period)=>{
    const requestId=++latestRequest.current;
    ++recollectSequence.current;
    recollectInFlight.current=null;
    setRecollection({busyId:'',feedback:{}});
    setDiagnosticUpload({saving:false,message:'',error:false});
    setState(s=>({...s,loading:true,error:''}));
    const meta=periodMeta(selectedPeriod);
    const [sellerR,adsR]=await Promise.allSettled([
      (async()=>{
         const first=await motorData('sellerFunnel',{period:selectedPeriod},60000);
         const errorList=arr(first?.errors);
         const allNotReady=errorList.length>0&&errorList.every(x=>/data isn.t ready|not ready|not_ready|not.ready/i.test(String(x?.error||x?.message||'')));
         if(!allNotReady&&!needsFunnelRetry(first))return first;
         // Uma única retentativa do mesmo período. Não substituir 30 dias por Hoje.
         await new Promise(resolve=>setTimeout(resolve,1800));
         try{
           const again=await motorData('sellerFunnel',{period:selectedPeriod},60000);
           return chooseBestFunnelResponse(first,again);
         }catch{return first}
       })(),
      getJson('/api/shopee/ads?days='+meta.days)
    ]);
    if(requestId!==latestRequest.current)return;
    const seller=sellerR.status==='fulfilled'?sellerR.value:null;
    const ads=adsR.status==='fulfilled'?(adsR.value?.v7||adsR.value?.v5||adsR.value):null;
    const errors=[];
    if(sellerR.status==='rejected')errors.push('Funil completo: '+String(sellerR.reason?.message||sellerR.reason));
    if(adsR.status==='rejected')errors.push('Shopee Ads: '+String(adsR.reason?.message||adsR.reason));
    if(seller&&deriveStoreFunnel(seller).coverage.stageCount===0){
       const notReady=arr(seller?.errors).some(x=>/data isn.t ready|not ready|not_ready/i.test(String(x?.error||x?.message||'')));
       errors.push(notReady
         ?'O Motor informou que o relatório deste período ainda não estava pronto. Confira o período em Informações Gerenciais no Seller Center e tente atualizar.'
         :'A resposta do Motor não trouxe etapas mensuráveis do funil para este período. Verifique a conexão e a cobertura em Configurações → Saúde do Sistema.');
     }
    if(seller&&seller?.period?.type&&seller.period.type!==selectedPeriod)errors.push('O Motor Sênior respondeu '+periodMeta(seller.period.type).label+' em vez de '+periodMeta(selectedPeriod).label+'. Atualize a extensão para v0.17.4+ para usar o histórico mapeado.');
    try{
      // A Super Análise é a fonte de elegibilidade do Funil. O Motor apenas
      // complementa os produtos com métricas do Seller Center.
      const extra=await getJson('/api/funnel/context');
      if(requestId!==latestRequest.current)return;
      setContext(extra?.items||{});
    }catch(error){
      errors.push('Contexto da Super Análise: '+String(error?.message||error));
      if(requestId!==latestRequest.current)return;
      setContext({});
    }
    if(requestId!==latestRequest.current)return;
    setState({loading:false,error:errors.join(' · '),seller,ads});
    // Só conta como atualização válida quando o Motor entregou pelo menos uma etapa do funil.
    if(seller&&deriveStoreFunnel(seller).coverage.stageCount>0)setLastUpdated({at:Date.now(),period:selectedPeriod});
  };
  useEffect(()=>{
    try{
      const saved=localStorage.getItem('gs_funnel_guidance_mode');
      if(saved==='standard'||saved==='specific')setGuidanceMode(saved);
      const params=new URLSearchParams(window.location.search);
      if(params.get('tab')==='produto')setTab('produto');
      setRequestedItem(String(params.get('item_id')||''));
      setExpandedId(String(params.get('item_id')||''));
    }catch{}
    load('past30days');
  },[]);
  // Ao abrir um anúncio vindo do diagnóstico, leva a tela até o card correspondente.
  useEffect(()=>{
    if(tab!=='produto'||state.loading)return;
    const timer=setTimeout(()=>{
      try{document.getElementById(requestedItem?'produto-'+requestedItem:'funil-produtos')?.scrollIntoView({behavior:'smooth',block:'start'})}catch{}
    },60);
    return()=>clearTimeout(timer);
  },[tab,requestedItem,state.loading]);
  const changePeriod=next=>{
    if(next===period)return;
    setPeriod(next);
    load(next);
  };
  const selectTab=next=>{
    if(next==='produto'){setRequestedItem('');setExpandedId('');setStageFocus('')}
    setTab(next);
  };
  // Abre a aba Por Produto mantendo o contexto: anúncio escolhido, etapa analisada e, se pedido, o modo específico.
  const openProduct=(itemId,opts={})=>{
    setRequestedItem(String(itemId||''));
    setExpandedId(String(itemId||''));
    setStageFocus(opts.stage||'');
    if(opts.mode==='specific')chooseGuidance('specific');
    setTab('produto');
  };
  const chooseGuidance=mode=>{
    setGuidanceMode(mode);
    try{localStorage.setItem('gs_funnel_guidance_mode',mode)}catch{}
  };
  const recollectProduct=async itemId=>{
    const id=String(itemId||'').trim();
    if(!id||!state.seller||recollectInFlight.current)return;
    // Não substituir o relatório de outros itens nem bloquear a página inteira.
    const request={id,period,epoch:latestRequest.current,sequence:++recollectSequence.current};
    recollectInFlight.current=request;
    setRecollection(old=>({busyId:id,feedback:{...old.feedback,[id]:null}}));
    const feedback=(message,tone='warning')=>setRecollection(old=>({
      busyId:'',
      feedback:{...old.feedback,[id]:{message,tone}}
    }));
    try{
      const fresh=await motorData('sellerFunnel',{period:request.period},60000);
      if(recollectInFlight.current!==request||request.epoch!==latestRequest.current)return;
      const result=mergeRecollectedFunnelProduct(state.seller,fresh,id,request.period);
      if(result.status==='updated'){
        setState(current=>({...current,seller:result.seller}));
        const pending=result.complete?'Todas as 7 etapas disponíveis.':result.metrics+' de 7 etapas recebidas; as demais continuam indisponíveis.';
        feedback('Métricas atualizadas ('+periodMeta(request.period).label+'). '+pending,'success');
      }else{
        const messages={
          not_returned:'A coleta terminou, mas a Shopee não disponibilizou as métricas deste anúncio no período '+periodMeta(request.period).label+'. Nenhum dado foi inventado.',
          no_metrics:'O Motor encontrou este anúncio, mas não retornou métricas do Funil. Os dados anteriores foram preservados.',
          less_complete:'O Motor retornou menos métricas do que antes; mantive os dados anteriores para não perder informação.',
          period_unconfirmed:'O Motor não informou o período dos dados. A atualização foi descartada para não misturar Hoje, 7 e 30 dias.',
          period_mismatch:'O Motor retornou outro período. A atualização foi descartada para não misturar os dados.',
          no_response:'O Motor não retornou dados utilizáveis para este anúncio.'
        };
        feedback(messages[result.status]||'Não foi possível atualizar este anúncio.');
      }
    }catch(error){
      if(recollectInFlight.current!==request||request.epoch!==latestRequest.current)return;
      feedback('Falha na recoleta: não foi possível concluir a coleta ('+String(error?.message||error)+'). Tente novamente.');
    }finally{
      if(recollectInFlight.current===request){
        recollectInFlight.current=null;
        setRecollection(old=>({...old,busyId:''}));
      }
    }
  };

  const model=useMemo(()=>{
    const s=state.seller||{},k=s.keyMetrics||{},rt=s.realtime?.key_metrics||{};
    const products=arr(s.products).map(p=>({
      ...p,
      id:String(p?.id??p?.item_id??p?.itemId??'').trim(),
      name:p?.name||p?.title||p?.product_name||null,
      image:p?.image||p?.image_url||null
    })).filter(p=>p.id);
    const {totals,rates,coverage,sources,evidence}=deriveStoreFunnel(s);
    const med={
      ctr:median(products.map(p=>num(p.ctr))),
      clickVisit:median(products.map(p=>{const a=num(p.product_card_clicks),b=num(p.uv);return a>0&&b!=null?b/a:null})),
      cart:median(products.map(p=>num(p.uv_to_add_to_cart_rate))),
      paid:median(products.map(p=>num(p.uv_to_paid_buyers_rate))),
      cartPlaced:median(products.map(p=>{const a=num(p.add_to_cart_buyers),b=num(p.placed_buyers);return a>0&&b!=null?b/a:null})),
      placedPaid:median(products.map(p=>{const a=num(p.placed_buyers),b=num(p.paid_buyers);return a>0&&b!=null?b/a:null})),
      paidConfirmed:median(products.map(p=>{const a=num(p.paid_buyers),b=num(p.confirmed_buyers);return a>0&&b!=null?b/a:null}))
    };
    const traffic=s.traffic||null;
    const campaigns=arr(state.ads?.campaigns).map(normalizeAdsCampaign);
    const comparison={
      visitors:num(k?.shop_uv?.chain_ratio),
      paidOrders:num(k?.paid_orders?.chain_ratio),
      paidGmv:num(k?.paid_gmv?.chain_ratio),
      confirmedOrders:num(k?.confirmed_orders?.chain_ratio)
    };
    return{totals,rates,coverage,sources,evidence,products,med,traffic,campaigns,comparison,trends:s.productMetricTrends||{},orderPerformance:s.orderPerformance||{},key:k,realtime:rt,period:s.period||null,errors:arr(s.errors)};
  },[state]);
  const funnelProductDiagnosis=useMemo(()=>diagnoseFunnelProducts(state.seller,context),[state.seller,context]);
  const saveCollectionDiagnostic=async()=>{
    if(diagnosticUpload.saving||!state.seller)return;
    setDiagnosticUpload({saving:true,message:'',error:false});
    // Somente IDs e flags de presença; sem payload bruto, preço ou credenciais.
    const evidence={
      periodRequested:period,
      ...funnelProductDiagnosis,
      sourceStages:model.coverage?.presentStages||[],
      diagnosticType:'product-funnel-coverage-v1'
    };
    try{
      const result=await getJsonWithPost('/api/system-health/report',{
        checkedAt:new Date().toISOString(),deep:true,summary:'warning',
        modules:[{id:'funnel-product',label:'Funil por Produto',status:'warning',detail:'Cobertura de IDs e campos (sem valores ou credenciais).'}],
        funnelCoverage:model.coverage,
        funnelEvidence:evidence
      });
      setDiagnosticUpload({saving:false,message:'Diagnóstico salvo. Protocolo: '+(result?.report?.id||'registrado')+'.',error:false});
    }catch(error){
      setDiagnosticUpload({saving:false,message:'Falha ao salvar diagnóstico: '+String(error?.message||error),error:true});
    }
  };

  const productsById=new Map(model.products.map(p=>[String(p.id),p]));
  const analyzedProducts=Object.values(context||{}).map(ctx=>{
    const id=String(ctx?.itemId||'').trim();
    if(!id||!ctx?.analyzedAt)return null;
    const age=(Date.now()-new Date(ctx.analyzedAt).getTime())/86400000;
    if(!Number.isFinite(age)||age>30)return null;
    const live=productsById.get(id);
    if(live)return live;
    // Mantém o anúncio analisado visível mesmo quando a coleta do Motor falhar.
    return{
      id,
      name:ctx?.title||('Produto '+id),
      image:ctx?.image||null,
      funnelMetricsUnavailable:true
    };
  }).filter(Boolean);
  // Com uma etapa em foco (vinda do diagnóstico), os anúncios com maior oportunidade nela vêm primeiro.
  // É só ordenação: nenhum anúncio some da lista.
  const focusOpportunity=new Map(stageFocus?rankProductsForStage(model.products,stageFocus,9999).ranked.map(x=>[String(x.p.id),x.opportunity]):[]);
  const orderedAnalyzed=[...analyzedProducts].sort((a,b)=>{
    if(requestedItem&&String(a.id)===requestedItem)return -1;
    if(requestedItem&&String(b.id)===requestedItem)return 1;
    if(stageFocus){const d=(focusOpportunity.get(String(b.id))||0)-(focusOpportunity.get(String(a.id))||0);if(d)return d}
    return productPlan(a,model.med).rank-productPlan(b,model.med).rank;
  });
  const focusTransition=stageFocus?transitionById(stageFocus):null;
  const productRows=orderedAnalyzed.map(p=>{
    const plan=productPlan(p,model.med);
    const failed=/^Falha/.test(String(recollection.feedback[String(p.id)]?.message||''));
    const state=classifyProduct(plan,{updating:recollection.busyId===String(p.id),failed});
    return{p,plan,state,ctx:context?.[String(p.id)]||null};
  });
  const unavailableForFunnel=Math.max(0,model.products.filter(p=>!context?.[String(p.id)]?.analyzedAt).length);
  const analyzedWithoutMetrics=analyzedProducts.filter(p=>p.funnelMetricsUnavailable||productPlan(p,model.med).priority==='missing').length;

  const full=!!state.seller;
  const reported=state.seller?.period?.type;
  const actualPeriod=state.loading?period:(reported||period);
  const actualPeriodMeta=periodMeta(actualPeriod);
  const periodMismatch=!state.loading&&reported&&reported!==period;
  const stamp=lastUpdated&&lastUpdated.period===period?new Date(lastUpdated.at):null;
  const hhmm=d=>d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  // Estado da coleta: nunca declara "atualizado" antes da resposta e deixa dados parciais explícitos.
  const status=state.loading?{tone:'loading',text:`Coletando o funil de ${periodMeta(period).label.toLowerCase()} no Seller Center… isso pode levar até 1 minuto.`}
    :!full?{tone:'error',text:'Não foi possível coletar o funil completo neste período.'}
    :model.coverage.stageCount===0?{tone:'error',text:'O Motor respondeu, mas sem nenhuma etapa do funil neste período.'}
    :model.coverage.stageCount<7?{tone:'partial',text:`Dados parciais: ${model.coverage.stageCount} de 7 etapas coletadas (faltam ${model.coverage.missingStages.join(', ')}).${stamp?` Atualizado às ${hhmm(stamp)}.`:''}`}
    :{tone:'ok',text:`Atualizado${stamp?` às ${hhmm(stamp)}`:''} · ${periodMeta(period).label} · 7 de 7 etapas coletadas.`};
  const TABS=[['loja','Funil da Loja','store'],['produto','Por Produto','package'],['trafego','Fontes de Tráfego','traffic'],['ads','Histórico Ads','ads']];
  const topProduct=orderedAnalyzed[0]||null;

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>GESTOR SÊNIOR · CONVERSÃO</span><h1>Análise de Funil</h1><p>Descubra onde sua loja perde clientes e o que melhorar primeiro.</p></div>
      <div className={styles.headerActions}>
        <div className={styles.periodPicker} role="group" aria-label="Período do funil">{PERIODS.map(x=><button type="button" key={x.id} data-active={period===x.id} aria-pressed={period===x.id} onClick={()=>changePeriod(x.id)} disabled={state.loading}>{x.label}</button>)}</div>
        <span className={styles.periodBadge} data-warn={periodMismatch?'true':'false'} title="Período efetivamente usado nos dados exibidos (informado pelo Motor)"><Icon name="clock" size={14}/>{state.loading?'Coletando…':<>Dados de: {actualPeriodMeta.label}{actualPeriod==='real_time'?' · tempo real':''}</>}</span>
        <button type="button" onClick={()=>load(period)} disabled={state.loading} aria-busy={state.loading}><Icon name="refresh" size={15}/>{state.loading?'Atualizando…':'Atualizar agora'}</button>
      </div>
    </header>

    <div className={styles.statusLine} data-tone={status.tone} role="status" aria-live="polite">
      <Icon name={status.tone==='ok'?'check':status.tone==='loading'?'refresh':'alert'} size={16}/>
      <span>{status.text}</span>
      {status.tone==='error'&&!state.loading&&<button type="button" onClick={()=>load(period)}>Tentar novamente</button>}
    </div>
    {periodMismatch&&<div className={styles.warning}>O Motor Sênior respondeu {periodMeta(reported).label} em vez de {periodMeta(period).label}. Atualize a extensão para v0.17.4+ para usar o histórico mapeado.</div>}
    {!state.loading&&state.error&&<div className={styles.warning}>{state.error}</div>}
    {!state.loading&&!full&&<div className={styles.warning}><b>Funil completo indisponível.</b> Atualize o Motor Sênior para a versão 0.17.4 ou superior e mantenha uma sessão ativa no Seller Center. Enquanto isso, a aba “Histórico Ads” continua usando os dados já disponíveis.</div>}

    <nav className={styles.tabs} aria-label="Seções da análise de funil">
      {TABS.map(([id,label,icon])=><button type="button" key={id} data-active={tab===id} aria-current={tab===id?'page':undefined} onClick={()=>selectTab(id)}><Icon name={icon} size={16}/>{label}</button>)}
    </nav>

    {state.loading&&<div className={styles.loadingPanel} aria-busy="true">
      <span className={styles.spinner} aria-hidden="true"/>
      <div><b>Lendo Informações Gerenciais da Shopee e montando o funil de {periodMeta(period).label.toLowerCase()}…</b><p>Os números do período anterior foram ocultados para não serem confundidos com este período.</p></div>
    </div>}

    {!state.loading&&tab==='loja'&&<StoreOverview
      model={model} context={context} guidanceMode={guidanceMode} onChooseGuidance={chooseGuidance}
      onOpenProduct={openProduct} resolvePlan={p=>specificPlan(p,model.med,context)}
      periodMeta={actualPeriodMeta} periodId={actualPeriod} lastUpdated={stamp?stamp.getTime():null}
      topProductCard={topProduct?<ProductActionCard p={topProduct} med={model.med} mode={guidanceMode} context={context}/>:null}/>}

    {!state.loading&&tab==='produto'&&<section className={styles.panel} id="funil-produtos">
      <div className={styles.sectionHead}><div><h2>Funil por Produto</h2><p>Escolha um anúncio para ver o funil, o diagnóstico e o plano de ação. Anúncios com Super Análise recente aparecem mesmo sem métricas do funil.</p></div><span>{analyzedProducts.length} disponíveis</span></div>
      {focusTransition&&<div className={styles.stageFocusBanner} role="status"><Icon name="target" size={16}/><span>Anúncios ordenados pela maior oportunidade em <b>{stageByKey(focusTransition.from)?.label} → {stageByKey(focusTransition.to)?.label}</b> (distância para a mediana dos seus anúncios × volume). Nenhum anúncio foi ocultado.</span><button type="button" onClick={()=>setStageFocus('')}>Limpar ordenação</button></div>}
      <div className={styles.funnelEligibilityNotice}><b>Super Análise obrigatória</b><span>{analyzedWithoutMetrics>0?`${analyzedWithoutMetrics} produto(s) analisado(s) estão sem métricas completas do Funil.`:unavailableForFunnel>0?`${unavailableForFunnel} produto(s) da coleta ainda precisam de Super Análise.`:'Todos os produtos analisados estão com métricas disponíveis.'} Preço e concorrentes vêm da Super Análise; as métricas do funil vêm do Motor Sênior.</span><Link href="/super-analise">Gerenciar na Super Análise →</Link></div>
      {analyzedWithoutMetrics>0&&<aside className={styles.collectionNotice} role="status">
        <div><strong>Métricas não coletadas ou incompletas em {analyzedWithoutMetrics} de {analyzedProducts.length} anúncios</strong>
          <p>O Motor não entregou todos os números do funil de {actualPeriodMeta.label}. Isso não comprova baixo tráfego.</p>
        </div>
        <div className={styles.collectionActions}>
          <button type="button" title={`Refaz a coleta do funil da loja em ${actualPeriodMeta.label} e atualiza os ${analyzedWithoutMetrics} anúncio(s) sem métricas, preservando dados válidos.`} onClick={()=>load(period)}>↻ Tentar novamente</button>
          {period!=='real_time'&&<button type="button" onClick={()=>changePeriod('real_time')}>Testar Hoje</button>}
          <Link href="/?section=config">Saúde do Sistema →</Link>
        </div>
        <details className={styles.collectionDetails}>
          <summary>Entender quais anúncios o Motor devolveu</summary>
          <p>Período solicitado: {periodMeta(period).label}. Período informado pelo Motor: {funnelProductDiagnosis.periodReported?periodMeta(funnelProductDiagnosis.periodReported).label:'não informado'}. Produtos na resposta: {funnelProductDiagnosis.returnedProductCount}; encontrados entre os analisados: {funnelProductDiagnosis.matchedCount} de {funnelProductDiagnosis.analyzedProductCount}.</p>
          <div className={styles.collectionRows}>{funnelProductDiagnosis.products.map(item=><div key={item.id}>
            <strong>ID {item.id}</strong>
            <span>{item.status==='not_returned'?'Não veio na lista do Motor':item.status==='no_metrics'?'Encontrado sem métricas':item.status==='partial'?'Encontrado com dados parciais':'Métricas coletadas'}</span>
            <small>{PRODUCT_FUNNEL_FIELDS.filter(([key])=>item.fields[key]).map(([,label])=>label).join(', ')||'Nenhuma etapa retornada'}</small>
          </div>)}</div>
          <div className={styles.collectionActions}>
            <button type="button" disabled={diagnosticUpload.saving} onClick={saveCollectionDiagnostic}>{diagnosticUpload.saving?'Salvando…':'Salvar diagnóstico da coleta'}</button>
          </div>
          <small>Salva somente IDs dos anúncios e indicadores de presença das métricas no relatório técnico da loja. Não envia valores comerciais, cookies ou credenciais.</small>
          {diagnosticUpload.message&&<p role="status" data-error={diagnosticUpload.error?'true':'false'}>{diagnosticUpload.message}</p>}
        </details>
      </aside>}
      <GuidanceSwitch mode={guidanceMode} onChange={chooseGuidance}/>
      <p className={styles.planHint}><b>Plano de destrave</b> · As sugestões são testes orientados por evidências; nenhuma alteração é aplicada automaticamente.</p>
      {!productRows.length?<div className={styles.empty}>Nenhum produto disponível. Faça a Super Análise dos anúncios que deseja acompanhar no Funil.</div>:<>
        <ProductList rows={productRows} expandedId={expandedId} recollection={recollection} onRecollect={recollectProduct}
          onToggle={id=>setExpandedId(cur=>cur===id?'':id)}
          renderDetail={row=><ProductFunnelCard key={'funnel-'+row.p.id} p={row.p} med={model.med} mode={guidanceMode} context={context} state={row.state}
              focused={!!requestedItem&&String(row.p.id)===requestedItem}
              onRecollect={recollectProduct} recollecting={recollection.busyId===String(row.p.id)}
              recollectDisabled={!!recollection.busyId} recollectFeedback={recollection.feedback[String(row.p.id)]}/>}/>
        <details className={styles.rawDetails}><summary>Ver tabela completa dos produtos liberados</summary><div className={styles.tableWrap}><table><thead><tr><th>Produto</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Visitantes</th><th>Carrinho</th><th>Pedido</th><th>Pago</th><th>Confirmado</th><th>Status</th></tr></thead><tbody>{orderedAnalyzed.map(p=><ProductRow key={p.id} p={p} med={model.med}/>)}</tbody></table></div></details>
      </>}
    </section>}

    {!state.loading&&tab==='trafego'&&<TrafficSources traffic={model.traffic} errors={model.errors} periodMeta={actualPeriodMeta} periodId={actualPeriod}
      lastUpdated={stamp?stamp.getTime():null} onGoTab={selectTab} onRefresh={()=>load(period)} onChangePeriod={changePeriod}/>}

    {!state.loading&&tab==='ads'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>Histórico Shopee Ads · 7 dias</h2><p>Camada complementar para enxergar campanhas fora do recorte em tempo real.</p></div></div>
      <p className={styles.tabNote}><Icon name="info" size={15}/>São métricas de publicidade paga (campanhas). Elas não representam o funil geral da loja, que inclui também o tráfego orgânico.</p>
      {!model.campaigns.length?<div className={styles.empty}>Sem campanhas disponíveis.</div>:<div className={styles.adsList}>{model.campaigns.slice(0,12).map((c,i)=><div key={i}><b>{c.name}</b><span>{int(c.impressions)} impressões · {int(c.clicks)} cliques · {int(c.orders)} pedidos</span><small>CTR {pct(c.ctr)} · clique→pedido {pct(c.cvr)}</small></div>)}</div>}
    </section>}

    {!state.loading&&tab!=='loja'&&tab!=='trafego'&&<section className={styles.sourceNote}><strong>Fonte e confiabilidade</strong><p>Os indicadores vêm de Informações Gerenciais da Shopee, coletados pelo Motor Sênior com a sessão do Seller Center. Etapas sem números disponíveis permanecem como “—”, sem estimativas artificiais. O fluxo utiliza Carrinho → Pedido → Pago → Confirmado.</p>{model.errors.length>0&&<details><summary>Detalhes técnicos da coleta ({model.errors.length})</summary><small>{model.errors.map(x=>x.source+': '+x.error).join(' · ').slice(0,2500)}</small></details>}</section>}
  </div>
}
