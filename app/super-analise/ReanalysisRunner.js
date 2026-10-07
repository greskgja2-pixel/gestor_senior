'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import styles from './reanalysis-runner.module.css';
import {fetchJsonWithTimeout,classifyAsyncError} from '../lib/client-async';

const arr=v=>Array.isArray(v)?v:[];
const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);

function Step({index,current,label,status}){
  const done=status==='done',active=status==='active';
  return <div className={`${styles.step} ${done?styles.done:''} ${active?styles.active:''}`}><span>{done?'✓':index}</span><div><b>{label}</b><small>{done?'Concluído':active?'Em andamento':'Aguardando'}</small></div></div>;
}

function mergeProduct(previous,fresh){
  const next={...previous,...fresh};
  next.itemId=fresh?.itemId??fresh?.item_id??previous?.itemId??previous?.item_id;
  next.item_id=fresh?.item_id??fresh?.itemId??previous?.item_id??previous?.itemId;
  next.price=fresh?.price??fresh?.currentPrice??previous?.price;
  next.sold=fresh?.historicalSold??fresh?.sold??previous?.sold;
  next.rating=fresh?.rating??previous?.rating;
  next.reviewCount=fresh?.reviewCount??previous?.reviewCount;
  next.stock=fresh?.stock??previous?.stock;
  if(fresh?.imageUrl&&!next.imageUrl)next.imageUrl=fresh.imageUrl;
  if(arr(fresh?.imageUrls).length)next.imageUrls=fresh.imageUrls;
  return next;
}
function mergeCompetitor(previous,fresh){
  if(!fresh)return previous;
  return {...previous,...fresh,
    price:fresh?.price??previous?.price,
    sold:fresh?.historicalSold??fresh?.sold??previous?.sold,
    monthlySold:fresh?.monthlySold??fresh?.monthly_sold??previous?.monthlySold,
    rating:fresh?.rating??previous?.rating,
    reviewCount:fresh?.reviewCount??previous?.reviewCount,
    stock:fresh?.stock??previous?.stock,
    collectedAt:new Date().toISOString()
  };
}

export default function ReanalysisRunner({report,shopId,taskId=''}) {
  const router=useRouter();
  const [phase,setPhase]=useState('preparing');
  const [message,setMessage]=useState('Preparando a reanálise com os dados mais recentes da Shopee…');
  const [error,setError]=useState('');
  const [createdId,setCreatedId]=useState('');
  const itemId=String(report?.item_id||'');
  const product=report?.product_snapshot||{};
  const title=product?.title||product?.item_name||`Produto ${itemId}`;
  const image=product?.imageUrl||product?.image_url||arr(product?.imageUrls)[0]||null;
  const phaseIndex=phase==='error'&&createdId?4:({preparing:1,product:1,competitors:2,saving:3,ai:4,done:5,error:0}[phase]||1);
  const steps=useMemo(()=>[
    ['Atualizar anúncio',phaseIndex>1?'done':phaseIndex===1?'active':'wait'],
    ['Atualizar concorrentes',phaseIndex>2?'done':phaseIndex===2?'active':'wait'],
    ['Salvar nova rodada',phaseIndex>3?'done':phaseIndex===3?'active':'wait'],
    ['Gerar nova Super Análise',phaseIndex>4?'done':phaseIndex===4?'active':'wait']
  ],[phaseIndex]);

  async function publicItem(targetShopId,targetItemId){
    if(!targetShopId||!targetItemId)return null;
    try{
      const data=await fetchJsonWithTimeout(`/api/shopee/product-public?shop_id=${encodeURIComponent(targetShopId)}&item_ids=${encodeURIComponent(targetItemId)}&direct=1`,{cache:'no-store'},30000);
      return arr(data?.results).find(x=>x?.ok)||null;
    }catch{return null}
  }

  async function finishAi(reportId,{skipImages=false}={}){
    setPhase('ai');setMessage(skipImages?'Gerando a nova Super Análise sem análise visual das imagens…':'Gerando a nova Super Análise com I.A. e comparando com a rodada anterior…');
    try{
      await fetchJsonWithTimeout('/api/ai/super-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_id:reportId,skip_images:skipImages})},58000);
    }catch(error){
      if(skipImages)throw error;
      setMessage('A análise visual não respondeu. Tentando concluir a reanálise com os dados do anúncio e dos concorrentes…');
      await fetchJsonWithTimeout('/api/ai/super-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_id:reportId,skip_images:true})},58000);
    }
    if(taskId){
      try{await fetchJsonWithTimeout('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:taskId,action:'done'})},12000)}catch{}
    }
    setPhase('done');setMessage('Reanálise concluída. Abrindo o Super Anúncio com o novo histórico…');
    setTimeout(()=>router.replace(`/extensao-shopee-intelligence?section=super-anuncio&item_id=${encodeURIComponent(itemId)}&tab=history&reanalyzed=1`),700);
  }

  async function run(){
    setError('');
    try{
      if(createdId){
        await finishAi(createdId);
        return;
      }
      setPhase('product');setMessage('Atualizando preço, vendas, avaliações, estoque e demais dados atuais do anúncio…');
      let freshOwn=null;
      try{
        const products=await fetchJsonWithTimeout('/api/shopee/products?refresh=1',{cache:'no-store'},45000);
        freshOwn=arr(products?.items).find(x=>String(x?.item_id??x?.itemId)===itemId)||null;
      }catch{}
      const publicOwn=await publicItem(shopId,itemId);
      const productSnapshot=mergeProduct(product,{...(freshOwn||{}),...(publicOwn||{})});

      setPhase('competitors');setMessage('Atualizando os concorrentes já vinculados à análise anterior…');
      const previousCompetitors=arr(report?.competitors).slice(0,3);
      const competitors=[];
      for(const comp of previousCompetitors){
        const compShop=String(comp?.shopId??comp?.shop_id??'');
        const compItem=String(comp?.itemId??comp?.item_id??comp?.id??'');
        const fresh=await publicItem(compShop,compItem);
        competitors.push(mergeCompetitor(comp,fresh));
      }
      if(!competitors.length)throw new Error('A análise anterior não possui concorrentes vinculados para uma nova rodada confiável.');

      setPhase('saving');setMessage('Criando uma nova rodada no histórico deste anúncio…');
      const body={
        item_id:Number(itemId),
        source:'gestor-reanalysis',
        objective:report?.objective||null,
        situation:report?.situation||null,
        bottleneck:report?.bottleneck||null,
        score:report?.score,
        product_snapshot:productSnapshot,
        ads_snapshot:report?.ads_snapshot||{},
        finance_snapshot:report?.finance_snapshot||{},
        competitors,
        report:{...(report?.report||{}),reanalysis_of:report?.id||null,reanalysis_started_at:new Date().toISOString()},
        suggestions:{},
        metrics:{...(report?.metrics||{}),
          price:n(productSnapshot?.price??productSnapshot?.currentPrice)??report?.metrics?.price,
          sold:n(productSnapshot?.historicalSold??productSnapshot?.sold)??report?.metrics?.sold
        },
        frequency_days:10,
        next_reanalysis_at:new Date(Date.now()+10*86400000).toISOString()
      };
      const saved=await fetchJsonWithTimeout('/api/extension-intelligence/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},30000);
      const reportId=String(saved?.report?.id||'');
      if(!reportId)throw new Error('A nova rodada foi criada sem identificador de relatório.');
      setCreatedId(reportId);

      await finishAi(reportId);
    }catch(e){
      console.error('[Reanálise] falhou',e);
      setPhase('error');
      const kind=classifyAsyncError(e);
      setError(kind==='timeout'?'A reanálise demorou mais que o esperado. Tente novamente.':'A etapa de I.A. não pôde ser concluída agora. Tente novamente em instantes.');
      setMessage('');
    }
  }

  useEffect(()=>{run();/* eslint-disable-next-line react-hooks/exhaustive-deps */},[]);

  return <div className={styles.page}>
    <header><div><small>REANÁLISE</small><h1>Atualizando este anúncio</h1><p>Uma nova rodada será preservada no histórico do Super Anúncio. A análise anterior não será sobrescrita.</p></div></header>
    <section className={styles.product}>{image?<img src={image} alt=""/>:<div className={styles.noImage}/>}<div><b>{title}</b><span>ID {itemId}</span><small>Última análise: {report?.analyzed_at?new Date(report.analyzed_at).toLocaleString('pt-BR'):'—'}</small></div></section>
    <section className={styles.steps}>{steps.map(([label,status],i)=><Step key={label} index={i+1} label={label} status={status}/>)}</section>
    {message&&<div className={styles.status}><span className={styles.spinner}/><div><b>{phase==='done'?'Concluído':'Reanálise em andamento'}</b><p>{message}</p></div></div>}
    {error&&<div className={styles.error}><div><b>Não foi possível concluir a reanálise</b><p>{error}</p>{createdId&&<small>A nova rodada já foi preservada no histórico. Ao tentar novamente, somente a etapa de I.A. será refeita; não será criada outra rodada.</small>}</div><button type="button" onClick={run}>Tentar novamente</button>{createdId&&<button type="button" onClick={()=>{setError('');finishAi(createdId,{skipImages:true}).catch(e=>{console.error('[Reanálise sem imagens] falhou',e);setPhase('error');setError('Mesmo sem analisar as imagens, a etapa de I.A. não pôde ser concluída agora. Tente novamente em instantes.');setMessage('')})}}>Pular análise das imagens</button>}</div>}
    <aside>Este fluxo usa a conexão da loja no próprio Gestor e os concorrentes já vinculados. Ele não exige um novo login no Motor Sênior.</aside>
  </div>;
}
