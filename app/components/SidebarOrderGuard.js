'use client';

import {useLayoutEffect} from 'react';

const MENU_TREE=[
  {type:'item',label:'Dashboard',icon:'⌂',tone:'violet',href:'/'},
  {type:'group',id:'products',label:'Produtos',icon:'▱',tone:'blue',href:'/produtos',children:[
    {label:'Super Análise',icon:'▤',tone:'indigo',href:'/super-analise'},
    {label:'Super Anúncio',icon:'▣',tone:'cyan',href:'/extensao-shopee-intelligence?section=super-anuncio'},
    {label:'Concorrentes',icon:'⌘',tone:'orange',href:'/extensao-shopee-intelligence?section=concorrentes'},
    {label:'Reanálises',icon:'↻',tone:'purple',href:'/extensao-shopee-intelligence?section=reanalises'},
    {label:'Prioridades',icon:'☆',tone:'amber',href:'/extensao-shopee-intelligence?section=prioridades'},
    {label:'Relatórios',icon:'▤',tone:'teal',href:'/extensao-shopee-intelligence?section=relatorios'}
  ]},
  {type:'group',id:'ads',label:'Shopee Ads',icon:'◎',tone:'coral',href:'/extensao-shopee-intelligence?section=shopee-ads',children:[
    {label:'Proteção ROAS',icon:'◈',tone:'green',href:'/protecao-roas'}
  ]},
  {type:'item',label:'Temas',icon:'◐',tone:'pink',href:'/?section=temas'},
  {type:'item',label:'Configurações',icon:'⚙',tone:'slate',href:'/?section=config'}
];

export const GS_MENU_ORDER=MENU_TREE.flatMap(x=>x.type==='group'?[{label:x.label,icon:x.icon,href:x.href},...x.children]:[x]);
const PRODUCT_LABELS=new Set(['Produtos','Super Análise','Super Anúncio','Concorrentes','Reanálises','Prioridades','Relatórios']);
const ADS_LABELS=new Set(['Shopee Ads','Proteção ROAS']);
const SHOP_CACHE_KEY='gs-shop-state-v1';

function activeLabel(){
  const path=location.pathname;
  const section=new URLSearchParams(location.search).get('section')||'';
  const hash=location.hash;
  if(path==='/'){
    if(section==='temas')return'Temas';
    if(section==='config')return'Configurações';
    return'Dashboard';
  }
  if(path.startsWith('/produtos'))return'Produtos';
  if(path.startsWith('/super-analise'))return'Super Análise';
  if(path.startsWith('/protecao-roas'))return'Proteção ROAS';
  if(path.startsWith('/extensao-shopee-intelligence')){
    if(section==='concorrentes'||hash==='#concorrentes')return'Concorrentes';
    if(section==='shopee-ads'||hash==='#shopee-ads')return'Shopee Ads';
    if(section==='reanalises'||hash==='#reanálises')return'Reanálises';
    if(section==='prioridades'||hash==='#prioridades')return'Prioridades';
    if(section==='relatorios'||hash==='#relatorios')return'Relatórios';
    return'Super Anúncio';
  }
  return'';
}

function makeIcon(item){
  const icon=document.createElement('span');
  icon.dataset.gsMenuIcon='true';
  icon.dataset.gsTone=item.tone||'blue';
  icon.textContent=item.icon;
  return icon;
}
function makeLink(item,{sub=false,parent=false,active=false}={}){
  const a=document.createElement('a');
  a.href=item.href;
  a.dataset.gsMenuItem=item.label;
  if(sub)a.dataset.gsSubmenuItem='true';
  if(parent)a.dataset.gsGroupParent='true';
  if(active){a.dataset.gsActive='true';a.setAttribute('aria-current','page');}
  a.appendChild(makeIcon(item));
  const label=document.createElement('span');
  label.dataset.gsMenuLabel='true';
  label.textContent=item.label;
  a.appendChild(label);
  if(parent){
    const chevron=document.createElement('span');
    chevron.dataset.gsMenuChevron='true';
    chevron.textContent='›';
    a.appendChild(chevron);
  }
  return a;
}
function buildNav(nav){
  const active=activeLabel();
  const signature='v4:'+active;
  if(nav.dataset.gsMenuSignature===signature&&nav.querySelector('[data-gs-menu-root="true"]'))return;
  const root=document.createElement('div');
  root.dataset.gsMenuRoot='true';
  for(const entry of MENU_TREE){
    if(entry.type==='item'){
      root.appendChild(makeLink(entry,{active:entry.label===active}));
      continue;
    }
    const group=document.createElement('div');
    group.dataset.gsMenuGroup=entry.id;
    const expanded=(entry.id==='products'&&PRODUCT_LABELS.has(active))||(entry.id==='ads'&&ADS_LABELS.has(active));
    group.dataset.gsExpanded=expanded?'true':'false';
    group.appendChild(makeLink(entry,{parent:true,active:entry.label===active}));
    const children=document.createElement('div');
    children.dataset.gsSubmenu='true';
    for(const child of entry.children)children.appendChild(makeLink(child,{sub:true,active:child.label===active}));
    group.appendChild(children);
    root.appendChild(group);
  }
  nav.replaceChildren(root);
  nav.dataset.gsMenuSignature=signature;
  nav.dataset.gsMenuReady='true';
}

function findSidebarNavs(){
  return [...document.querySelectorAll('aside nav')].filter(nav=>nav.closest('aside'));
}
function extensionReady(){
  return document.documentElement?.dataset?.gsExtensionBridge==='ready'||
    !!document.getElementById('gs-extension-bridge-marker')||
    !!document.querySelector('meta[name="gestor-senior-extension"]');
}

let shopState={connected:null,paused:false,shopId:null,shopName:null,error:null,checkedAt:0};

function hydrateShopState(){
  try{
    const parsed=JSON.parse(sessionStorage.getItem(SHOP_CACHE_KEY)||'null');
    if(parsed&&typeof parsed==='object'&&typeof parsed.connected==='boolean'){
      shopState={
        connected:parsed.connected,
        paused:!!parsed.paused,
        shopId:parsed.shopId||null,
        shopName:parsed.shopName||null,
        error:null,
        checkedAt:Number(parsed.checkedAt)||0
      };
    }
  }catch{}
}
function cacheShopState(){
  try{
    sessionStorage.setItem(SHOP_CACHE_KEY,JSON.stringify({
      connected:shopState.connected,
      paused:shopState.paused,
      shopId:shopState.shopId,
      shopName:shopState.shopName,
      checkedAt:shopState.checkedAt
    }));
  }catch{}
}
async function refreshShop(){
  try{
    const r=await fetch('/api/shopee/connection',{cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Falha ao verificar loja');
    shopState={
      connected:!!j.connected,
      paused:!!j.paused,
      shopId:j.shopId||null,
      shopName:j.shopName||null,
      error:null,
      checkedAt:Date.now()
    };
    cacheShopState();
  }catch(e){
    // Uma falha transitória não transforma uma loja que estava conectada em "desconectada".
    // Mantemos o último estado confirmado e tentamos de novo no próximo ciclo.
    shopState={...shopState,error:String(e?.message||e)};
  }
  renderStatusCards();
}
function statusRow(icon,title,value,ok){
  const row=document.createElement('div');
  row.dataset.gsStatusRow='true';
  const badge=document.createElement('span');
  badge.dataset.gsStatusIcon='true';
  badge.textContent=icon;
  badge.dataset.gsStatusOk=ok?'true':'false';
  const copy=document.createElement('div');
  const b=document.createElement('b');
  b.textContent=title;
  const s=document.createElement('small');
  s.textContent=value;
  copy.append(b,s);
  row.append(badge,copy);
  return row;
}
function renderStatusCards(){
  const extReady=extensionReady();
  const shopLabel=shopState.connected===null
    ?'Verificando loja…'
    :shopState.connected
      ?(shopState.shopName||('Loja #'+(shopState.shopId||'')))
      :(shopState.paused?'Loja pausada':'Loja desconectada');
  const signature=[
    extReady?'1':'0',
    shopState.connected===null?'?':shopState.connected?'1':'0',
    shopState.paused?'1':'0',
    shopState.shopId||'',
    shopState.shopName||''
  ].join('|');

  document.querySelectorAll('aside').forEach(aside=>{
    if(!aside.querySelector('nav'))return;
    let card=aside.querySelector('[data-gs-system-status]');
    if(!card){
      card=document.createElement('div');
      card.dataset.gsSystemStatus='true';
      aside.appendChild(card);
    }
    if(card.dataset.gsStatusSignature===signature)return;
    card.dataset.gsStatusSignature=signature;
    card.replaceChildren();
    card.appendChild(statusRow('●','Motor Senior',extReady?'Extensão conectada':'Extensão não detectada',extReady));
    card.appendChild(statusRow('◆','Loja Shopee',shopLabel,shopState.connected===true));

    let action;
    if(shopState.connected===null){
      action=document.createElement('button');
      action.type='button';
      action.disabled=true;
      action.textContent='Verificando…';
    }else if(shopState.connected){
      action=document.createElement('button');
      action.type='button';
      action.textContent='Sair da loja';
      action.onclick=async()=>{
        if(action.disabled)return;
        action.disabled=true;
        action.textContent='Saindo…';
        try{
          const r=await fetch('/api/shopee/logout',{method:'POST',cache:'no-store'});
          if(!r.ok)throw new Error('Falha ao desconectar.');
          try{sessionStorage.removeItem(SHOP_CACHE_KEY);}catch{}
          location.href='/';
        }catch{
          action.disabled=false;
          action.textContent='Tentar sair novamente';
        }
      };
    }else if(shopState.paused){
      action=document.createElement('button');
      action.type='button';
      action.textContent='Entrar com a Shopee';
      action.onclick=async()=>{
        if(action.disabled)return;
        action.disabled=true;
        action.textContent='Entrando…';
        try{
          const r=await fetch('/api/shopee/resume',{method:'POST',cache:'no-store'});
          if(!r.ok)throw new Error('Falha ao reconectar.');
          try{sessionStorage.removeItem(SHOP_CACHE_KEY);}catch{}
          location.reload();
        }catch{
          action.disabled=false;
          action.textContent='Tentar novamente';
        }
      };
    }else{
      action=document.createElement('a');
      action.href='/api/shopee/authorize';
      action.textContent='Conectar loja';
    }
    action.dataset.gsShopAction='true';
    card.appendChild(action);
  });
}

function removeLegacyStatusCards(){
  document.querySelectorAll('aside').forEach(aside=>{
    aside.querySelectorAll('div[class*="_engineCard__"],div[class*="_extCard__"],div[class*="_motor__"]').forEach(el=>{
      if(!el.hasAttribute('data-gs-system-status'))el.remove();
    });
  });
}
function normalizeAll(){
  findSidebarNavs().forEach(buildNav);
  removeLegacyStatusCards();
  renderStatusCards();
}

export default function SidebarOrderGuard(){
  useLayoutEffect(()=>{
    hydrateShopState();
    normalizeAll();
    refreshShop();

    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        normalizeAll();
      });
    });
    observer.observe(document.body,{childList:true,subtree:true});

    const onRoute=()=>{
      document.querySelectorAll('aside nav').forEach(n=>delete n.dataset.gsMenuSignature);
      normalizeAll();
    };
    const onReady=()=>renderStatusCards();
    const heartbeat=setInterval(renderStatusCards,2500);
    const shopTimer=setInterval(refreshShop,30000);

    window.addEventListener('popstate',onRoute);
    window.addEventListener('hashchange',onRoute);
    window.addEventListener('gs-extension-ready',onReady);
    return()=>{
      observer.disconnect();
      clearInterval(heartbeat);
      clearInterval(shopTimer);
      window.removeEventListener('popstate',onRoute);
      window.removeEventListener('hashchange',onRoute);
      window.removeEventListener('gs-extension-ready',onReady);
    };
  },[]);
  return null;
}
