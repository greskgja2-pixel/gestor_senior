// Central de Promoções — estados, contagens, alertas e orientações (lógica pura, testada em
// tests/promotions-diagnosis.test.mjs). SOMENTE LEITURA: nada aqui altera preço, estoque, desconto ou período.
//
// Regras:
//  - `status` vem da Shopee (lista operacional de onde a campanha foi lida); o horário só valida e aponta divergências.
//  - falha ao consultar produtos (item_count=null) ≠ zero produtos confirmado ≠ quantidade não informada.
//  - alertas só existem com evidência; orientação separa fato / possível problema / ação.

const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);

export const ALERT_THRESHOLDS=Object.freeze({endingSoonHours:48,startingSoonHours:48});

export const STATES=Object.freeze({
  active:{id:'active',label:'Ativa agora',level:'good',icon:'zap'},
  scheduled:{id:'scheduled',label:'Agendada',level:'info',icon:'calendar'},
  ended:{id:'ended',label:'Encerrada',level:'data',icon:'check'},
  disabled:{id:'disabled',label:'Desativada',level:'warn',icon:'alert'},
  removed:{id:'removed',label:'Removida',level:'data',icon:'cancel'},
  rejected:{id:'rejected',label:'Rejeitada',level:'bad',icon:'alert'},
  unknown:{id:'unknown',label:'Status desconhecido',level:'data',icon:'help'}
});
export const stateOf=row=>STATES[row?.status]||STATES.unknown;

// Divergência entre o estado operacional da Shopee e o que o horário indica.
export function statusNote(row){
  if(!row)return null;
  if(row.status==='disabled'||row.status==='removed'||row.status==='rejected')return`A Shopee informa esta promoção como ${stateOf(row).label.toLowerCase()} (código ${row.shopee_status??'—'}); o horário sozinho indicaria "${(STATES[row.time_status]||STATES.unknown).label.toLowerCase()}".`;
  if(row.status_mismatch&&row.time_status&&row.time_status!==row.status)return`Divergência: a lista da Shopee a classifica como "${stateOf(row).label.toLowerCase()}", mas o horário indica "${(STATES[row.time_status]||STATES.unknown).label.toLowerCase()}". Prevalece a informação da Shopee.`;
  return null;
}

// Contagem de produtos com três situações distintas.
export function productCount(row){
  if(row?.items_state==='failed'&&num(row?.item_count)==null)return{kind:'failed',n:null,text:'Não foi possível consultar os produtos desta promoção.'};
  const n=num(row?.item_count);
  if(n==null)return{kind:'unknown',n:null,text:'Quantidade de produtos indisponível.'};
  if(n===0)return{kind:'zero',n:0,text:'Esta promoção não possui produtos participantes no momento.'};
  return{kind:'known',n,text:`${n} produto${n===1?'':'s'}${row?.has_more?' ou mais':''}`};
}

export function timeLeft(row,now){
  const start=num(row?.start_time),end=num(row?.end_time);
  const fmt=sec=>{
    const m=Math.floor(sec/60);if(m<60)return`${Math.max(m,1)} min`;
    const h=Math.floor(m/60);if(h<48)return`${h} h${m%60?` ${m%60} min`:''}`;
    const d=Math.floor(h/24);return`${d} dia${d===1?'':'s'}${h%24?` ${h%24} h`:''}`;
  };
  if(row?.status==='active'&&end&&end>now)return{kind:'ends',seconds:end-now,text:`termina em ${fmt(end-now)}`};
  if(row?.status==='scheduled'&&start&&start>now)return{kind:'starts',seconds:start-now,text:`começa em ${fmt(start-now)}`};
  return null;
}

export function summarize(rows){
  const live=r=>r.status==='active'||r.status==='scheduled';
  return{
    active:rows.filter(r=>r.status==='active').length,
    scheduled:rows.filter(r=>r.status==='scheduled').length,
    ended:rows.filter(r=>r.status==='ended').length,
    // Situação (ativa/agendada/encerrada) e tipo (desconto/relâmpago) são cortes DIFERENTES do mesmo conjunto: não somar.
    discounts:rows.filter(r=>r.kind==='discount'&&live(r)).length,
    flash:rows.filter(r=>r.kind==='flash_sale'&&live(r)).length
  };
}

export const FILTERS=Object.freeze([
  {id:'active',label:'Ativas agora'},{id:'scheduled',label:'Agendadas'},
  {id:'discounts',label:'Campanhas de desconto'},{id:'flash',label:'Ofertas Relâmpago'},{id:'ended',label:'Encerradas'}
]);
export function filterRows(rows,filter,query=''){
  const q=String(query||'').trim().toLowerCase();
  const live=r=>r.status==='active'||r.status==='scheduled';
  let out=rows;
  if(filter==='active')out=rows.filter(r=>r.status==='active');
  else if(filter==='scheduled')out=rows.filter(r=>r.status==='scheduled');
  else if(filter==='discounts')out=rows.filter(r=>r.kind==='discount'&&live(r));
  else if(filter==='flash')out=rows.filter(r=>r.kind==='flash_sale'&&live(r));
  else if(filter==='ended')out=rows.filter(r=>r.status==='ended');
  if(q)out=out.filter(r=>String(r.name||'').toLowerCase().includes(q)||String(r.id??'').includes(q));
  return out;
}

// Alertas: cada um tem evidência explícita, nível, explicação, promoção e ação. Sem fundamento, não há alerta.
export function buildAlerts(rows,now,opts={}){
  const T={...ALERT_THRESHOLDS,...opts};
  const out=[];
  for(const r of rows){
    const key=r.kind+'-'+r.id;
    const label=(r.kind==='flash_sale'?'Oferta Relâmpago':'Campanha')+(r.name&&r.kind!=='flash_sale'?` “${r.name}”`:'');
    const pc=productCount(r);
    if(r.status==='active'||r.status==='scheduled'){
      if(pc.kind==='zero')out.push({id:'empty-'+key,rowKey:key,level:'warn',icon:'package',title:`${label} sem produtos`,fact:`${label} está ${stateOf(r).label.toLowerCase()} e a Shopee informa 0 produtos participantes.`,action:'Verifique se há produtos cadastrados e elegíveis; uma promoção vazia não traz vendas.'});
      else if(pc.kind==='failed'||pc.kind==='unknown')out.push({id:'nodata-'+key,rowKey:key,level:'data',icon:'help',title:`${label}: produtos não confirmados`,fact:pc.text,action:'Atualize os dados antes de tomar decisões; a quantidade de produtos não foi confirmada, então a promoção não deve ser considerada vazia.'});
    }
    const tl=timeLeft(r,now);
    if(tl?.kind==='ends'&&tl.seconds<=T.endingSoonHours*3600)out.push({id:'ending-'+key,rowKey:key,level:'warn',icon:'clock',title:`${label} termina em breve`,fact:`${label} ${tl.text}.`,action:'Veja se será necessário preparar outra campanha para não ficar sem promoção ativa.'});
    if(tl?.kind==='starts'&&tl.seconds<=T.startingSoonHours*3600)out.push({id:'starting-'+key,rowKey:key,level:'info',icon:'calendar',title:`${label} começa em breve`,fact:`${label} ${tl.text}.`,action:'Confira produtos, preços promocionais e estoque antes do início.'});
    const note=statusNote(r);
    if(note)out.push({id:'status-'+key,rowKey:key,level:r.status==='rejected'?'bad':'warn',icon:'alert',title:`${label}: estado divergente`,fact:note,action:'Abra o Seller Center para conferir o estado real desta promoção.'});
  }
  const order={bad:0,warn:1,info:2,data:3};
  return out.sort((a,b)=>order[a.level]-order[b.level]);
}

// "O que devo verificar?" — recomendações determinísticas. Margem só é citada quando há custo (o Gestor não o recebe aqui).
export function guidance(rows,alerts,now){
  const items=[];
  const hasEmpty=alerts.some(a=>a.id.startsWith('empty-'));
  const hasNoData=alerts.some(a=>a.id.startsWith('nodata-'));
  const hasEnding=alerts.some(a=>a.id.startsWith('ending-'));
  if(hasEmpty)items.push({id:'g-empty',fact:'Há promoção ativa ou agendada com 0 produtos confirmados.',problem:'Pode não haver produtos elegíveis cadastrados.',action:'Verifique se existem produtos cadastrados e elegíveis nesta promoção.'});
  if(hasEnding)items.push({id:'g-ending',fact:'Uma promoção ativa termina em breve.',problem:'A loja pode ficar sem campanha ativa.',action:'Veja se será necessário preparar outra campanha.'});
  if(hasNoData)items.push({id:'g-nodata',fact:'Não foi possível verificar todas as informações de alguma promoção.',problem:'Decisões com dados incompletos podem estar erradas.',action:'Atualize os dados antes de tomar decisões.'});
  if(rows.some(r=>(r.status==='active'||r.status==='scheduled')&&(r.products||[]).some(p=>p.discount_pct!=null&&p.discount_pct>=40)))items.push({id:'g-margin',fact:'Há produtos com desconto de 40% ou mais.',problem:'Descontos altos podem reduzir bastante a margem, mas o Gestor não conhece o seu custo nesta tela.',action:'Confira se o preço promocional mantém uma margem adequada na Precificação Inteligente.'});
  if(!rows.some(r=>r.status==='active')&&rows.some(r=>r.status==='scheduled'))items.push({id:'g-gap',fact:'Nenhuma promoção está ativa agora, mas há promoções agendadas.',problem:'—',action:'Acompanhe o início da próxima promoção.'});
  if(!items.length)items.push({id:'g-ok',fact:'Nenhuma ocorrência relevante nas promoções coletadas.',problem:'—',action:'Atualize periodicamente e acompanhe o prazo das campanhas.'});
  return items;
}
