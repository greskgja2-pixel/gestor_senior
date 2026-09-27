'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {motorData} from '../lib/client-async';
import styles from './funil.module.css';

const num=v=>Number.isFinite(Number(v))?Number(v):null;
const int=v=>num(v)==null?'—':Math.round(Number(v)).toLocaleString('pt-BR');
const pct=v=>num(v)==null?'—':(Number(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const money=v=>num(v)==null?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const val=x=>num(x?.value??x);
const arr=v=>Array.isArray(v)?v:[];
const median=values=>{const a=values.filter(v=>Number.isFinite(v)).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const cleanText=v=>String(v||'').replace(/\s+/g,' ').trim();
const pickSuggestion=(list,re)=>arr(list).map(cleanText).find(x=>re.test(x))||null;

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
      const safeExact=margin!=null&&margin>=20&&marketMedian>=ownPrice*.9;
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
  const [tab,setTab]=useState('loja');
  const [guidanceMode,setGuidanceMode]=useState('standard');
  const [context,setContext]=useState({});
  const [state,setState]=useState({loading:true,error:'',seller:null,ads:null});
  const load=async()=>{
    setState(s=>({...s,loading:true,error:''}));
    const [sellerR,adsR]=await Promise.allSettled([
      motorData('sellerFunnel',{},45000),
      getJson('/api/shopee/ads?days=7')
    ]);
    const seller=sellerR.status==='fulfilled'?sellerR.value:null;
    const ads=adsR.status==='fulfilled'?(adsR.value?.v7||adsR.value?.v5||adsR.value):null;
    const errors=[];
    if(sellerR.status==='rejected')errors.push('Funil completo: '+String(sellerR.reason?.message||sellerR.reason));
    if(adsR.status==='rejected')errors.push('Shopee Ads: '+String(adsR.reason?.message||adsR.reason));
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
    load();
  },[]);
  const chooseGuidance=mode=>{
    setGuidanceMode(mode);
    try{localStorage.setItem('gs_funnel_guidance_mode',mode)}catch{}
  };

  const model=useMemo(()=>{
    const s=state.seller||{},k=s.keyMetrics||{},rt=s.realtime?.key_metrics||{};
    const products=arr(s.products);
    const totals={
      impressions:products.length?products.reduce((a,p)=>a+(num(p.product_card_impressions)||0),0):null,
      clicks:products.length?products.reduce((a,p)=>a+(num(p.product_card_clicks)||0),0):null,
      visitors:products.length?products.reduce((a,p)=>a+(num(p.uv)||0),0):val(k.shop_uv)??num(rt.uv),
      carts:products.length?products.reduce((a,p)=>a+(num(p.add_to_cart_buyers)||0),0):null,
      placed:val(k.place_orders)??num(rt.orders),
      paid:val(k.paid_orders),
      confirmed:val(k.confirmed_orders),
      paidGmv:val(k.paid_gmv)??num(rt.sales)
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
    return{totals,rates,products,med,sources,campaigns,key:k,realtime:rt,errors:arr(s.errors)};
  },[state]);

  if(state.loading)return <div className={styles.page}><div className={styles.loading}>Lendo Informações Gerenciais da Shopee e montando o funil…</div></div>;

  const full=!!state.seller;
  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>GESTOR SÊNIOR · CONVERSÃO</span><h1>Análise de Funil</h1><p>Da impressão até o pedido confirmado, com dados do Seller Center e diagnóstico por produto.</p></div>
      <button type="button" onClick={load}>↻ Atualizar agora</button>
    </header>

    {state.error&&<div className={styles.warning}>{state.error}</div>}
    {!full&&<div className={styles.warning}><b>Funil completo indisponível.</b> Atualize o Motor Sênior para a versão 0.17.1 ou superior e mantenha uma sessão ativa no Seller Center. Enquanto isso, a aba “Histórico Ads” continua usando os dados já disponíveis.</div>}

    <nav className={styles.tabs}>
      <button data-active={tab==='loja'} onClick={()=>setTab('loja')}>Funil da Loja</button>
      <button data-active={tab==='produto'} onClick={()=>setTab('produto')}>Por Produto</button>
      <button data-active={tab==='trafego'} onClick={()=>setTab('trafego')}>Fontes de Tráfego</button>
      <button data-active={tab==='ads'} onClick={()=>setTab('ads')}>Histórico Ads</button>
    </nav>

    {tab==='loja'&&<>
      <section className={styles.hero}>
        <div><span>TEMPO REAL · HOJE</span><h2>{full?'Jornada completa do comprador':'Aguardando dados completos do Seller Center'}</h2><p>Impressões → Cliques → Visitantes → Carrinho → Pedido criado → Pago → Confirmado.</p></div>
        <div className={styles.heroMetric}><strong>{money(model.totals.paidGmv)}</strong><span>vendas pagas no período</span></div>
      </section>
      <section className={styles.funnelCard}>
        <div className={styles.funnel}>
          <Step label="Impressões" value={model.totals.impressions} sub="Cards exibidos" tone="violet"/>
          <i>→</i><Step label="Cliques" value={model.totals.clicks} sub="Entradas no produto" rate={model.rates.ctr} tone="blue"/>
          <i>→</i><Step label="Visitantes" value={model.totals.visitors} sub="UV da loja/produtos" rate={model.rates.clickVisit} tone="cyan"/>
          <i>→</i><Step label="Carrinho" value={model.totals.carts} sub="Compradores que adicionaram" rate={model.rates.visitCart} tone="amber"/>
          <i>→</i><Step label="Pedido criado" value={model.totals.placed} sub="Placed orders" rate={model.rates.cartPlaced} tone="orange"/>
          <i>→</i><Step label="Pago" value={model.totals.paid} sub="Paid orders" rate={model.rates.placedPaid} tone="green"/>
          <i>→</i><Step label="Confirmado" value={model.totals.confirmed} sub="Confirmed orders" rate={model.rates.paidConfirmed} tone="teal"/>
        </div>
      </section>
      <section className={styles.rateGrid}>
        <div><span>CTR</span><strong>{pct(model.rates.ctr)}</strong><small>impressão → clique</small></div>
        <div><span>Visita → carrinho</span><strong>{pct(model.rates.visitCart)}</strong><small>intenção de compra</small></div>
        <div><span>Pedido → pago</span><strong>{pct(model.rates.placedPaid)}</strong><small>fechamento do pagamento</small></div>
        <div><span>Pago → confirmado</span><strong>{pct(model.rates.paidConfirmed)}</strong><small>qualidade final da conversão</small></div>
      </section>
      <section className={styles.education}>
        <div><b>1</b><h3>Impressão → clique</h3><p>Queda forte aqui aponta para capa, título, preço percebido ou competitividade na busca.</p></div>
        <div><b>2</b><h3>Visita → carrinho</h3><p>Se a pessoa entra e não adiciona, revise oferta, prova social, imagens, variações, frete e descrição.</p></div>
        <div><b>3</b><h3>Carrinho → pedido/pago</h3><p>O desejo existe, mas algo trava o fechamento: preço final, cupom, frete, prazo ou confiança.</p></div>
      </section>
    </>}

    {tab==='produto'&&<section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>Funil por Produto</h2><p>Escolha se quer entender o problema ou receber uma receita mais direta do que testar.</p></div><span>{model.products.length} produtos</span></div>
      <div className={styles.guidanceMode}>
        <div><strong>Como você quer receber as sugestões?</strong><small>Sua escolha fica salva neste navegador.</small></div>
        <div role="group" aria-label="Modo de orientação">
          <button type="button" data-active={guidanceMode==='standard'} onClick={()=>chooseGuidance('standard')}><b>Padrão</b><span>Mostre o problema e o que revisar</span></button>
          <button type="button" data-active={guidanceMode==='specific'} onClick={()=>chooseGuidance('specific')}><b>Específico · me diga o que fazer</b><span>Cruze concorrentes, preço, margem e Super Análise</span></button>
        </div>
      </div>
      {guidanceMode==='specific'&&<div className={styles.modeNotice}><b>Modo específico ligado.</b> Quando houver evidência suficiente, o Gestor dá um teste concreto e mostra os concorrentes/dados usados. Se faltar custo, margem ou concorrentes, ele avisa em vez de inventar.</div>}
      {!model.products.length?<div className={styles.empty}>Sem dados de produto no momento.</div>:<>
        <div className={styles.actionIntro}><b>Plano de destrave</b><span>{guidanceMode==='specific'?'Siga os passos como teste controlado; nenhuma alteração é aplicada sozinha.':'Prioridade: primeiro os produtos com gargalo mais forte. Produtos com pouco volume ficam separados para evitar conclusões precipitadas.'}</span></div>
        <div className={styles.actionList}>
          {[...model.products].sort((a,b)=>productPlan(a,model.med).rank-productPlan(b,model.med).rank).map(p=><ProductActionCard key={'plan-'+p.id} p={p} med={model.med} mode={guidanceMode} context={context}/>)}
        </div>
        <details className={styles.rawDetails}><summary>Ver tabela completa de números</summary><div className={styles.tableWrap}><table><thead><tr><th>Produto</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Visitantes</th><th>Carrinho</th><th>Pedido</th><th>Pago</th><th>Confirmado</th><th>Status</th></tr></thead><tbody>{model.products.map(p=><ProductRow key={p.id} p={p} med={model.med}/>)}</tbody></table></div></details>
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
