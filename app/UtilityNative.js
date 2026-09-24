'use client';
import {useEffect,useState} from 'react';
import styles from './utility-native.module.css';

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
    <section className={styles.panel}><h2>Integrações</h2><div className={styles.providerGrid}><article data-ok={providers.email?.configured?'true':'false'}><b>Resend</b><span>{providers.email?.configured?'Pronto para enviar e-mails':'Aguardando chave e remetente no servidor'}</span></article><article data-ok={providers.whatsapp?.configured?'true':'false'}><b>WhatsApp Cloud API</b><span>{providers.whatsapp?.configured?'Pronto para usar o template aprovado':'Aguardando credenciais e template da Meta'}</span></article></div><p>O status da extensão Motor Sênior e da loja Shopee permanece visível no menu lateral. Conexão, saída e reconexão continuam sendo controladas por ali.</p></section>
    <section className={styles.panel}><h2>Segurança dos dados</h2><p>O Gestor diferencia dados reais, ausência de coleta e erro de integração. Chaves do Resend e da Meta ficam somente no servidor e nunca são exibidas nesta tela.</p></section>
  </div>;
}
