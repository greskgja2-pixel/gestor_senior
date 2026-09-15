(()=>{
'use strict';
const $=s=>document.querySelector(s);const page=location.pathname.endsWith('/analytics.html')?'analytics':'sidepanel';let activeTour=null,stepIndex=0,focusEl=null,cardEl=null;
const sidepanelTours=[
{id:'start',icon:'👋',title:'Primeiros passos',desc:'Entenda a Visão e onde ficam as principais funções.',time:'~40 s',steps:[
{tab:'home',target:'nav button[data-tab="home"]',title:'Visão geral',text:'A aba Visão é o ponto de partida. Ela resume base coletada, lojas, preço mediano e tarefas ativas.'},
{target:'#homeAnalyze',title:'Analisar o anúncio aberto',text:'Abra um anúncio na Shopee e use este botão. A extensão coleta os dados do produto, localiza concorrentes e roda o motor Super Anúncio.'},
{target:'a.dashboard-link[href="analytics.html"]',title:'Dashboard Analítica',text:'Aqui você abre a tela horizontal com todos os produtos, Ads, GMV, ROAS, CTR, margem e ações em massa.'},
{target:'#homeLast',title:'Última análise',text:'Depois de analisar, este card mostra rapidamente a nota, concorrentes encontrados e quantas melhorias foram sugeridas.'}]},
{id:'analysis',icon:'✨',title:'Super Análise',desc:'Aprenda a avaliar e melhorar um anúncio.',time:'~1 min',steps:[
{tab:'analyze',target:'nav button[data-tab="analyze"]',title:'Abra a Super Análise',text:'Nesta aba ficam a auditoria 0–100, comparação com concorrentes, Ads e plano de melhoria.'},
{target:'#analysisCost',title:'Informe o custo real',text:'Cadastre o custo do produto. Esse valor é essencial para o sistema proteger sua margem e não sugerir mudanças financeiras que tragam prejuízo.',tip:'Use o custo de aquisição/fabricação do item, sem inventar valor.'},
{target:'#smartAnalyze',title:'Rodar a análise',text:'Clique em Analisar com o anúncio da Shopee aberto. A extensão usa primeiro a base do Coletor 3.1 e complementa com busca ao vivo quando necessário.'},
{target:'#analysisEmpty',title:'Leia o diagnóstico',text:'Depois da análise, este espaço vira o relatório com nota por área, tendência, plano de melhoria, título e descrição sugeridos.'},
{target:'#analysisEmpty',title:'Aplique com segurança',text:'Quando houver ação validada, como ROAS, você poderá executar pelo plano. Título, descrição e preço continuam aguardando aprovação quando não houver escrita validada.',tip:'A extensão nunca deve alterar preço ou conteúdo automaticamente sem passar pelos guardrails definidos.'}]},
{id:'automation',icon:'⚙️',title:'Automação de melhoria',desc:'Configure manutenção periódica sem perder margem.',time:'~1 min',steps:[
{tab:'auto',target:'nav button[data-tab="auto"]',title:'Melhoria contínua',text:'Crie uma tarefa para o anúncio ser reavaliado a cada 3, 7 ou 14 dias.'},
{target:'#autoCost',title:'Custo do produto',text:'Preencha o custo antes de usar modo automático. Ele entra no cálculo de margem e no limite financeiro.'},
{target:'#autoMode',title:'Escolha o modo',text:'“Recomendar e aprovar” apenas prepara mudanças. “Automático Ads” pode executar ações de Ads já validadas dentro dos limites configurados.'},
{target:'#autoRoasDelta',title:'Limite por ciclo',text:'Defina o quanto a Meta de ROAS pode mudar em uma única rodada. Mudanças graduais reduzem o risco de desestabilizar a campanha.'},
{target:'#autoMargin',title:'Proteja a margem',text:'Configure margem mínima, lucro mínimo e teto semanal de Ads. Se a proposta violar essas regras, ela é bloqueada.'},
{target:'#createAuto',title:'Criar manutenção',text:'Depois de revisar os limites, crie a tarefa. Ela aparecerá abaixo com próxima execução, histórico e recomendações.'}]},
{id:'resale',icon:'🛒',title:'Revenda e concorrentes',desc:'Use o Coletor 3.1 para alimentar a base de mercado.',time:'~1 min',steps:[
{tab:'resale',target:'nav button[data-tab="resale"]',title:'Painel Revenda',text:'Essa área usa o Coletor Shopee 3.1 para pesquisar produtos e alimentar a base de concorrentes.'},
{target:'.mode',title:'Termo ou categoria',text:'Escolha pesquisar por uma palavra-chave ou por categorias da Shopee.'},
{target:'#resaleTerm',title:'Digite a busca',text:'No modo Termo, use uma busca que represente bem o produto. Ex.: “caderno de colorir infantil”.'},
{target:'#collectPages',title:'Defina a profundidade',text:'Escolha uma página específica ou todas. Quanto mais páginas, maior a amostra e maior o tempo da coleta.'},
{target:'#startCollection',title:'Iniciar coleta',text:'A extensão coleta os resultados, sanitiza dados sensíveis e atualiza o índice local usado nas análises.'},
{target:'#resaleTop',title:'Base reaproveitável',text:'Os produtos coletados ficam disponíveis para futuras comparações, evitando repetir pesquisas desnecessárias.'}]},
{id:'lab',icon:'🧪',title:'Coletor técnico',desc:'Use o Auto Mapper somente quando estivermos mapeando a Shopee.',time:'~35 s',steps:[
{tab:'lab',target:'nav button[data-tab="lab"]',title:'Laboratório técnico',text:'Esta área é voltada ao mapeamento de endpoints e manutenção da Enciclopédia técnica.'},
{target:'#researchCapture',title:'Captura técnica completa',text:'Ative somente durante uma sessão de mapeamento. No uso normal deixe desligado para manter a extensão leve.',tip:'A Proteção de ROAS continua sendo observada de forma leve mesmo com este modo desligado.'},
{target:'#clearTechnical',title:'Limpar capturas',text:'Depois de exportar ou terminar a sessão, você pode apagar as capturas técnicas locais.'},
{target:'#clearIndex',title:'Índice do Coletor 3.1',text:'Este botão apaga a base local de concorrentes. Use só quando quiser realmente recomeçar a coleta.'}]},
{id:'dashboard',icon:'📊',title:'Dashboard Analítica',desc:'Abra a central horizontal de produtos e desempenho.',time:'~30 s',steps:[
{tab:'home',target:'a.dashboard-link[href="analytics.html"]',title:'Abra em tela cheia',text:'A Dashboard foi feita para uso horizontal. Ela abre em uma página própria para não cortar tabelas.'},
{target:'a.dashboard-link[href="analytics.html"]',title:'O que você encontra lá',text:'Filtros de data, comparação temporal, GMV, ROAS, CTR, margem, custo por conversão, Super Análise, exportação e ações em massa.',tip:'Ao abrir a Dashboard, clique no botão ? dela para ver o tutorial específico daquela tela.'}]}
];
const analyticsTours=[
{id:'analytics-read',icon:'📈',title:'Ler o desempenho',desc:'Use filtros, comparação temporal e ordenação.',time:'~1 min',steps:[
{target:'#rangeBtn',title:'Escolha o período',text:'Selecione datas ou use atalhos como Hoje, Ontem, 3 dias, 7 dias, Semanal e Mensal. O período anterior equivalente é calculado automaticamente.'},
{target:'.summary',title:'Resumo do período',text:'Veja quantidade de produtos, produtos com Ads, GMV Ads, gasto e ROAS consolidado.'},
{target:'#searchInput',title:'Busque produtos',text:'Filtre por nome ou ID. O filtro ao lado também separa produtos com Ads, sem Ads e com/sem Super Análise.'},
{target:'.table-card',title:'Tabela analítica',text:'Cada linha reúne imagem, anúncio, nota, custo, preço, custo por conversão, GMV, ROAS, CTR e margem.'},
{target:'th button[data-sort="roas"]',title:'Ordene as métricas',text:'Clique nos cabeçalhos numéricos para ordenar crescente ou decrescente. Isso facilita encontrar os melhores e piores casos.'},
{target:'.score-btn, [data-score]',title:'Abra a Super Análise',text:'A Nota Super Análise é clicável quando houver análise disponível. Ela abre o diagnóstico detalhado do anúncio.'}]},
{id:'analytics-bulk',icon:'⚡',title:'Ações em massa',desc:'Analise e cuide de vários produtos de uma vez.',time:'~50 s',steps:[
{target:'#selectPage',title:'Selecione produtos',text:'Marque a página inteira ou escolha produtos individualmente na primeira coluna.'},
{target:'.bulk-quick',title:'Seleções inteligentes',text:'Use atalhos para marcar produtos com ROAS abaixo da meta, não analisados ou com margem negativa.'},
{target:'#bulkAnalyze',title:'Analisar selecionados',text:'Roda a Super Análise em lote. Para estabilidade, a auditoria profunda limita a quantidade de anúncios por rodada.'},
{target:'#bulkSchedule',title:'Agendar revisão semanal',text:'Cria manutenção periódica para os produtos selecionados.'},
{target:'#bulkFixRoas',title:'Corrigir ROAS seguro',text:'Só altera campanhas individuais que passam pelos limites de custo, margem e segurança. Campanhas compartilhadas são bloqueadas.'}]},
{id:'analytics-export',icon:'⇩',title:'Exportar e paginar',desc:'Leve a visão filtrada para CSV ou Excel.',time:'~30 s',steps:[
{target:'#exportBtn',title:'Exportar dados',text:'Baixe CSV ou Excel (.xlsx). A exportação respeita os filtros e a ordenação ativos.'},
{target:'#pageSize',title:'Itens por página',text:'Escolha 10, 25, 50 ou 100 produtos por página.'},
{target:'.pager-controls',title:'Navegação',text:'Use Anterior e Próximo para percorrer toda a loja sem perder os filtros aplicados.'}]}
];
const tours=page==='analytics'?analyticsTours:sidepanelTours;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function injectLauncher(){if($('#gsTutorialLauncher'))return;const b=document.createElement('button');b.id='gsTutorialLauncher';b.className='gs-tutorial-launcher';b.type='button';b.title='Mini tutoriais';b.setAttribute('aria-label','Abrir mini tutoriais');b.textContent='?';b.onclick=openMenu;document.body.appendChild(b);chrome.storage?.local?.get('gsTutorialNudgeV08').then(x=>{if(x.gsTutorialNudgeV08)return;const n=document.createElement('div');n.className='gs-tutorial-nudge';n.textContent='Novo: mini tutoriais';document.body.appendChild(n);setTimeout(()=>n.remove(),5000);chrome.storage.local.set({gsTutorialNudgeV08:true}).catch(()=>{});}).catch(()=>{});}
function openMenu(){closeTour(false);document.querySelector('.gs-tutorial-menu-back')?.remove();const back=document.createElement('div');back.className='gs-tutorial-menu-back';back.innerHTML=`<div class="gs-tutorial-menu" role="dialog" aria-modal="true"><div class="gs-tutorial-menu-head"><div><strong>Mini tutoriais</strong><small>Escolha uma função para aprender em poucos passos.</small></div><button class="gs-tutorial-close" aria-label="Fechar">×</button></div><div class="gs-tutorial-list">${tours.map(t=>`<button class="gs-tutorial-item" data-tour="${esc(t.id)}"><span class="gs-tutorial-icon">${t.icon}</span><span><b>${esc(t.title)}</b><small>${esc(t.desc)}</small></span><span class="gs-tutorial-time">${esc(t.time)}</span></button>`).join('')}</div></div>`;back.addEventListener('click',e=>{if(e.target===back)back.remove();});back.querySelector('.gs-tutorial-close').onclick=()=>back.remove();back.querySelectorAll('[data-tour]').forEach(b=>b.onclick=()=>{const t=tours.find(x=>x.id===b.dataset.tour);back.remove();startTour(t);});document.body.appendChild(back);}
function switchTab(name){if(!name)return;const btn=document.querySelector(`nav button[data-tab="${name}"]`);if(btn&&!btn.classList.contains('active'))btn.click();}
function getTarget(step){try{return step.target?document.querySelector(step.target):null}catch{return null}}
function clearFocus(){focusEl?.remove();focusEl=null;}
function positionFocus(target){clearFocus();if(!target)return;target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});setTimeout(()=>{const r=target.getBoundingClientRect();if(r.width<2||r.height<2)return;const f=document.createElement('div');f.className='gs-tutorial-focus';const pad=5;Object.assign(f.style,{left:`${Math.max(3,r.left-pad)}px`,top:`${Math.max(3,r.top-pad)}px`,width:`${Math.min(innerWidth-6,r.width+pad*2)}px`,height:`${Math.min(innerHeight-6,r.height+pad*2)}px`});document.body.appendChild(f);focusEl=f;},120);}
function startTour(tour){if(!tour)return;activeTour=tour;stepIndex=0;showStep();}
function showStep(){if(!activeTour)return;const step=activeTour.steps[stepIndex];switchTab(step.tab);setTimeout(()=>{const target=getTarget(step);positionFocus(target);cardEl?.remove();const c=document.createElement('div');const rect=target?.getBoundingClientRect();const useTop=rect&&rect.top>innerHeight*.58;c.className=`gs-tutorial-card ${useTop?'top':'bottom'}`;c.innerHTML=`<div class="gs-tutorial-step"><span>${esc(activeTour.title)}</span><span>${stepIndex+1} de ${activeTour.steps.length}</span></div><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p>${step.tip?`<div class="gs-tutorial-tip">💡 ${esc(step.tip)}</div>`:''}<div class="gs-tutorial-progress"><i style="width:${((stepIndex+1)/activeTour.steps.length)*100}%"></i></div><div class="gs-tutorial-actions"><button data-exit>Sair</button><div><button data-back ${stepIndex===0?'disabled':''}>Voltar</button><button data-next class="primary">${stepIndex===activeTour.steps.length-1?'Concluir':'Próximo'}</button></div></div>`;c.querySelector('[data-exit]').onclick=()=>closeTour(true);c.querySelector('[data-back]').onclick=()=>{if(stepIndex>0){stepIndex--;showStep();}};c.querySelector('[data-next]').onclick=()=>{if(stepIndex>=activeTour.steps.length-1){closeTour(true);showDone();}else{stepIndex++;showStep();}};document.body.appendChild(c);cardEl=c;},160);}
function closeTour(mark=false){clearFocus();cardEl?.remove();cardEl=null;if(mark&&activeTour)chrome.storage?.local?.set({[`gsTutorialDone_${activeTour.id}`]:true}).catch(()=>{});activeTour=null;stepIndex=0;}
function showDone(){const n=document.createElement('div');n.className='gs-tutorial-nudge';n.textContent='Tutorial concluído ✓';document.body.appendChild(n);setTimeout(()=>n.remove(),2500);}
window.addEventListener('resize',()=>{if(activeTour)showStep();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelector('.gs-tutorial-menu-back')?.remove();closeTour(false);}});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectLauncher,{once:true});else injectLauncher();
})();