'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import styles from './page.module.css';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>n(v)==null?'—':`${n(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const arr=v=>Array.isArray(v)?v:[];
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;
const productImage=p=>p?.imageUrl||p?.image_url||p?.imageUrls?.[0]||p?.image?.image_url_list?.[0]||null;

const TABS=[
  ['title','Título','T'],['description','Descrição','▤'],['images','Imagens','▧'],['video','Vídeo','▶'],
  ['category','Categoria Shopee','◇'],['price','Preço & Concorrência','$'],['variations','Atributos & Variações','⌘']
];
const SCORE_TERMS={title:['título','titulo'],description:['descrição','descricao'],images:['imagem'],video:['vídeo','video'],category:['categoria'],price:['preço','preco','concorr'],variations:['atributo','varia']};
const TAB_LABEL={title:'Título',description:'Descrição',images:'Imagens',video:'Vídeo',category:'Categoria',price:'Preço',variations:'Atributos & Variações'};

function Help({text}){return <span className={styles.help} title={text}>i</span>}
function Gauge({score,label}){const v=n(score);const p=Math.max(0,Math.min(100,v??0));return <div className={styles.gaugeWrap}><div className={styles.gauge} style={{'--g':`${p*1.8}deg`}}><b>{v==null?'—':Math.round(v)}</b><small>/100</small></div><span>{label}</span></div>}
function dimScore(report,terms){const d=arr(report?.report?.dimensions).find(x=>terms.some(t=>String(x?.name||'').toLowerCase().includes(t)));if(!d)return null;const s=n(d.score),max=n(d.maxScore)||100;return s==null?null:Math.round(Math.max(0,Math.min(100,s/max*100)))}
function scoreMap(report){return Object.fromEntries(Object.entries(SCORE_TERMS).map(([k,t])=>[k,dimScore(report,t)]))}
function currentMargin(price,cost,deductions=0){const p=n(price),c=n(cost),d=n(deductions)??0;if(p==null||p<=0||c==null)return null;return ((p-c-d)/p)*100}

function Sidebar({connected}){return <aside className={styles.sidebar}>
  <div className={styles.brand}><span>GS</span><div><b>Gestor Sênior</b><small>Shopee Intelligence</small></div></div>
  <nav>
    <Link href="/">⌂ <span>Dashboard</span></Link>
    <Link href="/produtos">▱ <span>Produtos</span></Link>
    <Link className={styles.active} href="/super-analise">▤ <span>Super Análise</span></Link>
    <Link href="/extensao-shopee-intelligence">▣ <span>Super Anúncio</span></Link>
    <Link href="/extensao-shopee-intelligence#concorrentes">⌘ <span>Concorrentes</span></Link>
    <Link href="/extensao-shopee-intelligence#shopee-ads">◎ <span>Shopee Ads</span></Link>
    <Link href="/extensao-shopee-intelligence#reanálises">↻ <span>Reanálises</span></Link>
    <Link href="/extensao-shopee-intelligence#prioridades">☆ <span>Prioridades</span></Link>
    <Link href="/extensao-shopee-intelligence#relatorios">▤ <span>Relatórios</span></Link>
  </nav>
  <div className={styles.engineBadge}><div><i className={connected?styles.online:styles.offline}/><b>Motor Senior</b></div><small>{connected?'Conectado e pronto':'Desconectado'}</small><p>Coleta e executa tarefas na Shopee em segundo plano.</p></div>
</aside>}

function Metric({label,value,title,accent}){return <div className={`${styles.metric} ${accent?styles.metricAccent:''}`} title={title||''}><small>{label}</small><b>{value}</b></div>}

export default function SuperAnaliseInteligente({report,products=[]}){
  const [connected,setConnected]=useState(false);
  const [tab,setTab]=useState('description');
  const [analysis,setAnalysis]=useState(report?.report?.ai_analysis||null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [categories,setCategories]=useState([]);
  const [categoryQuery,setCategoryQuery]=useState('');
  const [chosenCategory,setChosenCategory]=useState('');
  const [draft,setDraft]=useState({});

  const p=report?.product_snapshot||{};
  const f=report?.finance_snapshot||{};
  const before=useMemo(()=>scoreMap(report),[report]);
  const after=analysis?.afterScores||{};
  const images=arr(p.imageUrls||p.image?.image_url_list);
  const competitors=arr(report?.competitors).slice(0,3);
  const basePrice=n(metric(report,'price')??p.price??p.currentPrice);
  const baseCost=n(f.productCost??p.referenceCost);
  const baseProfit=n(f.profit);
  const inferredDeductions=basePrice!=null&&baseCost!=null&&baseProfit!=null?Math.max(0,basePrice-baseCost-baseProfit):0;
  const marginNow=n(f.marginPct)??currentMargin(basePrice,baseCost,inferredDeductions);
  const marginProof=basePrice!=null&&baseCost!=null?`Preço ${money(basePrice)} − custo ${money(baseCost)}${inferredDeductions>0?` − taxas/Ads/outros registrados ${money(inferredDeductions)}`:''} = margem ${pct(marginNow)}`:'Margem indisponível: preço ou custo não capturado.';

  useEffect(()=>{
    setAnalysis(report?.report?.ai_analysis||null);
    setDraft({
      title:p.title||p.item_name||'',description:p.description||'',
      suggestionTitle:report?.report?.ai_analysis?.title?.suggestion||'',
      suggestionDescription:report?.report?.ai_analysis?.description?.suggestion||'',
      price:basePrice??'',cost:baseCost??'',
      imagePlan:report?.report?.ai_analysis?.images?.suggestion||'',
      videoPlan:report?.report?.ai_analysis?.video?.suggestion||'',
      pricePlan:report?.report?.ai_analysis?.price?.suggestion||'',
      variationsPlan:report?.report?.ai_analysis?.variations?.suggestion||''
    });
  },[report?.id]);

  useEffect(()=>{
    const ready=()=>setConnected(true);
    const onMessage=e=>{if(e.source===window&&e.data?.source==='GS_EXTENSION'&&(e.data?.type==='GS_EXTENSION_READY'||e.data?.type==='GS_EXTENSION_PONG'))ready()};
    window.addEventListener('gs-extension-ready',ready);window.addEventListener('message',onMessage);
    const id=setInterval(()=>{
      const ok=document.documentElement?.dataset?.gsExtensionBridge==='ready'||!!document.getElementById('gs-extension-bridge-marker');
      if(ok)setConnected(true);
      window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin);
    },900);
    return()=>{clearInterval(id);window.removeEventListener('gs-extension-ready',ready);window.removeEventListener('message',onMessage)};
  },[]);

  useEffect(()=>{
    fetch('/api/shopee/catalog?resource=categories',{cache:'no-store'}).then(r=>r.json()).then(raw=>{
      const roots=raw?.response?.category_list||raw?.category_list||raw?.response?.list||[];const out=[];
      const walk=(x,parent='')=>{if(Array.isArray(x)){x.forEach(v=>walk(v,parent));return}if(!x||typeof x!=='object')return;const id=x.category_id??x.id,name=x.display_category_name||x.original_category_name||x.category_name||x.name;if(id&&name){const label=parent?`${parent} > ${name}`:String(name);out.push({id:String(id),label});for(const k of ['children','child_list','category_list','sub_categories'])if(Array.isArray(x[k]))walk(x[k],label)}else Object.values(x).forEach(v=>Array.isArray(v)&&walk(v,parent))};
      walk(roots);setCategories(out);
    }).catch(()=>{});
  },[]);

  function openExtension(){window.postMessage({source:'GS_GESTOR',type:'GS_OPEN_SIDE_PANEL'},location.origin)}
  function setField(k,v){setDraft(d=>({...d,[k]:v}))}
  function saveDraft(){localStorage.setItem(`gs-super-analysis-draft-${report?.id}`,JSON.stringify({draft,chosenCategory,analysis,savedAt:new Date().toISOString()}));setMessage('Rascunho salvo neste navegador.')}
  function applyAll(){if(!analysis)return;setDraft(d=>({...d,title:analysis?.title?.suggestion||d.title,description:analysis?.description?.suggestion||d.description,imagePlan:analysis?.images?.suggestion||d.imagePlan,videoPlan:analysis?.video?.suggestion||d.videoPlan,pricePlan:analysis?.price?.suggestion||d.pricePlan,variationsPlan:analysis?.variations?.suggestion||d.variationsPlan}));setMessage('Todas as sugestões foram aplicadas ao rascunho. Nada foi alterado na Shopee.')}
  async function runGemini(){if(!report?.id)return;setBusy(true);setMessage('Analisando anúncio e concorrentes com Gemini…');try{const r=await fetch('/api/ai/super-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_id:report.id})});const j=await r.json();if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);setAnalysis(j.analysis);setDraft(d=>({...d,suggestionTitle:j.analysis?.title?.suggestion||'',suggestionDescription:j.analysis?.description?.suggestion||'',imagePlan:j.analysis?.images?.suggestion||'',videoPlan:j.analysis?.video?.suggestion||'',pricePlan:j.analysis?.price?.suggestion||'',variationsPlan:j.analysis?.variations?.suggestion||''}));setMessage(`Análise concluída${j.visualImages?` · ${j.visualImages} imagens avaliadas visualmente`:''}.`)}catch(e){setMessage(String(e?.message||e))}finally{setBusy(false)}}

  const aiTerms=arr(analysis?.category?.searchTerms);
  const search=(categoryQuery||aiTerms.join(' ')).toLowerCase().trim();
  const filteredCategories=categories.filter(c=>!search||search.split(/\s+/).some(w=>w.length>2&&c.label.toLowerCase().includes(w))).slice(0,10);
  const liveMargin=currentMargin(draft.price,draft.cost,inferredDeductions);

  if(!report)return <div className={styles.screen}><Sidebar connected={connected}/><main className={styles.empty}><h1>✦ Super Análise Inteligente</h1><p>Nenhuma análise encontrada. Inicie pela página <b>Produtos</b> e envie um anúncio para a Super Análise.</p></main></div>;

  const activeBefore=before[tab]??report.score;
  const activeAfter=n(after?.[tab]);

  return <div className={styles.screen}>
    <Sidebar connected={connected}/>
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerLeft}><button className={styles.menuButton} type="button" aria-label="Menu">☰</button><div className={styles.spark}>✦</div><div><h1>Super Análise Inteligente</h1><p>Compare os dados originais do seu anúncio com as sugestões da IA e aplique as melhorias que fizerem sentido.</p></div></div>
        <div className={styles.headerActions}><span className={connected?styles.connected:styles.disconnected}><i className={connected?styles.online:styles.offline}/>{connected?'Motor Senior conectado':'Motor Senior desconectado'}</span><button type="button" data-gs-super-analysis onClick={openExtension}>↗ Abrir Motor Senior</button><button className={styles.iconButton} type="button" title="Notificações">♧</button></div>
      </header>

      <section className={styles.productBar}>
        {productImage(p)?<img src={productImage(p)} alt=""/>:<div className={styles.noImage}/>} 
        <div className={styles.productInfo}><span className={styles.sourceBadge}>🛍 Analisando anúncio da Shopee</span><b>{p.title||p.item_name||`Produto ${report.item_id}`}</b><small>Categoria: {p.category||'Categoria não capturada'}</small><div className={styles.productBadges}><span>● Ativo</span><span>🔥 Shopee</span></div></div>
        <div className={styles.metrics}>
          <Metric label="Preço" value={money(basePrice)}/><Metric label="Custo" value={money(baseCost)}/><Metric label="Margem estimada" value={pct(marginNow)} title={marginProof} accent/>
          <Metric label="Vendas" value={n(metric(report,'sold')??p.sold)?.toLocaleString('pt-BR')||'—'}/><Metric label="Avaliação" value={n(p.rating)!=null?`${n(p.rating).toFixed(1)} ★`:'—'}/>
          <Metric label="Fotos" value={p.imageCount??images.length??0}/><Metric label="Vídeo" value={p.hasVideo?'✓ Sim':'—'}/><Metric label="Variações" value={p.variationCount??arr(p.models||p.variations).length??0}/>
        </div>
      </section>

      <div className={styles.tabs}>{TABS.map(([k,label,icon])=><button key={k} className={tab===k?styles.tabActive:''} onClick={()=>setTab(k)}><span>{icon}</span>{label}</button>)}</div>

      <div className={styles.workspace}>
        <section className={styles.content}>
          {tab==='title'&&<TextCompare title="Título" original={draft.title} suggestion={draft.suggestionTitle} onOriginal={v=>setField('title',v)} onSuggestion={v=>setField('suggestionTitle',v)} onApply={()=>setField('title',draft.suggestionTitle)} before={activeBefore} after={activeAfter} help="SEO, intenção de busca, clareza e padrões dos concorrentes com melhor desempenho."/>}
          {tab==='description'&&<TextCompare title="Descrição" original={draft.description} suggestion={draft.suggestionDescription} onOriginal={v=>setField('description',v)} onSuggestion={v=>setField('suggestionDescription',v)} onApply={()=>setField('description',draft.suggestionDescription)} before={activeBefore} after={activeAfter} multiline help="SEO, AIDA, benefícios, clareza, conversão e padrões positivos dos concorrentes."/>}
          {tab==='images'&&<ImagesSection images={images} competitors={competitors} plan={draft.imagePlan} onPlan={v=>setField('imagePlan',v)} before={activeBefore} after={activeAfter} insight={analysis?.images?.competitorInsight}/>} 
          {tab==='video'&&<PlanSection title="Vídeo" original={p.hasVideo?'O anúncio possui vídeo.':'O anúncio não possui vídeo.'} plan={draft.videoPlan} onPlan={v=>setField('videoPlan',v)} before={activeBefore} after={activeAfter}/>} 
          {tab==='category'&&<CategorySection current={p.category||'—'} terms={aiTerms} reason={analysis?.category?.reason} categories={filteredCategories} query={categoryQuery} setQuery={setCategoryQuery} chosen={chosenCategory} setChosen={setChosenCategory} before={activeBefore} after={activeAfter}/>} 
          {tab==='price'&&<PriceSection price={draft.price} cost={draft.cost} setPrice={v=>setField('price',v)} setCost={v=>setField('cost',v)} margin={liveMargin} deductions={inferredDeductions} competitors={competitors} plan={draft.pricePlan} onPlan={v=>setField('pricePlan',v)} before={activeBefore} after={activeAfter}/>} 
          {tab==='variations'&&<VariationsSection product={p} plan={draft.variationsPlan} onPlan={v=>setField('variationsPlan',v)} before={activeBefore} after={activeAfter}/>} 

          <WhyBlock analysis={analysis} tab={tab} competitorCount={competitors.length}/>
          <BottomSummary tab={tab} before={activeBefore} after={activeAfter} analysis={analysis}/>
        </section>

        <aside className={styles.rightbar}>
          <h3>Nota geral do anúncio <Help text="A nota depois é uma estimativa do conteúdo sugerido; não é promessa de vendas."/></h3>
          <div className={styles.gaugePair}><Gauge score={report.score} label="Antes"/><span>→</span><Gauge score={analysis?.afterScore} label="Após aplicar sugestões"/></div>
          <div className={styles.impactBox}><b>{analysis?.afterScore!=null&&report.score!=null?`↗ +${Math.max(0,Math.round(analysis.afterScore-report.score))} pontos de melhoria estimados`:'Impacto estimado aguardando IA'}</b><small>Aplique apenas as sugestões que fizerem sentido para o anúncio.</small></div>
          <button className={styles.primary} onClick={applyAll} disabled={!analysis}>▱ Aplicar tudo <small>(todas as categorias)</small></button>
          <button onClick={saveDraft}>▣ Salvar rascunho</button>
          <button onClick={runGemini} disabled={busy}>{busy?'Analisando…':'↻ Recalcular nota'}</button>
          <Link href={`/extensao-shopee-intelligence?item_id=${report.item_id}#concorrentes`}>▥ Ver análise de concorrentes</Link>
          <div className={styles.tipBox}><b>💡 Dica</b><p>Você continua no controle. Todas as sugestões da IA são editáveis antes de aplicar.</p></div>
          {message&&<div className={styles.message}>{message}</div>}
        </aside>
      </div>
    </main>
  </div>;
}

function TextCompare({title,original,suggestion,onOriginal,onSuggestion,onApply,before,after,multiline=false,help}){return <section className={styles.compare}>
  <article className={styles.panel}><div className={styles.panelHead}><h2>▣ {title} original do anúncio <Help text="Dado capturado da Shopee. Você pode editar aqui como rascunho."/></h2><span>✎ Editável</span></div><textarea rows={multiline?15:7} value={original} onChange={e=>onOriginal(e.target.value)}/><div className={styles.scoreFloat}><Gauge score={before} label="Antes"/></div></article>
  <div className={styles.arrow}><strong>➜</strong><small>Impacto estimado</small><b>{after!=null&&before!=null?`${Math.round(after-before)>=0?'+':''}${Math.round(after-before)} pts`:'—'}</b></div>
  <article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão completa da IA <Help text={help}/></h2><span>✎ Editável</span></div><textarea rows={multiline?15:7} value={suggestion} onChange={e=>onSuggestion(e.target.value)} placeholder="Execute a análise do Gemini para gerar a sugestão completa."/><div className={styles.applyLine}><Gauge score={after} label="Depois"/><button className={styles.primary} onClick={onApply} disabled={!suggestion}>✓ Aplicar sugestão</button></div></article>
</section>}

function ImagesSection({images,competitors,plan,onPlan,before,after,insight}){const comp=competitors.flatMap((c,ci)=>arr(c.imageUrls).slice(0,3).map(u=>({u,ci}))).slice(0,9);return <>
  <section className={styles.compare}>
    <article className={styles.panel}><div className={styles.panelHead}><h2>▣ Imagens originais do anúncio <Help text="Galeria atual capturada na Shopee."/></h2><span>{images.length} imagens</span></div><div className={styles.gallery}>{images.slice(0,10).map((u,i)=><figure key={`${u}-${i}`}><img src={u} alt=""/><em>{i+1}</em></figure>)}</div><div className={styles.scoreFloat}><Gauge score={before} label="Antes"/></div></article>
    <div className={styles.arrow}><strong>➜</strong><small>Análise visual</small></div>
    <article className={styles.panel}><div className={styles.panelHead}><h2>✦ Recomendações visuais da IA <Help text="Gemini compara visualmente capa, hierarquia, legibilidade, benefícios, prova visual e sequência da galeria."/></h2><span>✎ Editável</span></div><textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="Aguardando análise visual do Gemini…"/><div className={styles.applyLine}><Gauge score={after} label="Depois"/><button className={styles.primary} disabled={!plan}>✓ Aplicar plano de imagens</button></div></article>
  </section>
  <section className={styles.competitorsVisual}><h2>Comparação visual com os concorrentes <Help text="A IA também deve reconhecer quando suas imagens já são melhores e direcionar a atenção para preço, oferta, reputação ou Ads."/></h2><div className={styles.compGallery}>{comp.map((x,i)=><figure key={`${x.u}-${i}`}><img src={x.u} alt=""/><em>Conc. {x.ci+1}</em></figure>)}</div><p>{insight||'Após a análise, aqui aparece o que os concorrentes fazem melhor, o que você faz melhor e o que vale preservar.'}</p></section>
</>}

function PlanSection({title,original,plan,onPlan,before,after}){return <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>▣ {title} original</h2></div><div className={styles.textBox}>{original}</div><div className={styles.scoreFloat}><Gauge score={before} label="Antes"/></div></article><div className={styles.arrow}><strong>➜</strong></div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão completa da IA</h2><span>✎ Editável</span></div><textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="Aguardando análise do Gemini…"/><div className={styles.applyLine}><Gauge score={after} label="Depois"/><button className={styles.primary} disabled={!plan}>✓ Aplicar sugestão</button></div></article></section>}

function CategorySection({current,terms,reason,categories,query,setQuery,chosen,setChosen,before,after}){return <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>▣ Categoria original do anúncio</h2></div><div className={styles.textBox}>{current}</div><div className={styles.scoreFloat}><Gauge score={before} label="Antes"/></div></article><div className={styles.arrow}><strong>➜</strong></div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Categoria sugerida pela IA <Help text="A IA não cria categoria. O Gestor pesquisa apenas na árvore oficial da Shopee."/></h2><span>Oficial Shopee</span></div><p className={styles.muted}>{reason||'O Gemini fornece termos; o Gestor cruza com a lista oficial da Shopee.'}</p><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={terms.length?`Termos da IA: ${terms.join(', ')}`:'Buscar na árvore oficial da Shopee'}/><div className={styles.categoryList}>{categories.map(c=><label key={c.id}><input type="radio" name="cat" checked={chosen===c.id} onChange={()=>setChosen(c.id)}/><span>{c.label}</span></label>)}</div><div className={styles.applyLine}><Gauge score={after} label="Depois"/><button className={styles.primary} disabled={!chosen}>✓ Aplicar categoria ao rascunho</button></div></article></section>}

function PriceSection({price,cost,setPrice,setCost,margin,deductions,competitors,plan,onPlan,before,after}){return <>
  <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>▣ Preço e margem atuais <Help text="Preço e custo podem ser corrigidos manualmente. A margem é recalculada imediatamente."/></h2><span>✎ Editável</span></div><div className={styles.priceGrid}><label>Preço<input type="number" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Custo<input type="number" step="0.01" value={cost} onChange={e=>setCost(e.target.value)}/></label><div><small>Margem recalculada</small><b>{pct(margin)}</b></div></div><div className={styles.formula}>Prova dos 9: {money(price)} − {money(cost)}{deductions>0?` − ${money(deductions)} em taxas/Ads/outros registrados`:''} = margem {pct(margin)}</div><div className={styles.scoreFloat}><Gauge score={before} label="Antes"/></div></article><div className={styles.arrow}><strong>➜</strong></div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão de preço & concorrência</h2><span>✎ Editável</span></div><textarea rows={10} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="Aguardando análise do Gemini…"/><div className={styles.applyLine}><Gauge score={after} label="Depois"/><button className={styles.primary} disabled={!plan}>✓ Aplicar estratégia ao rascunho</button></div></article></section>
  <section className={styles.competitorCards}><h2>{competitors.length} concorrente(s) selecionado(s)</h2><div>{competitors.map((c,i)=><article key={i}>{c.imageUrl||arr(c.imageUrls)[0]?<img src={c.imageUrl||arr(c.imageUrls)[0]} alt=""/>:null}<b>{c.title||`Concorrente ${i+1}`}</b><small>{money(c.price)} · {n(c.sold)?.toLocaleString('pt-BR')||'—'} vendidos · {n(c.rating)?.toFixed(1)||'—'}★</small></article>)}</div></section>
</>}

function VariationsSection({product,plan,onPlan,before,after}){const models=arr(product.models||product.variations);const costs=arr(product.variationCosts);const costMap=new Map(costs.map(x=>[String(x.modelId??x.model_id),n(x.cost)]));return <section className={styles.compare}><article className={styles.panel}><div className={styles.panelHead}><h2>▣ Variações originais <Help text="A margem é calculada por variação quando preço e custo daquela variação estão disponíveis."/></h2><span>{models.length} variações</span></div>{models.length?<div className={styles.variationTable}><div><b>Variação</b><b>Preço</b><b>Custo</b><b>Margem</b></div>{models.map((m,i)=>{const id=String(m.modelId??m.model_id??m.id??i),price=n(m.price??m.currentPrice),cost=n(m.cost)??costMap.get(id),margin=currentMargin(price,cost,0);return <div key={id}><span>{m.name||m.model_name||`Variação ${i+1}`}</span><span>{money(price)}</span><span>{money(cost)}</span><span>{pct(margin)}</span></div>})}</div>:<div className={styles.textBox}>Este anúncio não possui variações estruturadas capturadas.</div>}<div className={styles.scoreFloat}><Gauge score={before} label="Antes"/></div></article><div className={styles.arrow}><strong>➜</strong></div><article className={styles.panel}><div className={styles.panelHead}><h2>✦ Sugestão para atributos & variações</h2><span>✎ Editável</span></div><textarea rows={12} value={plan} onChange={e=>onPlan(e.target.value)} placeholder="Aguardando análise do Gemini…"/><div className={styles.applyLine}><Gauge score={after} label="Depois"/><button className={styles.primary} disabled={!plan}>✓ Aplicar sugestão</button></div></article></section>}

function WhyBlock({analysis,tab,competitorCount}){const a=analysis?.[tab]||{};return <section className={styles.why}><h2><span>?</span> Por que a IA sugeriu essa alteração?</h2><div className={styles.whyGrid}><article><b>⌕ SEO</b><p>{a.seo||'Palavras-chave, intenção de busca e coerência com o produto.'}</p></article><article><b>✦ AIDA</b><p>{a.aida||'Atenção, interesse, desejo e ação quando fizer sentido para a categoria.'}</p></article><article><b>↗ Concorrentes</b><p>{a.competitors||`Padrões dos ${competitorCount||'concorrentes'} selecionados, sem confundir correlação com causa.`}</p></article><article><b>▤ Clareza</b><p>{a.clarity||a.reason||'Leitura fácil, menos dúvidas e melhor compreensão da oferta.'}</p></article><article><b>🛒 Conversão</b><p>{a.conversion||'Impacto provável na decisão de compra, sem prometer vendas.'}</p></article></div></section>}

function BottomSummary({tab,before,after,analysis}){const priorities=arr(analysis?.priorities);const titleBefore=n(analysis?.beforeScores?.title),titleAfter=n(analysis?.afterScores?.title),descriptionBefore=n(analysis?.beforeScores?.description),descriptionAfter=n(analysis?.afterScores?.description);return <div className={styles.bottomGrid}><section><h3>◉ Velocímetro da categoria: {TAB_LABEL[tab]} <Help text="Compara a nota atual da categoria com a nota estimada depois das sugestões."/></h3><div className={styles.gaugePair}><Gauge score={before} label="Antes"/><span>→</span><Gauge score={after} label="Depois"/></div><div className={styles.miniImpact}>{after!=null&&before!=null?`↗ ${after-before>=0?'+':''}${Math.round(after-before)} pontos de melhoria`:'Aguardando análise da IA'}</div></section><section><h3>▣ Melhorias detectadas na categoria</h3>{priorities.length?<ul>{priorities.slice(0,6).map((x,i)=><li key={i}><b>{x.area}</b> · {x.why}</li>)}</ul>:<p>As melhorias aparecem aqui depois da análise, destacando onde vale mexer primeiro.</p>}</section><section><h3>⊙ Resumo de impacto por categoria <Help text="Exemplo resumido do ganho estimado em categorias importantes do anúncio."/></h3><div className={styles.impactCards}><article><b>Título</b><strong>{titleBefore!=null&&titleAfter!=null?`+${Math.max(0,Math.round(titleAfter-titleBefore))} pts`:'—'}</strong><small>{titleBefore!=null&&titleAfter!=null?`${titleBefore} → ${titleAfter}`:'Aguardando IA'}</small></article><article><b>Descrição</b><strong>{descriptionBefore!=null&&descriptionAfter!=null?`+${Math.max(0,Math.round(descriptionAfter-descriptionBefore))} pts`:'—'}</strong><small>{descriptionBefore!=null&&descriptionAfter!=null?`${descriptionBefore} → ${descriptionAfter}`:'Aguardando IA'}</small></article></div><p>A mesma lógica de análise e otimização é aplicada a todas as categorias do anúncio.</p></section></div>}
