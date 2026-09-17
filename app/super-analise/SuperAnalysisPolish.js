'use client';

import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';

const safeArray=v=>Array.isArray(v)?v:[];
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const SCORE_KEYS={title:['título','titulo'],description:['descrição','descricao'],images:['imagem'],video:['vídeo','video'],category:['categoria'],price:['preço','preco','concorr'],variations:['atributo','varia']};
const LABELS={title:'Título',description:'Descrição',images:'Imagens',video:'Vídeo',category:'Categoria',price:'Preço',variations:'Atributos'};

function findScore(report,terms){
  const row=safeArray(report?.report?.dimensions).find(d=>terms.some(t=>String(d?.name||'').toLowerCase().includes(t)));
  if(!row)return null;
  const score=num(row.score),max=num(row.maxScore)||100;
  return score==null?null:Math.round(Math.max(0,Math.min(100,score/max*100)));
}
function Gauge({score,label}){
  const s=num(score);
  return <div className="gsPolishGaugeWrap"><div className="gsPolishGauge" style={{'--gs-p':`${Math.max(0,Math.min(100,s||0))*1.8}deg`}}><b>{s==null?'—':Math.round(s)}</b><small>/100</small></div><span>{label}</span></div>;
}
function suggestionCard(){
  const heading=[...document.querySelectorAll('main h3')].find(h=>/^\s*✦?\s*Sugestão completa da IA/i.test(h.textContent||''));
  return heading?.closest('div')||null;
}
function setTextarea(ta,value){
  if(!ta)return;
  const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
  setter?.call(ta,value);ta.dispatchEvent(new Event('input',{bubbles:true}));
}

export default function SuperAnalysisPolish({report}){
  const initial=report?.report?.ai_analysis||report?.suggestions?.ai||null;
  const [analysis,setAnalysis]=useState(initial);
  const [mount,setMount]=useState(null);
  const before=useMemo(()=>Object.fromEntries(Object.entries(SCORE_KEYS).map(([k,t])=>[k,findScore(report,t)])),[report]);
  const after=analysis?.afterScores||{};

  useEffect(()=>{
    const original=window.fetch;
    window.fetch=async(...args)=>{
      const res=await original(...args);
      try{const url=String(args?.[0]?.url||args?.[0]||'');if(url.includes('/api/ai/super-analysis')&&res.ok){const json=await res.clone().json();if(json?.analysis)setAnalysis(json.analysis);}}catch{}
      return res;
    };
    return()=>{window.fetch=original;};
  },[]);

  useEffect(()=>{
    const ensure=()=>{
      const heading=[...document.querySelectorAll('main h3')].find(x=>/Por que a IA sugeriu/i.test(x.textContent||''));
      const section=heading?.closest('section');if(!section?.parentElement)return;
      let host=document.getElementById('gs-mockup-bottom-host');
      if(!host){host=document.createElement('div');host.id='gs-mockup-bottom-host';section.insertAdjacentElement('afterend',host);}setMount(host);
    };
    ensure();const mo=new MutationObserver(ensure);mo.observe(document.body,{childList:true,subtree:true});return()=>mo.disconnect();
  },[]);

  useEffect(()=>{
    const ready=()=>{document.documentElement.dataset.gsExtensionBridge='ready';};
    const check=()=>{if(document.getElementById('gs-extension-bridge-marker')||document.documentElement?.dataset?.gsExtensionBridge==='ready')ready();};
    const message=e=>{if(e.source===window&&e.data?.source==='GS_EXTENSION'&&e.data?.type==='GS_EXTENSION_READY')ready();};
    window.addEventListener('gs-extension-ready',ready);window.addEventListener('message',message);check();
    const timer=setInterval(()=>{check();window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin);},800);
    return()=>{clearInterval(timer);window.removeEventListener('gs-extension-ready',ready);window.removeEventListener('message',message);};
  },[]);

  useEffect(()=>{
    if(analysis)return;
    const clean=()=>{const card=suggestionCard();const ta=card?.querySelector('textarea');if(ta?.value)setTextarea(ta,'');};
    const id=setTimeout(clean,60);const mo=new MutationObserver(()=>setTimeout(clean,0));mo.observe(document.body,{childList:true,subtree:true});
    return()=>{clearTimeout(id);mo.disconnect();};
  },[analysis]);

  useEffect(()=>{
    const install=()=>{
      const right=[...document.querySelectorAll('aside')].find(x=>/Nota geral do anúncio/i.test(x.textContent||''));if(!right)return;
      const gemini=[...right.querySelectorAll('button')].find(b=>/Analisar Tudo com Gemini|Gerar sugestões com Gemini|Reanalisar com Gemini/i.test(b.textContent||''));
      if(gemini)gemini.textContent=analysis?'↻ Reanalisar com Gemini':'✦ Gerar sugestões com Gemini';
      let apply=document.getElementById('gs-apply-all');
      if(!apply){apply=document.createElement('button');apply.id='gs-apply-all';apply.type='button';apply.className='gsApplyAll';(gemini||right.querySelector('button'))?.insertAdjacentElement('afterend',apply);}
      apply.textContent='✓ Aplicar tudo';apply.disabled=!analysis;apply.title=analysis?'Aplica todas as sugestões ao rascunho desta análise.':'Gere primeiro as sugestões do Gemini.';
      apply.onclick=()=>{
        if(!analysis)return;
        const draft={reportId:report?.id,itemId:report?.item_id,appliedAt:new Date().toISOString(),title:analysis?.title?.suggestion||null,description:analysis?.description?.suggestion||null,images:analysis?.images?.suggestion||null,video:analysis?.video?.suggestion||null,categorySearchTerms:safeArray(analysis?.category?.searchTerms),price:analysis?.price?.suggestion||null,variations:analysis?.variations?.suggestion||null};
        localStorage.setItem(`gs-applied-draft-${report?.id}`,JSON.stringify(draft));
        const sc=suggestionCard(),suggestion=sc?.querySelector('textarea'),compare=sc?.parentElement,textareas=compare?[...compare.querySelectorAll('textarea')]:[],original=textareas.find(x=>x!==suggestion);
        if(suggestion?.value&&original)setTextarea(original,suggestion.value);
        apply.textContent='✓ Aplicado ao rascunho';setTimeout(()=>{apply.textContent='✓ Aplicar tudo';},1600);
      };
    };
    install();const mo=new MutationObserver(install);mo.observe(document.body,{childList:true,subtree:true});return()=>mo.disconnect();
  },[analysis,report?.id,report?.item_id]);

  const improvements=Object.keys(SCORE_KEYS).map(key=>({key,before:before[key],after:num(after?.[key])})).filter(x=>x.before!=null&&x.after!=null&&x.after>x.before).sort((a,b)=>(b.after-b.before)-(a.after-a.before));
  const top=improvements.slice(0,4);
  const active=Object.entries(after).find(([,v])=>num(v)!=null)?.[0]||'title';
  const activeBefore=before[active]??report?.score,activeAfter=num(after?.[active]);

  return <>
    <style jsx global>{`
      #gs-mockup-bottom-host{margin-top:10px}.gsMockupBottom{display:grid;grid-template-columns:1.05fr 1.35fr 1.35fr;gap:10px}.gsMockCard{background:#fff;border:1px solid #dfe8f3;border-radius:12px;padding:12px;min-height:118px}.gsMockCard h4{margin:0 0 9px;font-size:11px;color:#24416d}.gsMockCard p{margin:5px 0;font-size:9px;line-height:1.4;color:#63738a}.gsMockCard ul{margin:0;padding:0;list-style:none}.gsMockCard li{font-size:9px;color:#4e6078;margin:5px 0}.gsMockCard li:before{content:'✓';color:#19a662;font-weight:900;margin-right:6px}.gsGaugePair{display:flex;align-items:center;justify-content:center;gap:14px}.gsGaugePair>span{font-weight:900;color:#77a0d4}.gsPolishGaugeWrap{display:flex;flex-direction:column;align-items:center;gap:2px}.gsPolishGauge{width:70px;height:39px;border-radius:70px 70px 0 0;overflow:hidden;position:relative;background:conic-gradient(from 270deg at 50% 100%,#ff9a48 0deg,#f5c34f 55deg,#47b970 var(--gs-p),#e8edf4 var(--gs-p) 180deg,transparent 180deg)}.gsPolishGauge:after{content:'';position:absolute;left:12px;right:12px;bottom:0;height:27px;background:#fff;border-radius:40px 40px 0 0}.gsPolishGauge b,.gsPolishGauge small{position:absolute;z-index:2;left:50%;transform:translateX(-50%)}.gsPolishGauge b{bottom:3px;font-size:18px;color:#21324d}.gsPolishGauge small{bottom:-6px;font-size:7px;color:#77859a}.gsPolishGaugeWrap>span{font-size:8px;color:#607086;font-weight:700}.gsImpactStrip{display:grid;grid-template-columns:1fr 1fr;gap:6px}.gsImpactMini{border:1px solid #e1e8f1;background:#f8fbff;border-radius:8px;padding:7px}.gsImpactMini b{display:block;font-size:9px;color:#225eb4}.gsImpactMini span{font-size:8px;color:#667890}.gsApplyAll{background:#1168e7!important;color:#fff!important;border-color:#1168e7!important}.gsApplyAll:disabled{opacity:.45!important;cursor:not-allowed!important}
      @media(min-width:1280px){main{min-width:0}.page_workspace__ucfd0{grid-template-columns:minmax(0,1fr) 245px!important;gap:10px!important}.page_compare__vUwm_{grid-template-columns:minmax(0,1fr) 38px minmax(0,1fr)!important}.page_productStrip__Rxft3{grid-template-columns:76px minmax(260px,1.4fr) minmax(620px,2.4fr)!important}}
      @media(max-width:1050px){.gsMockupBottom{grid-template-columns:1fr}.gsMockCard{min-height:auto}}
    `}</style>
    {mount&&createPortal(<div className="gsMockupBottom">
      <section className="gsMockCard"><h4>◉ Velocímetro da categoria: {LABELS[active]||'Análise'}</h4><div className="gsGaugePair"><Gauge score={activeBefore} label="Antes"/><span>→</span><Gauge score={activeAfter} label="Depois"/></div><p>{activeAfter!=null&&activeBefore!=null?`Impacto estimado: +${Math.max(0,Math.round(activeAfter-activeBefore))} pontos.`:'A nota depois será calculada pelo Gemini.'}</p></section>
      <section className="gsMockCard"><h4>✓ Melhorias detectadas nesta análise</h4>{top.length?<ul>{top.map(x=><li key={x.key}>{LABELS[x.key]}: +{Math.round(x.after-x.before)} pontos ({Math.round(x.before)} → {Math.round(x.after)})</li>)}</ul>:<p>Gere as sugestões do Gemini. Se seu anúncio já estiver melhor em um critério, o Gestor deve recomendar preservar em vez de inventar mudança.</p>}</section>
      <section className="gsMockCard"><h4>▥ Resumo do impacto no anúncio</h4><div className="gsImpactStrip">{Object.keys(SCORE_KEYS).slice(0,6).map(k=><div className="gsImpactMini" key={k}><b>{LABELS[k]}</b><span>{before[k]==null?'—':Math.round(before[k])} → {num(after?.[k])==null?'—':Math.round(num(after[k]))}</span></div>)}</div><p>A projeção mede qualidade estimada do anúncio, não promete aumento de vendas.</p></section>
    </div>,mount)}
  </>;
}
