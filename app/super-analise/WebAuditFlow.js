'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import styles from './web-audit.module.css';
import {motorData,classifyAsyncError} from '../lib/client-async';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>n(v)==null?'—':`${n(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const ratingText=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const ratingDraft=v=>n(v)==null?'':n(v).toFixed(1);
const safe=v=>v===null||v===undefined?'':v;
const idFromUrl=value=>{try{const m=String(value||'').match(/\/product\/(\d+)\/(\d+)/);return m?{shopId:m[1],itemId:m[2]}:null}catch{return null}};
async function validatePublicProduct(targetUrl,product){
  const ids=idFromUrl(targetUrl); if(!ids?.itemId)return product;
  try{
    const res=await fetch(`/api/shopee/product-public?shop_id=${encodeURIComponent(ids.shopId)}&item_ids=${encodeURIComponent(ids.itemId)}`,{cache:'no-store'});
    const json=await res.json(); const real=json?.results?.find(x=>x?.ok);
    if(!res.ok||!real)return product;
    return {...product,
      price:real.price??product?.price,
      sold:real.historicalSold??product?.sold,
      rating:real.rating??product?.rating,
      reviewCount:real.reviewCount??product?.reviewCount,
      stock:real.stock??product?.stock,
      validationSource:'shopee_public_api'};
  }catch(e){console.warn('[Super Análise] validação pública indisponível',e);return product;}
}

function Help({children}){return <span className={styles.help} title={children}>?</span>}
function Step({n:step,current,label}){const done=current>step,active=current===step;return <div className={`${styles.step} ${done?styles.done:''} ${active?styles.active:''}`}><span>{done?'✓':step}</span><small>{label}</small></div>}
function EditableField({id,label,value,onChange,type='number',step='0.01',help}){return <label className={styles.editable}><span>{label}{help&&<Help>{help}</Help>}</span><div><input id={id} type={type} step={step} value={safe(value)} onChange={e=>onChange(e.target.value)}/><button type="button" className={styles.pencil} title="Editar manualmente" onClick={()=>document.getElementById(id)?.focus()}>✎</button></div></label>}
function feeCalc(price,cost,adsCostPerSale=0){
  const p=n(price),c=n(cost),adsValue=Math.max(0,n(adsCostPerSale)??0);
  if(p==null||p<=0||c==null)return null;
  const commissionRate=.20,fixedFee=4,commission=p*commissionRate;
  const profit=p-commission-fixedFee-c-adsValue;
  return {price:p,cost:c,commissionRate,commission,fixedFee,adsCostPerSale:adsValue,profit,margin:(profit/p)*100};
}
function estimatedMargin(price,cost,adsCostPerSale=0){return feeCalc(price,cost,adsCostPerSale)?.margin??null}
function marginSummary(price,cost,adsCostPerSale=0){
  const calc=feeCalc(price,cost,adsCostPerSale);
  if(!calc)return'Margem indisponível: falta preço ou custo válido.';
  const parts=[`Preço ${money(calc.price)}`,`20% Shopee (${money(calc.commission)})`,`taxa fixa ${money(calc.fixedFee)}`,`custo ${money(calc.cost)}`];
  if(calc.adsCostPerSale>0)parts.push(`Ads/venda ${money(calc.adsCostPerSale)}`);
  return `${parts[0]} − ${parts.slice(1).join(' − ')} = ${money(calc.profit)} de lucro · margem ${pct(calc.margin)}`;
}

export default function WebAuditFlow({initialUrl=''}){
  const [connected,setConnected]=useState(false),[version,setVersion]=useState('');
  const [step,setStep]=useState(1),[url,setUrl]=useState(initialUrl||''),[loading,setLoading]=useState(false),[message,setMessage]=useState(initialUrl?'Preparando a análise guiada deste produto…':'');
  const [bundle,setBundle]=useState(null),[productDraft,setProductDraft]=useState({});
  const [objective,setObjective]=useState('Aumentar vendas'),[situation,setSituation]=useState('Vende bem'),[bottleneck,setBottleneck]=useState('Não sei');
  const [ads,setAds]=useState({roas:'',targetRoas:'',spend:'',gmv:'',costPerSale:''});
  const [baseCost,setBaseCost]=useState(''),[variationCosts,setVariationCosts]=useState([]);
  const [picker,setPicker]=useState(null),[competitors,setCompetitors]=useState([]),[analyzing,setAnalyzing]=useState(false);
  const [operation,setOperation]=useState({status:'idle',message:''});
  const pollRef=useRef(null),pickerDeadlineRef=useRef(0),autoStartedRef=useRef(false);

  useEffect(()=>{
    let detected=false;
    const markReady=versionValue=>{detected=true;setConnected(true);if(versionValue)setVersion(versionValue)};
    const ready=e=>{if(e.source===window&&e.data?.source==='GS_EXTENSION'&&(e.data?.type==='GS_EXTENSION_READY'||e.data?.type==='GS_EXTENSION_PONG'))markReady(e.data.version||'')};
    const inspect=()=>{const meta=document.querySelector('meta[name="gestor-senior-extension"]');if(meta||document.documentElement?.dataset?.gsExtensionBridge==='ready'||document.getElementById('gs-extension-bridge-marker'))markReady(meta?.content||'');window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin)};
    window.addEventListener('message',ready);inspect();
    const ping=setInterval(inspect,1800);
    const missing=setTimeout(()=>{if(initialUrl&&!detected){setMessage('Motor Senior não detectado. Verifique se a extensão está ativa e tente novamente.');setOperation({status:'error',message:'A extensão não respondeu ao teste de conexão.'})}},8000);
    return()=>{clearInterval(ping);clearTimeout(missing);clearTimeout(pollRef.current);window.removeEventListener('message',ready)};
  },[initialUrl]);

  useEffect(()=>{if(!initialUrl||!connected||autoStartedRef.current)return;autoStartedRef.current=true;loadProduct(initialUrl);},[connected,initialUrl]);

  const models=bundle?.models||[];
  const allVariationCosts=useMemo(()=>models.length>0&&models.every(m=>n(variationCosts.find(x=>String(x.modelId)===String(m.modelId))?.cost)!=null),[models,variationCosts]);
  const needsBase=bundle?.needsBaseCost!==false&&!allVariationCosts;
  const variationMargins=useMemo(()=>models.map(m=>{const row=variationCosts.find(x=>String(x.modelId)===String(m.modelId));return{modelId:m.modelId,name:m.name||row?.name||'Variação',price:n(m.price),cost:n(row?.cost),margin:estimatedMargin(m.price,row?.cost)}}),[models,variationCosts,ads.costPerSale]);
  const p={...(bundle?.product||{}),...productDraft};

  async function loadProduct(targetUrl=url){
    const chosen=String(targetUrl||url||'').trim();
    if(!chosen){setOperation({status:'empty',message:'Informe o link do anúncio da Shopee.'});return setMessage('Informe o link do anúncio da Shopee.')}
    if(!connected){setOperation({status:'error',message:'Motor Senior não detectado.'});return setMessage('Motor Senior não detectado. Ative a extensão e tente novamente.')}
    setUrl(chosen);setLoading(true);setOperation({status:'loading',message:'Coletando dados reais do anúncio…'});setMessage('Motor Senior abrindo o anúncio e coletando os dados reais da Shopee…');
    try{
      const data=await motorData('collectProduct',{url:chosen},35000);
      if(!data?.product)throw Object.assign(new Error('O Motor Senior respondeu, mas não retornou os dados do anúncio.'),{code:'empty'});
      const validatedProduct=await validatePublicProduct(chosen,data.product);
      const validatedData={...data,product:validatedProduct};
      setBundle(validatedData);
      setProductDraft({price:safe(validatedProduct?.price),sold:safe(validatedProduct?.sold),rating:ratingDraft(validatedProduct?.rating),reviewCount:safe(validatedProduct?.reviewCount)});
      setAds({roas:safe(data.ads?.roas),targetRoas:safe(data.ads?.targetRoas),spend:safe(data.ads?.spend),gmv:safe(data.ads?.gmv),costPerSale:safe(data.ads?.costPerSale??data.ads?.cpa)});
      setBaseCost(safe(data.baseCost));
      setVariationCosts((data.variationCosts||[]).map(x=>({...x,cost:safe(x.cost)})));
      setStep(2);setOperation({status:'success',message:'Anúncio coletado com sucesso.'});
      setMessage(data.adsTimedOut?'Anúncio carregado. A coleta de Ads expirou; esses campos ficaram como não coletados e permanecem editáveis.':'Anúncio carregado. Confira os dados, custos e Ads antes de continuar.');
    }catch(e){
      console.error('[Super Análise] collectProduct falhou',e);
      const kind=e?.code==='empty'?'empty':classifyAsyncError(e);
      setOperation({status:kind,message:String(e?.message||e)});
      setMessage(kind==='timeout'?'A coleta excedeu 35 segundos. Você pode tentar novamente sem perder o produto selecionado.':String(e?.message||e));
      autoStartedRef.current=false;
    }finally{setLoading(false);}
  }

  async function saveAndContinue(){
    if(needsBase&&n(baseCost)==null)return setMessage('Informe o custo unitário padrão porque ainda existe item sem custo por variação.');
    if(models.length>0&&!allVariationCosts&&n(baseCost)==null)return setMessage('Preencha os custos das variações ou informe o custo padrão.');
    setLoading(true);setOperation({status:'loading',message:'Salvando custos…'});setMessage('Salvando custos e preparando a seleção dos concorrentes…');
    try{
      await motorData('saveCosts',{itemId:p.itemId,models,baseCost:n(baseCost),variationCosts:variationCosts.map(x=>({...x,cost:n(x.cost)}))},25000);
      setStep(3);setOperation({status:'success',message:'Custos salvos.'});setMessage('Agora escolha de 1 até 3 concorrentes. O Motor Senior abrirá a busca normal da Shopee.');
    }catch(e){console.error('[Super Análise] saveCosts falhou',e);const kind=classifyAsyncError(e);setOperation({status:kind,message:String(e?.message||e)});setMessage(kind==='timeout'?'O salvamento expirou. Tente novamente.':String(e?.message||e));}finally{setLoading(false);}
  }

  async function pollPickerResult(requestId){
    if(Date.now()>pickerDeadlineRef.current){
      clearTimeout(pollRef.current);setPicker(null);
      setOperation({status:'timeout',message:'A seleção de concorrentes excedeu 2 minutos.'});
      setMessage('A busca de concorrentes expirou. Você pode abrir a busca novamente.');
      return;
    }
    try{
      const r=await motorData('pickerResult',{requestId},8000);
      if(r?.done){
        clearTimeout(pollRef.current);setPicker(null);
        if(r.cancelled){setOperation({status:'empty',message:'Seleção cancelada.'});setMessage('Seleção cancelada. Você pode abrir a busca novamente.');return}
        const items=(r.items||[]).slice(0,3);setCompetitors(items);
        if(items.length>=1&&items.length<=3){setStep(4);setOperation({status:'success',message:'Concorrentes coletados.'});setMessage(`${items.length} concorrente(s) coletado(s) em profundidade. Você voltou para a mesma Super Análise; revise e clique em Analisar Tudo.`)}
        else{setOperation({status:'empty',message:'Nenhum concorrente recebido.'});setMessage('Nenhum concorrente foi recebido. Escolha pelo menos 1 e no máximo 3.')}
        return;
      }
    }catch(e){
      if(e?.code!=='timeout')console.warn('[Super Análise] consulta temporária do seletor falhou',e);
    }
    pollRef.current=setTimeout(()=>pollPickerResult(requestId),1500);
  }

  async function openPicker(){
    clearTimeout(pollRef.current);
    setOperation({status:'loading',message:'Abrindo busca de concorrentes…'});
    setMessage('Abrindo a busca da Shopee. Escolha de 1 a 3 concorrentes; ao voltar, o Motor Senior fará a coleta profunda antes de fechar a busca.');
    try{
      const req=await motorData('openCompetitorPicker',{title:p.title,itemId:p.itemId},15000);
      if(!req?.requestId)throw Object.assign(new Error('O seletor abriu sem um identificador de acompanhamento.'),{code:'empty'});
      setPicker(req);pickerDeadlineRef.current=Date.now()+120000;
      pollRef.current=setTimeout(()=>pollPickerResult(req.requestId),800);
    }catch(e){
      console.error('[Super Análise] openCompetitorPicker falhou',e);
      const kind=e?.code==='empty'?'empty':classifyAsyncError(e);
      setOperation({status:kind,message:String(e?.message||e)});
      setMessage(kind==='timeout'?'A abertura da busca expirou. Tente novamente.':String(e?.message||e));
    }
  }

  async function reloadPicker(){
    if(!picker)return openPicker();
    try{await motorData('reloadCompetitorPicker',{requestId:picker.requestId},12000);setOperation({status:'success',message:'Busca recarregada.'});setMessage('Busca recarregada. Aguarde alguns segundos para os botões “Selecionar” aparecerem.');}catch(e){console.error('[Super Análise] reload picker falhou',e);const kind=classifyAsyncError(e);setOperation({status:kind,message:String(e?.message||e)});setMessage(kind==='timeout'?'A recarga da busca expirou. Tente novamente.':String(e?.message||e));}
  }

  async function analyzeAll(){
    if(competitors.length<1||competitors.length>3)return setMessage('Selecione de 1 até 3 concorrentes antes de analisar.');
    setAnalyzing(true);setOperation({status:'loading',message:'Consolidando a Super Análise…'});setMessage('Concorrentes já coletados. Motor Senior consolidando anúncio, contexto, Ads, custos, margens, variações, imagens e concorrentes para a análise…');
    try{
      const result=await motorData('analyzeAll',{
        product:{...(bundle.product||{}),...productDraft},models,objective,situation,bottleneck,
        ads:{...(bundle.ads||{}),roas:n(ads.roas),targetRoas:n(ads.targetRoas),spend:n(ads.spend),gmv:n(ads.gmv),costPerSale:n(ads.costPerSale)},
        baseCost:n(baseCost),variationCosts:variationCosts.map(x=>({...x,cost:n(x.cost)})),competitors
      },120000);
      setOperation({status:'success',message:'Pacote concluído.'});setMessage('Pacote concluído. Abrindo Original × Sugestão da IA no Gestor…');
      const q=result.reportId?`?report_id=${encodeURIComponent(result.reportId)}`:`?item_id=${encodeURIComponent(result.itemId)}`;
      location.href=`/super-analise${q}`;
    }catch(e){console.error('[Super Análise] analyzeAll falhou',e);const kind=classifyAsyncError(e);setOperation({status:kind,message:String(e?.message||e)});setMessage(kind==='timeout'?'A análise excedeu 2 minutos. Tente novamente; os dados preenchidos continuam nesta tela.':String(e?.message||e));setAnalyzing(false);}
  }

  function reset(){clearTimeout(pollRef.current);pickerDeadlineRef.current=0;autoStartedRef.current=true;setStep(1);setUrl('');setBundle(null);setProductDraft({});setAds({roas:'',targetRoas:'',spend:'',gmv:'',costPerSale:''});setBaseCost('');setVariationCosts([]);setCompetitors([]);setPicker(null);setMessage('');setAnalyzing(false);setLoading(false);setOperation({status:'idle',message:''});}

  return <div className={`${styles.screen} gs-super-analysis-flow`}>
    <main className={styles.main}>
      <header className={styles.header}><div><h1>✦ Super Análise</h1><p>Fluxo guiado no Gestor; o Motor Senior apenas coleta e executa tarefas na Shopee.</p></div><button onClick={reset}>Recomeçar</button></header>
      <section className={styles.progress}><Step n={1} current={step} label="Anúncio"/><Step n={2} current={step} label="Contexto, Ads e custos"/><Step n={3} current={step} label="1–3 concorrentes"/><Step n={4} current={step} label="Analisar tudo"/></section>
      {message&&<div className={styles.message} data-state={operation.status}>{message}</div>}
      {(operation.status==='error'||operation.status==='timeout'||operation.status==='empty')&&step===1&&url&&<div className={styles.asyncState}><b>{operation.status==='timeout'?'Tempo esgotado':operation.status==='empty'?'Dados não retornados':'Falha na coleta'}</b><span>{operation.message}</span><button type="button" onClick={()=>loadProduct(url)} disabled={loading}>Tentar novamente</button></div>}

      {step===1&&<section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>1</span><h2>Carregar anúncio</h2></div><Help>Quando você vem de Produtos, o anúncio já chega selecionado. O Motor Senior faz a coleta em segundo plano.</Help></div><p>Se você entrou diretamente nesta página, cole o link do anúncio.</p><div className={styles.row}><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://shopee.com.br/..."/><button className={styles.primary} disabled={loading||!url.trim()} onClick={()=>loadProduct()}>{loading?'Coletando…':'Carregar anúncio'}</button></div></section>}

      {step===2&&<>
        <section className={styles.productCard}>{p?.imageUrl?<img src={p.imageUrl} alt=""/>:<div className={styles.noImg}/>}<div><b>{p?.title||'Anúncio selecionado'}</b><small>ID {p?.itemId||'—'} · {p?.category||'Categoria não capturada'}</small></div><div className={styles.metrics}><span><small>Preço</small><b>{money(p?.price)}</b></span><span><small>Vendidos</small><b>{p?.sold||'—'}</b></span><span><small>Avaliação</small><b>{ratingText(p?.rating)} ★</b></span><span><small>Avaliações</small><b>{p?.reviewCount||'—'}</b></span><span><small>Variações</small><b>{p?.variationCount??models.length}</b></span></div></section>

        <section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>2</span><h2>Conferência rápida do anúncio</h2></div><Help>Os dados são automáticos, mas o lápis permanece disponível para corrigir uma captura incorreta antes da análise.</Help></div><div className={styles.editGrid}><EditableField id="edit-price" label="Preço atual R$" value={productDraft.price} onChange={v=>setProductDraft(d=>({...d,price:v}))}/><EditableField id="edit-sold" label="Vendidos" value={productDraft.sold} onChange={v=>setProductDraft(d=>({...d,sold:v}))} step="1"/><EditableField id="edit-rating" label="Avaliação" value={productDraft.rating} onChange={v=>setProductDraft(d=>({...d,rating:v}))}/><EditableField id="edit-reviews" label="Qtd. avaliações" value={productDraft.reviewCount} onChange={v=>setProductDraft(d=>({...d,reviewCount:v}))} step="1"/></div></section>

        <section className={styles.card}><div className={styles.cardHead}><div><h2>Objetivo, situação e gargalo</h2></div><Help>Essas respostas orientam o Gemini para evitar sugestões genéricas e preservar margem, posicionamento e estratégia.</Help></div><div className={styles.three}><label>Objetivo principal<select value={objective} onChange={e=>setObjective(e.target.value)}><option>Aumentar vendas</option><option>Aumentar lucro</option><option>Melhorar ROAS</option><option>Ganhar posicionamento</option><option>Melhorar conversão</option></select></label><label>Situação atual<select value={situation} onChange={e=>setSituation(e.target.value)}><option>Vende bem</option><option>Vende pouco</option><option>Não vende</option><option>Está começando</option><option>Oscila muito</option></select></label><label>Principal gargalo<select value={bottleneck} onChange={e=>setBottleneck(e.target.value)}><option>Não sei</option><option>Poucos cliques</option><option>Pouca conversão</option><option>Preço</option><option>Margem</option><option>ROAS</option><option>Conteúdo do anúncio</option></select></label></div></section>

        <div className={styles.twoCols}>
          <section className={styles.card}><div className={styles.cardHead}><div className={styles.titleStack}><h2>Shopee Ads — últimos 7 dias</h2><small>Métricas referentes aos últimos 7 dias.</small></div><Help>O Motor Senior tenta preencher automaticamente os dados dos últimos 7 dias. O lápis continua disponível mesmo depois da captura.</Help></div><div className={styles.editGrid}><EditableField id="ads-roas" label="ROAS" value={ads.roas} onChange={v=>setAds(a=>({...a,roas:v}))}/><EditableField id="ads-target" label="ROAS alvo" value={ads.targetRoas} onChange={v=>setAds(a=>({...a,targetRoas:v}))}/><EditableField id="ads-spend" label="Gasto Ads R$" value={ads.spend} onChange={v=>setAds(a=>({...a,spend:v}))}/><EditableField id="ads-gmv" label="GMV R$" value={ads.gmv} onChange={v=>setAds(a=>({...a,gmv:v}))}/><EditableField id="ads-cps" label="Custo por venda R$" value={ads.costPerSale} onChange={v=>setAds(a=>({...a,costPerSale:v}))}/></div></section>

          <section className={styles.card}><div className={styles.cardHead}><h2>Custos e margens</h2><Help>A margem estimada desconta 20% da Shopee, taxa fixa de R$ 4,50 e o custo do produto. O custo de Ads é analisado separadamente.</Help></div>{needsBase&&<EditableField id="base-cost" label="Custo unitário padrão R$" value={baseCost} onChange={setBaseCost}/>} {models.length>0?<div className={styles.variations}><b>Custos por variação</b>{models.map(m=>{const row=variationCosts.find(x=>String(x.modelId)===String(m.modelId))||{modelId:m.modelId,name:m.name,cost:''};const mg=estimatedMargin(m.price,row.cost,ads.costPerSale);return <div key={m.modelId}><span><strong>{m.name}</strong><small>{m.sku||'Sem SKU'} · preço {money(m.price)} · <em title={marginSummary(m.price,row.cost,ads.costPerSale)}>margem {pct(mg)} ?</em></small></span><div className={styles.costEdit}><input type="number" min="0" step="0.01" value={safe(row.cost)} onChange={e=>setVariationCosts(v=>{const exists=v.some(x=>String(x.modelId)===String(m.modelId));return exists?v.map(x=>String(x.modelId)===String(m.modelId)?{...x,cost:e.target.value}:x):[...v,{modelId:m.modelId,name:m.name,cost:e.target.value}]})}/><button type="button" className={styles.pencil}>✎</button></div></div>})}</div>:<div className={styles.marginRows}><div title={marginSummary(p?.price,baseCost)}><span>Margem estimada</span><b>{pct(estimatedMargin(p?.price,baseCost))}</b><small>{marginSummary(p?.price,baseCost)}</small></div></div>}</section>
        </div>
        <div className={styles.actions}><button onClick={()=>setStep(1)}>‹ Voltar</button><button className={styles.primary} disabled={loading} onClick={saveAndContinue}>{loading?'Salvando…':'Continuar para concorrentes ›'}</button></div>
      </>}

      {step===3&&<section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>3</span><h2>Selecione de 1 até 3 concorrentes</h2></div><Help>O Motor Senior abre uma busca normal da Shopee, adiciona o botão “Selecionar” e coleta profundamente cada concorrente antes de retornar.</Help></div><p>Escolha de 1 a 3 anúncios realmente comparáveis. Ao clicar em “Voltar para Análise” na Shopee, aparecerá “Coletando concorrentes, aguarde”; só depois da coleta a aba será fechada e esta Super Análise voltará ao foco.</p><div className={styles.actionsLeft}><button className={styles.primary} onClick={openPicker}>{picker?'Busca aberta':'Abrir busca da Shopee'}</button><button onClick={reloadPicker}>↻ Recarregar botões</button></div>{competitors.length>0&&<div className={styles.competitors}>{competitors.map((c,i)=><article key={`${c.itemId||i}`}><>{c.imageUrl?<img src={c.imageUrl} alt=""/>:<div className={styles.noImg}/>}</><div><b>{i+1}. {c.title||'Concorrente'}</b><small>{money(c.price)} · {c.sold??'—'} vendidos · {c.rating??'—'} ★</small></div></article>)}</div>}<div className={styles.actions}><button onClick={()=>setStep(2)}>‹ Voltar</button>{competitors.length>=1&&competitors.length<=3&&<button className={styles.primary} onClick={()=>setStep(4)}>Revisar e analisar ›</button>}</div></section>}

      {step===4&&<><section className={styles.card}><div className={styles.cardHead}><div><span className={styles.num}>4</span><h2>Revisão antes de Analisar Tudo</h2></div><Help>Nada é alterado na Shopee nesta etapa. Os concorrentes já foram coletados; o Motor Senior agora consolida o pacote para o Gemini.</Help></div><div className={styles.reviewGrid}><article><small>Objetivo</small><b>{objective}</b><span>{situation} · gargalo: {bottleneck}</span></article><article><small>Ads</small><b>ROAS {ads.roas||'—'} · alvo {ads.targetRoas||'—'}</b><span>GMV {money(ads.gmv)} · gasto {money(ads.spend)} · custo/venda {money(ads.costPerSale)}</span></article><article><small>Custos</small><b>{models.length?`${variationCosts.filter(x=>n(x.cost)!=null).length}/${models.length} variações com custo`:money(baseCost)}</b><span>Margens serão calculadas com preço e custo correspondentes.</span></article><article><small>Concorrentes</small><b>{competitors.length}/3 máximo</b><span>Já coletados: título, descrição, imagens, vídeo, preço, vendas, avaliações, estoque, categoria, atributos, variações e sinais de oferta quando disponíveis.</span></article></div><div className={styles.finalBox}><b>O que acontece agora?</b><p>O Motor Senior usa os concorrentes já coletados, complementa automaticamente qualquer dado que ainda estiver disponível, e envia anúncio + contexto + Ads + custos + margens + variações + imagens ao Gestor. Depois você verá Original × Sugestão da IA, justificativas SEO/AIDA/concorrentes, análise visual das imagens, categoria oficial Shopee e notas Antes × Depois.</p></div><div className={styles.actions}><button onClick={()=>setStep(3)}>‹ Voltar aos concorrentes</button><button className={styles.primaryBig} disabled={analyzing||competitors.length<1||competitors.length>3} onClick={analyzeAll}>{analyzing?'Consolidando e preparando…':'✦ Analisar Tudo'}</button></div></section></>}
    </main>
  </div>;
}