'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {fetchJsonWithTimeout} from '../lib/client-async';

const MENU=[
  {type:'item',label:'Dashboard',icon:'⌂',tone:'violet',href:'/'},
  {type:'group',id:'products',label:'Produtos',icon:'▱',tone:'blue',href:'/produtos',children:[
    {label:'Super Análise',icon:'▤',tone:'indigo',href:'/super-analise'},
    {label:'Super Anúncio',icon:'▣',tone:'cyan',href:'/extensao-shopee-intelligence?section=super-anuncio'},
    {label:'Concorrentes',icon:'⌘',tone:'orange',href:'/extensao-shopee-intelligence?section=concorrentes'},
    {label:'Reanálises',icon:'↻',tone:'purple',href:'/extensao-shopee-intelligence?section=reanalises'},
    {label:'Prioridades',icon:'☆',tone:'amber',href:'/extensao-shopee-intelligence?section=prioridades'},
    {label:'Relatórios',icon:'▤',tone:'teal',href:'/extensao-shopee-intelligence?section=relatorios'}
  ]},
  {type:'item',label:'Pedidos',icon:'▥',tone:'slate',href:'/pedidos'},
  {type:'group',id:'ads',label:'Shopee Ads',icon:'◎',tone:'coral',href:'/extensao-shopee-intelligence?section=shopee-ads',children:[
    {label:'Proteção ROAS',icon:'◈',tone:'green',href:'/protecao-roas'}
  ]},
  {type:'item',label:'Temas',icon:'◐',tone:'pink',href:'/?section=temas'},
  {type:'item',label:'Configurações',icon:'⚙',tone:'slate',href:'/?section=config'}
];

const STORAGE_GROUPS='gs-sidebar-open-groups-v1';
const STORAGE_SHOP='gs-shop-state-v2';

function routeState(pathname,section){
  if(pathname==='/'){
    if(section==='temas')return{label:'Temas'};
    if(section==='config')return{label:'Configurações'};
    return{label:'Dashboard'};
  }
  if(pathname.startsWith('/produtos'))return{label:'Produtos',group:'products'};
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

function loadStoredGroups(){
  try{
    const parsed=JSON.parse(localStorage.getItem(STORAGE_GROUPS)||'{}');
    return parsed&&typeof parsed==='object'?parsed:{};
  }catch{return{}}
}

function Icon({item}){return <span className="gs-nav-icon" data-tone={item.tone}>{item.icon}</span>}

function AppSidebar({active,activeGroup,section,onNavigate,onCloseMobile}){
  const [open,setOpen]=useState({products:true,ads:false});
  const [extension,setExtension]=useState('checking');
  const [shop,setShop]=useState({status:'checking',connected:null,paused:false,shopId:null,shopName:null,error:''});
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    const stored=loadStoredGroups();
    setOpen(prev=>({...prev,...stored,...(activeGroup?{[activeGroup]:true}:{})}));
  },[activeGroup]);

  function toggleGroup(id){
    setOpen(prev=>{
      const next={...prev,[id]:!prev[id]};
      try{localStorage.setItem(STORAGE_GROUPS,JSON.stringify(next))}catch{}
      return next;
    });
  }

  useEffect(()=>{
    let alive=true;
    const ready=()=>alive&&setExtension('connected');
    const onMessage=e=>{
      if(e.source===window&&e.data?.source==='GS_EXTENSION'&&(e.data?.type==='GS_EXTENSION_READY'||e.data?.type==='GS_EXTENSION_PONG'))ready();
    };
    const inspect=()=>{
      if(document.documentElement?.dataset?.gsExtensionBridge==='ready'||document.getElementById('gs-extension-bridge-marker')||document.querySelector('meta[name="gestor-senior-extension"]'))ready();
      window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin);
    };
    window.addEventListener('message',onMessage);
    window.addEventListener('gs-extension-ready',ready);
    inspect();
    const ping=setInterval(inspect,1800);
    const missing=setTimeout(()=>alive&&setExtension(x=>x==='checking'?'missing':x),6500);
    return()=>{alive=false;clearInterval(ping);clearTimeout(missing);window.removeEventListener('message',onMessage);window.removeEventListener('gs-extension-ready',ready)};
  },[]);

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
        const expanded=!!open[entry.id]||activeGroup===entry.id;
        return <div className="gs-nav-group" data-open={expanded?'true':'false'} key={entry.id}>
          <div className="gs-nav-parent">
            <Link href={entry.href} onClick={onNavigate} className={active===entry.label?'is-active':''}>
              <Icon item={entry}/><span>{entry.label}</span>
            </Link>
            <button type="button" onClick={()=>toggleGroup(entry.id)} aria-label={expanded?`Recolher ${entry.label}`:`Expandir ${entry.label}`} aria-expanded={expanded}>⌄</button>
          </div>
          <div className="gs-nav-submenu">
            {entry.children.map(child=><Link key={child.label} href={child.href} onClick={onNavigate} className={active===child.label?'is-active':''}>
              <Icon item={child}/><span>{child.label}</span>
            </Link>)}
          </div>
        </div>
      })}
    </nav>

    <div className="gs-sidebar-status">
      <div className="gs-status-row"><i data-ok={extension==='connected'?'true':'false'}/><div><b>Motor Senior</b><small>{extension==='checking'?'Verificando extensão…':extension==='connected'?'Extensão conectada':'Extensão não detectada'}</small></div></div>
      <div className="gs-status-row"><i data-ok={shop.connected===true?'true':'false'}/><div><b>Loja Shopee</b><small>{shopText}</small></div></div>
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
    <AppSidebar active={route.label} activeGroup={route.group} section={section} onNavigate={close} onCloseMobile={close}/>
    <div className="gs-mobile-bar">
      <button type="button" onClick={()=>setDrawer(true)} aria-label="Abrir menu">☰</button>
      <span className="gs-logo-mark">GS</span><b>Gestor Sênior</b><small>{route.label||'Painel'}</small>
    </div>
    {drawer&&<button type="button" className="gs-drawer-backdrop" onClick={close} aria-label="Fechar menu"/>}
    <main className="gs-app-main">{children}</main>
  </div>
}
