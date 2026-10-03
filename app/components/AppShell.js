'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {fetchJsonWithTimeout} from '../lib/client-async';

const MENU=[
  {type:'item',label:'Dashboard',icon:'⌂',tone:'violet',href:'/'},
  {type:'item',label:'Insights da Loja',icon:'✦',tone:'orange',href:'/insights'},
  {type:'item',label:'Análise de Funil',icon:'▽',tone:'cyan',href:'/funil'},
  {type:'item',label:'Promoções',icon:'⚡',tone:'amber',href:'/promocoes'},
  {type:'item',label:'Messenger',icon:'✉',tone:'green',href:'/messenger'},
  {type:'item',label:'Super Análise',icon:'▤',tone:'indigo',href:'/super-analise'},
  {type:'item',label:'Pesquisa de Produtos',icon:'⌕',tone:'green',href:'/pesquisa-produtos'},
  {type:'item',label:'Favoritos',icon:'★',tone:'amber',href:'/favoritos'},
  {type:'item',label:'Super Anúncio',icon:'▣',tone:'cyan',href:'/extensao-shopee-intelligence?section=super-anuncio'},
  {type:'item',label:'Concorrentes',icon:'⌘',tone:'blue',href:'/extensao-shopee-intelligence?section=concorrentes'},
  {type:'item',label:'Reanálises',icon:'↻',tone:'purple',href:'/extensao-shopee-intelligence?section=reanalises'},
  {type:'item',label:'Prioridades',icon:'☆',tone:'amber',href:'/extensao-shopee-intelligence?section=prioridades'},
  {type:'item',label:'Relatórios',icon:'▤',tone:'teal',href:'/extensao-shopee-intelligence?section=relatorios'},
  {type:'group',id:'ads',label:'Shopee Ads',icon:'◎',tone:'coral',href:'/extensao-shopee-intelligence?section=shopee-ads',children:[
    {label:'Proteção ROAS',icon:'◈',tone:'green',href:'/protecao-roas'}
  ]},
  {type:'item',label:'Temas',icon:'◐',tone:'pink',href:'/?section=temas'},
  {type:'item',label:'Configurações',icon:'⚙',tone:'slate',href:'/?section=config'}
];

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
  if(pathname.startsWith('/insights'))return{label:'Insights da Loja'};
  if(pathname.startsWith('/funil'))return{label:'Análise de Funil'};
  if(pathname.startsWith('/promocoes'))return{label:'Promoções'};
  if(pathname.startsWith('/messenger'))return{label:'Messenger'};
  if(pathname.startsWith('/produtos'))return{label:'Super Análise',group:'products'};
  if(pathname.startsWith('/pesquisa-produtos'))return{label:'Pesquisa de Produtos'};
  if(pathname.startsWith('/favoritos'))return{label:'Favoritos'};
  if(pathname.startsWith('/pedidos'))return{label:'Pedidos'};
  if(pathname.startsWith('/super-analise'))return{label:'Super Análise',group:'products'};
  if(pathname.startsWith('/protecao-roas'))return{label:'Proteção ROAS',group:'ads'};
  if(pathname.startsWith('/admin'))return{label:'Usuários'};
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

function AppSidebar({active,onNavigate,onCloseMobile,account}){
  const [extension,setExtension]=useState({status:'checking',version:''});
  const [shop,setShop]=useState({status:'checking',connected:null,paused:false,shopId:null,shopName:null,error:''});
  const [busy,setBusy]=useState(false);
  const [openTasks,setOpenTasks]=useState(0);
  const [competitorCheck,setCompetitorCheck]=useState({phase:'idle',message:'Aguardando próxima checagem.'});

  useEffect(()=>{
    let alive=true;
    const ready=versionValue=>{
      if(!alive)return;
      // Detectar o Motor não inicia mais rechecagem automática de concorrentes.
      // A atualização fica sob controle do usuário na página Concorrentes.
      setExtension(prev=>({status:'connected',version:String(versionValue||prev.version||'').trim()}));
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


  useEffect(()=>{
    let alive=true;
    const restore=()=>{
      try{
        const saved=JSON.parse(sessionStorage.getItem('gs_competitor_check_status')||'null');
        if(saved&&alive)setCompetitorCheck(saved);
      }catch{}
    };
    const onStatus=e=>{if(alive)setCompetitorCheck(e?.detail||{phase:'idle',message:'Aguardando próxima checagem.'})};
    restore();
    window.addEventListener('gs-competitor-check-status',onStatus);
    return()=>{alive=false;window.removeEventListener('gs-competitor-check-status',onStatus)};
  },[]);

  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      try{
        const data=await fetchJsonWithTimeout('/api/tasks',{cache:'no-store'},10000);
        if(alive)setOpenTasks(Array.isArray(data?.tasks)?data.tasks.length:0);
      }catch{if(alive)setOpenTasks(0)}
    };
    load();
    const timer=setInterval(load,2*60*1000);
    window.addEventListener('focus',load);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load)};
  },[]);

  async function refreshShop(){
    setShop(prev=>({...prev,status:prev.connected===null?'checking':'refreshing',error:''}));
    try{
      const data=await fetchJsonWithTimeout('/api/shopee/connection',{cache:'no-store'},10000);
      const next={status:'success',connected:!!data.connected,paused:!!data.paused,shopId:data.shopId||null,shopName:data.shopName||null,error:''};
      setShop(next);
    }catch(error){
      console.error('[AppSidebar] connection refresh failed',error);
      setShop(prev=>({...prev,status:'error',error:error?.code==='timeout'?'Tempo esgotado ao verificar a loja.':'Não foi possível verificar a loja agora.'}));
    }
  }

  useEffect(()=>{
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
      {[...MENU,...(account?.isAdmin?[{type:'item',label:'Usuários',icon:'♛',tone:'amber',href:'/admin'}]:[])].map(entry=>{
        if(entry.type==='item'){
          return <Link key={entry.label} href={entry.href} onClick={onNavigate} className={active===entry.label?'is-active':''}>
            <Icon item={entry}/><span>{entry.label}</span>{entry.label==='Prioridades'&&openTasks>0&&<span className="gs-nav-badge">{openTasks>99?'99+':openTasks}</span>}
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
      <div className="gs-status-row"><i data-ok={competitorCheck.phase==='error'?'false':'true'}/><div><b>Checador de concorrentes</b><small>{competitorCheck.message||'Aguardando próxima checagem.'}</small></div></div>
      {shop.error&&<div className="gs-status-error">{shop.error}</div>}
      <button type="button" onClick={shopAction} disabled={busy||shop.status==='checking'}>
        {busy?'Aguarde…':shop.connected?'Sair da loja':shop.paused?'Entrar com a Shopee':'Entrar com minha loja Shopee'}
      </button>
      {account&&<div className="gs-account-actions"><small>{account.name||account.email}</small><button type="button" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});location.href='/login'}}>Sair da conta</button></div>}
      {shop.status==='error'&&<button type="button" className="gs-status-retry" onClick={refreshShop} disabled={busy}>Tentar verificar novamente</button>}
    </div>
  </aside>
}

function motorActivityText(detail={}){
  const period=detail?.payload?.period;
  const periodLabel=period==='past30days'?'30 dias':period==='past7days'?'7 dias':period==='real_time'?'hoje':period==='yesterday'?'ontem':'';
  const actions={
    sellerFunnel:periodLabel?`Coletando o funil de ${periodLabel} no Seller Center…`:'Coletando dados do funil no Seller Center…',
    collectProduct:'Lendo dados do anúncio na Shopee…',
    marketplaceSearch:'Pesquisando produtos e concorrentes na Shopee…',
    syncShopeeAds:'Atualizando dados do Shopee Ads…',
    syncProtectionStates:'Verificando Proteção de ROAS…',
    openCompetitorPicker:'Abrindo seleção de concorrentes…',
    analyzeAll:'Montando a Super Análise…',
    saveCosts:'Salvando custos do produto…'
  };
  return actions[detail.action]||'Motor Sênior trabalhando…';
}

function MotorActivityCard(){
  const [activity,setActivity]=useState(null);
  const [elapsed,setElapsed]=useState(0);
  const hideRef=useRef(null);

  useEffect(()=>{
    const onActivity=e=>{
      const d=e?.detail||{};
      if(hideRef.current){clearTimeout(hideRef.current);hideRef.current=null}
      if(d.phase==='start'){
        setElapsed(0);
        setActivity({...d,text:motorActivityText(d)});
        return;
      }
      if(d.phase==='progress'){
        setActivity(prev=>({...prev,...d,phase:'start',text:d.message||prev?.text||motorActivityText(d)}));
        return;
      }
      if(d.phase==='success'){
        setActivity(prev=>({...prev,...d,phase:'success',text:'Concluído. Dados recebidos do Motor Sênior.'}));
        hideRef.current=setTimeout(()=>setActivity(null),3500);
        return;
      }
      if(d.phase==='timeout'){
        setActivity(prev=>({...prev,...d,phase:'timeout',text:'O Motor Sênior não respondeu no tempo esperado.'}));
        hideRef.current=setTimeout(()=>setActivity(null),9000);
        return;
      }
      if(d.phase==='error'){
        setActivity(prev=>({...prev,...d,phase:'error',text:d.message||'O Motor Sênior encontrou um erro.'}));
        hideRef.current=setTimeout(()=>setActivity(null),9000);
      }
    };
    window.addEventListener('gs-motor-activity',onActivity);
    return()=>{window.removeEventListener('gs-motor-activity',onActivity);if(hideRef.current)clearTimeout(hideRef.current)};
  },[]);

  useEffect(()=>{
    if(!activity||activity.phase!=='start')return;
    const t=setInterval(()=>setElapsed(v=>v+1),1000);
    return()=>clearInterval(t);
  },[activity?.phase,activity?.requestId]);

  if(!activity)return null;
  const working=activity.phase==='start';
  return <div className="gs-motor-activity" data-phase={activity.phase} role="status" aria-live="polite">
    <span className="gs-motor-activity-icon">{working?<i/>:activity.phase==='success'?'✓':'!'}</span>
    <div><b>{working?'Motor Sênior trabalhando':'Motor Sênior'}</b><small>{activity.text}</small></div>
    {working&&<span className="gs-motor-activity-time">{activity.percent!=null?activity.percent+'% · ':''}{elapsed}s</span>}
  </div>;
}

const PUBLIC_PAGES=['/login','/cadastro','/apresentacao','/privacidade','/termos','/docs/tecnica','/status'];

export default function AppShell({children}){
  const pathname=usePathname();
  if(PUBLIC_PAGES.includes(pathname))return children;
  return <ProtectedAppShell pathname={pathname}>{children}</ProtectedAppShell>;
}

function ProtectedAppShell({children,pathname}){
  const searchParams=useSearchParams();
  const section=searchParams.get('section')||'';
  const [drawer,setDrawer]=useState(false);
  const [account,setAccount]=useState(null);

  useEffect(()=>{setDrawer(false)},[pathname,section]);

  useEffect(()=>{
    let alive=true;
    fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(alive)setAccount(data)}).catch(()=>{});
    const ping=()=>{if(document.visibilityState==='visible')fetch('/api/auth/activity',{method:'POST',cache:'no-store'}).catch(()=>{})};
    ping();const timer=setInterval(ping,60000);window.addEventListener('focus',ping);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',ping)};
  },[]);

  const route=useMemo(()=>routeState(pathname,section),[pathname,section]);
  const close=()=>setDrawer(false);

  return <div className="gs-app-shell" data-drawer={drawer?'open':'closed'}>
    <AppSidebar active={route.label} onNavigate={close} onCloseMobile={close} account={account}/>
    <MotorActivityCard/>
    <div className="gs-mobile-bar">
      <button type="button" onClick={()=>setDrawer(true)} aria-label="Abrir menu">☰</button>
      <span className="gs-logo-mark">GS</span><b>Gestor Sênior</b><small>{route.label||'Painel'}</small>
    </div>
    {drawer&&<button type="button" className="gs-drawer-backdrop" onClick={close} aria-label="Fechar menu"/>}
    <main className="gs-app-main">{children}</main>
  </div>
}
