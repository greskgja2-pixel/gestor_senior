(() => {
  'use strict';

  const DEEP_KEY='gsCompetitorDeepProfilesV1';
  const STOP=new Set(['para','com','sem','uma','uns','umas','que','por','dos','das','de','da','do','em','no','na','nos','nas','e','ou','kit','produto','novo','original']);
  const words=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'N/A';
  const finite=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const norm=s=>words(s).join(' ');

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
    const description=(document.querySelector('#productValidation .description-preview')?.textContent||'').replace(/^Descrição:\s*/i,'').trim();
    return{
      title:document.querySelector('#productValidation .product-check-head strong')?.textContent?.trim()||'',
      description,descriptionLength:description.length,
      price:parseNumber(cellValue('Preço')),sold:parseNumber(cellValue('Itens vendidos')),rating:parseNumber(cellValue('Avaliação')),reviews:parseNumber(cellValue('Qtd. avaliações')),
      imageCount:parseNumber(cellValue('Imagens'))||0,hasVideo:/sim/i.test(cellValue('Vídeo')),variationCount:parseNumber(cellValue('Variações'))||0,
      attributesCount:0
    };
  }
  function selectedBasic(){
    return[...document.querySelectorAll('#competitorList .competitor.selected')].slice(0,3).map((row,index)=>{
      const title=row.querySelector('strong')?.textContent?.trim()||`Concorrente ${index+1}`;
      const info=row.querySelector('small')?.textContent||'';
      return{index:index+1,title,price:parseNumber(info.match(/R\$\s*[\d.,]+/)?.[0]),rating:parseNumber(info.match(/[\d.,]+(?=\s*★)/)?.[0]),sold:parseNumber(info.match(/[\d.,]+\s*(?:mil|k)?\+?(?=\s*vendid)/i)?.[0])};
    });
  }
  async function selectedCompetitors(){
    const basic=selectedBasic();
    let deep=[];
    try{
      const stored=await chrome.storage.local.get(DEEP_KEY),box=stored?.[DEEP_KEY];
      if(box&&Date.now()-Number(box.createdAt||0)<30*60*1000&&Array.isArray(box.items))deep=box.items;
    }catch{}
    if(!deep.length)return basic;
    const used=new Set();
    return basic.map((b,i)=>{
      let idx=deep.findIndex((d,j)=>!used.has(j)&&norm(d.title)===norm(b.title));if(idx<0)idx=deep.findIndex((_d,j)=>!used.has(j));
      const d=idx>=0?deep[idx]:null;if(idx>=0)used.add(idx);if(!d)return b;
      return{...b,...d,index:i+1,title:d.title||b.title,price:finite(d.price)??b.price,rating:finite(d.rating)??b.rating,sold:finite(d.sold)??b.sold,imageCount:finite(d.imageCount)??0,variationCount:finite(d.variationCount)??0,attributesCount:finite(d.attributesCount)??0,descriptionLength:finite(d.descriptionLength)??String(d.description||'').length,offerSignals:Array.isArray(d.offerSignals)?d.offerSignals:[],offerComposition:Array.isArray(d.offerComposition)?d.offerComposition:[],variationDetails:Array.isArray(d.variationDetails)?d.variationDetails:[],imageUrls:Array.isArray(d.imageUrls)?d.imageUrls:[]};
    });
  }
  function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
  function avg(values){const a=values.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;}
  function recurringTerms(comps){
    const freq=new Map();for(const c of comps){const seen=new Set(words(c.title).filter(w=>w.length>=4&&!STOP.has(w)));for(const w of seen)freq.set(w,(freq.get(w)||0)+1);}
    return[...freq.entries()].filter(([,count])=>count>=Math.min(2,comps.length)).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([term,count])=>({term,count}));
  }
  function recurringSignals(comps){
    const freq=new Map();for(const c of comps){for(const s of new Set(c.offerSignals||[]))freq.set(s,(freq.get(s)||0)+1);}
    return[...freq.entries()].sort((a,b)=>b[1]-a[1]).map(([signal,count])=>({signal,count}));
  }
  function analyze(own,comps){
    const ownTerms=new Set(words(own.title)),common=recurringTerms(comps),missing=common.filter(x=>!ownTerms.has(x.term)).slice(0,5).map(x=>x.term),medPrice=median(comps.map(c=>c.price));
    const profiles=comps.map(c=>{
      const traits=[];
      if(Number.isFinite(c.price)&&Number.isFinite(own.price)&&own.price>0){const d=(c.price-own.price)/own.price;if(d<=-.10)traits.push('preço mais agressivo');else if(d>=.10)traits.push('preço mais alto');else traits.push('preço semelhante ao seu');}
      if(Number.isFinite(c.sold)){if(c.sold>=1000)traits.push('alto volume vendido');else if(c.sold>=100)traits.push('volume relevante de vendas');else if(c.sold>0)traits.push('já possui tração');}
      if(Number.isFinite(c.rating)){if(c.rating>=4.8)traits.push('reputação muito forte');else if(c.rating>=4.5)traits.push('boa reputação');}
      if(c.imageCount>=7)traits.push(`galeria ampla (${c.imageCount} imagens)`);else if(c.imageCount>0)traits.push(`${c.imageCount} imagens`);
      if(c.hasVideo)traits.push('usa vídeo');
      if(c.variationCount>1)traits.push(`${c.variationCount} variações`);
      if(c.attributesCount>=5)traits.push(`${c.attributesCount} atributos preenchidos`);
      if(c.descriptionLength>=700)traits.push('descrição detalhada');else if(c.descriptionLength>=300)traits.push('descrição intermediária');
      if(c.offerSignals?.length)traits.push(`oferta: ${c.offerSignals.slice(0,4).join(', ')}`);
      const unique=words(c.title).filter(w=>w.length>=4&&!STOP.has(w)&&!ownTerms.has(w)).slice(0,4);if(unique.length)traits.push(`termos diferentes: ${unique.join(', ')}`);
      return{...c,traits};
    });

    const recommendations=[];
    if(missing.length)recommendations.push({area:'Título',text:`Os concorrentes repetem “${missing.join(', ')}”. Use apenas os termos que realmente descrevem o seu produto e que ajudam o comprador a entender a oferta.`});
    if(Number.isFinite(own.price)&&Number.isFinite(medPrice)){
      const d=(own.price-medPrice)/medPrice;
      if(d>.10)recommendations.push({area:'Preço + diferenciação',text:`Seu preço está ${(d*100).toFixed(1)}% acima da mediana (${money(medPrice)}). Antes de reduzir, deixe os diferenciais visíveis nas primeiras imagens, no título e na descrição.`});
      else if(d<-.10)recommendations.push({area:'Margem',text:`Seu preço está ${Math.abs(d*100).toFixed(1)}% abaixo da mediana (${money(medPrice)}). Preserve a margem e evite baixar só porque um concorrente vende barato.`});
      else recommendations.push({area:'Preço',text:`Seu preço está perto da mediana (${money(medPrice)}). A disputa tende a depender mais de apresentação, confiança e composição da oferta.`});
    }
    const compDesc=profiles.map(c=>c.descriptionLength).filter(Number.isFinite),descAvg=avg(compDesc),descMax=compDesc.length?Math.max(...compDesc):null;
    if(Number.isFinite(descMax)&&descMax>=350&&own.descriptionLength<descMax*.7)recommendations.push({area:'Descrição',text:`Os concorrentes chegam a ${descMax.toLocaleString('pt-BR')} caracteres de descrição${Number.isFinite(descAvg)?` (média ${Math.round(descAvg).toLocaleString('pt-BR')})`:''}. Sua descrição tem ${own.descriptionLength}. Vale enriquecer benefícios, medidas, conteúdo do kit, dúvidas frequentes e instruções reais do produto.`});
    const maxImages=Math.max(0,...profiles.map(c=>finite(c.imageCount)||0));
    if(maxImages>own.imageCount)recommendations.push({area:'Imagens',text:`Há concorrente usando ${maxImages} imagens e seu anúncio tem ${own.imageCount}. Avalie completar a galeria com capa clara, conteúdo do kit, medidas, detalhes, uso real e diferenciais. A análise compara estrutura/quantidade da galeria, não inventa características visuais.`});
    const videoUsers=profiles.filter(c=>c.hasVideo).length;
    if(!own.hasVideo&&videoUsers)recommendations.push({area:'Vídeo',text:`${videoUsers} dos ${profiles.length} concorrentes analisados usam vídeo. Um vídeo curto mostrando o produto real, tamanho, conteúdo e uso pode reduzir dúvidas e aumentar confiança.`});
    const maxVariations=Math.max(0,...profiles.map(c=>finite(c.variationCount)||0));
    if(maxVariations>own.variationCount)recommendations.push({area:'Variações',text:`Os concorrentes chegam a ${maxVariations} variações; seu anúncio mostra ${own.variationCount}. Se houver opções reais do produto que hoje estão separadas ou pouco claras, avalie organizá-las em variações sem criar opções artificiais.`});
    const maxAttrs=Math.max(0,...profiles.map(c=>finite(c.attributesCount)||0));
    if(maxAttrs>=5&&maxAttrs>own.attributesCount)recommendations.push({area:'Atributos',text:`Alguns concorrentes têm até ${maxAttrs} atributos estruturados. Preencher material, tamanho, faixa etária, quantidade, cor e demais atributos verdadeiros ajuda a busca e reduz dúvida do comprador.`});
    const signals=recurringSignals(profiles),recurring=signals.filter(x=>x.count>=Math.min(2,profiles.length)).slice(0,5);
    if(recurring.length)recommendations.push({area:'Composição da oferta',text:`Elementos que aparecem repetidamente nas ofertas: ${recurring.map(x=>`${x.signal} (${x.count}/${profiles.length})`).join(', ')}. Veja quais fazem sentido para o seu produto e para sua margem; não copie promessa, brinde ou condição que você não oferece.`});
    const soldRows=profiles.filter(c=>Number.isFinite(c.sold));
    if(soldRows.length){
      const top=soldRows.reduce((a,b)=>a.sold>=b.sold?a:b),clues=[];
      if(top.hasVideo)clues.push('vídeo');if(top.imageCount)clues.push(`${top.imageCount} imagens`);if(top.variationCount>1)clues.push(`${top.variationCount} variações`);if(top.descriptionLength>=300)clues.push('descrição detalhada');if(top.offerSignals?.length)clues.push(top.offerSignals.slice(0,3).join(', '));
      if((!Number.isFinite(own.sold)||top.sold>own.sold)&&clues.length)recommendations.push({area:'Pistas do mais vendido',text:`O concorrente com maior tração (${top.sold.toLocaleString('pt-BR')} vendidos) também apresenta ${clues.join(' · ')}. Isso não prova causalidade, mas aponta elementos concretos para você testar no seu anúncio.`});
    }
    const ratingRows=profiles.filter(c=>Number.isFinite(c.rating));if(ratingRows.length){const best=ratingRows.reduce((a,b)=>a.rating>=b.rating?a:b);if(!Number.isFinite(own.rating)||best.rating>own.rating)recommendations.push({area:'Prova social',text:`Há concorrente com avaliação ${best.rating.toFixed(1)}. Reforce confiança com produto fiel às imagens, atendimento, respostas a dúvidas e pós-venda.`});}
    if(!recommendations.length)recommendations.push({area:'Monitoramento',text:'Os concorrentes estão muito próximos do seu anúncio nos dados disponíveis. Continue acompanhando preço, vendas, conteúdo e reputação antes de alterar a oferta.'});
    return{profiles,recommendations:recommendations.slice(0,9)};
  }
  function thumbnails(p){
    const imgs=(p.imageUrls||[]).slice(0,3);if(!imgs.length)return'';
    return`<div style="display:flex;gap:5px;margin-top:6px">${imgs.map(u=>`<img src="${esc(u)}" alt="" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid var(--wizard-line)">`).join('')}</div>`;
  }
  function variationText(p){
    const parts=(p.variationDetails||[]).slice(0,3).map(v=>`${v.name}: ${(v.options||[]).slice(0,6).join(', ')}`).filter(Boolean);
    return parts.length?parts.join(' • '):'';
  }
  function render(result,comps){
    const anchor=document.getElementById('raySummary');if(!anchor)return;document.getElementById('competitorAiReview')?.remove();
    const profiles=result.profiles.map(p=>{
      const deep=p.deepCollected?'<span class="pill">leitura profunda</span>':'<span class="pill">leitura básica</span>';
      const meta=[p.price!=null?money(p.price):'Preço N/A',p.sold!=null?`${p.sold.toLocaleString('pt-BR')} vendidos`:null,p.rating!=null?`${p.rating.toFixed(1)}★`:null].filter(Boolean).join(' · ');
      const content=[`${p.imageCount||0} imagens`,p.hasVideo?'vídeo: sim':'vídeo: não',`${p.variationCount||0} variações`,`${p.attributesCount||0} atributos`,`${p.descriptionLength||0} caracteres na descrição`].join(' · ');
      const vars=variationText(p),offer=(p.offerComposition||[]).slice(0,3);
      return`<div style="padding:9px 0;border-bottom:1px solid var(--wizard-line)"><div class="row"><b>Concorrente ${p.index}</b>${deep}</div><div style="font-size:10px;color:var(--wizard-muted);margin-top:3px">${esc(p.title.slice(0,120))}</div><div style="font-size:10px;margin-top:4px">${esc(meta)}</div>${thumbnails(p)}<div style="font-size:9.5px;color:var(--wizard-muted);margin-top:5px">${esc(content)}</div>${vars?`<div style="font-size:9.5px;color:var(--wizard-muted);margin-top:3px"><b>Variações:</b> ${esc(vars)}</div>`:''}${offer.length?`<div style="font-size:9.5px;color:var(--wizard-muted);margin-top:3px"><b>Oferta/descrição:</b> ${offer.map(esc).join(' • ')}</div>`:''}<div style="font-size:9.5px;color:var(--wizard-muted);margin-top:4px"><b>Leitura:</b> ${esc(p.traits.length?p.traits.join(' · '):'Sem característica forte confirmada.')}</div>${p.deepError?`<div style="font-size:9px;color:var(--wizard-muted);margin-top:3px">Detalhe não coletado: ${esc(p.deepError)}</div>`:''}</div>`;
    }).join('');
    const recs=result.recommendations.map((r,i)=>`<div style="padding:8px 0;border-bottom:1px solid var(--wizard-line)"><b style="font-size:10px">${i+1}. ${esc(r.area)}</b><div style="font-size:10px;color:var(--wizard-muted);line-height:1.45;margin-top:3px">${esc(r.text)}</div></div>`).join('');
    const deepCount=comps.filter(c=>c.deepCollected).length;
    const card=document.createElement('div');card.id='competitorAiReview';card.className='card compact-card';
    card.innerHTML=`<div class="row"><b>🧠 IA — Análise profunda dos concorrentes</b><span class="pill">${deepCount}/${comps.length} completos</span></div><p class="muted" style="font-size:10px;line-height:1.45">O Gestor abriu os concorrentes em segundo plano e comparou título, descrição, estrutura da galeria, presença de vídeo, variações, atributos, preço, vendas, avaliação e composição textual da oferta. Sugestões são pistas para teste, não prova de que um elemento sozinho causou mais vendas.</p><div style="margin-top:8px"><b style="font-size:11px">Raio-X dos concorrentes</b>${profiles}</div><div style="margin-top:10px"><b style="font-size:11px">Sugestões para o seu anúncio</b>${recs}</div>`;
    anchor.insertAdjacentElement('afterend',card);
  }
  async function run(){
    const comps=await selectedCompetitors();if(!comps.length)return;render(analyze(ownProduct(),comps),comps);
  }
  function init(){
    const version=document.querySelector('.version');if(version)version.textContent='v0.12.9';
    const wizardInfo=document.querySelector('#tab-analyze .wizard-head .muted');if(wizardInfo)wizardInfo.textContent=wizardInfo.textContent.replace(/v\d+\.\d+\.\d+/,'v0.12.9');
    document.getElementById('step3Next')?.addEventListener('click',()=>setTimeout(()=>run().catch(()=>{}),140));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
