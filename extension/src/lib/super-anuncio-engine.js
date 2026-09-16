import {computeProfit, DEFAULT_FINANCE} from './profit-engine.js';

const words = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g) || [];
const money = n => Number(n || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const med = arr => { const a = arr.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };

export function duplicateWordCount(title){
  const w=words(title).filter(x=>x.length>=3), seen=new Set(); let dup=0;
  for(const x of w){if(seen.has(x))dup++;else seen.add(x);} return dup;
}
export function medianPrice(competitors=[]){return med(competitors.map(c=>Number(c.bestSellingVariationPrice ?? c.price)).filter(Number.isFinite));}
export function buildPriceInsight(price, median, count){
  if(!Number.isFinite(Number(price))) return 'Preço do anúncio não confirmado.';
  if(!Number.isFinite(Number(median))) return count ? 'Concorrentes encontrados, mas sem preço confiável suficiente para calcular a mediana.' : 'Encontre produtos equivalentes antes de alterar preço.';
  const p=Number(price), diff=(p-median)/median;
  if(Math.abs(diff)<=0.10) return 'Seu preço está próximo da faixa dos concorrentes selecionados. O ganho deve vir mais de conteúdo, confiança e diferenciação do que de desconto.';
  if(diff>0) return `Seu preço está ${(diff*100).toFixed(1)}% acima da mediana dos concorrentes. Revise diferenciais e conversão antes de reduzir preço.`;
  return `Seu preço está ${Math.abs(diff*100).toFixed(1)}% abaixo da mediana. Confirme margem e posicionamento antes de baixar ainda mais.`;
}
export function optimizeTitle(title, competitors=[]){
  const original=String(title||'').trim(); if(!original)return original;
  const base=words(original); const freq=new Map();
  competitors.forEach(c=>words(c.title).forEach(w=>{if(w.length>=4)freq.set(w,(freq.get(w)||0)+1)}));
  const missing=[...freq.entries()].filter(([w,n])=>n>=2&&!base.includes(w)).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([w])=>w);
  const tokens=[], seen=new Set();
  for(const raw of original.split(/\s+/)){const k=words(raw)[0]||raw.toLowerCase();if(!seen.has(k)){tokens.push(raw);seen.add(k)}}
  for(const w of missing){if(!seen.has(w)){tokens.push(w);seen.add(w)}}
  return tokens.join(' ').slice(0,120).trim();
}
const STOP=new Set(['para','com','sem','uma','uns','umas','que','por','dos','das','de','da','do','em','no','na','nos','nas','e','ou','kit','produto','novo','original']);
const normalizeLine=s=>String(s||'').replace(/^[\s•●▪◦✅✔️👉📌🎨]+/u,'').replace(/\s+/g,' ').trim();
const uniqueLines=lines=>{const out=[],seen=new Set();for(const raw of lines){const line=normalizeLine(raw);const key=words(line).join(' ');if(line.length<3||seen.has(key))continue;seen.add(key);out.push(line);}return out;};
function factualLines(description){
  const original=String(description||'').trim();if(!original)return[];
  let lines=uniqueLines(original.split(/\r?\n+/));
  if(lines.length<4){lines=uniqueLines(original.split(/(?<=[.!?])\s+/));}
  const score=line=>{let s=0;if(/\d/.test(line))s+=3;if(/(cm|mm|kg|g\b|página|folha|unidade|tamanho|material|idade|conteúdo|formato|quantidade|medida|cor|espiral|capa|a4|a5)/i.test(line))s+=3;if(line.includes(':'))s+=2;if(line.length>=20&&line.length<=140)s+=2;return s;};
  return lines.map((line,i)=>({line,i,score:score(line)})).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,12).sort((a,b)=>a.i-b.i).map(x=>x.line);
}
function recurringCompetitorTerms(competitors=[],min=2){
  const freq=new Map();for(const c of competitors){const seen=new Set(words(c?.title).filter(w=>w.length>=4&&!STOP.has(w)));for(const w of seen)freq.set(w,(freq.get(w)||0)+1);}
  return [...freq.entries()].filter(([,count])=>count>=min).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([term,count])=>({term,count}));
}
export function optimizeDescription(title, description, competitors=[]){
  const original=String(description||'').trim(), facts=factualLines(original), titleText=String(title||'').trim();
  const recurring=recurringCompetitorTerms(competitors,Math.min(2,Math.max(1,competitors.length))).slice(0,8).map(x=>x.term);
  const out=[];if(titleText)out.push(titleText);
  if(facts.length){out.push('','Informações do produto:');for(const f of facts)out.push(`• ${f}`);}else if(original){out.push('',original);}
  if(recurring.length){out.push('','Termos frequentes observados nos concorrentes para avaliar:');out.push(recurring.join(', '));out.push('Use apenas os termos que realmente correspondem às características deste produto.');}
  return out.join('\n').trim();
}
export function buildCompetitorInsights(input, competitors=[]){
  const ownTitle=words(input?.title), ownSet=new Set(ownTitle), ownPrice=Number(input?.price), median=medianPrice(competitors);
  const strengths=[],similarities=[],opportunities=[];
  const priced=competitors.map(c=>({c,price:Number(c?.bestSellingVariationPrice??c?.price)})).filter(x=>Number.isFinite(x.price));
  if(priced.length){const low=priced.reduce((a,b)=>a.price<=b.price?a:b);strengths.push(`Menor preço entre os selecionados: ${money(low.price)}${low.c?.title?` — ${String(low.c.title).slice(0,65)}`:''}.`);}
  const sold=competitors.map(c=>({c,sold:Number(c?.sold??c?.historicalSold)})).filter(x=>Number.isFinite(x.sold));
  if(sold.length){const top=sold.reduce((a,b)=>a.sold>=b.sold?a:b);strengths.push(`Maior volume vendido observado: ${top.sold.toLocaleString('pt-BR')}${top.c?.title?` — ${String(top.c.title).slice(0,65)}`:''}.`);}
  const ratings=competitors.map(c=>({c,rating:Number(c?.rating),reviews:Number(c?.reviewCount)})).filter(x=>Number.isFinite(x.rating));
  if(ratings.length){const top=ratings.reduce((a,b)=>a.rating>=b.rating?a:b);strengths.push(`Melhor avaliação observada: ${top.rating.toFixed(1)}${Number.isFinite(top.reviews)?` (${top.reviews.toLocaleString('pt-BR')} avaliações)`:''}.`);}
  const recurring=recurringCompetitorTerms(competitors,Math.min(2,Math.max(1,competitors.length))).slice(0,8);
  if(recurring.length)strengths.push(`Termos recorrentes nos títulos: ${recurring.map(x=>x.term).join(', ')}.`);
  const shared=[...new Set(competitors.flatMap(c=>words(c?.title).filter(w=>w.length>=4&&!STOP.has(w)&&ownSet.has(w))))].slice(0,8);
  if(shared.length)similarities.push(`Termos em comum com seu anúncio: ${shared.join(', ')}.`);
  if(Number.isFinite(ownPrice)&&Number.isFinite(median)){const diff=Math.abs((ownPrice-median)/median);if(diff<=.12)similarities.push(`Seu preço está próximo da mediana dos concorrentes (${money(median)}).`);else opportunities.push(ownPrice>median?`Seu preço está ${(((ownPrice-median)/median)*100).toFixed(1)}% acima da mediana; confira se os diferenciais justificam a diferença.`:`Seu preço está abaixo da mediana; preserve margem antes de baixar mais.`);}
  const missing=recurring.filter(x=>!ownSet.has(x.term)).slice(0,5).map(x=>x.term);if(missing.length)opportunities.push(`Valide se estes termos recorrentes também descrevem seu produto: ${missing.join(', ')}.`);
  const ownRating=Number(input?.product?.rating),bestRating=ratings.length?Math.max(...ratings.map(x=>x.rating)):null;if(Number.isFinite(ownRating)&&Number.isFinite(bestRating)&&ownRating<bestRating)opportunities.push(`A melhor avaliação concorrente (${bestRating.toFixed(1)}) está acima da sua (${ownRating.toFixed(1)}); priorize prova social e experiência do comprador.`);
  if(!strengths.length)strengths.push('Ainda não há dados comparáveis suficientes para apontar um ponto forte com segurança.');
  if(!similarities.length)similarities.push('Compare tema, formato, público e faixa de preço quando esses dados estiverem disponíveis.');
  if(!opportunities.length)opportunities.push('Mantenha monitoramento de preço, vendas, avaliação e palavras recorrentes antes de alterar o anúncio.');
  return {strengths:strengths.slice(0,4),similarities:similarities.slice(0,4),opportunities:opportunities.slice(0,4)};
}
export function suggestCategory(category){return String(category||'').trim();}
export function buildRoasStrategy(input, finance={}){
  const current=Number(input.roas7d), target=Number(input.roasTarget), price=Number(input.price), cost=Number(input.productCost);
  const cfg={...DEFAULT_FINANCE,...finance}; let margin=null, breakEven=null;
  if(Number.isFinite(price)&&price>0&&Number.isFinite(cost)&&cost>=0){const r=computeProfit({price, productCost:cost, ...cfg});margin=r.contributionMargin;breakEven=r.breakEvenRoas;}
  const safeFloor=Number.isFinite(breakEven)?breakEven*1.15:null;
  if(Number.isFinite(margin)&&margin<=0)return {title:'A venda não deixa margem para Ads',message:'Com o preço e o custo informados, não sobra margem estimada para publicidade. Revise preço e custos antes de reduzir a Meta de ROAS.',grossMarginPct:margin*100,preliminaryBreakEvenRoas:breakEven,suggestedTarget:null};
  if(Number.isFinite(breakEven)&&Number.isFinite(current)&&current<breakEven)return {title:'Proteja a margem antes de buscar mais volume',message:'O ROAS atual está abaixo do ponto de equilíbrio estimado. Não reduza a Meta de ROAS agora.',grossMarginPct:margin*100,preliminaryBreakEvenRoas:breakEven,suggestedTarget:null};
  if(Number.isFinite(breakEven)&&Number.isFinite(target)&&target<breakEven)return {title:'Meta de ROAS abaixo do limite estimado',message:'Subir a meta é mais prudente para proteger a margem.',grossMarginPct:margin*100,preliminaryBreakEvenRoas:breakEven,suggestedTarget:safeFloor};
  if(Number.isFinite(target)&&target>0&&Number.isFinite(current)){
    const fulfillment=current/target;
    if(fulfillment>=1.05){let suggested=safeFloor==null?target*.90:Math.max(safeFloor,target*.90);if(suggested>=target*.98)suggested=null;return {title:'A campanha está cumprindo a meta',message:suggested==null?'Mantenha a configuração e acompanhe.':'Há espaço para testar uma redução gradual para buscar mais volume sem descer do limite estimado.',grossMarginPct:margin==null?null:margin*100,preliminaryBreakEvenRoas:breakEven,suggestedTarget:suggested};}
    if(fulfillment<.80){const canLower=safeFloor==null||target*.90>safeFloor;return {title:canLower?'A meta pode estar restritiva':'Não reduza a meta sem revisar a margem',message:canLower?'O ROAS real está bem abaixo da meta. Teste uma redução pequena e monitore por vários dias.':'A margem não deixa espaço seguro para reduzir a meta.',grossMarginPct:margin==null?null:margin*100,preliminaryBreakEvenRoas:breakEven,suggestedTarget:canLower?Math.max(safeFloor||0,target*.90):null};}
    return {title:'Meta e ROAS estão próximos',message:'Evite ajustes frequentes. Acompanhe 7 a 14 dias e altere de forma gradual.',grossMarginPct:margin==null?null:margin*100,preliminaryBreakEvenRoas:breakEven,suggestedTarget:null};
  }
  return {title:'Use uma meta compatível com sua margem',message:'Informe Meta de ROAS e ROAS real para permitir comparação.',grossMarginPct:margin==null?null:margin*100,preliminaryBreakEvenRoas:breakEven,suggestedTarget:null};
}
export function analyze(input){
  const competitors=input.competitors||[], median=medianPrice(competitors), priceInsight=buildPriceInsight(Number(input.price),median,competitors.length);
  const optimizedTitle=optimizeTitle(input.title,competitors), optimizedDescription=optimizeDescription(input.title,input.description,competitors), suggestedCategory=suggestCategory(input.category), competitorInsights=buildCompetitorInsights(input,competitors);
  const p=input.product||{}, dims=[];
  let titleScore=String(input.title||'').length>=40&&String(input.title||'').length<=120?12:String(input.title||'').length>=25?9:5;const dup=duplicateWordCount(input.title);titleScore=Math.max(3,Math.min(12,titleScore-(dup>3?3:dup)));dims.push({name:'Título',score:titleScore,maxScore:12,reason:titleScore>=10?'O título tem boa densidade e tamanho para leitura.':'O título pode ganhar clareza, prioridade de palavras e menos repetição.',action:optimizedTitle===input.title?'Mantenha o título e valide termos usados pelos concorrentes.':'Teste o título otimizado.'});
  const dl=String(input.description||'').length, ds=dl>=500?12:dl>=250?10:dl>=100?7:dl>0?4:2;dims.push({name:'Descrição',score:ds,maxScore:12,reason:ds>=10?'A descrição tem volume suficiente para organizar benefícios e dúvidas.':'A descrição está curta ou pouco estruturada.',action:'Use a versão estruturada e complete apenas informações verdadeiras.'});
  const ic=Number(p.imageCount||0),is=ic>=7?15:ic>=5?12:ic>=3?9:ic>0?6:7;dims.push({name:'Imagens',score:is,maxScore:15,reason:`Foram identificadas ${ic} imagem(ns) no anúncio.`,action:ic>=7?'Mantenha variedade visual.':'Tente chegar a 7+ imagens úteis.'});
  const hv=!!p.hasVideo;dims.push({name:'Vídeo',score:hv?8:2,maxScore:8,reason:hv?'O anúncio possui vídeo.':'Não identifiquei vídeo no anúncio.',action:hv?'Use o vídeo para demonstrar uso, tamanho e benefício real.':'Adicione um vídeo curto.'});
  dims.push({name:'Categoria',score:String(input.category||'').trim()?8:3,maxScore:8,reason:String(input.category||'').trim()?'Há uma categoria identificada.':'A categoria não pôde ser confirmada.',action:'Use a subcategoria mais específica.'});
  let cs=competitors.length>=3?8:competitors.length===2?6:competitors.length===1?4:2;if(Number.isFinite(Number(input.price))&&Number.isFinite(median)){const d=Math.abs((Number(input.price)-median)/median);cs+=d<=.10?7:d<=.20?5:3}else cs+=3;dims.push({name:'Preço e concorrência',score:Math.max(0,Math.min(15,cs)),maxScore:15,reason:priceInsight,action:competitors.length<3?'Compare com 3 produtos equivalentes antes de mexer no preço.':'Use preço junto de reputação, conteúdo e diferenciais; não baixe automaticamente.'});
  let proof=5;if(Number.isFinite(Number(p.rating)))proof+=Number(p.rating)>=4.8?3:Number(p.rating)>=4.5?2:1;if(Number.isFinite(Number(p.reviewCount)))proof+=Number(p.reviewCount)>=100?2:Number(p.reviewCount)>=20?1:0;dims.push({name:'Prova social',score:Math.min(10,proof),maxScore:10,reason:Number.isFinite(Number(p.rating))?`Avaliação identificada: ${Number(p.rating).toFixed(1)}${Number.isFinite(Number(p.reviewCount))?` em ${p.reviewCount} avaliação(ões)`:''}.`:'Avaliações não confirmadas.',action:'Reforce confiança com fotos reais, respostas claras e consistência.'});
  let st=4;if(Number(p.attributesCount||0)>=5)st+=2;if(Number(p.variationCount||0)>0)st++;if(Number(p.stock||0)>0)st++;dims.push({name:'Atributos, estoque e variações',score:Math.min(8,st),maxScore:8,reason:`Atributos: ${p.attributesCount||0} • Variações: ${p.variationCount||0}${Number.isFinite(Number(p.stock))?` • Estoque: ${p.stock}`:''}`,action:'Preencha atributos relevantes e mantenha variações claras.'});
  let ads=8,adsReason='Ads não informado como ativo; a nota não penaliza por isso.',adsAction='Se ativar Ads, acompanhe por pelo menos 7 dias.';if(input.adsActive){const r=Number(input.roas7d);if(!Number.isFinite(r)){ads=6;adsReason='Ads ativo, mas ROAS de 7 dias não informado.'}else{ads=r>=5?12:r>=3?10:r>=2?7:4;adsReason=`ROAS informado: ${r.toFixed(2)}${Number.isFinite(Number(input.roasTarget))?` • Meta de ROAS ${Number(input.roasTarget).toFixed(2)}`:''}${Number.isFinite(Number(input.adsSpend7d))?` • gasto ${money(input.adsSpend7d)} em 7 dias`:''}.`;adsAction=r<2?'Antes de aumentar orçamento, revise oferta, preço, criativo e conversão.':'O Ads está gerando retorno; preserve o que funciona e teste melhorias sem mudanças bruscas.'}}dims.push({name:'Ads e eficiência',score:Math.min(12,ads),maxScore:12,reason:adsReason,action:adsAction});
  const score=Math.max(0,Math.min(100,dims.reduce((s,d)=>s+d.score,0))),summary=score>=85?'Anúncio forte. O foco agora é refinamento e vantagem competitiva.':score>=70?'Boa base, com oportunidades claras para ganhar conversão e competitividade.':score>=55?'O anúncio tem base utilizável, mas há pontos importantes limitando o desempenho.':'O anúncio precisa de ajustes relevantes.';
  const lessons=dims.filter(d=>d.score<d.maxScore*.85).map(d=>({title:d.name,current:d.name==='Título'?input.title:d.name==='Descrição'?input.description:d.name==='Categoria'?input.category:d.name==='Preço e concorrência'?money(input.price):'',optimized:d.name==='Título'?optimizedTitle:d.name==='Descrição'?optimizedDescription:d.name==='Categoria'?suggestedCategory:d.name==='Preço e concorrência'?priceInsight:'',why:d.reason,how:d.action}));
  return {score,summary,optimizedTitle,optimizedDescription,suggestedCategory,dimensions:dims,lessons,competitorMedian:median,priceInsight,competitors,competitorInsights,roasStrategy:buildRoasStrategy(input,input.finance)};
}
