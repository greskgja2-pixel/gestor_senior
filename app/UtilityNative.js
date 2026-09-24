'use client';
import {useEffect,useState} from 'react';
import styles from './utility-native.module.css';

const THEMES=[
  ['dark','Escuro'],['light','Claro'],['warm','Quente'],['win11','Windows 11'],['classic','Clássico'],['ubuntu','Ubuntu']
];

export default function UtilityNative({section}){
  const [theme,setTheme]=useState('dark');
  const [prefs,setPrefs]=useState({display_name:'',email:'',phone:'',task_enabled:true,email_enabled:true,whatsapp_enabled:false,push_enabled:false,ads_zero_sales_spend_threshold:10,categories:{flash_sale:true,reanalysis:true,competitors:true,images:true,video:true,ads:true,other:true}});
  const [prefState,setPrefState]=useState({loading:false,saving:false,message:''});
  useEffect(()=>{try{setTheme(localStorage.getItem('gs_theme')||'dark')}catch{}},[]);
  useEffect(()=>{
    if(section!=='config')return;
    let alive=true;setPrefState(x=>({...x,loading:true,message:''}));
    fetch('/api/notification-preferences',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j?.error||'Falha ao carregar configurações.');return j}).then(j=>{if(alive)setPrefs(j.preferences||prefs)}).catch(e=>{if(alive)setPrefState(x=>({...x,message:String(e?.message||e)}))}).finally(()=>{if(alive)setPrefState(x=>({...x,loading:false}))});
    return()=>{alive=false};
  },[section]);
  async function savePrefs(){
    setPrefState(x=>({...x,saving:true,message:''}));
    try{
      const r=await fetch('/api/notification-preferences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(prefs)});
      const j=await r.json();if(!r.ok)throw new Error(j?.error||'Falha ao salvar.');
      setPrefs(j.preferences);setPrefState({loading:false,saving:false,message:'Configurações salvas.'});
    }catch(e){setPrefState({loading:false,saving:false,message:String(e?.message||e)})}
  }
  function choose(value){
    setTheme(value);
    try{localStorage.setItem('gs_theme',value)}catch{}
    document.documentElement.dataset.gsTheme=value;
    document.body.dataset.gsTheme=value;
    window.postMessage({source:'GS_GESTOR_THEME',theme:value},location.origin);
  }
  if(section==='temas')return <div className={styles.page}><header><h1>Temas</h1><p>Escolha a aparência do Gestor Sênior. A preferência fica salva neste navegador.</p></header><section className={styles.panel}><div className={styles.grid}>{THEMES.map(([id,label])=><button key={id} type="button" className={theme===id?styles.active:''} onClick={()=>choose(id)}><span className={styles.preview} data-theme={id}/><b>{label}</b><small>{theme===id?'Tema atual':'Aplicar tema'}</small></button>)}</div></section></div>;
  return <div className={styles.page}><header><h1>Configurações</h1><p>Configure como o Gestor Sênior deve falar com você e quais alertas deseja acompanhar.</p></header>
    <section className={styles.panel}><h2>🔔 Lembretes e notificações</h2><p>Esses dados serão usados nos lembretes do Gestor. O envio externo por e-mail/WhatsApp será habilitado conforme os canais forem conectados.</p>
      <div className={styles.formGrid}>
        <label>Como quer ser chamado?<input value={prefs.display_name||''} onChange={e=>setPrefs(x=>({...x,display_name:e.target.value}))} placeholder="Seu nome"/></label>
        <label>E-mail dos alertas<input type="email" value={prefs.email||''} onChange={e=>setPrefs(x=>({...x,email:e.target.value}))} placeholder="voce@email.com"/></label>
        <label>Celular / WhatsApp<input value={prefs.phone||''} onChange={e=>setPrefs(x=>({...x,phone:e.target.value}))} placeholder="(13) 99999-9999"/></label>
      </div>
      <div className={styles.formGrid}>
        <label>Alerta de Ads sem venda<input type="number" min="0" step="1" value={prefs.ads_zero_sales_spend_threshold??10} onChange={e=>setPrefs(x=>({...x,ads_zero_sales_spend_threshold:e.target.value}))}/><small>Avise quando um anúncio gastar pelo menos este valor no dia anterior e tiver 0 vendas.</small></label>
      </div>
      <div className={styles.channelGrid}>
        <label><input type="checkbox" checked={prefs.task_enabled!==false} onChange={e=>setPrefs(x=>({...x,task_enabled:e.target.checked}))}/> Tarefas no Gestor</label>
        <label><input type="checkbox" checked={prefs.email_enabled!==false} onChange={e=>setPrefs(x=>({...x,email_enabled:e.target.checked}))}/> E-mail</label>
        <label><input type="checkbox" checked={prefs.whatsapp_enabled===true} onChange={e=>setPrefs(x=>({...x,whatsapp_enabled:e.target.checked}))}/> WhatsApp <small>canal será conectado depois</small></label>
        <label><input type="checkbox" checked={prefs.push_enabled===true} onChange={e=>setPrefs(x=>({...x,push_enabled:e.target.checked}))}/> Notificação no celular <small>push será conectado depois</small></label>
      </div>
      <h3>Quero receber alertas sobre</h3>
      <div className={styles.channelGrid}>{[
        ['flash_sale','Oferta Relâmpago'],['reanalysis','Reanálises'],['competitors','Concorrentes'],['images','Imagens'],['video','Vídeo'],['ads','Shopee Ads'],['other','Outras tarefas']
      ].map(([key,label])=><label key={key}><input type="checkbox" checked={prefs.categories?.[key]!==false} onChange={e=>setPrefs(x=>({...x,categories:{...(x.categories||{}),[key]:e.target.checked}}))}/>{label}</label>)}</div>
      <div className={styles.saveLine}><button type="button" onClick={savePrefs} disabled={prefState.loading||prefState.saving}>{prefState.saving?'Salvando…':prefState.loading?'Carregando…':'Salvar notificações'}</button>{prefState.message&&<span>{prefState.message}</span>}</div>
    </section>
    <section className={styles.panel}><h2>Integrações</h2><p>O status da extensão Motor Sênior e da loja Shopee permanece visível no menu lateral. Conexão, saída e reconexão continuam sendo controladas por ali.</p></section>
    <section className={styles.panel}><h2>Segurança dos dados</h2><p>O Gestor diferencia dados reais, ausência de coleta e erro de integração. Nenhuma configuração desta página cria métricas fictícias.</p></section>
  </div>;
}
