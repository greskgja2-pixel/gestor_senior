(() => {
  'use strict';

  const STOP=new Set(['para','com','sem','uma','uns','umas','que','por','dos','das','de','da','do','em','no','na','nos','nas','e','ou','kit','produto','novo','original']);
  const words=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'N/A';

  function parseNumber(raw){
    const text=String(raw??'').trim().toLowerCase();if(!text)return null;
    const mult=/\b(mil|k)\b/.test(text)?1000:1;
    const cleaned=text.replace(/\b(mil|k)\b/g,'').replace(/\+/g,'').replace(/[^\d.,-]/g,'');if(!cleaned)return null;
    let normalized=cleaned;
    if(mult===1000)normalized=cleaned.includes(',')?cleaned.replace(/\./g,'').replace(',','.'):cleaned;
    else if(cleaned.includes(',')&&cleaned.includes('.'))normalized=cleaned.replace(/\./g,'').replace(',','.');
    else if(cleaned.includes(','))normalized=cleaned.replace(',','.');
    else normalized=cleaned.replace(/\.(?=\d{3}(?:\D|$))/g,'');
    const n=Number(normalized);return Number.isFinite(n)?n*mult:null;
  }

  function cellValue(label){
    const target=String(label).toLowerCase();
    const cell=[...document.querySelectorAll('#productValidation .validation-grid > div')].find(x=>String(x.querySelector('span')?.textContent||'').trim().toLowerCase()===target);
    return cell?.querySelector('b')?.textContent?.trim()||'';
  }

  function ownProduct(){
    return {
      title:document.querySelector('#productValidation .product-check-head strong')?.textContent?.trim()||'',
      price:parseNumber(cellValue('Preço')),
      sold:parseNumber(cellValue('Itens vendidos')),
      rating:parseNumber(cellValue('Avaliação')),
      reviews:parseNumber(cellValue('Qtd. avaliações'))
    };
  }

  function selectedCompetitors(){
    return [...document.querySelectorAll('#competitorList .competitor.selected')].slice(0,3).map((row,index)=>{
      const title=row.querySelector('strong')?.textContent?.trim()||`Concorrente ${index+1}`;
      const info=row.querySelector('small')?.textContent||'';
      return {
        index:index+1,
        title,
        price:parseNumber(info.match(/R\$\s*[\d.,]+/)?.[0]),
        rating:parseNumber(info.match(/[\d.,]+(?=\s*★)/)?.[0]),
        sold:parseNumber(info.match(/[\d.,]+\s*(?:mil|k)?\+?(?=\s*vendid)/i)?.[0])
      };
    });
  }

  function median(values){
    const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;
    const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
  }

  function recurringTerms(comps){
    const freq=new Map();
    for(const c of comps){
      const seen=new Set(words(c.title).filter(w=>w.length>=4&&!STOP.has(w)));
      for(const w of seen)freq.set(w,(freq.get(w)||0)+1);
    }
    return [...freq.entries()].filter(([,count])=>count>=Math.min(2,comps.length)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([term,count])=>({term,count}));
  }

  function analyze(own,comps){
    const ownTerms=new Set(words(own.title));
    const common=recurringTerms(comps);
    const missing=common.filter(x=>!ownTerms.has(x.term)).slice(0,5).map(x=>x.term);
    const medPrice=median(comps.map(c=>c.price));
    const profiles=comps.map(c=>{
      const traits=[];
      if(Number.isFinite(c.price)&&Number.isFinite(own.price)&&own.price>0){const d=(c.price-own.price)/own.price;if(d<=-.10)traits.push('preço mais agressivo');else if(d>=.10)traits.push('preço mais alto');else traits.push('preço semelhante ao seu');}
      if(Number.isFinite(c.sold)){if(c.sold>=1000)traits.push('alto volume vendido');else if(c.sold>=100)traits.push('volume relevante de vendas');else if(c.sold>0)traits.push('já possui tração');}
      if(Number.isFinite(c.rating)){if(c.rating>=4.8)traits.push('reputação muito forte');else if(c.rating>=4.5)traits.push('boa reputação');}
      const unique=words(c.title).filter(w=>w.length>=4&&!STOP.has(w)&&!ownTerms.has(w)).slice(0,4);
      if(unique.length)traits.push(`termos diferentes: ${unique.join(', ')}`);
      return {...c,traits};
    });

    const recommendations=[];
    if(missing.length)recommendations.push({area:'Título',text:`Os concorrentes repetem os termos “${missing.join(', ')}”. Valide quais realmente descrevem o seu produto e, se fizer sentido, inclua-os naturalmente no título.`});
    if(Number.isFinite(own.price)&&Number.isFinite(medPrice)){
      const d=(own.price-medPrice)/medPrice;
      if(d>.10)recommendations.push({area:'Oferta',text:`Seu preço está ${(d*100).toFixed(1)}% acima da mediana dos concorrentes (${money(medPrice)}). Antes de baixar, destaque claramente diferenciais que justifiquem o valor.`});
      else if(d<-.10)recommendations.push({area:'Margem',text:`Seu preço está ${Math.abs(d*100).toFixed(1)}% abaixo da mediana (${money(medPrice)}). Não entre em guerra de preço sem conferir a margem; use o preço como vantagem comercial.`});
      else recommendations.push({area:'Preço',text:`Seu preço está próximo da mediana dos concorrentes (${money(medPrice)}). O ganho tende a vir mais de conteúdo, confiança e diferenciação do que de desconto.`});
    }
    const soldRows=comps.filter(c=>Number.isFinite(c.sold));
    if(soldRows.length){const top=soldRows.reduce((a,b)=>a.sold>=b.sold?a:b);if(!Number.isFinite(own.sold)||top.sold>own.sold)recommendations.push({area:'Oferta vencedora',text:`O concorrente com maior tração tem ${top.sold.toLocaleString('pt-BR')} vendidos. Estude a promessa principal, composição do kit e clareza da oferta dele para entender o que pode estar ajudando na conversão — sem copiar o anúncio.`});}
    const ratingRows=comps.filter(c=>Number.isFinite(c.rating));
    if(ratingRows.length){const best=ratingRows.reduce((a,b)=>a.rating>=b.rating?a:b);if(!Number.isFinite(own.rating)||best.rating>own.rating)recommendations.push({area:'Prova social',text:`Há concorrente com avaliação ${best.rating.toFixed(1)}. Reforce confiança com fotos reais, respostas a dúvidas, pós-venda e destaque de avaliações positivas.`});}
    if(common.length)recommendations.push({area:'Descrição',text:`Termos recorrentes observados: ${common.slice(0,6).map(x=>x.term).join(', ')}. Quando forem verdadeiros para o seu produto, transforme esses termos em benefícios e especificações claras na descrição.`});
    if(!recommendations.length)recommendations.push({area:'Monitoramento',text:'Os dados coletados ainda não mostram uma vantagem clara. Continue acompanhando preço, vendas, avaliação e posicionamento dos concorrentes antes de alterar o anúncio.'});
    return {profiles,recommendations:recommendations.slice(0,5)};
  }

  function render(result,comps){
    const anchor=document.getElementById('raySummary');if(!anchor)return;
    document.getElementById('competitorAiReview')?.remove();
    const profiles=result.profiles.map(p=>`<div style="padding:8px 0;border-bottom:1px solid var(--wizard-line)"><b>Concorrente ${p.index}</b><div style="font-size:10px;color:var(--wizard-muted);margin-top:3px">${esc(p.title.slice(0,100))}</div><div style="font-size:10px;margin-top:4px">${p.price!=null?money(p.price):'Preço N/A'}${p.sold!=null?` · ${p.sold.toLocaleString('pt-BR')} vendidos`:''}${p.rating!=null?` · ${p.rating.toFixed(1)}★`:''}</div><div style="font-size:9.5px;color:var(--wizard-muted);margin-top:4px">${esc(p.traits.length?p.traits.join(' · '):'Sem característica forte confirmada com os dados disponíveis.')}</div></div>`).join('');
    const recs=result.recommendations.map((r,i)=>`<div style="padding:8px 0;border-bottom:1px solid var(--wizard-line)"><b style="font-size:10px">${i+1}. ${esc(r.area)}</b><div style="font-size:10px;color:var(--wizard-muted);line-height:1.45;margin-top:3px">${esc(r.text)}</div></div>`).join('');
    const card=document.createElement('div');card.id='competitorAiReview';card.className='card compact-card';
    card.innerHTML=`<div class="row"><b>🧠 IA — Aprendizados dos concorrentes</b><span class="pill">${comps.length} analisados</span></div><p class="muted" style="font-size:10px;line-height:1.45">Depois da seleção dos concorrentes, o Gestor compara as características disponíveis e transforma os padrões encontrados em sugestões para o seu anúncio. Não copie características que o seu produto não possui.</p><div style="margin-top:8px"><b style="font-size:11px">Características observadas</b>${profiles}</div><div style="margin-top:10px"><b style="font-size:11px">Sugestões baseadas nos concorrentes</b>${recs}</div>`;
    anchor.insertAdjacentElement('afterend',card);
  }

  function run(){
    const comps=selectedCompetitors();if(!comps.length)return;
    render(analyze(ownProduct(),comps),comps);
  }

  function init(){
    const version=document.querySelector('.version');if(version)version.textContent='v0.12.8';
    const wizardInfo=document.querySelector('#tab-analyze .wizard-head .muted');if(wizardInfo)wizardInfo.textContent=wizardInfo.textContent.replace(/v\d+\.\d+\.\d+/,'v0.12.8');
    document.getElementById('step3Next')?.addEventListener('click',()=>setTimeout(run,80));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
