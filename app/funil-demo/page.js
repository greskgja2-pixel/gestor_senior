'use client';

// Demonstração PÚBLICA do redesign da Análise de Funil. Todos os números são FICTÍCIOS e gerados aqui:
// nenhuma chamada ao Motor, à Shopee ou ao banco. Não substitui a página real /funil.
import {useMemo,useState} from 'react';
import {deriveStoreFunnel} from '../lib/funnel-health';
import StoreOverview from '../funil/StoreOverview';

const PERIODS={past30days:{label:'30 dias',days:30,f:1},past7days:{label:'7 dias',days:7,f:.3},real_time:{label:'Hoje',days:1,f:.08}};

function buildSeller(periodId){
  const {f,days}=PERIODS[periodId];
  const products=[];
  for(let i=1;i<=22;i++){
    const lag=i<=5;
    const imp=Math.round((lag?9000:3500-i*60)*f),ctr=lag?.02:.055+(i%4)*.004;
    const clicks=Math.round(imp*ctr),uv=Math.round(clicks*.75),carts=Math.round(uv*(i>16?.03:.09)),placed=Math.round(carts*.55),paid=Math.round(placed*.7),conf=Math.round(paid*.9);
    products.push({id:'DEMO'+i,name:'Produto fictício '+i+' (exemplo de título de anúncio)',product_card_impressions:imp,product_card_clicks:clicks,ctr:imp?clicks/imp:null,uv,add_to_cart_buyers:carts,placed_buyers:placed,paid_buyers:paid,confirmed_buyers:conf,uv_to_add_to_cart_rate:uv?carts/uv:null,uv_to_paid_buyers_rate:uv?paid/uv:null});
  }
  const n=days>1?days:0;
  const trend=(base,gap)=>Array.from({length:n},(_,i)=>({date:Date.now()-(n-1-i)*86400000,value:gap&&i%11===5?null:Math.round(base*(.6+.8*Math.abs(Math.sin(i/3))))}));
  return{period:{type:periodId},totalProducts:22,products,
    keyMetrics:{shop_uv:{value:Math.round(3699*f),chain_ratio:-.12},place_orders:{value:Math.round(210*f)},paid_orders:{value:Math.round(160*f),chain_ratio:-.18},confirmed_orders:{value:Math.round(140*f),chain_ratio:.03},paid_gmv:{value:Math.round(9800*f),chain_ratio:.05}},
    productOverview:{atc_uv:{value:Math.round(420*f)}},
    productMetricTrends:{uv:trend(120,true),atc_uv:trend(14),placed_order:trend(7,true),paid_order:trend(5),confirmed_order:trend(4)},
    orderPerformance:{cancelled_orders:{value:9},cancelled_sales:{value:520.4},return_refund_orders:{value:3},return_refund_sales:{value:190}},errors:[]};
}

export default function FunilDemo(){
  const [period,setPeriod]=useState('past30days');
  const [mode,setMode]=useState('standard');
  const [notice,setNotice]=useState('');
  const model=useMemo(()=>{
    const s=buildSeller(period);
    const {totals,rates,coverage,sources,evidence}=deriveStoreFunnel(s);
    const products=s.products;
    const k=s.keyMetrics;
    return{totals,rates,coverage,sources,evidence,products,trends:s.productMetricTrends,orderPerformance:s.orderPerformance,period:s.period,errors:[],
      comparison:{visitors:k.shop_uv.chain_ratio,paidOrders:k.paid_orders.chain_ratio,paidGmv:k.paid_gmv.chain_ratio,confirmedOrders:k.confirmed_orders.chain_ratio}};
  },[period]);
  return <div style={{maxWidth:1450,margin:'0 auto',padding:'20px 16px',background:'#f4f7fb',minHeight:'100vh',color:'#17243a'}}>
    <div role="note" style={{background:'#fff4d6',border:'1px solid #efd9a4',color:'#6b4e00',borderRadius:12,padding:'12px 14px',marginBottom:14,fontSize:14,lineHeight:1.5}}>
      <b>DEMONSTRAÇÃO com dados fictícios.</b> Nada aqui vem da sua loja. Serve só para ver o novo layout da Análise de Funil. Os botões que abrem produtos reais estão desativados.
    </div>
    <h1 style={{margin:'0 0 4px',fontSize:28}}>Análise de Funil</h1>
    <p style={{margin:'0 0 14px',color:'#5d7185'}}>Descubra onde sua loja perde clientes e o que melhorar primeiro.</p>
    <div role="group" aria-label="Período da demonstração" style={{display:'flex',gap:6,marginBottom:14}}>
      {Object.entries(PERIODS).map(([id,p])=><button key={id} type="button" aria-pressed={period===id} onClick={()=>setPeriod(id)} style={{border:'1px solid #c9d9ea',background:period===id?'#1769e8':'#fff',color:period===id?'#fff':'#245c9c',borderRadius:10,padding:'9px 14px',fontWeight:800,cursor:'pointer',minHeight:40}}>{p.label}</button>)}
    </div>
    {notice&&<div role="status" style={{background:'#eef6ff',border:'1px solid #cfe1f6',borderRadius:10,padding:'10px 12px',marginBottom:12,fontSize:13}}>{notice}</div>}
    <StoreOverview model={model} context={{}} guidanceMode={mode} onChooseGuidance={setMode}
      onOpenProduct={()=>setNotice('Na versão real, este botão abre o produto escolhido no Funil por Produto. Na demonstração ele fica desativado.')}
      resolvePlan={()=>null} topProductCard={null} periodMeta={{label:PERIODS[period].label}} periodId={period} lastUpdated={Date.now()}/>
  </div>;
}
