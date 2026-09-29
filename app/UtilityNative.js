'use client';
import {useEffect,useState} from 'react';
import styles from './utility-native.module.css';
import {motorData} from './lib/client-async';
import {deriveStoreFunnel} from './lib/funnel-health';

const THEMES=[
  ['dark','Escuro'],['light','Claro'],['warm','Quente'],['win11','Windows 11'],['classic','Clássico'],['ubuntu','Ubuntu']
];
const DEFAULT_CATEGORIES={
  flash_sale:true,reanalysis:true,competitors:true,images:true,video:true,ads:true,other:true,
  competitor_velocity_whatsapp:true,competitor_velocity_whatsapp_pct:100,competitor_velocity_whatsapp_min_sales_per_day:5
};
const DEFAULT_PREFS={
  display_name:'',email:'',phone:'',task_enabled:true,email_enabled:true,whatsapp_enabled:false,push_enabled:false,
  ads_zero_sales_spend_threshold:10,categories:DEFAULT_CATEGORIES
};
const DEFAULT_PROVIDERS={
  email:{provider:'Resend',configured:false},
  whatsapp:{provider:'Meta WhatsApp Cloud API',configured:false},
  push:{provider:null,configured:false}
};

export default function UtilityNative({section}){
  const [theme,setTheme]=useState('dark');
  const [prefs,setPrefs]=useState(DEFAULT_PREFS);
  const [providers,setProviders]=useState(DEFAULT_PROVIDERS);
  const [prefState,setPrefState]=useState({loading:false,saving:false,message:''});
  const [testState,setTestState]=useState({channel:'',message:''});
  const [health,setHealth]=useState({running:false,checkedAt:'',summary:'idle',modules:[],error:''});

  useEffect(()=>{try{setTheme(localStorage.getItem('gs_theme')||'dark')}catch{}},[]);
  useEffect(()=>{
    if(section!=='config')return;
    let alive=true;setPrefState(x=>({...x,loading:true,message:''}));
    fetch('/api/notification-preferences',{cache:'no-store'})
      .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j?.error||'Falha ao carregar configurações.');return j})
      .then(j=>{
        if(!alive)return;
        const p=j.preferences||DEFAULT_PREFS;
        setPrefs({...DEFAULT_PREFS,...p,categories:{...DEFAULT_CATEGORIES,...(p.categories||{})}});
        setProviders(j.providers||DEFAULT_PROVIDERS);
      })
      .catch(e=>{if(alive)setPrefState(x=>({...x,message:String(e?.message||e)}))})
      .finally(()=>{if(alive)setPrefState(x=>({...x,loading:false}))});
    return()=>{alive=false};
  },[section]);

  function healthModule(id,label,status,detail,checks=[]){
    return {id,label,status,detail,checks};
  }

  async function jsonProbe(url,timeout=12000){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
    const started=Date.now();
    try{
      const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j?.error)throw new Error(j?.error||('HTTP '+r.status));
      return {ok:true,data:j,latency:Date.now()-started};
    }catch(error){
      return {ok:false,error:error?.name==='AbortError'?'Tempo esgotado.':String(error?.message||error),latency:Date.now()-started};
    }finally{clearTimeout(timer)}
  }

  function detectExtension(timeout=3500){
    return new Promise(resolve=>{
      let done=false,timer=null;
      const finish=value=>{if(done)return;done=true;window.removeEventListener('message',onMessage);window.removeEventListener('gs-extension-ready',onReady);if(timer)clearTimeout(timer);resolve(value)};
      const onMessage=e=>{if(e.source===window&&e.data?.source==='GS_EXTENSION'&&(e.data?.type==='GS_EXTENSION_READY'||e.data?.type==='GS_EXTENSION_PONG'))finish({ok:true,version:String(e.data.version||'').trim()})};
      const onReady=e=>finish({ok:true,version:String(e?.detail?.version||'').trim()});
      window.addEventListener('message',onMessage);
      window.addEventListener('gs-extension-ready',onReady);
      const meta=document.querySelector('meta[name="gestor-senior-extension"]');
      if(document.documentElement?.dataset?.gsExtensionBridge==='ready'||document.getElementById('gs-extension-bridge-marker')||meta)return finish({ok:true,version:String(meta?.content&&meta.content!=='ready'?meta.content:'').trim()});
      window.postMessage({source:'GS_GESTOR',type:'GS_EXTENSION_PING'},location.origin);
      timer=setTimeout(()=>finish({ok:false,error:'Motor Sênior não detectado neste navegador.'}),timeout);
    });
  }

  async function runHealthDiagnostic({deep=true}={}){
    if(section!=='config'||health.running)return;
    setHealth(x=>({...x,running:true,error:''}));
    const modules=[];
    try{
      const [server,connection,extension]=await Promise.all([
        jsonProbe('/api/system-health',15000),
        jsonProbe('/api/shopee/connection',12000),
        detectExtension()
      ]);
      const deps=server.ok?server.data?.dependencies||{}:{};
      const shopOk=connection.ok&&connection.data?.connected===true;
      modules.push(healthModule('shop','Loja Shopee',shopOk?'ok':connection.ok?'warning':'error',shopOk?(connection.data.shopName||'Conectada e respondendo.'):(connection.ok?'Loja não conectada.':connection.error),[
        {label:'API de conexão',ok:connection.ok,detail:connection.ok?connection.latency+' ms':connection.error}
      ]));
      modules.push(healthModule('database','Banco / Supabase',deps.database?.status||'error',server.ok?(deps.database?.detail||'Verificação concluída.'):server.error,[
        {label:'Diagnóstico do servidor',ok:server.ok,detail:server.ok?server.latency+' ms':server.error}
      ]));
      modules.push(healthModule('motor','Motor Sênior',extension.ok?'ok':'error',extension.ok?('Extensão conectada'+(extension.version?' · '+extension.version:'')):extension.error,[
        {label:'Handshake extensão ↔ Gestor',ok:extension.ok,detail:extension.ok?'Resposta recebida.':extension.error}
      ]));

      let funnelContext={ok:false,error:'Teste não executado.'},funnelMotor={ok:false,error:'Teste profundo não executado.'};
      if(shopOk)funnelContext=await jsonProbe('/api/funnel/context',15000);
      if(deep&&extension.ok&&shopOk){
        try{
          const started=Date.now();
          const data=await motorData('sellerFunnel',{period:'real_time',diagnostic:true},60000);
          funnelMotor={ok:!!data,data,latency:Date.now()-started,error:data?'':'Motor respondeu sem dados.'};
        }catch(error){funnelMotor={ok:false,error:String(error?.message||error)}}
      }
      const funnelCoverage=deep&&funnelMotor.ok?deriveStoreFunnel(funnelMotor.data).coverage:null;
      let funnelStatus='warning',funnelDetail='Dependências respondem, mas a qualidade dos dados ainda não foi testada.';
      if(!shopOk||!extension.ok||!funnelContext.ok){
        funnelStatus='error';funnelDetail='Uma dependência necessária do Funil falhou.';
      }else if(!deep){
        funnelStatus='warning';funnelDetail='Conexões básicas OK. Execute o diagnóstico agora para validar se o Funil recebeu métricas suficientes.';
      }else if(!funnelMotor.ok){
        funnelStatus='error';funnelDetail='A coleta real do Seller Center falhou.';
      }else if(!funnelCoverage?.canDiagnose){
        funnelStatus='warning';funnelDetail='O Motor respondeu, mas o Funil da Loja continua com dados insuficientes para comparar etapas.';
      }else if(!funnelCoverage?.healthy){
        funnelStatus='warning';funnelDetail='O Funil recebeu dados parciais. Já há alguma leitura, mas a cobertura ainda está incompleta.';
      }else{
        funnelStatus='ok';funnelDetail='Funil com cobertura suficiente para diagnóstico da loja.';
      }
      const missing=funnelCoverage?.missingStages?.length?funnelCoverage.missingStages.join(', '):'nenhuma';
      modules.push(healthModule('funnel','Funil',funnelStatus,funnelDetail,[
        {label:'Loja conectada',ok:shopOk,detail:shopOk?'OK':'Necessária'},
        {label:'Contexto do Funil',ok:funnelContext.ok,detail:funnelContext.ok?(funnelContext.latency+' ms'):funnelContext.error},
        {label:'Motor respondeu à coleta',ok:deep?funnelMotor.ok:extension.ok,detail:deep?(funnelMotor.ok?(funnelMotor.latency+' ms'):funnelMotor.error):'Aguardando teste profundo'},
        {label:'Etapas com dados',ok:deep?((funnelCoverage?.stageCount||0)>=5):false,detail:deep?((funnelCoverage?.stageCount||0)+'/7 · faltando: '+missing):'Execute o diagnóstico agora'},
        {label:'Transições calculáveis',ok:deep?((funnelCoverage?.transitionCount||0)>=3):false,detail:deep?((funnelCoverage?.transitionCount||0)+'/6'):'Execute o diagnóstico agora'}
      ]));

      const analysis=server.ok?server.data?.modules?.super_analysis:null;
      modules.push(healthModule('analysis','Super Análise',analysis?.status||'error',analysis?.detail||server.error||'Sem resposta.',[
        {label:'Histórico no banco',ok:analysis?.status==='ok',detail:analysis?.records!=null?(analysis.records+' registro(s)'):(analysis?.detail||'')}
      ]));
      const comp=server.ok?server.data?.modules?.competitors:null;
      modules.push(healthModule('competitors','Concorrentes',comp?.status||'error',comp?.detail||server.error||'Sem resposta.',[
        {label:'Monitoramento no banco',ok:comp?.status==='ok',detail:comp?.records!=null?(comp.records+' monitoramento(s)'):(comp?.detail||'')},
        {label:'Motor disponível para rechecagem',ok:extension.ok,detail:extension.ok?'OK':'Extensão necessária para coleta'}
      ]));
      const tasks=server.ok?server.data?.modules?.priorities:null;
      modules.push(healthModule('priorities','Central de Prioridades',tasks?.status||'error',tasks?.detail||server.error||'Sem resposta.',[
        {label:'Tabela de tarefas',ok:tasks?.status==='ok',detail:tasks?.records!=null?(tasks.records+' tarefa(s)'):(tasks?.detail||'')}
      ]));

      const hasError=modules.some(x=>x.status==='error'),hasWarning=modules.some(x=>x.status==='warning');
      setHealth({running:false,checkedAt:new Date().toISOString(),summary:hasError?'error':hasWarning?'warning':'ok',modules,error:''});
    }catch(error){
      setHealth(x=>({...x,running:false,summary:'error',error:String(error?.message||error)}));
    }
  }

  async function savePrefs(){
    setPrefState(x=>({...x,saving:true,message:''}));
    try{
      const r=await fetch('/api/notification-preferences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(prefs)});
      const j=await r.json();if(!r.ok)throw new Error(j?.error||'Falha ao salvar.');
      setPrefs({...DEFAULT_PREFS,...j.preferences,categories:{...DEFAULT_CATEGORIES,...(j.preferences?.categories||{})}});
      setProviders(j.providers||providers);
      setPrefState({loading:false,saving:false,message:'Configurações salvas.'});
    }catch(e){setPrefState({loading:false,saving:false,message:String(e?.message||e)})}
  }

  async function testChannel(channel){
    setTestState({channel,message:''});
    try{
      const r=await fetch('/api/notifications/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel})});
      const j=await r.json();
      if(j?.providers)setProviders(j.providers);
      if(!r.ok)throw new Error(j?.error||'Falha no teste.');
      setTestState({channel:'',message:channel==='email'?'E-mail de teste enviado.':'WhatsApp de teste enviado.'});
    }catch(e){setTestState({channel:'',message:String(e?.message||e)})}
  }

  function choose(value){
    setTheme(value);
    try{localStorage.setItem('gs_theme',value)}catch{}
    document.documentElement.dataset.gsTheme=value;
    document.body.dataset.gsTheme=value;
    window.postMessage({source:'GS_GESTOR_THEME',theme:value},location.origin);
  }

  useEffect(()=>{
    if(section==='config')runHealthDiagnostic({deep:false});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[section]);

  if(section==='temas')return <div className={styles.page}><header><h1>Temas</h1><p>Escolha a aparência do Gestor Sênior. A preferência fica salva neste navegador.</p></header><section className={styles.panel}><div className={styles.grid}>{THEMES.map(([id,label])=><button key={id} type="button" className={theme===id?styles.active:''} onClick={()=>choose(id)}><span className={styles.preview} data-theme={id}/><b>{label}</b><small>{theme===id?'Tema atual':'Aplicar tema'}</small></button>)}</div></section></div>;

  const velocityPct=Number(prefs.categories?.competitor_velocity_whatsapp_pct??100);
  const velocityRate=Number(prefs.categories?.competitor_velocity_whatsapp_min_sales_per_day??5);
  return <div className={styles.page}><header><h1>Configurações</h1><p>Configure como o Gestor Sênior deve falar com você e quais alertas deseja acompanhar.</p></header>
    <section className={styles.panel}><h2>🔔 Lembretes e notificações</h2><p>Nome, e-mail e celular ficam vinculados à loja conectada. Os canais externos só enviam quando o respectivo provedor estiver configurado no servidor.</p>
      <div className={styles.formGrid}>
        <label>Como quer ser chamado?<input value={prefs.display_name||''} onChange={e=>setPrefs(x=>({...x,display_name:e.target.value}))} placeholder="Seu nome"/></label>
        <label>E-mail dos alertas<input type="email" value={prefs.email||''} onChange={e=>setPrefs(x=>({...x,email:e.target.value}))} placeholder="voce@email.com"/></label>
        <label>Celular / WhatsApp<input value={prefs.phone||''} onChange={e=>setPrefs(x=>({...x,phone:e.target.value}))} placeholder="(13) 99999-9999"/></label>
      </div>
      <div className={styles.formGrid}>
        <label>Alerta de Ads sem venda<input type="number" min="0" step="1" value={prefs.ads_zero_sales_spend_threshold??10} onChange={e=>setPrefs(x=>({...x,ads_zero_sales_spend_threshold:e.target.value}))}/><small>Avise quando um anúncio gastar pelo menos este valor no dia anterior e tiver 0 vendas.</small></label>
        <label>WhatsApp: aceleração mínima<input type="number" min="25" step="5" value={Number.isFinite(velocityPct)?velocityPct:100} onChange={e=>setPrefs(x=>({...x,categories:{...(x.categories||{}),competitor_velocity_whatsapp_pct:e.target.value}}))}/><small>Percentual mínimo de aumento no ritmo de vendas para considerar o alerta crítico. Padrão: 100%.</small></label>
        <label>WhatsApp: vendas/dia mínimas<input type="number" min="0" step="0.5" value={Number.isFinite(velocityRate)?velocityRate:5} onChange={e=>setPrefs(x=>({...x,categories:{...(x.categories||{}),competitor_velocity_whatsapp_min_sales_per_day:e.target.value}}))}/><small>Evita WhatsApp por oscilações pequenas. Padrão: pelo menos 5 vendas/dia.</small></label>
      </div>
      <div className={styles.channelGrid}>
        <label><input type="checkbox" checked={prefs.task_enabled!==false} onChange={e=>setPrefs(x=>({...x,task_enabled:e.target.checked}))}/> Tarefas no Gestor</label>
        <label><input type="checkbox" checked={prefs.email_enabled!==false} onChange={e=>setPrefs(x=>({...x,email_enabled:e.target.checked}))}/> E-mail <small>{providers.email?.configured?'Resend conectado':'Resend ainda não configurado'}</small></label>
        <label><input type="checkbox" checked={prefs.whatsapp_enabled===true} onChange={e=>setPrefs(x=>({...x,whatsapp_enabled:e.target.checked}))}/> WhatsApp <small>{providers.whatsapp?.configured?'Meta Cloud API conectada':'Meta Cloud API ainda não configurada'}</small></label>
        <label><input type="checkbox" checked={prefs.push_enabled===true} onChange={e=>setPrefs(x=>({...x,push_enabled:e.target.checked}))}/> Notificação no celular <small>push será conectado depois</small></label>
      </div>
      <label className={styles.criticalRule}><input type="checkbox" checked={prefs.categories?.competitor_velocity_whatsapp!==false} onChange={e=>setPrefs(x=>({...x,categories:{...(x.categories||{}),competitor_velocity_whatsapp:e.target.checked}}))}/><span><b>WhatsApp só para aceleração forte de concorrente</b><small>O alerta crítico só dispara quando o concorrente ultrapassar os dois limites acima. Mudanças menores continuam no Gestor e podem ir por e-mail.</small></span></label>
      <div className={styles.testLine}>
        <button type="button" onClick={()=>testChannel('email')} disabled={testState.channel!==''||!providers.email?.configured||!prefs.email}>{testState.channel==='email'?'Enviando…':'Testar e-mail'}</button>
        <button type="button" onClick={()=>testChannel('whatsapp')} disabled={testState.channel!==''||!providers.whatsapp?.configured||!prefs.phone}>{testState.channel==='whatsapp'?'Enviando…':'Testar WhatsApp'}</button>
        {testState.message&&<span>{testState.message}</span>}
      </div>
      <h3>Quero receber alertas sobre</h3>
      <div className={styles.channelGrid}>{[
        ['flash_sale','Oferta Relâmpago'],['reanalysis','Reanálises'],['competitors','Concorrentes'],['images','Imagens'],['video','Vídeo'],['ads','Shopee Ads'],['other','Outras tarefas']
      ].map(([key,label])=><label key={key}><input type="checkbox" checked={prefs.categories?.[key]!==false} onChange={e=>setPrefs(x=>({...x,categories:{...(x.categories||{}),[key]:e.target.checked}}))}/>{label}</label>)}</div>
      <div className={styles.saveLine}><button type="button" onClick={savePrefs} disabled={prefState.loading||prefState.saving}>{prefState.saving?'Salvando…':prefState.loading?'Carregando…':'Salvar notificações'}</button>{prefState.message&&<span>{prefState.message}</span>}</div>
    </section>
    <section className={styles.panel}>
      <div className={styles.healthHead}><div><h2>🩺 Saúde do Sistema</h2><p>Testa as dependências reais dos módulos. Verde significa que os testes executados responderam; vermelho mostra exatamente onde a cadeia quebrou.</p></div><button type="button" onClick={()=>runHealthDiagnostic({deep:true})} disabled={health.running}>{health.running?'Executando diagnóstico…':'Executar diagnóstico agora'}</button></div>
      <div className={styles.healthSummary} data-status={health.summary}><span className={styles.healthDot}/><div><b>{health.running?'Verificando módulos…':health.summary==='ok'?'Sistema operacional':health.summary==='warning'?'Sistema com atenção':health.summary==='error'?'Problema detectado':'Aguardando diagnóstico'}</b><small>{health.checkedAt?'Última verificação: '+new Date(health.checkedAt).toLocaleString('pt-BR'):'O teste rápido roda ao abrir Configurações.'}</small></div></div>
      {health.error&&<div className={styles.healthError}>{health.error}</div>}
      <div className={styles.healthGrid}>{health.modules.map(mod=><article key={mod.id} className={styles.healthCard} data-status={mod.status}>
        <div className={styles.healthCardTitle}><span className={styles.healthDot}/><div><b>{mod.label}</b><small>{mod.status==='ok'?'Operacional':mod.status==='warning'?'Atenção':'Falha'}</small></div></div>
        <p>{mod.detail}</p>
        <details><summary>Ver diagnóstico</summary><div className={styles.healthChecks}>{mod.checks.map((check,i)=><div key={i} data-ok={check.ok?'true':'false'}><span>{check.ok?'✓':'×'}</span><div><b>{check.label}</b><small>{check.detail}</small></div></div>)}</div></details>
      </article>)}</div>
      <p className={styles.healthNote}>O botão de diagnóstico executa uma coleta real e somente leitura do Funil no período “Hoje”. Ele não altera preço, estoque, ROAS ou anúncios.</p>
    </section>
    <section className={styles.panel}><h2>Integrações</h2><div className={styles.providerGrid}><article data-ok={providers.email?.configured?'true':'false'}><b>Resend</b><span>{providers.email?.configured?'Pronto para enviar e-mails':'Aguardando chave e remetente no servidor'}</span></article><article data-ok={providers.whatsapp?.configured?'true':'false'}><b>WhatsApp Cloud API</b><span>{providers.whatsapp?.configured?'Pronto para usar o template aprovado':'Aguardando credenciais e template da Meta'}</span></article></div><p>O status da extensão Motor Sênior e da loja Shopee permanece visível no menu lateral. Conexão, saída e reconexão continuam sendo controladas por ali.</p></section>
    <section className={styles.panel}><h2>Segurança dos dados</h2><p>O Gestor diferencia dados reais, ausência de coleta e erro de integração. Chaves do Resend e da Meta ficam somente no servidor e nunca são exibidas nesta tela.</p></section>
  </div>;
}
