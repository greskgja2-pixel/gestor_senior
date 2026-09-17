'use client';

import {useEffect} from 'react';

const MENU=[
  {label:'Dashboard',icon:'⌂',href:'/'},
  {label:'Super Anúncio',icon:'▣',href:'/extensao-shopee-intelligence'},
  {label:'Super Análise',icon:'▤',href:'/super-analise'},
  {label:'Produtos',icon:'▱',href:'/produtos'},
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
  if(path.startsWith('/super-analise'))return'Super Análise';
  if(path.startsWith('/produtos'))return'Produtos';
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

function findSidebarNavs(){
  return [...document.querySelectorAll('aside nav')].filter(nav=>{
    const text=norm(nav.textContent);
    return ['dashboard','super anúncio','produtos'].filter(x=>text.includes(x)).length>=2;
  });
}

function normalizeNav(nav){
  const existing=[...nav.querySelectorAll(':scope > a')];
  const byLabel=new Map();
  for(const a of existing){
    const text=norm(a.textContent);
    for(const item of MENU){
      if(text.includes(norm(item.label))&&!byLabel.has(item.label))byLabel.set(item.label,a);
    }
  }

  const active=activeLabel();
  for(const item of MENU){
    let a=byLabel.get(item.label);
    if(!a){
      a=document.createElement('a');
      a.textContent=`${item.icon} ${item.label}`;
    }else{
      const span=a.querySelector('span');
      if(span)span.textContent=item.label;
      else a.textContent=`${item.icon} ${item.label}`;
    }
    a.href=item.href;
    a.dataset.gsMenuItem=item.label;
    if(item.label===active){
      a.setAttribute('aria-current','page');
      a.dataset.gsActive='true';
    }else{
      a.removeAttribute('aria-current');
      delete a.dataset.gsActive;
    }
    nav.appendChild(a);
  }

  for(const a of existing){
    if(!a.dataset.gsMenuItem&&!MENU.some(item=>norm(a.textContent).includes(norm(item.label))))a.remove();
  }
  nav.dataset.gsMenuReady='true';
}

function normalizeAll(){for(const nav of findSidebarNavs())normalizeNav(nav);}

export default function SidebarOrderGuard(){
  useEffect(()=>{
    normalizeAll();
    const observer=new MutationObserver(()=>normalizeAll());
    observer.observe(document.body,{childList:true,subtree:true});
    const onRoute=()=>setTimeout(normalizeAll,0);
    window.addEventListener('popstate',onRoute);
    window.addEventListener('hashchange',onRoute);
    return()=>{observer.disconnect();window.removeEventListener('popstate',onRoute);window.removeEventListener('hashchange',onRoute);};
  },[]);
  return null;
}
