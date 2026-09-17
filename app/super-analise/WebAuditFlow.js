'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import styles from './web-audit.module.css';

const money=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const uid=()=>`${Date.now()}-${Math.random().toString(36).slice(2)}`;

function engine(action,payload={},ms=30000){
  return new Promise((resolve,reject)=>{
    const requestId=uid();
    const timer=setTimeout(()=>{window.removeEventListener('message',onMessage);reject(new Error('O motor da extensão demorou demais para responder.'));},ms);
    function onMessage(event){
      if(event.source!==window||event.data?.source!=='GS_EXTENSION'||event.data?.type!=='GS_ENGINE_RESPONSE'||event.data?.requestId!==requestId)return;
      clearTimeout(timer);window.removeEventListener('message',onMessage);const r=event.data.result||{};r.ok?resolve(r.data??r):reject(new Error(r.error||'Falha no motor da extensão.'));
    }
    window.addEventListener('message',onMessage);
    window.postMessage({source:'GS_GESTOR',type:'GS_ENGINE_REQUEST',requestId,action,payload},location.origin);
  });
}

function Help({children}){return <span className={styles.help} title={children}>?</span>}
function Step({n:step,current,label}){const done=current>step,active=current===step;return <div className={`${styles.step} ${done?styles.done:''} ${active?styles.active:''}`}><span>{done?'✓':step}</span><small>{label}</small></div>}

export default function WebAuditFlow({initialUrl=''}){
  const [connected,setConnected]=useState(false),[version,setVersion]=useState('');
  const [step,setStep]=useState(1),[url,setUrl]=useState(initialUrl||''),[loading,setLoading]=useState(false),[message,setMessage]=useState(initialUrl?'Preparando a análise guiada deste produto…':'');
  const [bundle,setBundle]=useState(null),[objective,setObjective]=useState('Aumentar vendas'),[situation,setSituation]=useState('Vende bem'),[bottleneck,setBottleneck]=useState('Não sei');
  const [ads,setAds]=useState({roas:'',targetRoas:'',spend:''}),[baseCost,setBaseCost]=useState(''),[variationCosts,setVariationCosts]=useState([]);
  const [picker,setPicker]=useState(null),[competitors,setCompetitors]=useState([]),[analyzing,setAnalyzing]=useState(false);
  const pollRef=useRef(null),autoStartedRef=useRef(false);

  useEffect(()=>{
    const ready=e=>{if(e.source===window&&e.data?.source==='GS_EXTENSION'&&e.data?.type==='GS_EXTENSION_READY'){setConnected(true);setVersion(e.data.version||'');}};
    window.addEventListener('message',ready);window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin);
    const ping=setInterval(()=>window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin),1800);
    const stale=setInterval(()=>{const marker=document.querySelector('meta[name="gestor-senior-extension"]');if(marker){setConnected(true);setVersion(marker.content||'');}},1800);
    return()=>{clearInterval(ping);clearInterval(stale);clearInterval(pollRef.current);window.removeEventListener('message',ready);};
  },[]);

  useEffect(()=>{
    if(!initialUrl||!connected||autoStartedRef.current)return;
    autoStartedRef.current=true;
    loadProduct(initialUrl);
  },[connected,initialUrl]);

  const needsBase=bundle?.needsBaseCost!==false;
  const allVariationCosts=useMemo(()=>bundle?.models?.length>0&&bundle.models.every(m=>variationCosts.find(x=>String(x.modelId)===String(m.modelId))?.cost!==''&&n(variationCosts.find(x=>String(x.modelId)===String(m.modelId))?.cost)!=null),[bundle,variationCosts]);

  async function loadProduct(targetUrl=url){
    const chosen=String(targetUrl||url||'').trim();
    if(!chosen)return setMessage('Informe o link do anúncio da Shopee.');
    if(!connected)return setMessage('A extensão-motor não foi detectada. Recarregue a página depois de instalar/ativar a versão nova.');
    setUrl(chosen);setLoading(true);setMessage('Abrindo o anúncio em segundo plano e coletando os dados da Shopee…');
    try{
      const data=await engine('collectProduct',{url:chosen},45000);setBundle(data);setAds({roas:data.ads?.roas??'',targetRoas:data.ads?.targetRoas??'',spend:data.ads?.spend??''});setBaseCost(data.baseCost??'');setVariationCosts((data.variationCosts||[]).map(x=>({...x,cost:x.cost??''})));setStep(2);setMessage(data.adsTimedOut?'Anúncio carregado. Os Ads demoraram para responder; os campos ficaram liberados para edição manual.':'Anúncio carregado. Confira os dados, escolha objetivo/situação/gargalo e continue a análise guiada.');
    }catch(e){setMessage(String(e?.message||e));autoStartedRef.current=false;}finally{setLoading(false);}
  }

  async function saveAndContinue(){
    setLoading(true);setMessage('Salvando custos e preparando a seleção dos concorrentes…');
    try{
      await engine('saveCosts',{itemId:bundle.product.itemId,models:bundle.models||[],baseCost:baseCost===''?null:Number(baseCost),variationCosts:variationCosts.map(x=>({...x,cost:x.cost===''?null:Number(x.cost)}))},30000);
      setStep(3);setMessage('Agora escolha exatamente 3 concorrentes diretamente na busca da Shopee.');
    }catch(e){setMessage(String(e?.message||e));}finally{setLoading(false);}
  }

  async function openPicker(){
    setMessage('Abrindo a busca da Shopee. Se os botões “Selecionar” não aparecerem, use Recarregar abaixo.');
    try{
      const p=await engine('openCompetitorPicker',{title:bundle.product.title,itemId:bundle.product.itemId},15000);setPicker(p);clearInterval(pollRef.current);pollRef.current=setInterval(async()=>{try{const r=await engine('pickerResult',{requestId:p.requestId},8000);if(!r?.done)return;clearInterval(pollRef.current);setPicker(null);if(r.cancelled)return setMessage('Seleção cancelada. Você pode abrir a busca novamente.');setCompetitors(r.items||[]);setMessage(`${r.items?.length||0} concorrentes recebidos. Confira e clique em Analisar Tudo.`);}catch{}},1100);
    }catch(e){setMessage(String(e?.message||e));}
  }

  async function reloadPicker(){
    if(!picker)return openPicker();
    try{await engine('reloadCompetitorPicker',{requestId:picker.requestId},12000);setMessage('Busca recarregada. Aguarde alguns segundos para os botões “Selecionar” aparecerem.');}catch(e){setMessage(String(e?.message||e));}
  }

  async function analyzeAll(){
    if(competitors.length!==3)return setMessage('Selecione exatamente 3 concorrentes antes de analisar.');
    setAnalyzing(true);setMessage('Coletando descrição, imagens, vídeo, variações, atributos e oferta dos 3 concorrentes…');
    try{
      const result=await engine('analyzeAll',{product:bundle.product,models:bundle.models||[],objective,situation,bottleneck,ads:{...bundle.ads,roas:n(ads.roas),targetRoas:n(ads.targetRoas),spend:n(ads.spend)},baseCost:baseCost===''?null:Number(baseCost),variationCosts:variationCosts.map(x=>({...x,cost:x.cost===''?null:Number(x.cost)})),competitors},120000);
      setMessage('Coleta concluída. Abrindo a análise completa no Gestor…');
      const q=result.reportId?`?report_id=${encodeURIComponent(result.reportId)}`:`?item_id=${encodeURIComponent(result.itemId)}`;location.href=`/super-analise${q}`;
    }catch(e){setMessage(String(e?.message||e));setAnalyzing(false);}
  }

  function reset(){clearInterval(pollRef.current);autoStartedRef.current=true;setStep(1);setUrl('');setBundle(null);setAds({roas:'',targetRoas:'',spend:''});setBaseCost('');setVariationCosts([]);setCompetitors([]);setPicker(null);setMessage('');setAnalyzing(false);}

  const p=bundle?.product;
  return <div className={styles.screen}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><span>GS</span><div><b>Gestor Sênior</b><small>Shopee Intelligence</small></div></div>
      <nav><Link href="/">⌂ Dashboard</Link><Link href="/extensao-shopee-intelligence">▣ Super Anúncio</Link><Link className={styles.active} href="/super-analise">▤ Super Análise</Link><Link href="/produtos">▱ Produtos</Link><Link href="/extensao-shopee-intelligence#concorrentes">⌘ Concorrentes</Link><Link href="/extensao-shopee-intelligence">◎ Shopee Ads</Link><Link href="/extensao-shopee-intelligence#reanálises">↻ Reanálises</Link><Link href="/extensao-shopee-intelligence">☆ Prioridades</Link><Link href="/extensao-shopee-intelligence">▤ Relatórios</Link></nav>
      <div className={`${styles.engineCard} ${connected?styles.engineOn:styles.engineOff}`}><div><i/> <b>Motor da extensão</b></div><strong>{connected?`Conectado${version?` · v${version}`:''}`:'Desconectado'}</strong><small>A interface fica no Gestor. A extensão só coleta e executa tarefas na Shopee.</small></div>
    </aside>
    <main className={styles.main}>
      <header className={styles.header}><div><h1>✦ Super Análise</h1><p>Análise guiada no Gestor; a extensão trabalha apenas como motor de coleta.</p></div><button onClick={reset}>Recomeçar</button></header>
      <section className={styles.progress}><Step n={1} current={step} label="Anúncio"/><Step n={2} current={step} label="Contexto, Ads e custos"/><Step n={3} current={step} label="3 concorrentes"/><Step n={4} current={step} label="Analisar tudo"/></section>
      {message&&<div className={styles.message}>{message}</div>}

      {step===1&&<section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>1</span><h2>Carregar anúncio</h2></div><Help>A extensão abre o anúncio em segundo plano para ler os dados reais da Shopee sem você sair do Gestor.</Help></div><p>Cole o link do anúncio que será analisado.</p><div className={styles.row}><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://shopee.com.br/..."/><button className={styles.primary} disabled={loading||!url.trim()} onClick={()=>loadProduct()}>{loading?'Coletando…':'Carregar anúncio'}</button></div></section>}

      {step===2&&<><section className={styles.productCard}>{p?.imageUrl?<img src={p.imageUrl} alt=""/>:<div className={styles.noImg}/>}<div><b>{p?.title}</b><small>ID {p?.itemId} · {p?.category}</small></div><div className={styles.metrics}><span><small>Preço</small><b>{money(p?.price)}</b></span><span><small>Vendidos</small><b>{p?.sold??'—'}</b></span><span><small>Avaliação</small><b>{p?.rating??'—'} ★</b></span><span><small>Fotos</small><b>{p?.imageCount??'—'}</b></span><span><small>Variações</small><b>{p?.variationCount??0}</b></span></div></section><section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>2</span><h2>Objetivo, situação e gargalo</h2></div><Help>Essas respostas orientam o Gemini para não sugerir mudanças que contrariem sua meta ou prejudiquem a margem.</Help></div><div className={styles.three}><label>Objetivo principal<select value={objective} onChange={e=>setObjective(e.target.value)}><option>Aumentar vendas</option><option>Aumentar lucro</option><option>Melhorar ROAS</option><option>Ganhar posicionamento</option><option>Melhorar conversão</option></select></label><label>Situação atual<select value={situation} onChange={e=>setSituation(e.target.value)}><option>Vende bem</option><option>Vende pouco</option><option>Não vende</option><option>Está começando</option><option>Oscila muito</option></select></label><label>Principal gargalo<select value={bottleneck} onChange={e=>setBottleneck(e.target.value)}><option>Não sei</option><option>Poucos cliques</option><option>Pouca conversão</option><option>Preço</option><option>Margem</option><option>ROAS</option><option>Conteúdo do anúncio</option></select></label></div></section><div className={styles.twoCols}><section className={styles.card}><div className={styles.cardHead}><h2>Shopee Ads — últimos 7 dias</h2><Help>Os valores são buscados automaticamente. Se a Shopee não responder, você pode preencher manualmente.</Help></div><div className={styles.three}><label>ROAS<input type="number" step="0.01" value={ads.roas} onChange={e=>setAds({...ads,roas:e.target.value})}/></label><label>ROAS alvo<input type="number" step="0.01" value={ads.targetRoas} onChange={e=>setAds({...ads,targetRoas:e.target.value})}/></label><label>Gasto Ads R$<input type="number" step="0.01" value={ads.spend} onChange={e=>setAds({...ads,spend:e.target.value})}/></label></div></section><section className={styles.card}><div className={styles.cardHead}><h2>Custos</h2><Help>Quando todas as variações já têm custo, o Gestor não exige um custo unitário padrão.</Help></div>{needsBase&&!allVariationCosts&&<label>Custo unitário padrão R$<input type="number" min="0" step="0.01" value={baseCost} onChange={e=>setBaseCost(e.target.value)} placeholder="Ex.: 12,50"/></label>}{bundle.models?.length>0?<div className={styles.variations}><b>Custos por variação</b>{bundle.models.map(m=>{const row=variationCosts.find(x=>String(x.modelId)===String(m.modelId))||{modelId:m.modelId,name:m.name,cost:''};return <div key={m.modelId}><span><strong>{m.name}</strong><small>{m.sku||'Sem SKU'} · preço {money(m.price)}</small></span><input type="number" min="0" step="0.01" value={row.cost} onChange={e=>setVariationCosts(v=>v.map(x=>String(x.modelId)===String(m.modelId)?{...x,cost:e.target.value}:x))}/></div>})}</div>:<small className={styles.muted}>Este anúncio não possui variações.</small>}</section></div><div className={styles.actions}><button onClick={()=>setStep(1)}>‹ Voltar</button><button className={styles.primary} disabled={loading} onClick={saveAndContinue}>{loading?'Salvando…':'Continuar ›'}</button></div></>}

      {step===3&&<section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>3</span><h2>Selecione 3 concorrentes</h2></div><Help>A extensão abre uma busca normal da Shopee e injeta o botão “Selecionar” em cada anúncio. Você escolhe exatamente 3.</Help></div><p>A busca abre em outra aba. Depois de marcar os 3, clique em <b>Voltar para Análise</b> na própria Shopee.</p><div className={styles.actionsLeft}><button className={styles.primary} onClick={openPicker}>{picker?'Seleção aberta':'Abrir busca da Shopee'}</button><button onClick={reloadPicker}>↻ Recarregar botões</button></div>{competitors.length>0&&<div className={styles.competitors}>{competitors.map((c,i)=><article key={c.itemId||i}>{c.imageUrl?<img src={c.imageUrl} alt=""/>:<div className={styles.noImg}/>}<div><b>{i+1}. {c.title}</b><small>{money(c.price)} · {c.sold??'—'} vendidos · {c.rating??'—'} ★</small></div></article>)}</div>}<div className={styles.actions}><button onClick={()=>setStep(2)}>‹ Voltar</button><button className={styles.primary} disabled={competitors.length!==3} onClick={()=>setStep(4)}>Continuar ›</button></div></section>}

      {step===4&&<section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>4</span><h2>Pronto para analisar</h2></div><Help>Ao clicar, a extensão abre os 3 concorrentes em segundo plano e coleta descrição, imagens, vídeo, atributos, variações, preço, avaliações e sinais da oferta.</Help></div><div className={styles.reviewGrid}><article><small>Anúncio</small><b>{p?.title}</b><span>{money(p?.price)} · custo {baseCost!==''?money(baseCost):(allVariationCosts?'por variação':'—')}</span></article><article><small>Objetivo</small><b>{objective}</b><span>{situation} · {bottleneck}</span></article><article><small>Ads</small><b>ROAS {ads.roas||'—'} / alvo {ads.targetRoas||'—'}</b><span>Gasto {ads.spend!==''?money(ads.spend):'—'}</span></article><article><small>Concorrentes</small><b>3 selecionados</b><span>Coleta profunda será feita agora</span></article></div><div className={styles.finalBox}><b>O que acontece agora?</b><p>A extensão trabalha somente como motor. Ela coleta e salva o pacote técnico. Em seguida o Gestor abre a tela grande de análise, onde o Gemini compara original × sugestão, notas antes/depois, concorrentes e imagens.</p></div><div className={styles.actions}><button onClick={()=>setStep(3)}>‹ Voltar</button><button className={styles.primaryBig} disabled={analyzing} onClick={analyzeAll}>{analyzing?'Coletando e preparando…':'✦ Analisar Tudo'}</button></div></section>}
    </main>
  </div>;
}
