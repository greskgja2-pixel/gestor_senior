'use client';

import {useEffect} from 'react';

const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const money=v=>num(v)==null?'—':num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>num(v)==null?'—':`${num(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const safeArray=v=>Array.isArray(v)?v:[];
const setText=(el,text)=>{if(el&&String(el.textContent||'')!==String(text))el.textContent=text;};
function parseMoneyInput(raw){const s=String(raw??'').replace(/R\$/gi,'').replace(/\s/g,'').trim();if(!s)return null;let normalized=s;if(s.includes(',')&&s.includes('.')){normalized=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');}else if(s.includes(',')){normalized=s.replace(/\./g,'').replace(',','.');}else if((s.match(/\./g)||[]).length===1&&/\.\d{1,2}$/.test(s)){normalized=s;}else{normalized=s.replace(/\./g,'');}const value=Number(normalized);return Number.isFinite(value)?value:null;}

function financeCalc({price,cost,finance={},metrics={},ads={}}){
  const sale=num(price),productCost=num(cost);
  if(!(sale>0)||productCost==null||productCost<0)return null;
  const commissionRate=num(finance.commissionRate)??0.20;
  const fixedFee=num(finance.fixedFee)??4;
  const packagingCost=num(finance.packagingCost)??0;
  const taxRate=num(finance.taxRate)??0;
  const otherCost=num(finance.otherCost)??0;
  const adsCostPerSale=Math.max(0,num(metrics.cpa??ads.costPerOrder??finance.adsCostPerSale)??0);
  const commission=sale*commissionRate;
  const tax=sale*taxRate;
  const profit=sale-commission-tax-fixedFee-packagingCost-otherCost-adsCostPerSale-productCost;
  const marginPct=profit/sale*100;
  return {sale,productCost,commissionRate,commission,fixedFee,packagingCost,taxRate,tax,otherCost,adsCostPerSale,profit,marginPct};
}

function proofLine(name,calc){
  const parts=[money(calc.sale),`comissão ${pct(calc.commissionRate*100)} (${money(calc.commission)})`,`taxa fixa ${money(calc.fixedFee)}`,`custo ${money(calc.productCost)}`];
  if(calc.packagingCost>0)parts.push(`embalagem ${money(calc.packagingCost)}`);
  if(calc.tax>0)parts.push(`impostos ${money(calc.tax)}`);
  if(calc.otherCost>0)parts.push(`outros ${money(calc.otherCost)}`);
  if(calc.adsCostPerSale>0)parts.push(`Ads/venda ${money(calc.adsCostPerSale)}`);
  const equation=`${parts[0]} - ${parts.slice(1).join(' - ')} = lucro ${money(calc.profit)}`;
  return `${name?`${name}: `:''}${equation} · margem ${pct(calc.marginPct)}`;
}

function variationRows(meta){
  const p=meta?.productSnapshot||{};
  const raw=safeArray(p.variations).length?safeArray(p.variations):safeArray(p.models);
  const costs=safeArray(p.variationCosts);
  return raw.map((v,i)=>{
    const id=String(v?.modelId??v?.model_id??v?.id??i);
    const costRow=costs.find(c=>String(c?.modelId??c?.model_id)===id);
    return {id,name:v?.name||v?.modelName||v?.model_name||v?.variation||`Variação ${i+1}`,price:num(v?.price??v?.currentPrice??v?.current_price),cost:num(v?.cost??costRow?.cost),profit:num(v?.profit??v?.marginR),marginPct:num(v?.marginPct??v?.margin_pct)};
  });
}

function calcSummary(meta){
  const vars=variationRows(meta),finance=meta?.financeSnapshot||{},metrics=meta?.metrics||{},ads=meta?.adsSnapshot||{},p=meta?.productSnapshot||{};
  if(vars.length){
    const calcs=vars.map(v=>({...v,calc:financeCalc({price:v.price,cost:v.cost,finance,metrics,ads})}));
    if(calcs.some(v=>!v.calc)){
      const missing=calcs.filter(v=>!v.calc).map(v=>v.name).join(', ');
      return {valid:false,text:'—',profitText:'—',proof:`Margem não calculada. Falta preço ou custo válido em: ${missing}.`};
    }
    const margins=calcs.map(v=>v.calc.marginPct),profits=calcs.map(v=>v.calc.profit),minM=Math.min(...margins),maxM=Math.max(...margins),minP=Math.min(...profits),maxP=Math.max(...profits);
    const proof=calcs.map(v=>proofLine(v.name,v.calc)).join('\n');
    return {valid:true,text:Math.abs(maxM-minM)<.01?pct(minM):`${pct(minM)} – ${pct(maxM)}`,profitText:Math.abs(maxP-minP)<.01?money(minP):`${money(minP)} – ${money(maxP)}`,proof};
  }
  const price=num(metrics.price??p.price),calc=financeCalc({price,cost:finance.productCost,finance,metrics,ads});
  if(!calc)return {valid:false,text:'—',profitText:'—',proof:'Margem não calculada. É necessário ter preço e custo válidos.'};
  const proof=`${proofLine('',calc)}\nMargem = ${money(calc.profit)} ÷ ${money(calc.sale)} = ${pct(calc.marginPct)}`;
  return {valid:true,text:pct(calc.marginPct),profitText:money(calc.profit),proof};
}

async function api(body){
  const r=await fetch('/api/extension-intelligence/manual-price',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j?.error)throw new Error(j?.error||`HTTP ${r.status}`);
  return j;
}

function itemIdFromArticle(article){const m=String(article?.innerText||'').match(/\bID\s*:?[\s\u00a0]*(\d{6,})\b/i);return m?.[1]||null;}
function headerMetric(article,label){return [...article.querySelectorAll('span')].find(el=>el.closest('button')&&[...el.children].some(x=>x.tagName==='SMALL'&&String(x.textContent||'').trim()===label));}

export default function MarginPriceEnhancements({items=[]}){
  useEffect(()=>{
    const metadata=new Map((items||[]).map(x=>[String(x.itemId),x]));
    const style=document.createElement('style');style.dataset.gsMarginPrice='1';style.textContent=`
      .gs-price-edit{display:inline-flex;align-items:center;justify-content:center;margin-left:5px;width:22px;height:22px;border:1px solid #bfd4ed;border-radius:7px;background:#fff;color:#1764c8;font-weight:900;cursor:pointer;vertical-align:middle}
      .gs-price-edit:hover{background:#eef6ff;border-color:#79aef0}
      .gs-margin-proof{cursor:help;text-decoration:underline dotted #7b91a8;text-underline-offset:3px}
      .gs-margin-missing{color:#7a8795!important}
    `;document.head.appendChild(style);
    let timer=null;
    const toast=text=>{let b=document.getElementById('gs-margin-toast');if(!b){b=document.createElement('div');b.id='gs-margin-toast';Object.assign(b.style,{position:'fixed',right:'24px',bottom:'24px',zIndex:'99999',background:'#0f2947',color:'#fff',padding:'11px 14px',borderRadius:'10px',font:'600 12px system-ui',boxShadow:'0 8px 24px #0003'});document.body.appendChild(b);}setText(b,text);clearTimeout(b.__timer);b.__timer=setTimeout(()=>b.remove(),3200);};

    const sync=()=>{
      document.querySelectorAll('#super-anuncio-dashboard article').forEach(article=>{
        const itemId=itemIdFromArticle(article),meta=metadata.get(String(itemId||''));if(!meta)return;
        const vars=variationRows(meta),priceCell=headerMetric(article,'Preço'),priceB=priceCell?.querySelector('b');
        const allVarPrices=vars.length>0&&vars.every(v=>num(v.price)>0),singlePrice=num(meta?.metrics?.price??meta?.productSnapshot?.price);
        const priceValid=vars.length?allVarPrices:singlePrice>0;
        if(priceB){
          if(vars.length&&allVarPrices){const vals=vars.map(v=>v.price),min=Math.min(...vals),max=Math.max(...vals);setText(priceB,Math.abs(max-min)<.001?money(min):`${money(min)} – ${money(max)}`);}
          else if(!vars.length&&singlePrice>0)setText(priceB,money(singlePrice));
          else setText(priceB,'—');
        }
        if(priceCell&&!priceValid&&!priceCell.querySelector('[data-gs-price-edit]')){
          const edit=document.createElement('span');edit.dataset.gsPriceEdit='1';edit.className='gs-price-edit';edit.textContent='✎';edit.title=vars.length?'Informar os preços das variações manualmente':'Informar o preço correto manualmente';edit.tabIndex=0;edit.setAttribute('role','button');
          const handle=async e=>{e.preventDefault();e.stopPropagation();try{
            if(vars.length){const rows=[];for(const v of vars){const raw=window.prompt(`Preço atual da variação “${v.name}” (R$):`,v.price>0?String(v.price).replace('.',','):'');if(raw===null)return;const price=parseMoneyInput(raw);if(!(price>0)){toast('Digite um preço válido maior que zero.');return;}rows.push({model_id:v.id,price});}setText(edit,'…');await api({report_id:meta.reportId,variation_prices:rows});}
            else{const raw=window.prompt('Preço atual correto do produto (R$):',singlePrice>0?String(singlePrice).replace('.',','):'');if(raw===null)return;const price=parseMoneyInput(raw);if(!(price>0)){toast('Digite um preço válido maior que zero.');return;}setText(edit,'…');await api({report_id:meta.reportId,price});}
            window.location.reload();
          }catch(err){setText(edit,'✎');toast(`Erro ao salvar preço: ${String(err?.message||err)}`);}};
          edit.addEventListener('click',handle);edit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')handle(e);});priceB?.insertAdjacentElement('afterend',edit);
        }

        const summary=calcSummary(meta),marginCell=headerMetric(article,'Margem'),marginB=marginCell?.querySelector('b');
        if(marginB){setText(marginB,summary.text);marginB.title=summary.proof;marginB.classList.add('gs-margin-proof');marginB.classList.toggle('gs-margin-missing',!summary.valid);}

        [...article.querySelectorAll('small')].filter(x=>String(x.textContent||'').trim()==='Margem %').forEach(label=>{const box=label.parentElement,b=box?.querySelector('b');if(b){setText(b,summary.text);b.title=summary.proof;b.classList.add('gs-margin-proof');}});
        [...article.querySelectorAll('small')].filter(x=>String(x.textContent||'').trim()==='Margem R$').forEach(label=>{const box=label.parentElement,b=box?.querySelector('b');if(b){setText(b,summary.profitText);b.title=summary.proof;b.classList.add('gs-margin-proof');}});
        article.querySelectorAll('tbody tr').forEach(row=>{const cells=row.querySelectorAll(':scope > td');if(!cells.length)return;const label=String(cells[0].textContent||'').trim();if(label==='Margem %'&&cells[2]){setText(cells[2],summary.text);cells[2].title=summary.proof;cells[2].classList.add('gs-margin-proof');}if(label==='Margem R$'&&cells[2]){setText(cells[2],summary.profitText);cells[2].title=summary.proof;cells[2].classList.add('gs-margin-proof');}});
      });
    };
    const root=document.getElementById('super-anuncio-dashboard')||document.body,obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(sync,40);});obs.observe(root,{childList:true,subtree:true});sync();
    return()=>{obs.disconnect();clearTimeout(timer);style.remove();document.getElementById('gs-margin-toast')?.remove();};
  },[items]);
  return null;
}
