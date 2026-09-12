(function(){
'use strict';
const SIMPLE=['dashboard','pedidos','produtos','loja','atendimento','preco','financeiro','promocoes','estoque','ads'];
const PAGES=[
{id:'dashboard',page:'home',icon:'🏠',label:'Início',live:true,desc:'Resumo real da loja conectada.'},
{id:'estrategias',icon:'🧭',label:'Estratégias',desc:'Hub de estratégias da loja. Voltou à navegação, mas só receberá indicadores quando houver fonte real.'},
{id:'produtos',page:'products',icon:'🗂️',label:'Produtos',live:true,desc:'Catálogo real da Shopee.'},
{id:'pedidos',page:'orders',icon:'📦',label:'Meus Pedidos',live:true,desc:'Pedidos reais retornados pela Shopee.'},
{id:'ads',page:'ads',icon:'📣',label:'Shopee Ads',desc:'Desempenho de anúncios pagos e sugestões de otimização.'},
{id:'historico',icon:'📈',label:'Histórico x Ads / Lucro Real',desc:'Cruza vendas, gasto em Ads e lucro real por produto.'},
{id:'melhoria',icon:'✨',label:'Melhoria de Anúncio',desc:'Diagnóstico de qualidade dos anúncios, fotos, título, categoria e atributos.'},
{id:'seo',page:'seo',icon:'🔎',label:'SEO / Busca',desc:'Palavras-chave, busca e posicionamento dos anúncios.'},
{id:'preco',icon:'💰',label:'Precificação e Lucro',desc:'Custos, taxas, preço de venda, margem e lucro real.'},
{id:'concorrencia',page:'competition',icon:'🕵️',label:'Análise de Concorrência',desc:'Comparação com anúncios concorrentes usando somente fontes reais.'},
{id:'financeiro',page:'finance',icon:'🏦',label:'Financeiro',desc:'Receitas, custos, repasses e resultado da operação.'},
{id:'impostos',icon:'🧾',label:'Impostos',desc:'Informações fiscais, obrigações e organização tributária da operação.'},
{id:'estoque',icon:'📦',label:'Estoque',desc:'Estoque disponível, cobertura, giro e alertas de ruptura.'},
{id:'crescimento',icon:'🚀',label:'Oportunidades de Crescimento',desc:'Produtos e ações com maior potencial de crescimento.'},
{id:'atendimento',icon:'💬',label:'Atendimento / Chat',desc:'Central de mensagens e atendimento ao cliente.'},
{id:'avaliacoes',icon:'⭐',label:'Avaliações e Reputação',desc:'Avaliações, reputação e sinais de satisfação dos clientes.'},
{id:'logistica',icon:'🚚',label:'Logística',desc:'Canais de envio, prazos e acompanhamento logístico.'},
{id:'saude',icon:'🛡️',label:'Saúde da Conta',desc:'Indicadores de saúde da conta e possíveis riscos operacionais.'},
{id:'conteudo',icon:'🎬',label:'Conteúdo e Marketing',desc:'Conteúdo, calendário e materiais de marketing ligados aos produtos.'},
{id:'promocoes',icon:'🎯',label:'Promoções e Ofertas',desc:'Promoções, cupons e campanhas comerciais.'},
{id:'loja',icon:'🏪',label:'Minha Loja',desc:'Perfil, identidade e configurações comerciais da loja.'},
{id:'dashboard-geral',icon:'📊',label:'Dashboard Geral',desc:'Visão consolidada financeira e operacional da loja.'}
];
const SYSTEM=[{id:'config',icon:'⚙️',label:'Configurações',desc:'Preferências do Gestor Senior, modo de exibição e integrações.'},{id:'connection',page:'connection',icon:'🔗',label:'Integração Shopee',live:true,desc:'Status real da conexão Shopee Open Platform.'}];
const pageMap=new Map([...PAGES,...SYSTEM].map(x=>[x.id,x]));
let mode='avancado';
try{mode=localStorage.getItem('shopeeos_mode')||'avancado';}catch(e){}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function visible(p){return mode==='avancado'||SIMPLE.includes(p.id)||p.id==='config'||p.id==='connection';}
function navButton(p){if(!visible(p))return'';const real=p.page?' data-page="'+esc(p.page)+'"':'';const only=p.page?'':' shell-only';return '<button class="shell-page'+only+'" data-shell-id="'+esc(p.id)+'"'+real+'><span class="shell-icon">'+p.icon+'</span><span class="shell-label">'+esc(p.label)+'</span><span class="shell-state '+(p.live?'live':'')+'">'+(p.live?'LIVE':'em integração')+'</span></button>';}
function buildNav(){const nav=document.getElementById('nav');if(!nav)return;nav.innerHTML='<div class="mode-switcher-restored"><button data-mode="simples" class="'+(mode==='simples'?'active':'')+'">Simples</button><button data-mode="avancado" class="'+(mode==='avancado'?'active':'')+'">Avançado</button></div><div class="shell-nav-title">Central de gestão</div>'+PAGES.map(navButton).join('')+'<div class="shell-nav-title">Sistema</div>'+SYSTEM.map(navButton).join('');const first=nav.querySelector('[data-page="home"]');if(first)first.classList.add('active');}
function updateActive(id){document.querySelectorAll('#nav .shell-page').forEach(b=>b.classList.toggle('active',b.dataset.shellId===id));}
function renderShellPage(p){const content=document.getElementById('content');if(!content)return;const top=document.getElementById('topTitle');if(top)top.textContent=p.label;content.innerHTML='<div class="shell-module-card"><div class="shell-module-icon">'+p.icon+'</div><h1>'+esc(p.label)+'</h1><div class="shell-module-status">Módulo preservado · integração pendente</div><p>'+esc(p.desc||'')+'</p><div class="shell-module-box"><strong>Por que esta tela não mostra números ainda?</strong>A versão antiga desta página usava dados de demonstração. A página e o fluxo foram restaurados, mas os números fictícios continuam removidos. Assim que conectarmos uma fonte real para este módulo, os dados passam a aparecer aqui.</div></div>';updateActive(p.id);closeDrawer();}
function setMode(next){mode=next;try{localStorage.setItem('shopeeos_mode',mode);}catch(e){}buildNav();const current=document.querySelector('#nav .shell-page.active');if(!current){const home=document.querySelector('#nav [data-shell-id="dashboard"]');home?.click();}}
function addMobile(){const bar=document.querySelector('.topbar');if(!bar||bar.querySelector('.shell-menu-btn'))return;const btn=document.createElement('button');btn.className='shell-menu-btn';btn.type='button';btn.textContent='☰';btn.title='Abrir menu';bar.insertBefore(btn,bar.firstChild);let bd=document.querySelector('.shell-backdrop');if(!bd){bd=document.createElement('div');bd.className='shell-backdrop';document.body.appendChild(bd);}btn.addEventListener('click',()=>{document.querySelector('.sidebar')?.classList.toggle('shell-open');bd.classList.toggle('open');});bd.addEventListener('click',closeDrawer);}
function closeDrawer(){document.querySelector('.sidebar')?.classList.remove('shell-open');document.querySelector('.shell-backdrop')?.classList.remove('open');}
document.addEventListener('click',function(e){const m=e.target.closest('[data-mode]');if(m){e.preventDefault();e.stopPropagation();setMode(m.dataset.mode);return;}const b=e.target.closest('#nav .shell-page');if(!b)return;const id=b.dataset.shellId,p=pageMap.get(id);if(!p)return;if(!p.page){e.preventDefault();e.stopImmediatePropagation();renderShellPage(p);}else{setTimeout(()=>{updateActive(id);const top=document.getElementById('topTitle');if(top)top.textContent=p.label;closeDrawer();},0);}},true);
function init(){buildNav();addMobile();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();