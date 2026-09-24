import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const safeText=(v,max=500)=>v==null?null:(String(v).trim().slice(0,max)||null);
const positiveInt=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const allowedPriority=new Set(['urgent','high','medium','low']);
const priorityRank={urgent:0,high:1,medium:2,low:3};

async function syncReanalysisTasks(db,shopId){
  const now=Date.now(),soon=now+24*3600*1000;
  const [{data:schedules,error:scheduleError},{data:existing,error:taskError}]=await Promise.all([
    db.from('extension_analysis_schedules').select('item_id,title,next_run_at,last_run_at,enabled').eq('shop_id',shopId),
    db.from('gs_tasks').select('id,item_id,due_at,created_at').eq('shop_id',shopId).eq('source','system').eq('task_type','reanalysis').eq('status','open')
  ]);
  if(scheduleError||taskError)return;
  const byItem=new Map((existing||[]).map(x=>[String(x.item_id),x]));
  for(const s of schedules||[]){
    const row=byItem.get(String(s.item_id));
    const next=s.next_run_at?new Date(s.next_run_at).getTime():NaN;
    const last=s.last_run_at?new Date(s.last_run_at).getTime():NaN;
    if(row&&Number.isFinite(last)&&last>new Date(row.created_at).getTime()){
      await db.from('gs_tasks').update({status:'done',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id).eq('shop_id',shopId);
      byItem.delete(String(s.item_id));
    }
    if(!s.enabled||!Number.isFinite(next)||next>soon)continue;
    const current=byItem.get(String(s.item_id));
    const payload={
      shop_id:shopId,item_id:s.item_id,task_type:'reanalysis',
      title:'Refazer Super Análise',
      description:`${s.title||('Produto '+s.item_id)} precisa de uma nova análise.`,
      priority:next<=now?'urgent':'high',status:'open',due_at:new Date(next).toISOString(),
      remind_at:new Date(next).toISOString(),source:'system',
      action_url:`/super-analise?item_id=${s.item_id}`,
      dedupe_key:`reanalysis:${s.item_id}`,
      metadata:{reason:'analysis_schedule'},updated_at:new Date().toISOString()
    };
    if(current)await db.from('gs_tasks').update(payload).eq('id',current.id).eq('shop_id',shopId);
    else await db.from('gs_tasks').insert(payload);
  }
}

function sortTasks(rows){
  return [...rows].sort((a,b)=>{
    const p=(priorityRank[a.priority]??9)-(priorityRank[b.priority]??9);
    if(p)return p;
    const ad=a.due_at?new Date(a.due_at).getTime():Infinity,bD=b.due_at?new Date(b.due_at).getTime():Infinity;
    return ad-bD;
  });
}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const db=supabaseAdmin();
  await syncReanalysisTasks(db,shop.shop_id);
  const url=new URL(request.url);
  const briefing=url.searchParams.get('briefing')==='1';
  const status=safeText(url.searchParams.get('status'),20)||'open';
  const itemId=positiveInt(url.searchParams.get('item_id'));
  let q=db.from('gs_tasks').select('*').eq('shop_id',shop.shop_id).eq('status',status).order('created_at',{ascending:false}).limit(300);
  if(itemId)q=q.eq('item_id',itemId);
  const {data,error}=await q;
  if(error)return NextResponse.json({error:error.message},{status:500});
  let tasks=data||[];
  if(briefing){
    const now=new Date(),end=new Date(now);end.setHours(23,59,59,999);
    tasks=tasks.filter(t=>{
      const snooze=t.snoozed_until?new Date(t.snoozed_until).getTime():0;
      if(snooze>Date.now())return false;
      const due=t.due_at?new Date(t.due_at).getTime():Infinity;
      const remind=t.remind_at?new Date(t.remind_at).getTime():Infinity;
      return t.priority==='urgent'||due<=end.getTime()||remind<=Date.now();
    }).slice(0,8);
  }
  return NextResponse.json({ok:true,tasks:sortTasks(tasks)});
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const title=safeText(body?.title,240),itemId=positiveInt(body?.item_id??body?.itemId);
  if(!title)return NextResponse.json({error:'Informe o título do lembrete.'},{status:400});
  let dueAt=null;
  if(body?.due_at){
    const d=new Date(body.due_at);if(Number.isNaN(d.getTime()))return NextResponse.json({error:'Data do lembrete inválida.'},{status:400});
    dueAt=d.toISOString();
  }else if(Number.isFinite(Number(body?.delay_days))){
    const d=new Date(Date.now()+Math.max(0,Number(body.delay_days))*86400000);dueAt=d.toISOString();
  }
  const row={
    shop_id:shop.shop_id,item_id:itemId,task_type:safeText(body?.task_type,60)||'other',
    title,description:safeText(body?.description,1000),
    priority:allowedPriority.has(body?.priority)?body.priority:'medium',
    status:'open',due_at:dueAt,remind_at:dueAt,source:safeText(body?.source,60)||'manual',
    action_url:safeText(body?.action_url,1000),metadata:body?.metadata&&typeof body.metadata==='object'?body.metadata:{},
    updated_at:new Date().toISOString()
  };
  const {data,error}=await supabaseAdmin().from('gs_tasks').insert(row).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,task:data});
}

export async function PATCH(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const id=safeText(body?.id,100),action=safeText(body?.action,30);
  if(!id)return NextResponse.json({error:'Tarefa inválida.'},{status:400});
  const now=new Date().toISOString();
  let patch={updated_at:now};
  if(action==='done')patch={...patch,status:'done',completed_at:now};
  else if(action==='dismiss')patch={...patch,status:'dismissed'};
  else if(action==='snooze'){
    const hours=Math.max(1,Number(body?.hours)||24);
    const at=new Date(Date.now()+hours*3600000).toISOString();
    patch={...patch,status:'open',snoozed_until:at,remind_at:at};
  }else return NextResponse.json({error:'Ação de tarefa inválida.'},{status:400});
  const {data,error}=await supabaseAdmin().from('gs_tasks').update(patch).eq('shop_id',shop.shop_id).eq('id',id).select('*').maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(!data)return NextResponse.json({error:'Tarefa não encontrada.'},{status:404});
  return NextResponse.json({ok:true,task:data});
}
