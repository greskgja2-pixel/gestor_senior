'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {fetchJsonWithTimeout,motorData} from '../lib/client-async';

const MENU=[
  {type:'item',label:'Dashboard',icon:'⌂',tone:'violet',href:'/'},
  {type:'item',label:'Super Análise',icon:'▤',tone:'indigo',href:'/super-analise'},
  {type:'item',label:'Super Anúncio',icon:'▣',tone:'cyan',href:'/extensao-shopee-intelligence?section=super-anuncio'},
  {type:'item',label:'Reanálises',icon:'↻',tone:'purple',href:'/extensao-shopee-intelligence?section=reanalises'},
  {type:'item',label:'Prioridades',icon:'☆',tone:'amber',href:'/extensao-shopee-intelligence?section=prioridades'},
  {type:'item',label:'Relatórios',icon:'▤',tone:'teal',href:'/extensao-shopee-intelligence?section=relatorios'},
  {type:'group',id:'ads',label:'Shopee Ads',icon:'◎',tone:'coral',href:'/extensao-shopee-intelligence?section=shopee-ads',children:[
    {label:'Proteção ROAS',icon:'◈',tone:'green',href:'/protecao-roas'}
  ]},
  {type:'item',label:'Temas',icon:'◐',tone:'pink',href:'/?section=temas'},
  {type:'item',label:'Configurações',icon:'⚙',tone:'slate',href:'/?section=config'}
];

const STORAGE_SHOP='gs-shop-state-v2';

function bestProductImage(product){
  const rows=[
    product?.imageUrl,product?.image_url,
    ...(Array.isArray(product?.imageUrls)?product.imageUrls:[]),
    ...(Array.isArray(product?.image_urls)?product.image_urls:[]),
    ...(Array.isArray(product?.images)?product.images.map(x=>typeof x==='string'?x:(x?.url||x?.image_url||x?.imageUrl)):[]),
    ...(Array.isArray(product?.image?.image_url_list)?product.image.image_url_list:[])
  ].map(v=>String(v||'').trim()).filter(Boolean).filter(u=>/^https?:\/\//i.test(u)&&!/\.svg(?:\?|$)/i.test(u)&&!/productdetailspage|avatar|icon|logo/i.test(u));
  const score=u=>{let value=0;if(/down-br\.img\.susercontent\.com\/file\//i.test(u))value+=5;if(/\/br-11134207-/i.test(u))value+=10;if(/_tn(?:\?|$)/i.test(u))value-=6;if(/_cover(?:\?|$)/i.test(u))value-=8;if(/review|rating|profile/i.test(u))value-=10;return value};
  return rows.map((u,i)=>({u,i,score:score(u)})).sort((a,b)=>b.score-a.score||a.i-b.i)[0]?.u||null;
}

function isStructuredProduct(product,data,source){
  if(/pdp_get_pc|structured|api/.test(source))return true;
  if(product?.ratingDebug?.pdpGetPc?.ok===true||product?.rating_debug?.pdp_get_pc?.ok===true)return true;
  if(product?.validation?.pdpGetPc?.ok===true||product?.validation?.pdp_get_pc?.ok===true)return true;
  if(data?.ratingDebug?.pdpGetPc?.ok===true||data?.rating_debug?.pdp_get_pc?.ok===true)return true;
  return false;
}

function routeState(pathname,section){
  if(pathname==='/'){
    if(section==='temas')return{label:'Temas'};
    if(section==='config')return{label:'Configurações'};
    return{label:'Dashboard'};
  }
  if(pathname.startsWith('/produtos'))return{label:'Super Análise',group:'products'};
  if(pathname.startsWith('/pedidos'))return{label:'Pedidos'};
  if(pathname.startsWith('/super-analise'))return{label:'Super Análise',group:'products'};
  if(pathname.startsWith('/protecao-roas'))return{label:'Proteção ROAS',group:'ads'};
  if(pathname.startsWith('/extensao-shopee-intelligence')){
    const map={
      'super-anuncio':'Super Anúncio',
      concorrentes:'Concorrentes',
      reanalises:'Reanálises',
      prioridades:'Prioridades',
      relatorios:'Relatórios',
      'shopee-ads':'Shopee Ads'
    };
    const label=map[section]||'Super Anúncio';
    return{label,group:label==='Shopee Ads'?'ads':'products'};
  }
  return{label:''};
}

function Icon({item}){return <span className="gs-nav-icon" data-tone={item.tone}>{item.icon}</span>}

function AppSidebar({active,onNavigate,onCloseMobile}){
  const [extension,setExtension]=useState({status:'checking',version:''});
  const [shop,setShop]=useState({status:'checking',connected:null,paused:false,shopId:null,shopName:null,error:''});
  const [busy,setBusy]=useState(false);
  const [competitorSync,setCompetitorSync]=useState({phase:'idle',due:0,updated:0,failed:0,message:''});
  const competitorSyncRef=useRef({running:false,lastAt:0});

  useEffect(()=>{
    let alive=true;
    const ready=versionValue=>{
      if(!alive)return;
      setExtension(prev=>({status:'connected',version:String(versionValue||prev.version||'').trim()}));
      autoRefreshCompetitors();
    };
    const onMessage=e=>{
      if(e.source===window&&e.data?.source==='GS_EXTENSION'&&(e.data?.type==='GS_EXTENSION_READY'||e.data?.type==='GS_EXTENSION_PONG'))ready(e.data.version||'');
    };
    const onReadyEvent=e=>ready(e?.detail?.version||'');
    const inspect=()=>{
      const meta=document.querySelector('meta[name="gestor-senior-extension"]');
      const detected=document.documentElement?.dataset?.gsExtensionBridge==='ready'||document.getElementById('gs-extension-bridge-marker')||meta;
      if(detected)ready(meta?.content&&meta.content!=='ready'?meta.content:'');
      window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin);
    };
    window.addEventListener('message',onMessage);
    window.addEventListener('gs-extension-ready',onReadyEvent);
    inspect();
    const ping=setInterval(inspect,1800);
    const missing=setTimeout(()=>alive&&setExtension(prev=>prev.status==='checking'?{...prev,status:'missing'}:prev),6500);
    return()=>{alive=false;clearInterval(ping);clearTimeout(missing);window.removeEventListener('message',onMessage);window.removeEventListener('gs-extension-ready',onReadyEvent)};
  },[]);

  async function autoRefreshCompetitors(){
    const state=competitorSyncRef.current;
    if(state.running||Date.now()-state.lastAt<5*60*1000)return;
    state.running=true;state.lastAt=Date.now();
    try{
      const queue=await fetchJsonWithTimeout('/api/competitor-monitor?due=1',{cache:'no-store'},12000);
      const watches=Array.isArray(queue?.watches)?queue.watches:[];
      setCompetitorSync({phase:watches.length?'running':'idle',due:watches.length,updated:0,failed:0,message:watches.length?'Atualizando concorrentes vencidos…':'Nenhum concorrente vencido.'});
      if(!watches.length)return;
      let updated=0,failed=0;
      for(const watch of watches.slice(0,6)){
        try{
          const data=await motorData('collectProduct',{url:watch.competitor_url,reason:'scheduled-competitor-refresh',expectedItemId:String(watch.competitor_item_id)},45000);
          const p=data?.product||data;
          const itemId=String(p?.itemId??p?.item_id??''),shopId=String(p?.shopId??p?.shop_id??'');
          if(itemId!==String(watch.competitor_item_id)||shopId!==String(watch.competitor_shop_id))throw new Error('A extensão retornou outro anúncio.');
          const source=String(p?.ratingSource||p?.validationSource||p?.source||data?.source||'').toLowerCase();
          const structured=isStructuredProduct(p,data,source);
          if(!structured)throw new Error('Coleta estruturada do concorrente ainda não foi confirmada; snapshot descartado.');
          const imageUrl=bestProductImage(p);
          await fetchJsonWithTimeout('/api/competitor-monitor',{
            method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
            body:JSON.stringify({
              watch_id:watch.id,title:p?.title||p?.item_name||watch.competitor_title,
              price:p?.price??p?.currentPrice??null,sold:p?.sold??p?.historicalSold??null,
              rating:p?.rating??null,stock:p?.stock??null,image_url:imageUrl,
              source:source||'pdp_get_pc_intercepted',confidence:'structured',
              raw:{ratingSource:p?.ratingSource||null,validationSource:p?.validationSource||null,imageCount:p?.imageCount??(Array.isArray(p?.imageUrls)?p.imageUrls.length:null),categoryId:p?.categoryId??p?.category_id??null,pdpGetPcOk:p?.ratingDebug?.pdpGetPc?.ok===true||p?.rating_debug?.pdp_get_pc?.ok===true}
            })
          },15000);
          updated++;
        }catch(error){
          failed++;
          console.warn('[CompetitorAutoRefresh] concorrente não atualizado',watch?.competitor_item_id,error);
        }
        setCompetitorSync({phase:'running',due:watches.length,updated,failed,message:`Atualizados ${updated} · falhas ${failed}`});
        await new Promise(resolve=>setTimeout(resolve,1800));
      }
      const remaining=Math.max(0,watches.length-updated-failed);
      setCompetitorSync({
        phase:failed?'warning':'success',due:watches.length,updated,failed,
        message:failed?`${updated} atualizado(s); ${failed} aguardam nova tentativa.`:`${updated} concorrente(s) atualizado(s) automaticamente.`
      });
      if(remaining>0)setTimeout(()=>{competitorSyncRef.current.lastAt=0;autoRefreshCompetitors()},5*60*1000);
    }catch(error){
      console.warn('[CompetitorAutoRefresh] fila indisponível',error);
      setCompetitorSync({phase:'warning',due:0,updated:0,failed:0,message:'Não foi possível consultar a fila de concorrentes.'});
    }finally{competitorSyncRef.current.running=false}
  }

  async function refreshShop(){
    setShop(prev=>({...prev,status:prev.connected===null?'checking':'refreshing',error:''}));
    try{
      const data=await fetchJsonWithTimeout('/api/shopee/connection',{cache:'no-store'},10000);
      const next={status:'success',connected:!!data.connected,paused:!!data.paused,shopId:data.shopId||null,shopName:data.shopName||null,error:''};
      setShop(next);
      try{sessionStorage.setItem(STORAGE_SHOP,JSON.stringify(next))}catch{}
    }catch(error){
      console.error('[AppSidebar] connection refresh failed',error);
      setShop(prev=>({...prev,status:'error',error:error?.code==='timeout'?'Tempo esgotado ao verificar a loja.':'Não foi possível verificar a loja agora.'}));
    }
  }

  useEffect(()=>{
    try{
      const cached=JSON.parse(sessionStorage.getItem(STORAGE_SHOP)||'null');
      if(cached&&typeof cached.connected==='boolean')setShop({...cached,status:'success',error:''});
    }catch{}
    refreshShop();
    const timer=setInterval(refreshShop,30000);
    return()=>clearInterval(timer);
  },[]);

  async function shopAction(){
    if(busy)return;
    setBusy(true);
    try{
      if(shop.connected){
        await fetchJsonWithTimeout('/api/shopee/logout',{method:'POST',cache:'no-store'},15000);
      }else if(shop.paused){
        await fetchJsonWithTimeout('/api/shopee/resume',{method:'POST',cache:'no-store'},15000);
      }else{
        location.href='/api/shopee/authorize';
        return;
      }
      try{sessionStorage.removeItem(STORAGE_SHOP)}catch{}
      await refreshShop();
      location.reload();
    }catch(error){
      console.error('[AppSidebar] shop action failed',error);
      setShop(prev=>({...prev,status:'error',error:error?.code==='timeout'?'A ação expirou. Tente novamente.':'A ação falhou. Tente novamente.'}));
    }finally{setBusy(false)}
  }

  const extensionVersion=extension.version?`${/^v/i.test(extension.version)?'':'v'}${extension.version}`:'';

  const shopText=shop.connected===true
    ?(shop.shopName||(`Loja #${shop.shopId||'conectada'}`))
    :shop.connected===false
      ?(shop.paused?'Loja pausada':'Loja desconectada')
      :'Verificando loja…';

  return <aside className="gs-sidebar" aria-label="Navegação principal">
    <div className="gs-sidebar-brand">
      <span className="gs-logo-mark">GS</span>
      <div><b>Gestor Sênior</b><small>Shopee Intelligence</small></div>
      <button type="button" className="gs-mobile-close" onClick={onCloseMobile} aria-label="Fechar menu">×</button>
    </div>

    <nav className="gs-nav">
      {MENU.map(entry=>{
        if(entry.type==='item'){
          return <Link key={entry.label} href={entry.href} onClick={onNavigate} className={active===entry.label?'is-active':''}>
            <Icon item={entry}/><span>{entry.label}</span>
          </Link>
        }
        return <div className="gs-nav-group" key={entry.id}>
          <Link href={entry.href} onClick={onNavigate} className={'gs-nav-parent-link '+(active===entry.label?'is-active':'')}>
            <Icon item={entry}/><span>{entry.label}</span>
          </Link>
          <div className="gs-nav-submenu">
            {entry.children.map(child=><Link key={child.label} href={child.href} onClick={onNavigate} className={active===child.label?'is-active':''}>
              <Icon item={child}/><span>{child.label}</span>
            </Link>)}
          </div>
        </div>
      })}
    </nav>

    <div className="gs-sidebar-status">
      <div className="gs-status-row"><i data-ok={extension.status==='connected'?'true':'false'}/><div><b>Motor Senior</b><small>{extension.status==='checking'?'Verificando extensão…':extension.status==='connected'?`Extensão conectada${extensionVersion?` · ${extensionVersion}`:''}`:'Extensão não detectada'}</small></div></div>
      <div className="gs-status-row"><i data-ok={shop.connected===true?'true':'false'}/><div><b>Loja Shopee</b><small>{shopText}</small></div></div>
      {extension.status==='connected'&&competitorSync.message&&<div className="gs-status-row"><i data-ok={competitorSync.phase==='success'||competitorSync.phase==='idle'?'true':'false'}/><div><b>Radar de concorrentes</b><small>{competitorSync.message}</small></div></div>}
      {shop.error&&<div className="gs-status-error">{shop.error}</div>}
      <button type="button" onClick={shopAction} disabled={busy||shop.status==='checking'}>
        {busy?'Aguarde…':shop.connected?'Sair da loja':shop.paused?'Entrar com a Shopee':'Conectar loja'}
      </button>
      {shop.status==='error'&&<button type="button" className="gs-status-retry" onClick={refreshShop} disabled={busy}>Tentar verificar novamente</button>}
    </div>
  </aside>
}

export default function AppShell({children}){
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const section=searchParams.get('section')||'';
  const [drawer,setDrawer]=useState(false);

  useEffect(()=>{setDrawer(false)},[pathname,section]);

  const route=useMemo(()=>routeState(pathname,section),[pathname,section]);
  const close=()=>setDrawer(false);

  return <div className="gs-app-shell" data-drawer={drawer?'open':'closed'}>
    <AppSidebar active={route.label} onNavigate={close} onCloseMobile={close}/>
    <div className="gs-mobile-bar">
      <button type="button" onClick={()=>setDrawer(true)} aria-label="Abrir menu">☰</button>
      <span className="gs-logo-mark">GS</span><b>Gestor Sênior</b><small>{route.label||'Painel'}</small>
    </div>
    {drawer&&<button type="button" className="gs-drawer-backdrop" onClick={close} aria-label="Fechar menu"/>}
    <main className="gs-app-main">{children}</main>
  </div>
}
