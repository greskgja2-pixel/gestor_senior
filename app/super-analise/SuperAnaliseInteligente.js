'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import styles from './page.module.css';

const n=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const money=v=>n(v)==null?'—':n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>n(v)==null?'—':`${n(v).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const safeArray=v=>Array.isArray(v)?v:[];
const firstImage=p=>p?.imageUrl||p?.image_url||p?.imageUrls?.[0]||p?.image?.image_url_list?.[0]||null;
const metric=(r,k)=>r?.metrics?.[k]??r?.ads_snapshot?.manual?.[k]??r?.ads_snapshot?.[k]??null;

const TABS=[
  ['title','Título','T'],['description','Descrição','▤'],['images','Imagens','▧'],['video','Vídeo','▶'],['category','Categoria Shopee','◇'],['price','Preço & Concorrência','$'],['variations','Atributos & Variações','⌘']
];

function findDimension(report,terms){
  const dims=safeArray(report?.report?.dimensions);
  const row=dims.find(d=>terms.some(t=>String(d?.name||'').toLowerCase().includes(t)));
  if(!row)return null;
  const score=n(row.score),max=n(row.maxScore)||100;
  return score==null?null:Math.max(0,Math.min(100,score/max*100));
}
function Gauge({score,label}){const s=n(score);return <div className={styles.gaugeBox}><div className={styles.gauge} style={{'--p':`${Math.max(0,Math.min(100,s||0))*1.8}deg`}}><b>{s==null?'—':Math.round(s)}</b><small>/100</small></div><span>{label}</span></div>}
function Help({text}){return <span className={styles.help} title={text}>?</span>}

function Sidebar({connected}){
  return <aside className={styles.sidebar}>
    <div className={styles.brand}><span>GS</span><div><b>Gestor Sênior</b><small>Shopee Intelligence</small></div></div>
    <nav>
      <Link href="/">⌂ <span>Dashboard</span></Link>
      <Link href="/extensao-shopee-intelligence">▣ <span>Super Anúncio</span></Link>
      <Link className={styles.active} href="/super-analise">▤ <span>Super Análise</span></Link>
      <Link href="/produtos">▱ <span>Produtos</span></Link>
      <Link href="/extensao-shopee-intelligence#concorrentes">⌘ <span>Concorrentes</span></Link>
      <Link href="/extensao-shopee-intelligence">◎ <span>Shopee Ads</span></Link>
      <Link href="/extensao-shopee-intelligence#reanálises">↻ <span>Reanálises</span></Link>
      <Link href="/extensao-shopee-intelligence">☆ <span>Prioridades</span></Link>
      <Link href="/extensao-shopee-intelligence">▤ <span>Relatórios</span></Link>
      <div className={styles.sideExtension}><div><Dot connected={connected}/><b>Extensão</b></div><small>{connected?'Conectada e pronta':'Não detectada nesta aba'}</small><button data-gs-super-analysis type="button">Abrir extensão</button></div>
      <Link href="/">⚙ <span>Configurações</span></Link>
    </nav>
  </aside>;
}
function Dot({connected}){return <i className={connected?styles.dotOn:styles.dotOff}/>}

function Empty(){return <main className={styles.empty}><h1>Super Análise Inteligente</h1><p>Nenhuma análise encontrada ainda. Faça a coleta pela extensão e clique em <b>Analisar Tudo</b>.</p><Link href="/extensao-shopee-intelligence">Voltar para Super Anúncio</Link></main>}

export default function SuperAnaliseInteligente({report,products,shopName}){
  const [connected,setConnected]=useState(false);
  const [tab,setTab]=useState('title');
  const [analysis,setAnalysis]=useState(report?.report?.ai_analysis||null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [categories,setCategories]=useState([]);
  const [categoryQuery,setCategoryQuery]=useState('');
  const p=report?.product_snapshot||{};
  const suggestions=analysis?.suggestions||report?.suggestions||{};

  useEffect(()=>{
    const check=()=>setConnected(document.documentElement?.dataset?.gsExtensionBridge==='ready');
    check();const timer=setInterval(check,900);return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    fetch('/api/shopee/catalog?resource=categories',{cache:'no-store'}).then(r=>r.json()).then(raw=>{
      const roots=raw?.response?.category_list||raw?.category_list||raw?.response?.list||[];const out=[];
      const walk=(x,parent='')=>{if(Array.isArray(x)){x.forEach(v=>walk(v,parent));return;}if(!x||typeof x!=='object')return;const id=x.category_id??x.id,name=x.display_category_name||x.original_category_name||x.category_name||x.name;if(id&&name){const label=parent?`${parent} > ${name}`:String(name);out.push({id:String(id),label});for(const key of ['children','child_list','category_list','sub_categories'])if(Array.isArray(x[key]))walk(x[key],label);}else Object.values(x).forEach(v=>Array.isArray(v)&&walk(v,parent));};
      walk(roots);setCategories(out);
    }).catch(()=>{});
  },[]);

  const scores=useMemo(()=>({
    title:findDimension(report,['título','titulo']),description:findDimension(report,['descrição','descricao']),images:findDimension(report,['imagem']),video:findDimension(report,['vídeo','video']),category:findDimension(report,['categoria']),price:findDimension(report,['preço','preco','concorr']),variations:findDimension(report,['atributo','varia'])
  }),[report]);
  const afterScores=analysis?.afterScores||{};

  if(!report)return <div className={styles.shell}><Sidebar connected={connected}/><Empty/></div>;

  async function runGemini(){
    setBusy(true);setMsg('Enviando anúncio e concorrentes para análise do Gemini…');
    try{
      const r=await fetch('/api/ai/super-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_id:report.id})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
      setAnalysis(j.analysis);setMsg('Análise concluída e salva.');
    }catch(e){setMsg(String(e?.message||e));}finally{setBusy(false)}
  }

  const titleSuggestion=analysis?.title?.suggestion||suggestions.title||'';
  const descSuggestion=analysis?.description?.suggestion||suggestions.description||'';
  const categoryTerms=safeArray(analysis?.category?.searchTerms);
  const filteredCats=categories.filter(c=>{const q=(categoryQuery||categoryTerms.join(' ')).toLowerCase().trim();return !q||q.split(/\s+/).some(w=>w.length>2&&c.label.toLowerCase().includes(w));}).slice(0,12);

  return <div className={styles.shell}>
    <Sidebar connected={connected}/>
    <main className={styles.main}>
      <header className={styles.topbar}><div><h1>✦ Super Análise Inteligente</h1><p>Dados originais do anúncio × sugestões da IA, com comparação antes/depois.</p></div><div className={styles.connection}><span className={connected?styles.connected:styles.disconnected}><Dot connected={connected}/>{connected?'Extensão conectada':'Extensão desconectada'}</span><button data-gs-super-analysis type="button">Abrir extensão</button></div></header>

      <section className={styles.productStrip}>
        {firstImage(p)?<img src={firstImage(p)} alt=""/>:<div className={styles.noImg}/>}<div className={styles.productTitle}><b>{p.title||p.item_name||`Produto ${report.item_id}`}</b><small>ID do anúncio: {report.item_id}</small><small>Categoria: {p.category||'—'}</small><span><em>Ativo</em><em>Shopee Oficial</em></span></div>
        <div className={styles.productMetrics}><div><small>Preço</small><b>{money(metric(report,'price')??p.price)}</b></div><div><small>Custo</small><b>{money(report.finance_snapshot?.productCost)}</b></div><div><small>Margem</small><b>{pct(report.finance_snapshot?.marginPct)}</b></div><div><small>Vendas</small><b>{n(metric(report,'sold')??p.sold)?.toLocaleString('pt-BR')||'—'}</b></div><div><small>Avaliação</small><b>{n(p.rating)?.toFixed(1)||'—'} ★</b></div><div><small>Fotos</small><b>{p.imageCount??safeArray(p.imageUrls).length||'—'}</b></div><div><small>Vídeo</small><b>{p.hasVideo?'Sim':'Não'}</b></div><div><small>Variações</small><b>{p.variationCount??safeArray(p.variations).length||0}</b></div></div>
      </section>

      <div className={styles.tabbar}>{TABS.map(([key,label,icon])=><button key={key} className={tab===key?styles.tabActive:''} onClick={()=>setTab(key)} type="button"><span>{icon}</span>{label}</button>)}</div>

      <div className={styles.workspace}>
        <section className={styles.center}>
          {tab==='title'&&<CompareText title="Título" original={p.title||p.item_name||''} suggestion={titleSuggestion} before={scores.title??report.score} after={afterScores.title} reason={analysis?.title?.reason} help="A IA considera SEO, clareza, intenção de busca, limite de caracteres e padrões observados nos concorrentes que mais vendem."/>}
          {tab==='description'&&<CompareText title="Descrição" original={p.description||''} suggestion={descSuggestion} before={scores.description??report.score} after={afterScores.description} reason={analysis?.description?.reason} multiline help="A IA considera SEO, AIDA, clareza, conversão, benefícios, informações técnicas e padrões dos concorrentes."/>}
          {tab==='images'&&<ImagesPanel product={p} competitors={report.competitors} analysis={analysis?.images} before={scores.images??report.score} after={afterScores.images}/>} 
          {tab==='video'&&<SimplePanel title="Vídeo" before={scores.video??report.score} after={afterScores.video} original={p.hasVideo?'O anúncio possui vídeo.':'O anúncio não possui vídeo.'} suggestion={analysis?.video?.suggestion||'Aguardando análise do Gemini.'} reason={analysis?.video?.reason}/>} 
          {tab==='category'&&<CategoryPanel product={p} analysis={analysis?.category} categories={filteredCats} query={categoryQuery} setQuery={setCategoryQuery} before={scores.category??report.score} after={afterScores.category}/>} 
          {tab==='price'&&<PricePanel report={report} analysis={analysis?.price} before={scores.price??report.score} after={afterScores.price}/>} 
          {tab==='variations'&&<VariationsPanel product={p} analysis={analysis?.variations} before={scores.variations??report.score} after={afterScores.variations}/>} 
          <section className={styles.why}><div className={styles.sectionTitle}><b>?</b><h3>Por que a IA sugeriu essa alteração?</h3></div><div className={styles.whyGrid}>{['SEO','AIDA','Concorrentes','Clareza','Conversão'].map(k=><div key={k}><b>{k}</b><p>{reasonFor(k,analysis,tab)}</p></div>)}</div></section>
        </section>

        <aside className={styles.rightbar}><h3>Nota geral do anúncio <Help text="Nota consolidada da análise atual. A nota prevista só aparece após o Gemini avaliar a sugestão."/></h3><div className={styles.twoGauges}><Gauge score={report.score} label="Antes"/><span>→</span><Gauge score={analysis?.afterScore} label="Depois"/></div><div className={styles.impact}>{analysis?.afterScore!=null&&report.score!=null?`+${Math.max(0,analysis.afterScore-report.score)} pontos de melhoria estimados`:'Execute a análise do Gemini para calcular o impacto estimado.'}</div><button className={styles.primary} onClick={runGemini} disabled={busy}>{busy?'Analisando…':'✦ Analisar Tudo com Gemini'}</button><button onClick={()=>localStorage.setItem(`gs-draft-${report.id}`,JSON.stringify({analysis,at:new Date().toISOString()}))}>▣ Salvar rascunho</button><button onClick={()=>location.reload()}>↻ Recalcular / atualizar</button><Link className={styles.actionLink} href={`/extensao-shopee-intelligence#${report.item_id}`}>▥ Ver análise de concorrentes</Link>{msg&&<p className={styles.statusMsg}>{msg}</p>}<div className={styles.tip}><b>💡 Dica do Gestor Sênior</b><p>As sugestões são editáveis. Revise antes de aplicar; o Gestor não altera o anúncio silenciosamente.</p></div></aside>
      </div>
    </main>
  </div>;
}

function CompareText({title,original,suggestion,before,after,reason,multiline=false,help}){
  const [left,setLeft]=useState(original||''),[right,setRight]=useState(suggestion||'');
  useEffect(()=>setLeft(original||''),[original]);useEffect(()=>setRight(suggestion||''),[suggestion]);
  const rows=multiline?12:4;
  return <><section className={styles.compare}><div className={styles.card}><div className={styles.cardHead}><h3>{title} original do anúncio <Help text="Este é o conteúdo capturado da Shopee. Você pode editar aqui para simular ajustes sem alterar o marketplace."/></h3><span>Editável</span></div><textarea rows={rows} value={left} onChange={e=>setLeft(e.target.value)}/><div className={styles.scoreCorner}><Gauge score={before} label="Antes"/></div></div><div className={styles.arrow}>→<small>{after!=null&&before!=null?`+${Math.round(after-before)} pts`:'impacto'}</small></div><div className={styles.card}><div className={styles.cardHead}><h3>✦ Sugestão completa da IA <Help text={help}/></h3><span>Editável</span></div><textarea rows={rows} value={right} onChange={e=>setRight(e.target.value)} placeholder="Aguardando análise do Gemini…"/><div className={styles.applyRow}><button className={styles.primary} type="button" onClick={()=>setLeft(right)} disabled={!right}>✓ Aplicar sugestão</button><Gauge score={after} label="Depois"/></div></div></section>{reason&&<div className={styles.reason}><b>Motivo principal:</b> {reason}</div>}</>;
}
function ImagesPanel({product,competitors,analysis,before,after}){const own=safeArray(product.imageUrls||product.image?.image_url_list);const compImgs=safeArray(competitors).flatMap(c=>safeArray(c.imageUrls)).slice(0,8);return <><section className={styles.compare}><div className={styles.card}><div className={styles.cardHead}><h3>Imagens originais <Help text="Galeria atual capturada do anúncio."/></h3><span>{own.length} imagens</span></div><div className={styles.gallery}>{own.slice(0,10).map((u,i)=><img key={u+i} src={u} alt={`Imagem ${i+1}`}/>)}</div><div className={styles.scoreCorner}><Gauge score={before} label="Antes"/></div></div><div className={styles.arrow}>→<small>comparação visual</small></div><div className={styles.card}><div className={styles.cardHead}><h3>✦ Recomendações visuais da IA</h3><span>Gemini Vision</span></div><div className={styles.analysisText}>{analysis?.suggestion||'Aguardando análise visual do Gemini das suas imagens e das imagens dos 3 concorrentes.'}</div><div className={styles.applyRow}><button className={styles.primary} disabled={!analysis}>✓ Aplicar plano de imagens</button><Gauge score={after} label="Depois"/></div></div></section><section className={styles.competitorImages}><h3>Pontos visuais dos concorrentes <Help text="A IA compara visualmente capa, hierarquia, texto, produto, benefícios, prova visual e sequência da galeria."/></h3><div className={styles.gallery}>{compImgs.map((u,i)=><img key={u+i} src={u} alt={`Concorrente ${i+1}`}/>)}</div><p>{analysis?.competitorInsight||'Quando o Gemini concluir, esta área mostrará o que os concorrentes fazem melhor e também quando suas imagens já são superiores.'}</p></section></>}
function SimplePanel({title,original,suggestion,before,after,reason}){return <><section className={styles.compare}><div className={styles.card}><h3>{title} atual</h3><div className={styles.analysisText}>{original}</div><Gauge score={before} label="Antes"/></div><div className={styles.arrow}>→</div><div className={styles.card}><h3>✦ Sugestão da IA</h3><div className={styles.analysisText}>{suggestion}</div><div className={styles.applyRow}><button className={styles.primary} disabled={!suggestion}>✓ Aplicar sugestão</button><Gauge score={after} label="Depois"/></div></div></section>{reason&&<div className={styles.reason}>{reason}</div>}</>}
function CategoryPanel({product,analysis,categories,query,setQuery,before,after}){return <section className={styles.compare}><div className={styles.card}><h3>Categoria atual</h3><div className={styles.analysisText}>{product.category||'—'}</div><Gauge score={before} label="Antes"/></div><div className={styles.arrow}>→</div><div className={styles.card}><div className={styles.cardHead}><h3>✦ Categoria sugerida <Help text="A IA não inventa categorias. O seletor abaixo contém somente categorias oficiais retornadas pela Shopee."/></h3><span>Somente Shopee</span></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar categoria oficial…"/><select size={8}>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><p className={styles.analysisText}>{analysis?.reason||'A IA gera termos de busca e o Gestor filtra a árvore oficial da Shopee.'}</p><div className={styles.applyRow}><button className={styles.primary} disabled={!categories.length}>✓ Aplicar categoria selecionada</button><Gauge score={after} label="Depois"/></div></div></section>}
function PricePanel({report,analysis,before,after}){const comps=safeArray(report.competitors),prices=comps.map(c=>n(c.price)).filter(v=>v!=null),median=prices.length?[...prices].sort((a,b)=>a-b)[Math.floor(prices.length/2)]:null;return <section className={styles.compare}><div className={styles.card}><h3>Preço e margem atuais</h3><div className={styles.analysisText}>Preço: {money(metric(report,'price')??report.product_snapshot?.price)}<br/>Margem: {pct(report.finance_snapshot?.marginPct)}<br/>ROAS: {n(metric(report,'roas'))??'—'}</div><Gauge score={before} label="Antes"/></div><div className={styles.arrow}>→</div><div className={styles.card}><h3>✦ Leitura competitiva da IA</h3><div className={styles.analysisText}>{analysis?.suggestion||`Mediana dos concorrentes: ${money(median)}. Aguardando o Gemini cruzar preço, margem, vendas, avaliações, oferta e qualidade do anúncio antes de recomendar mudanças.`}</div><div className={styles.applyRow}><button className={styles.primary} disabled={!analysis}>✓ Aplicar sugestão</button><Gauge score={after} label="Depois"/></div></div></section>}
function VariationsPanel({product,analysis,before,after}){const vars=safeArray(product.variations).length?safeArray(product.variations):safeArray(product.models);return <section className={styles.compare}><div className={styles.card}><h3>Atributos e variações atuais</h3><div className={styles.analysisText}>{vars.length?vars.map(v=>v.name||v.model_name||v.modelName).join(' • '):'Nenhuma variação capturada.'}<br/>{product.attributesCount||0} atributos estruturados.</div><Gauge score={before} label="Antes"/></div><div className={styles.arrow}>→</div><div className={styles.card}><h3>✦ Sugestão da IA</h3><div className={styles.analysisText}>{analysis?.suggestion||'Aguardando o Gemini comparar variações, atributos, concorrentes e clareza da oferta.'}</div><div className={styles.applyRow}><button className={styles.primary} disabled={!analysis}>✓ Aplicar sugestão</button><Gauge score={after} label="Depois"/></div></div></section>}
function reasonFor(kind,analysis,tab){const block=analysis?.[tab]||{};const map={SEO:block.seo,AIDA:block.aida,Concorrentes:block.competitors,Clareza:block.clarity,Conversão:block.conversion};return map[kind]||({SEO:'Palavras-chave, intenção de busca e coerência com o produto.',AIDA:'Atenção, interesse, desejo e ação quando esse critério fizer sentido.',Concorrentes:'Padrões dos 3 concorrentes selecionados, dando mais peso a sinais de vendas e reputação sem confundir correlação com causa.',Clareza:'Facilidade de entendimento, leitura no celular e redução de dúvidas.',Conversão:'Impacto provável na decisão de compra, sempre cruzado com preço, oferta e prova social.'})[kind];}
