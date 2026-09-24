const text=(value,max=1000)=>value==null?'':String(value).trim().slice(0,max);
const finite=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);

function appBaseUrl(){
  const raw=process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||process.env.VERCEL_PROJECT_PRODUCTION_URL||'';
  if(!raw)return '';
  return /^https?:\/\//i.test(raw)?raw.replace(/\/$/,''):`https://${raw.replace(/\/$/,'')}`;
}

function absoluteUrl(path){
  if(!path)return appBaseUrl()||'';
  if(/^https?:\/\//i.test(path))return path;
  const base=appBaseUrl();
  return base?`${base}${path.startsWith('/')?'':'/'}${path}`:path;
}

function escapeHtml(value){
  return text(value,5000)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

export function normalizeWhatsAppPhone(value){
  let digits=String(value||'').replace(/\D/g,'');
  if(!digits)return '';
  if(digits.startsWith('00'))digits=digits.slice(2);
  if((digits.length===10||digits.length===11)&&!digits.startsWith('55'))digits='55'+digits;
  return digits;
}

export function getNotificationProviderStatus(){
  const emailConfigured=Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM);
  const whatsappConfigured=Boolean(
    process.env.META_WHATSAPP_ACCESS_TOKEN&&
    process.env.META_WHATSAPP_PHONE_NUMBER_ID&&
    process.env.META_WHATSAPP_TEMPLATE_NAME&&
    process.env.META_GRAPH_VERSION
  );
  return {
    email:{provider:'Resend',configured:emailConfigured},
    whatsapp:{
      provider:'Meta WhatsApp Cloud API',
      configured:whatsappConfigured,
      template:process.env.META_WHATSAPP_TEMPLATE_NAME||null,
      language:process.env.META_WHATSAPP_TEMPLATE_LANGUAGE||'pt_BR'
    },
    push:{provider:null,configured:false}
  };
}

async function fetchJson(url,options={},timeoutMs=12000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
    const raw=await response.text();
    let data=null;
    try{data=raw?JSON.parse(raw):null}catch{data={raw:raw.slice(0,1000)}}
    if(!response.ok){
      const message=data?.message||data?.error?.message||data?.error||`HTTP ${response.status}`;
      const error=new Error(String(message));
      error.status=response.status;
      error.data=data;
      throw error;
    }
    return data;
  }finally{clearTimeout(timer)}
}

async function sendEmail({to,name,title,description,actionUrl,idempotencyKey}){
  const status=getNotificationProviderStatus().email;
  if(!status.configured)return{sent:false,reason:'provider_not_configured'};
  if(!to)return{sent:false,reason:'missing_recipient'};
  const from=process.env.RESEND_FROM;
  const safeTitle=escapeHtml(title||'Alerta do Gestor Sênior');
  const safeDescription=escapeHtml(description||'').replace(/\n/g,'<br/>');
  const safeName=escapeHtml(name||'');
  const link=absoluteUrl(actionUrl);
  const safeLink=escapeHtml(link);
  const html=`
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17243a">
      <h2 style="margin-bottom:8px">${safeTitle}</h2>
      ${safeName?`<p>Olá, ${safeName}.</p>`:''}
      <p style="line-height:1.6">${safeDescription}</p>
      ${link?`<p><a href="${safeLink}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#1769e8;color:#fff;text-decoration:none;font-weight:700">Abrir no Gestor Sênior</a></p>`:''}
      <p style="font-size:12px;color:#71839a;margin-top:24px">Mensagem automática do Gestor Sênior.</p>
    </div>`;
  const headers={
    'Content-Type':'application/json',
    Authorization:`Bearer ${process.env.RESEND_API_KEY}`
  };
  if(idempotencyKey)headers['Idempotency-Key']=text(idempotencyKey,240);
  const data=await fetchJson('https://api.resend.com/emails',{
    method:'POST',headers,
    body:JSON.stringify({from,to:[to],subject:text(title||'Alerta do Gestor Sênior',240),html})
  });
  return{sent:true,id:data?.id||null};
}

async function sendWhatsAppVelocity({to,name,competitorTitle,soldPerDay,velocityChangePct,actionUrl}){
  const status=getNotificationProviderStatus().whatsapp;
  if(!status.configured)return{sent:false,reason:'provider_not_configured'};
  const phone=normalizeWhatsAppPhone(to);
  if(!phone)return{sent:false,reason:'missing_recipient'};
  const version=process.env.META_GRAPH_VERSION;
  const phoneNumberId=process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const templateName=process.env.META_WHATSAPP_TEMPLATE_NAME;
  const language=process.env.META_WHATSAPP_TEMPLATE_LANGUAGE||'pt_BR';
  const pct=finite(velocityChangePct);
  const rate=finite(soldPerDay);
  const link=absoluteUrl(actionUrl);
  const params=[
    text(name||'Gestor Sênior',120),
    text(competitorTitle||'Concorrente',240),
    rate==null?'sem dado':rate.toLocaleString('pt-BR',{maximumFractionDigits:1})+' vendas/dia',
    pct==null?'forte aceleração':Math.abs(pct).toLocaleString('pt-BR',{maximumFractionDigits:0})+'%',
    text(link||'Abra o Gestor Sênior',500)
  ].map(v=>({type:'text',text:v}));
  const data=await fetchJson(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneNumberId)}/messages`,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.META_WHATSAPP_ACCESS_TOKEN}`},
    body:JSON.stringify({
      messaging_product:'whatsapp',
      to:phone,
      type:'template',
      template:{name:templateName,language:{code:language},components:[{type:'body',parameters:params}]}
    })
  });
  return{sent:true,id:data?.messages?.[0]?.id||null};
}

function categoryForTask(taskType){
  const map={reanalysis:'reanalysis',competitors:'competitors',ads:'ads',flash_sale:'flash_sale',images:'images',video:'video'};
  return map[taskType]||'other';
}

async function loadPreferences(db,shopId){
  const {data,error}=await db.from('gs_notification_preferences').select('*').eq('shop_id',shopId).maybeSingle();
  if(error)throw new Error(error.message);
  return data||{
    shop_id:shopId,display_name:'',email:'',phone:'',task_enabled:true,email_enabled:true,whatsapp_enabled:false,push_enabled:false,
    categories:{flash_sale:true,reanalysis:true,competitors:true,images:true,video:true,ads:true,other:true}
  };
}

async function resolveTask(db,shopId,task){
  if(task?.id){
    const {data}=await db.from('gs_tasks').select('*').eq('shop_id',shopId).eq('id',task.id).maybeSingle();
    if(data)return data;
  }
  if(task?.dedupe_key){
    const {data}=await db.from('gs_tasks').select('*').eq('shop_id',shopId).eq('dedupe_key',task.dedupe_key).maybeSingle();
    if(data)return data;
  }
  return task||null;
}

export function whatsappVelocityRule(preferences){
  const c=preferences?.categories||{};
  const pct=finite(c.competitor_velocity_whatsapp_pct);
  const minRate=finite(c.competitor_velocity_whatsapp_min_sales_per_day);
  return{
    enabled:c.competitor_velocity_whatsapp!==false,
    pctThreshold:pct==null?100:Math.max(25,pct),
    minSalesPerDay:minRate==null?5:Math.max(0,minRate)
  };
}

export async function sendTaskNotification({db,shopId,task,event={},allowWhatsApp=false}){
  const saved=await resolveTask(db,shopId,task);
  if(!saved)return{sent:false,reason:'task_not_found'};
  const prefs=await loadPreferences(db,shopId);
  const category=categoryForTask(saved.task_type);
  if(prefs?.categories?.[category]===false)return{sent:false,reason:'category_disabled'};
  const meta=saved.metadata&&typeof saved.metadata==='object'?saved.metadata:{};
  const notificationMeta=meta.notifications&&typeof meta.notifications==='object'?meta.notifications:{};
  const results={email:null,whatsapp:null};

  if(prefs.email_enabled!==false&&prefs.email&&!notificationMeta.email_at){
    try{
      results.email=await sendEmail({
        to:prefs.email,name:prefs.display_name,title:saved.title,description:saved.description,
        actionUrl:saved.action_url,idempotencyKey:'gs/'+text(saved.dedupe_key||saved.id,180)+'/email'
      });
    }catch(error){results.email={sent:false,error:String(error?.message||error)}}
  }else results.email={sent:false,reason:notificationMeta.email_at?'already_sent':'disabled_or_missing_recipient'};

  if(allowWhatsApp&&prefs.whatsapp_enabled===true&&prefs.phone&&!notificationMeta.whatsapp_at){
    try{
      results.whatsapp=await sendWhatsAppVelocity({
        to:prefs.phone,name:prefs.display_name,competitorTitle:event.competitorTitle,
        soldPerDay:event.soldPerDay,velocityChangePct:event.velocityChangePct,actionUrl:saved.action_url
      });
    }catch(error){results.whatsapp={sent:false,error:String(error?.message||error)}}
  }else results.whatsapp={sent:false,reason:!allowWhatsApp?'event_not_critical':notificationMeta.whatsapp_at?'already_sent':'disabled_or_missing_recipient'};

  const now=new Date().toISOString();
  const nextNotifications={...notificationMeta};
  if(results.email?.sent)nextNotifications.email_at=now;
  if(results.whatsapp?.sent)nextNotifications.whatsapp_at=now;
  const anySent=Boolean(results.email?.sent||results.whatsapp?.sent);
  if(anySent){
    await db.from('gs_tasks').update({
      last_notified_at:now,
      metadata:{...meta,notifications:nextNotifications},
      updated_at:now
    }).eq('shop_id',shopId).eq('id',saved.id);
  }
  return{sent:anySent,results,providers:getNotificationProviderStatus()};
}

export async function sendNotificationTest({channel,preferences}){
  const actionUrl='/extensao-shopee-intelligence?section=prioridades';
  if(channel==='email'){
    return sendEmail({
      to:preferences?.email,name:preferences?.display_name,
      title:'Teste de alerta do Gestor Sênior',
      description:'Seu e-mail está conectado corretamente aos alertas do Gestor Sênior.',
      actionUrl,idempotencyKey:'gs-test/'+Date.now()
    });
  }
  if(channel==='whatsapp'){
    return sendWhatsAppVelocity({
      to:preferences?.phone,name:preferences?.display_name,
      competitorTitle:'Concorrente de teste',soldPerDay:12.4,velocityChangePct:125,actionUrl
    });
  }
  return{sent:false,reason:'unsupported_channel'};
}
