// Diagnóstico do Funil da Loja — lógica pura (sem React), coberta por tests/funnel-store-diagnosis.test.mjs.
//
// Princípios (ver CLAUDE.md, "Regra de honestidade de dados"):
// 1. Nada é inventado: ausência é null, nunca zero.
// 2. A escolha do gargalo NÃO usa só a menor porcentagem (CTR sempre seria o "pior"). Ela compara cada anúncio com a
//    mediana dos PRÓPRIOS anúncios da loja, ponderando pelo volume da etapa. Limiares são heurísticas internas,
//    ajustáveis, e não benchmarks oficiais da Shopee.
// 3. Cliques → Visitantes NÃO é taxa de conversão: cliques (cards de produto) e visitantes (loja) vêm de fontes e
//    populações diferentes e a razão pode passar de 100%. Fica como "relação", nunca entra no ranking de gargalos.

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const arr=v=>Array.isArray(v)?v:[];
export const median=values=>{const a=arr(values).filter(v=>Number.isFinite(v)).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};

// Heurísticas internas (não oficiais). Mantidas num só lugar para ajuste e teste.
export const THRESHOLDS=Object.freeze({
  laggardRatio:.6,      // anúncio "abaixo da referência" = taxa < 60% da mediana dos anúncios (mesmo critério do productPlan)
  badShortfall:.25,     // perda relativa média ≥ 25% da referência → prioridade alta
  warnShortfall:.10,    // ≥ 10% → atenção
  minProductsForReference:3,
  changeNoticeable:.10  // variação do período anterior só é destacada a partir de ±10%
});

export const FUNNEL_STAGES=Object.freeze([
  {key:'impressions',label:'Impressões',icon:'eye',unit:'eventos',
    definition:'Quantas vezes seus anúncios apareceram para clientes na busca, recomendações e vitrines.',
    note:'Conta exibições (eventos), não pessoas.'},
  {key:'clicks',label:'Cliques',icon:'cursor',unit:'eventos',
    definition:'Cliques nos cards dos seus produtos. Uma mesma pessoa pode clicar várias vezes.',
    note:'Conta cliques (eventos) vindos dos cards de produto.'},
  {key:'visitors',label:'Visitantes',icon:'users',unit:'pessoas',
    definition:'Pessoas diferentes que visitaram sua loja no período.',
    note:'Pessoas únicas da loja. Vem de outra fonte que os cliques e por isso pode ser maior ou menor que eles.'},
  {key:'carts',label:'Carrinho',icon:'cart',unit:'pessoas',
    definition:'Visitantes que colocaram algum produto no carrinho.',
    note:'Pessoas únicas, vindas da visão geral de produtos.'},
  {key:'placed',label:'Pedido criado',icon:'package',unit:'pedidos',
    definition:'Pedidos criados no período, inclusive os que ainda não foram pagos.',
    note:'Conta pedidos, não pessoas.'},
  {key:'paid',label:'Pago',icon:'card',unit:'pedidos',
    definition:'Pedidos cujo pagamento foi aprovado.',
    note:'Conta pedidos pagos.'},
  {key:'confirmed',label:'Confirmado',icon:'check',unit:'pedidos',
    definition:'Pedidos pagos e confirmados (sem cancelamento até a data da coleta).',
    note:'Conta pedidos confirmados.'}
]);

const plural100=(rate,subject,verb)=>{
  const v=num(rate);
  if(v==null)return 'Sem dados suficientes para calcular esta relação.';
  const x=v*100,shown=x>=10?String(Math.round(x)):(Math.round(x*10)/10).toLocaleString('pt-BR');
  return `De cada 100 ${subject}, aproximadamente ${shown} ${verb}.`;
};

// Cada transição guarda: o que mede (fato), hipóteses (causas possíveis, NUNCA comprovadas) e ações sugeridas.
export const FUNNEL_TRANSITIONS=Object.freeze([
  {id:'ctr',from:'impressions',to:'clicks',kind:'conversion',kpiLabel:'CTR',sub:'Impressão → Clique',icon:'cursor',minBase:100,refKey:'ctr',
    per100:r=>plural100(r,'impressões','geraram cliques'),
    detail:'CTR é a relação entre cliques e impressões. Mede a capacidade do anúncio de atrair atenção nos resultados de busca. Fotografia principal, título, preço exibido e posição na busca podem influenciá-lo.',
    comparable:'direct',
    title:'Faça mais gente clicar nos anúncios que já aparecem',
    why:'Seus anúncios já recebem exposição, mas uma parte relevante dela gera proporcionalmente menos cliques que o padrão da sua própria loja.',
    causes:['A imagem principal pode estar pouco atrativa ou confusa nos resultados de busca.','O título pode não destacar o termo ou o benefício que o cliente procura.','O preço ou a oferta exibidos podem estar menos competitivos que os dos anúncios vizinhos.'],
    steps:['Pesquise na Shopee, como o cliente faria, o nome do seu produto. Abra os 10 primeiros anúncios e anote quais mais vendem e a faixa de preço deles.',
      'Compare a capa do seu anúncio com a deles, lado a lado: fundo, enquadramento, quantidade de itens à mostra, texto na imagem. Refaça a sua capa seguindo o padrão que se repete entre os que mais vendem, sem copiar a imagem de ninguém.',
      'Revise o título: as primeiras palavras devem ser o que o cliente digita (produto + principal característica). Compare com os títulos dos anúncios mais vendidos.',
      'Confira se o seu preço está na mesma faixa dos concorrentes diretos. Se estiver bem acima, avalie oferta ou cupom antes de baixar o preço, conferindo a margem na calculadora do Gestor.',
      'Mude um grupo pequeno de anúncios por vez, anote a data e compare o CTR no mesmo período depois de alguns dias. Só então avance para os próximos.']},
  {id:'visitCart',from:'visitors',to:'carts',kind:'conversion',kpiLabel:'Visita → Carrinho',sub:'Intenção de compra',icon:'cart',minBase:10,refKey:'cart',
    per100:r=>plural100(r,'visitantes','adicionaram ao carrinho'),
    detail:'Mostra quantos visitantes demonstraram intenção de compra ao colocar algo no carrinho. Visitantes e carrinhos vêm de fontes diferentes da Shopee, então a leitura é aproximada.',
    comparable:'cross',
    title:'Transforme visitas em intenção de compra',
    why:'As pessoas chegam aos anúncios, mas poucas avançam para o carrinho. A prioridade é a oferta dentro da página do produto.',
    causes:['Preço final, frete ou prazo podem estar pouco atraentes.','Imagens secundárias, medidas ou variações podem não esclarecer o produto.','Avaliações e prova social podem estar fracas para este tipo de produto.'],
    steps:['Abra o seu anúncio no celular, como o cliente. Nas primeiras telas dá para entender o que é, a quantidade/tamanho e o preço? Se não, reorganize as imagens e o começo da descrição.',
      'Compare suas imagens com as dos concorrentes e adicione o que falta: medidas, o que vem na embalagem, produto em uso e tabela de variações.',
      'Compare o preço final (com frete) e o prazo com 3 concorrentes diretos. Veja se frete grátis ou um cupom pequeno é viável para a sua margem.',
      'Leia as avaliações negativas, as suas e as dos concorrentes, e responda as dúvidas mais comuns na descrição.',
      'Confira se todas as variações têm estoque e nomes claros. Mude uma coisa por vez e acompanhe Visita → Carrinho no mesmo período.']},
  {id:'cartPlaced',from:'carts',to:'placed',kind:'conversion',kpiLabel:'Carrinho → Pedido',sub:'Fechamento do carrinho',icon:'package',minBase:5,refKey:'cartPlaced',
    per100:r=>plural100(r,'carrinhos','viraram pedido'),
    detail:'Mostra quantos carrinhos se transformam em pedido. Carrinhos contam pessoas e pedidos contam pedidos, então a relação é aproximada.',
    comparable:'cross',
    title:'Destrave quem já colocou no carrinho',
    why:'Existe intenção de compra, mas o fechamento perde força antes da criação do pedido.',
    causes:['O preço final (com frete e taxas) pode estar acima do esperado pelo cliente.','Cupom, frete grátis ou prazo podem estar menos competitivos.','Alguma variação procurada pode estar sem estoque.'],
    steps:['Simule a compra como cliente: coloque o produto no carrinho e vá até o fechamento. Veja o preço final com frete e taxas, porque um valor que muda no fim costuma gerar desistência.',
      'Compare o preço final com anúncios iguais ao seu. Se estiver acima, teste um cupom ou oferta pequena, conferindo antes a margem na calculadora do Gestor.',
      'Reveja o frete e o prazo de envio: frete grátis (se compensar) e prazo curto ajudam a fechar o pedido.',
      'Confira o estoque das variações mais procuradas. Variação sem estoque faz o cliente desistir.',
      'Mude uma coisa por vez e acompanhe Carrinho → Pedido no mesmo período.']},
  {id:'placedPaid',from:'placed',to:'paid',kind:'conversion',kpiLabel:'Pedido → Pago',sub:'Pagamento',icon:'card',minBase:5,refKey:'placedPaid',
    per100:r=>plural100(r,'pedidos','são pagos'),
    detail:'Mostra quantos pedidos criados chegam a ser pagos. Uma queda aqui acontece depois que o cliente já decidiu comprar.',
    comparable:'direct',
    title:'Investigue por que pedidos criados não viram pagamento',
    why:'O cliente já criou o pedido. Alterar capa e título agora atacaria uma etapa anterior ao problema observado.',
    causes:['Meio de pagamento, parcelamento ou prazo de pagamento podem estar dificultando a conclusão.','O preço final no fechamento pode ter mudado a percepção do cliente.','Pedidos expirados ou sem pagamento por desistência.'],
    steps:['No Seller Center, abra os pedidos não pagos ou expirados do período e procure um padrão: mesmo produto, mesma variação ou valores mais altos.',
      'Reveja o preço final e o prazo que o cliente vê no fechamento do pedido (frete e taxas incluídos).',
      'Não comece pela capa ou pelo título: o cliente já decidiu comprar.',
      'Evite baixar preço sem evidência de que ele é o problema; confira campanha e margem primeiro.',
      'Acompanhe Pedido → Pago por alguns dias antes de fazer mudanças grandes.']},
  {id:'paidConfirmed',from:'paid',to:'confirmed',kind:'conversion',kpiLabel:'Pago → Confirmado',sub:'Confirmação final',icon:'check',minBase:5,refKey:'paidConfirmed',
    per100:r=>plural100(r,'pedidos pagos','foram confirmados'),
    detail:'Mostra quantos pedidos pagos chegam à confirmação. A perda aqui costuma ser operacional: cancelamentos, estoque e expedição.',
    comparable:'direct',
    title:'Trate a operação depois do pagamento',
    why:'A aquisição chegou ao pagamento; a maior perda está na confirmação final.',
    causes:['Cancelamentos por falta de estoque ou atraso de expedição.','Pedidos devolvidos ou reembolsados antes da confirmação.','Demora na postagem pode levar a cancelamentos.'],
    steps:['No Seller Center, abra os pedidos cancelados do período e leia o motivo de cada um: sem estoque, atraso no envio ou pedido do comprador.',
      'Se for estoque: atualize a quantidade real e desative as variações zeradas.',
      'Se for atraso: confira se o prazo de preparo configurado é possível de cumprir e despache dentro dele.',
      'Confira as devoluções: se o motivo é produto diferente do anúncio, ajuste fotos e descrição.',
      'Não mexa em capa, título ou Ads para resolver uma perda que acontece depois do pagamento.']},
  // Relação entre populações diferentes: nunca é gargalo nem taxa de conversão.
  {id:'clickVisit',from:'clicks',to:'visitors',kind:'ratio',kpiLabel:'Visitantes ÷ Cliques',sub:'Relação entre fontes',icon:'users',minBase:1,refKey:null,
    per100:()=>'Cliques (cards de produto) e visitantes (pessoas da loja) são métricas diferentes; a razão não é uma taxa de conversão.',
    detail:'Cliques contam eventos nos cards de produto. Visitantes contam pessoas únicas da loja, vindas de outra fonte. Por isso há mais visitantes do que cliques em alguns períodos, e isso não é erro de cálculo.',
    comparable:'none',
    title:'Cliques e visitantes não formam uma etapa contínua',
    why:'São populações e fontes diferentes; o Gestor não trata essa relação como perda de clientes.',
    causes:[],steps:[]}
]);

export const transitionById=id=>FUNNEL_TRANSITIONS.find(t=>t.id===id)||null;
export const stageByKey=key=>FUNNEL_STAGES.find(s=>s.key===key)||null;

// Taxa de um anúncio para uma transição (mesmos campos do ranking de produtos).
export function storeStageProductRate(p,stageId){
  const impressions=num(p.product_card_impressions),clicks=num(p.product_card_clicks),visits=num(p.uv),carts=num(p.add_to_cart_buyers),placed=num(p.placed_buyers),paid=num(p.paid_buyers),confirmed=num(p.confirmed_buyers);
  if(stageId==='ctr')return{rate:impressions>0&&clicks!=null?clicks/impressions:null,base:impressions};
  if(stageId==='clickVisit')return{rate:clicks>0&&visits!=null?visits/clicks:null,base:clicks};
  if(stageId==='visitCart')return{rate:visits>0&&carts!=null?carts/visits:null,base:visits};
  if(stageId==='cartPlaced')return{rate:carts>0&&placed!=null?placed/carts:null,base:carts};
  if(stageId==='placedPaid')return{rate:placed>0&&paid!=null?paid/placed:null,base:placed};
  if(stageId==='paidConfirmed')return{rate:paid>0&&confirmed!=null?confirmed/paid:null,base:paid};
  return{rate:null,base:null};
}

// Avalia UMA transição de conversão comparando os anúncios com a mediana deles mesmos.
export function evaluateTransition(t,products,storeRate,storeBase){
  const base={id:t.id,from:t.from,to:t.to,kind:t.kind,rate:num(storeRate),storeBase:num(storeBase),level:'data',reason:'',reference:null,productCount:0,laggards:[],laggardShare:null,shortfall:null,inconsistent:0};
  if(t.kind!=='conversion'){
    return{...base,level:'info',reason:'Relação entre métricas de fontes diferentes; não é taxa de conversão.',exceeds:base.rate!=null&&base.rate>1};
  }
  if(base.rate!=null&&(base.rate<0||base.rate>1))base.reason='A taxa da loja passou de 100%: as métricas desta etapa vêm de fontes diferentes e não formam uma conversão válida.';
  const rows=[];let inconsistent=0;
  for(const p of arr(products)){
    const r=storeStageProductRate(p,t.id);
    if(r.rate==null||!(r.base>=t.minBase))continue;
    if(r.rate>1){inconsistent++;continue}
    rows.push({p,rate:r.rate,base:r.base});
  }
  base.inconsistent=inconsistent;base.productCount=rows.length;
  if(rows.length<THRESHOLDS.minProductsForReference){
    return{...base,reason:base.reason||`Poucos anúncios com volume suficiente (${rows.length}) para formar uma referência confiável.`};
  }
  const reference=median(rows.map(x=>x.rate));
  base.reference=reference;
  if(!(reference>0))return{...base,reason:base.reason||'A referência dos seus anúncios é zero nesta etapa; não há como comparar.'};
  const totalBase=rows.reduce((s,x)=>s+x.base,0);
  const lag=rows.filter(x=>x.rate<reference*THRESHOLDS.laggardRatio);
  const missed=rows.reduce((s,x)=>s+Math.max(0,reference-x.rate)*x.base,0);
  const shortfall=totalBase>0?missed/totalBase/reference:0;
  const level=shortfall>=THRESHOLDS.badShortfall&&lag.length>0?'bad':shortfall>=THRESHOLDS.warnShortfall?'warn':'good';
  return{...base,level,reason:base.reason,shortfall,totalBase,
    laggards:lag.sort((a,b)=>(Math.max(0,reference-b.rate)*b.base)-(Math.max(0,reference-a.rate)*a.base)).map(x=>({id:x.p.id,rate:x.rate,base:x.base})),
    laggardShare:totalBase>0?lag.reduce((s,x)=>s+x.base,0)/totalBase:null};
}

// Diagnóstico completo. `evidence` vem de deriveStoreFunnel(...).evidence (cobertura da coleta).
export function diagnoseStore({totals,rates,products,comparison,evidence}){
  const list=arr(FUNNEL_TRANSITIONS).map(t=>({t,ev:evaluateTransition(t,products,rates?.[t.id],totals?.[t.from])}));
  const evaluated=list.map(x=>x.ev);
  const actionable=evaluated.filter(e=>e.level==='bad'||e.level==='warn').sort((a,b)=>(b.shortfall-a.shortfall)||((b.totalBase||0)-(a.totalBase||0)));
  const good=evaluated.filter(e=>e.level==='good').sort((a,b)=>b.shortfall-a.shortfall);
  const expected=num(evidence?.productsExpected),got=num(evidence?.productCount);
  const failedPages=num(evidence?.rankingsPagesFailed)||0;
  const partialBase=failedPages>0||(expected!=null&&got!=null&&got<expected);
  const state=actionable.length?'bottleneck':good.length?'healthy':'insufficient';
  const primary=actionable[0]||null;
  return{
    state,primary,watch:state==='healthy'?good[0]:null,evaluated,actionable,
    reliability:{partialBase,productsReceived:got,productsExpected:expected,failedPages},
    trends:periodChanges(comparison)
  };
}

// Variação do período anterior (chain_ratio da Shopee). Aqui "subir" é bom para as quatro métricas atuais;
// o campo goodWhen existe para não presumir isso se outras métricas forem adicionadas.
export const COMPARISON_METRICS=Object.freeze([
  {key:'visitors',label:'Visitantes',totalKey:'visitors',goodWhen:'up',format:'int'},
  {key:'paidOrders',label:'Pedidos pagos',totalKey:'paid',goodWhen:'up',format:'int'},
  {key:'paidGmv',label:'GMV pago',totalKey:'paidGmv',goodWhen:'up',format:'money'},
  {key:'confirmedOrders',label:'Confirmados',totalKey:'confirmed',goodWhen:'up',format:'int'}
]);
export function judgeChange(value,goodWhen='up'){
  const v=num(value);
  if(v==null)return{verdict:'none',verdictLabel:'Sem comparação'};
  if(Math.abs(v)<THRESHOLDS.changeNoticeable)return{verdict:'stable',verdictLabel:'Estável'};
  const up=v>0;
  return{verdict:(goodWhen==='up')===up?'better':'worse',verdictLabel:(goodWhen==='up')===up?'Melhora':'Piora'};
}
export function periodChanges(comparison){
  return COMPARISON_METRICS.map(m=>({...m,value:num(comparison?.[m.key]),...judgeChange(comparison?.[m.key],m.goodWhen)}));
}
export function previousPeriodLabel(periodId){
  if(periodId==='past7days')return'7 dias imediatamente anteriores (cálculo da Shopee)';
  if(periodId==='past30days')return'30 dias imediatamente anteriores (cálculo da Shopee)';
  if(periodId==='real_time')return'janela de comparação definida pela Shopee para o tempo real (não informada)';
  return'período anterior definido pela Shopee';
}

// Produtos para começar: maior oportunidade (gap vs. mediana × volume) na etapa do gargalo.
export function rankProductsForStage(products,transitionId,limit=3){
  const t=transitionById(transitionId);
  if(!t||t.kind!=='conversion')return{ranked:[],reference:null};
  const rows=arr(products).map(p=>({p,...storeStageProductRate(p,t.id)})).filter(x=>x.rate!=null&&x.rate<=1&&x.base>0);
  const reference=median(rows.filter(x=>x.base>=t.minBase).map(x=>x.rate));
  const ranked=rows.map(x=>({...x,gap:reference!=null?Math.max(0,reference-x.rate):0,opportunity:reference!=null?Math.max(0,(reference-x.rate)*x.base):0}))
    .sort((a,b)=>(b.opportunity-a.opportunity)||(b.base-a.base));
  const actionable=ranked.filter(x=>x.opportunity>0);
  return{ranked:(actionable.length?actionable:ranked).slice(0,limit),reference,hasGap:actionable.length>0};
}
