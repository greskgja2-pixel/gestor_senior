'use client';
import {useEffect,useState} from 'react';
const initial=[
 {id:1,title:'Kit Festa Guerreiras do K-Pop • Personalizado',price:27.49,sales:262,priceDelta:-12,salesDelta:18,location:'Pará',ads:'Não confirmado',rank:'Não encontrado',badge:'Concorrente direto',color:'#8065df',symbol:'🎉'},
 {id:2,title:'Kit Guerreiras K-Pop • Decoração para aniversário',price:37.90,sales:833,priceDelta:8,salesDelta:9,location:'São Paulo',ads:'Não',rank:'2ª página',badge:'Concorrente direto',color:'#e669ac',symbol:'🎀'},
 {id:3,title:'Desenhos para Colorir Adulto • 50 Folhas A5',price:17.97,sales:38,priceDelta:-5,salesDelta:-22,location:'Rio de Janeiro',ads:'Não confirmado',rank:'1ª página',badge:'Concorrente direto',color:'#93a6b6',symbol:'🎨'},
 {id:4,title:'Kit Adesivos K-Pop • 50 Unidades',price:24.90,sales:521,priceDelta:0,salesDelta:34,location:'Minas Gerais',ads:'Não',rank:'3ª página',badge:'Concorrente indireto',color:'#d5a9e6',symbol:'🌟'}
];
const cash=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmt=v=>v>0?'+'+v+'%':v+'%';
export default function DemoConcorrentes(){
 const [items,setItems]=useState(initial),[opened,setOpened]=useState(null),[filter,setFilter]=useState(''),[order,setOrder]=useState('default'),[selected,setSelected]=useState([]),[toast,setToast]=useState(''),[compare,setCompare]=useState(false),[mobile,setMobile]=useState(false);
 useEffect(()=>{const fn=e=>{if(e.key==='Escape')setOpened(null)};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[]);
 const show=(v)=>{setToast(v+' — ação simulada, sem conexão com a Shopee.');setOpened(null);};
 const displayed=items.filter(i=>i.title.toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>order==='price'?a.price-b.price:order==='sales'?b.sales-a.sales:a.id-b.id);
 const style={page:{minHeight:'100vh',background:'#eef4fb',color:'#172d52',fontFamily:'Inter,system-ui,sans-serif',padding:'22px'},surface:{background:'#fff',border:'1px solid #e2eaf3',borderRadius:14,boxShadow:'0 2px 12px #18314b0a'},btn:{background:'#0c66ef',color:'#fff',border:0,borderRadius:8,padding:'11px 17px',cursor:'pointer',fontWeight:700},muted:{color:'#72839b',fontSize:12},label:{fontSize:12,fontWeight:700,color:'#506780'},input:{padding:11,borderRadius:8,border:'1px solid #d5e2ef',background:'#fff',minWidth:0}};
 return <main style={style.page} onClick={e=>{if(!e.target.closest('[data-open]'))setOpened(null)}}>
  <div style={{maxWidth:1480,margin:'auto'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:18}}>
    <div><div style={{fontSize:13,color:'#5471a1',fontWeight:800}}>GS · Gestor Sênior</div><h1 style={{margin:'4px 0 0',fontSize:28}}>Concorrentes</h1><p style={{color:'#789',margin:'6px 0'}}>Radar competitivo — prévia visual para testes</p></div>
    <span style={{color:'#87530a',background:'#fff0c9',padding:'9px 13px',borderRadius:20,fontWeight:800,fontSize:12}}>DEMONSTRAÇÃO · Dados fictícios</span>
   </div>
   <section style={{...style.surface,padding:14,display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',marginBottom:16}}>
    <label style={{flex:'2 1 230px',display:'grid',gap:6}}><span style={style.label}>Buscar concorrente</span><input style={style.input} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar concorrente ou produto..."/></label>
    <label style={{flex:'1 1 150px',display:'grid',gap:6}}><span style={style.label}>Ordenar por</span><select style={style.input} value={order} onChange={e=>setOrder(e.target.value)}><option value="default">Maior prioridade</option><option value="price">Menor preço</option><option value="sales">Mais vendas</option></select></label>
    <button style={style.btn} onClick={()=>show('Atualizar / Rechecar agora')}>↻ Atualizar / Rechecar agora</button>
   </section>
   <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:16}}>
    {[['↘','Queda de preço',items.filter(i=>i.priceDelta<0).length,'#e9f9ed'],['↗','Alta de preço',items.filter(i=>i.priceDelta>0).length,'#fff0f0'],['⚡','Vendas acelerando',items.filter(i=>i.salesDelta>0).length,'#edf3ff'],['◷','Rechecagens vencidas',0,'#fff6e6']].map(([icon,label,value,bg])=><article key={label} style={{...style.surface,padding:14,display:'flex',gap:12,alignItems:'center'}}><span style={{padding:12,background:bg,borderRadius:12,fontSize:23}}>{icon}</span><div><b style={{fontSize:24}}>{value}</b><div style={style.muted}>{label}</div></div></article>)}
   </section>
   <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(235px,280px)',gap:15,alignItems:'start'}} className="demo-layout">
   <section style={{minWidth:0}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12,flexWrap:'wrap'}}><strong>{displayed.length} concorrentes encontrados</strong><button onClick={()=>setCompare(!compare)} style={{...style.input,cursor:'pointer'}}>{compare?'Ocultar comparação':'Comparar selecionados ('+selected.length+')'}</button></div>
    {compare&&<div style={{...style.surface,padding:16,marginBottom:12}}><b>Comparação visual</b><div style={{display:'flex',gap:12,alignItems:'end',height:125,marginTop:8}}>{items.filter(i=>selected.includes(i.id)).map(i=><div key={i.id} style={{flex:1,textAlign:'center'}}><div style={{height:Math.max(5,i.sales/833*95),background:'#387efa',borderRadius:4}}/><small>{i.sales} vendas</small></div>)}</div>{selected.length===0&&<p style={style.muted}>Selecione um ou mais concorrentes para comparar.</p>}</div>}
    <div style={{display:'grid',gap:12}}>{displayed.map(i=><article key={i.id} style={{...style.surface,padding:15,display:'grid',gridTemplateColumns:'minmax(180px,2fr) minmax(110px,1fr) minmax(100px,1fr) 78px',gap:12,alignItems:'center',position:'relative'}} className="demo-card">
      <div style={{display:'flex',gap:12,alignItems:'center',minWidth:0}}><input aria-label={'Selecionar '+i.title} type="checkbox" checked={selected.includes(i.id)} onChange={()=>setSelected(x=>x.includes(i.id)?x.filter(v=>v!==i.id):[...x,i.id])}/><div style={{width:70,height:70,background:i.color,borderRadius:10,display:'grid',placeItems:'center',fontSize:31,flexShrink:0}}>{i.symbol}</div><div style={{minWidth:0}}><b style={{fontSize:13,color:'#0860cb'}}>{i.title}</b><div style={{marginTop:7}}><span style={{fontSize:10,borderRadius:15,padding:'4px 7px',background:'#eaf3ff',color:'#285a94'}}>{i.badge}</span></div></div></div>
      <div><div style={style.muted}>Preço atual</div><strong style={{fontSize:20,color:'#098352'}}>{cash(i.price)}</strong><div style={{color:i.priceDelta>0?'#ba3c43':'#07834e',fontSize:12}}>{fmt(i.priceDelta)}</div></div>
      <div><div style={style.muted}>Vendas acumuladas</div><strong style={{fontSize:23}}>{i.sales}</strong><div style={{color:i.salesDelta<0?'#ba3c43':'#07834e',fontSize:12}}>{fmt(i.salesDelta)}</div></div>
      <div style={{display:'flex',gap:6,position:'relative',justifyContent:'end'}} data-open>
       <button aria-label={'Informações de '+i.title} style={{...style.input,padding:'7px 9px',cursor:'pointer',color:'#0860cb'}} onClick={()=>setOpened(opened===i.id+'info'?null:i.id+'info')}>ⓘ</button>
       <button aria-label={'Ações de '+i.title} style={{...style.input,padding:'7px 9px',cursor:'pointer',fontWeight:900}} onClick={()=>setOpened(opened===i.id+'menu'?null:i.id+'menu')}>···</button>
       {opened===i.id+'info'&&<div className="demo-popup" role="dialog" aria-label="Detalhes do concorrente" style={{...style.surface,position:'absolute',top:42,right:0,zIndex:30,width:320,maxWidth:'min(320px,90vw)',padding:15,boxShadow:'0 12px 30px #1b355633'}}><div style={{display:'flex',justifyContent:'space-between'}}><b>Detalhes do concorrente</b><button onClick={()=>setOpened(null)}>×</button></div><dl style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,fontSize:12}}>{[['Indicado','Não confirmado'],['Localização',i.location],['Última coleta','09/10/2026, 16:51'],['Rechecagem','Em 3 dias'],['Visibilidade na busca',i.rank],['Ads',i.ads],['Preço normal',cash(i.price*1.1)],['Preço oferta',cash(i.price)]].map(([k,v])=><div key={k}><dt style={style.muted}>{k}</dt><dd style={{margin:'4px 0',fontWeight:700}}>{v}</dd></div>)}</dl></div>}
       {opened===i.id+'menu'&&<div className="demo-popup" role="menu" style={{...style.surface,position:'absolute',right:0,top:42,zIndex:30,padding:7,width:235,boxShadow:'0 12px 30px #1b355633',display:'grid'}}>{['⌕ Checar dados','✎ Editar preço do meu anúncio','↗ Ir para meu anúncio','↗ Abrir anúncio','◷ Histórico de coletas','🗑 Excluir concorrente'].map(label=><button key={label} onClick={()=>label.includes('Excluir')?(setItems(x=>x.filter(v=>v.id!==i.id)),show('Excluir concorrente')):show(label)} style={{border:0,background:'#fff',padding:'11px',textAlign:'left',cursor:'pointer',color:label.includes('Excluir')?'#c33':'#24476b'}}>{label}</button>)}</div>}
      </div>
     </article>)}</div>
   </section>
   <aside style={{display:'grid',gap:12,minWidth:0}} className="demo-aside">
    <div style={{...style.surface,padding:16}}><b>♧ Alertas do radar competitivo</b><p style={style.muted}>Nenhuma mudança importante detectada.</p></div>
    <div style={{...style.surface,padding:16}}><b>▥ Distribuição dos concorrentes</b><div style={{border:'14px solid #bccadb',height:125,width:125,borderRadius:'50%',display:'grid',placeItems:'center',margin:'18px auto'}}><div style={{textAlign:'center'}}><b style={{fontSize:25}}>{items.length}</b><div style={style.muted}>total</div></div></div><p style={style.muted}>● {items.length} concorrentes monitorados</p></div>
    <div style={{...style.surface,padding:16}}><b>💡 Dicas e insights</b><p style={style.muted}>Nenhum sinal urgente agora.</p></div>
   </aside>
   </div>
   {toast&&<div role="status" style={{position:'fixed',bottom:18,right:18,background:'#123b6a',color:'white',padding:15,borderRadius:10,zIndex:80,maxWidth:330}}>{toast} <button onClick={()=>setToast('')} style={{marginLeft:10}}>×</button></div>}
   <style>{'@media(max-width:1050px){.demo-layout{grid-template-columns:1fr!important}.demo-aside{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}}@media(max-width:690px){.demo-card{grid-template-columns:minmax(0,1fr) 85px!important}.demo-card>div:first-child{grid-column:1/-1}.demo-card>div:nth-child(3){grid-column:1}.demo-card>div:nth-child(4){grid-column:2;grid-row:2}.demo-popup{right:0!important}}'}</style>
  </div>
 </main>;
}