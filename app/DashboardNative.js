import Link from 'next/link';
import {getActiveShop} from '../lib/shop';
import {getProducts} from '../lib/products';
import {getOrders} from '../lib/orders';
import {supabaseAdmin} from '../lib/supabase';
import styles from './dashboard-native.module.css';

const qty=v=>Number.isFinite(Number(v))?Number(v):0;
function itemSales(orders,from,to){
  const map=new Map();
  for(const order of orders||[]){
    const t=Number(order?.create_time)*1000;
    if(!Number.isFinite(t)||t<from||t>=to)continue;
    for(const item of order?.item_list||[]){
      const id=String(item?.item_id??''); if(!id)continue;
      map.set(id,(map.get(id)||0)+qty(item?.model_quantity_purchased??item?.quantity??1));
    }
  }
  return map;
}
function explicitVideo(report){
  const p=report?.product_snapshot||{};
  for(const key of ['hasVideo','has_video']){
    if(typeof p[key]==='boolean')return p[key];
  }
  if(Array.isArray(p.video_info))return p.video_info.length>0;
  if(Array.isArray(p.videos))return p.videos.length>0;
  return null;
}
function imageNeedsWork(report){
  const dims=Array.isArray(report?.report?.dimensions)?report.report.dimensions:[];
  const imageDim=dims.find(d=>/imagem|foto/i.test(String(d?.name||'')));
  if(!imageDim)return null;
  const score=Number(imageDim.score),max=Number(imageDim.maxScore||100);
  if(!Number.isFinite(score)||!Number.isFinite(max)||max<=0)return null;
  return score/max<0.7;
}
function Card({tone,icon,title,badge,value,description,href,cta}){
  return <article className={styles.card} data-tone={tone}>
    <div className={styles.cardTop}><span className={styles.icon}>{icon}</span><span className={styles.badge}>{badge}</span></div>
    <h3>{title}</h3><strong className={styles.value}>{value}</strong><p>{description}</p>
    <Link href={href} className={styles.cta}>{cta}<span>›</span></Link>
  </article>
}
export default async function DashboardNative(){
  const shop=await getActiveShop();
  if(!shop)return <div className={styles.page}><h1>Dashboard</h1><p>Nenhuma loja Shopee conectada.</p></div>;
  const now=Date.now(),start14=now-14*86400000,start7=now-7*86400000;
  const [productsResult,ordersResult,reportsResult]=await Promise.allSettled([
    getProducts(shop),
    getOrders(shop,{days:14}),
    supabaseAdmin().from('extension_analysis_reports').select('id,item_id,analyzed_at,product_snapshot,report,metrics').eq('shop_id',shop.shop_id).order('analyzed_at',{ascending:false}).limit(3000)
  ]);
  const products=productsResult.status==='fulfilled'?(productsResult.value.items||[]):null;
  const orders=ordersResult.status==='fulfilled'?(ordersResult.value.orders||[]):null;
  const reports=reportsResult.status==='fulfilled'?(reportsResult.value.data||[]):null;
  const latest=new Map();
  for(const r of reports||[]){const id=String(r.item_id);if(!latest.has(id))latest.set(id,r);}
  const current=orders?itemSales(orders,start7,now):null;
  const previous=orders?itemSales(orders,start14,start7):null;
  const active=products?products.filter(p=>['NORMAL','LIVE','ACTIVE'].includes(String(p.item_status||'').toUpperCase())):null;
  const soldThisWeek=current?[...current.entries()].filter(([,v])=>v>0):null;
  const lost=current&&previous?[...previous.entries()].filter(([id,prev])=>prev>0&&(current.get(id)||0)<prev):null;
  const zeroSales=active&&current?active.filter(p=>(current.get(String(p.item_id))||0)===0):null;
  const unanalyzed=active?active.filter(p=>!latest.has(String(p.item_id))):null;
  let noVideo=null,imageIssues=null;
  if(active&&reports){
    const analyzed=active.map(p=>({p,r:latest.get(String(p.item_id))})).filter(x=>x.r);
    const videoKnown=analyzed.filter(x=>explicitVideo(x.r)!==null);
    noVideo=videoKnown.filter(x=>explicitVideo(x.r)===false);
    const imageKnown=analyzed.filter(x=>imageNeedsWork(x.r)!==null);
    imageIssues=imageKnown.filter(x=>imageNeedsWork(x.r)===true);
  }
  const display=v=>v===null?'Sem dados':String(v.length);
  const opportunities=[lost,zeroSales,unanalyzed,noVideo,imageIssues].filter(v=>Array.isArray(v)&&v.length>0).length;
  const actions=[
    Array.isArray(lost)&&lost.length?{text:`Revisar ${lost.length} anúncios que perderam venda esta semana`,badge:'Alta prioridade',href:'/produtos?insight=lost-sales'}:null,
    Array.isArray(unanalyzed)&&unanalyzed.length?{text:`Analisar ${unanalyzed.length} anúncios pendentes na Super Análise`,badge:'Priorizar',href:'/super-analise'}:null,
    Array.isArray(noVideo)&&noVideo.length?{text:`Adicionar vídeo em ${noVideo.length} anúncios com ausência confirmada`,badge:'Boa oportunidade',href:'/extensao-shopee-intelligence?section=super-anuncio'}:null,
    Array.isArray(imageIssues)&&imageIssues.length?{text:`Melhorar as fotos de ${imageIssues.length} anúncios sinalizados pela Super Análise`,badge:'Aumentar cliques',href:'/extensao-shopee-intelligence?section=super-anuncio'}:null
  ].filter(Boolean);
  return <div className={styles.page}>
    <header className={styles.header}><div><h1>Dashboard</h1><p>Aqui estão suas principais oportunidades e próximas ações para fazer sua loja crescer.</p></div><span className={styles.live}>● Shopee LIVE</span></header>
    <section className={styles.navigator}>
      <div className={styles.navigatorHead}><div><span className={styles.target}>◎</span><div><h2>Painel Norteador</h2><p>Foque no que realmente importa. Estes são os pontos que podem gerar mais resultados para a sua loja esta semana.</p></div></div><b>ϟ {opportunities} oportunidades identificadas</b></div>
      <div className={styles.grid}>
        <Card tone="green" icon="♕" title="Anúncios que mais venderam esta semana" badge="Destaque" value={display(soldThisWeek)} description={soldThisWeek===null?'A fonte de pedidos não respondeu.':'Anúncios com vendas reais nos últimos 7 dias.'} href="/produtos?insight=top-sales" cta="Ver anúncios"/>
        <Card tone="red" icon="↘" title="Anúncios que mais perderam venda esta semana" badge="Alta prioridade" value={display(lost)} description={lost===null?'Sem dados suficientes para comparar os dois períodos.':'Comparação real dos últimos 7 dias contra os 7 anteriores.'} href="/produtos?insight=lost-sales" cta="Revisar agora"/>
        <Card tone="slate" icon="◉" title="Anúncios que não venderam esta semana" badge="Atenção" value={display(zeroSales)} description={zeroSales===null?'Sem dados suficientes.':'Anúncios ativos com zero vendas nos últimos 7 dias.'} href="/produtos?insight=zero-sales" cta="Ver anúncios"/>
        <Card tone="purple" icon="⌕" title="Anúncios que precisam ser analisados" badge="Priorizar" value={display(unanalyzed)} description={unanalyzed===null?'A fonte de produtos não respondeu.':'Produtos ativos que ainda não possuem Super Análise.'} href="/super-analise" cta="Abrir Super Análise"/>
        <Card tone="blue" icon="▸" title="Anúncios sem vídeo" badge="Boa oportunidade" value={display(noVideo)} description={noVideo===null?'Vídeo não coletado ou análise indisponível.':'Somente análises em que a ausência de vídeo foi confirmada.'} href="/extensao-shopee-intelligence?section=super-anuncio" cta="Ver anúncios"/>
        <Card tone="gold" icon="▧" title="Anúncios que precisam melhorar as fotos" badge="Revisar mídia" value={display(imageIssues)} description={imageIssues===null?'Critério de imagens não coletado.':'Sinalizados pelo critério real de Imagens da Super Análise.'} href="/extensao-shopee-intelligence?section=super-anuncio" cta="Ver anúncios"/>
      </div>
    </section>
    <section className={styles.actions}><div className={styles.actionsHead}><div><span>☷</span><div><h2>Próximas ações recomendadas</h2><p>Prioridades geradas apenas a partir de dados disponíveis.</p></div></div></div>
      {actions.length?actions.map((a,i)=><Link href={a.href} key={a.text} className={styles.action}><i>{i+1}</i><span>{a.text}</span><b>{a.badge}</b><em>›</em></Link>):<div className={styles.empty}>Nenhuma ação confiável pôde ser gerada com os dados disponíveis agora.</div>}
    </section>
  </div>;
}
