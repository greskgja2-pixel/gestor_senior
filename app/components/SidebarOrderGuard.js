'use client';

import {useEffect} from 'react';

// ORDEM OFICIAL E IMUTAVEL DO MENU DO GESTOR SENIOR.
// A ordem acompanha o fluxo real de uso: visão geral -> escolher produto -> analisar -> acompanhar histórico.
export const GS_MENU_ORDER=[
  {label:'Dashboard',icon:'⌂',href:'/'},
  {label:'Produtos',icon:'▱',href:'/produtos'},
  {label:'Super Análise',icon:'▤',href:'/super-analise'},
  {label:'Super Anúncio',icon:'▣',href:'/extensao-shopee-intelligence'},
  {label:'Concorrentes',icon:'⌘',href:'/extensao-shopee-intelligence#concorrentes'},
  {label:'Shopee Ads',icon:'◎',href:'/extensao-shopee-intelligence#shopee-ads'},
  {label:'Reanálises',icon:'↻',href:'/extensao-shopee-intelligence#reanálises'},
  {label:'Prioridades',icon:'☆',href:'/extensao-shopee-intelligence#prioridades'},
  {label:'Relatórios',icon:'▤',href:'/extensao-shopee-intelligence#relatorios'}
];

const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();

function activeLabel(){
  const path=location.pathname;
  const hash=location.hash;
  if(path==='/')return'Dashboard';
  if(path.startsWith('/produtos'))return'Produtos';
  if(path.startsWith('/super-analise'))return'Super Análise';
  if(path.startsWith('/extensao-shopee-intelligence')){
    if(hash==='#concorrentes')return'Concorrentes';
    if(hash==='#shopee-ads')return'Shopee Ads';
    if(hash==='#reanálises')return'Reanálises';
    if(hash==='#prioridades')return'Prioridades';
    if(hash==='#relatorios')return'Relatórios';
    return'Super Anúncio';
  }
  return'';
}

function labelOf(a){
  if(a?.dataset?.gsMenuItem)return a.dataset.gsMenuItem;
  const text=norm(a?.textContent);
  return GS_MENU_ORDER.find(item=>text.includes(norm(item.label)))?.label||'';
}

function findSidebarNavs(){
  return [...document.querySelectorAll('aside nav')].filter(nav=>{
    const text=norm(nav.textContent);
    return ['dashboard','produtos','super análise','super anúncio'].filter(x=>text.includes(x)).length>=2;
  });
}

function setLinkContent(a,item){
  const span=a.querySelector('span');
  if(span){
    if(span.textContent!==item.label)span.textContent=item.label;
  }else{
    const desired=`${item.icon} ${item.label}`;
    if(a.textContent!==desired)a.textContent=desired;
  }
}

function normalizeNav(nav){
  const existing=[...nav.querySelectorAll(':scope > a')];
  const byLabel=new Map();
  for(const a of existing){
    const label=labelOf(a);
    if(label&&!byLabel.has(label))byLabel.set(label,a);
  }

  const active=activeLabel();
  const desired=GS_MENU_ORDER.map(item=>{
    let a=byLabel.get(item.label);
    if(!a)a=document.createElement('a');
    setLinkContent(a,item);
    if(a.getAttribute('href')!==item.href)a.setAttribute('href',item.href);
    a.dataset.gsMenuItem=item.label;
    if(item.label===active){
      if(a.getAttribute('aria-current')!=='page')a.setAttribute('aria-current','page');
      a.dataset.gsActive='true';
    }else{
      if(a.hasAttribute('aria-current'))a.removeAttribute('aria-current');
      if(a.dataset.gsActive)a.removeAttribute('data-gs-active');
    }
    return a;
  });

  for(const a of existing){
    if(!desired.includes(a))a.remove();
  }

  const current=[...nav.querySelectorAll(':scope > a')];
  const alreadyCorrect=current.length===desired.length&&desired.every((a,i)=>current[i]===a);
  if(!alreadyCorrect){
    const fragment=document.createDocumentFragment();
    desired.forEach(a=>fragment.appendChild(a));
    nav.appendChild(fragment);
  }
  nav.dataset.gsMenuReady='true';
}

function normalizeAll(){findSidebarNavs().forEach(normalizeNav);}

export default function SidebarOrderGuard(){
  useEffect(()=>{
    normalizeAll();
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;normalizeAll();});
    });
    observer.observe(document.body,{childList:true,subtree:true});
    const onRoute=()=>setTimeout(normalizeAll,0);
    window.addEventListener('popstate',onRoute);
    window.addEventListener('hashchange',onRoute);
    return()=>{observer.disconnect();window.removeEventListener('popstate',onRoute);window.removeEventListener('hashchange',onRoute);};
  },[]);
  return null;
}