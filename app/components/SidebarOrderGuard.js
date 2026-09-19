'use client';

import {useLayoutEffect} from 'react';

// ORDEM OFICIAL E IMUTAVEL DO MENU DO GESTOR SENIOR.
// A ordem acompanha o fluxo real de uso: visão geral -> escolher produto -> analisar -> acompanhar histórico.
export const GS_MENU_ORDER=[
  {label:'Dashboard',icon:'⌂',href:'/'},
  {label:'Produtos',icon:'▱',href:'/produtos'},
  {label:'Super Análise',icon:'▤',href:'/super-analise'},
  {label:'Super Anúncio',icon:'▣',href:'/extensao-shopee-intelligence'},
  {label:'Concorrentes',icon:'⌘',href:'/extensao-shopee-intelligence#concorrentes'},
  {label:'Shopee Ads',icon:'◎',href:'/extensao-shopee-intelligence#shopee-ads'},
  {label:'Proteção ROAS',icon:'◈',href:'/protecao-roas'},
  {label:'Reanálises',icon:'↻',href:'/extensao-shopee-intelligence#reanálises'},
  {label:'Prioridades',icon:'☆',href:'/extensao-shopee-intelligence#prioridades'},
  {label:'Relatórios',icon:'▤',href:'/extensao-shopee-intelligence#relatorios'}
];

const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
const MOTOR_TEXT=new Map([
  ['extensão','Motor Senior'],['extensão conectada','Motor Senior conectado'],['extensão desconectada','Motor Senior desconectado'],
  ['abrir extensão','Abrir Motor Senior'],['motor da extensão','Motor Senior'],['motor conectado','Motor Senior conectado']
]);

function activeLabel(){
  const path=location.pathname;
  const hash=location.hash;
  if(path==='/')return'Dashboard';
  if(path.startsWith('/produtos'))return'Produtos';
  if(path.startsWith('/super-analise'))return'Super Análise';
  if(path.startsWith('/protecao-roas'))return'Proteção ROAS';
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
  // Reconstrói o conteúdo interno para impedir que cada página use um glifo,
  // tamanho ou espaçamento diferente. O elemento <a> é preservado para não
  // quebrar a navegação do Next; apenas ícone e rótulo viram canônicos.
  let icon=a.querySelector('[data-gs-menu-icon]');
  let label=a.querySelector('[data-gs-menu-label]');
  if(!icon||!label){
    icon=document.createElement('span');
    label=document.createElement('span');
    icon.dataset.gsMenuIcon='true';
    label.dataset.gsMenuLabel='true';
    a.replaceChildren(icon,label);
  }
  if(icon.textContent!==item.icon)icon.textContent=item.icon;
  if(label.textContent!==item.label)label.textContent=item.label;
}

function normalizeNav(nav){
  const existing=[...nav.querySelectorAll(':scope > a')];
  const utility=[...nav.children].filter(el=>el.tagName!=='A');
  const byLabel=new Map();
  for(const a of existing){const label=labelOf(a);if(label&&!byLabel.has(label))byLabel.set(label,a);}
  const active=activeLabel();
  const desired=GS_MENU_ORDER.map(item=>{
    let a=byLabel.get(item.label);if(!a)a=document.createElement('a');setLinkContent(a,item);
    if(a.getAttribute('href')!==item.href)a.setAttribute('href',item.href);a.dataset.gsMenuItem=item.label;
    if(item.label===active){if(a.getAttribute('aria-current')!=='page')a.setAttribute('aria-current','page');a.dataset.gsActive='true';}
    else{if(a.hasAttribute('aria-current'))a.removeAttribute('aria-current');if(a.dataset.gsActive)a.removeAttribute('data-gs-active');}
    return a;
  });
  for(const a of existing){if(!desired.includes(a))a.remove();}
  const current=[...nav.querySelectorAll(':scope > a')];
  const alreadyCorrect=current.length===desired.length&&desired.every((a,i)=>current[i]===a);
  if(!alreadyCorrect){const fragment=document.createDocumentFragment();desired.forEach(a=>fragment.appendChild(a));nav.appendChild(fragment);}
  // Cards de status/controles ficam sempre abaixo das páginas do menu e nunca quebram a ordem visual.
  utility.forEach(el=>nav.appendChild(el));
  nav.dataset.gsMenuReady='true';
}

function normalizeMotorSenior(){
  const candidates=document.querySelectorAll('aside b,aside small,aside button,header span,header button');
  for(const el of candidates){
    const key=norm(el.textContent);
    if(MOTOR_TEXT.has(key))el.textContent=MOTOR_TEXT.get(key);
    if(key.includes('a extensão só coleta'))el.textContent='O Motor Senior só coleta e executa tarefas na Shopee.';
    if(key.includes('a extensão trabalha em segundo plano'))el.textContent='O Motor Senior trabalha em segundo plano e devolve os dados ao Gestor.';
  }
}

function normalizeAll(){findSidebarNavs().forEach(normalizeNav);normalizeMotorSenior();}

export default function SidebarOrderGuard(){
  useLayoutEffect(()=>{
    normalizeAll();
    let queued=false;
    const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;normalizeAll();});});
    observer.observe(document.body,{childList:true,subtree:true});
    const onRoute=()=>setTimeout(normalizeAll,0);
    window.addEventListener('popstate',onRoute);window.addEventListener('hashchange',onRoute);
    return()=>{observer.disconnect();window.removeEventListener('popstate',onRoute);window.removeEventListener('hashchange',onRoute);};
  },[]);
  return null;
}