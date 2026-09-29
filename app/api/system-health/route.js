import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../lib/shop';
import {supabaseAdmin} from '../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=20;

const now=()=>new Date().toISOString();
const ok=(detail,extra={})=>({status:'ok',detail,...extra});
const warn=(detail,extra={})=>({status:'warning',detail,...extra});
const fail=(detail,extra={})=>({status:'error',detail,...extra});

async function dbProbe(db,table,shopId){
  const started=Date.now();
  try{
    let q=db.from(table).select('*',{head:true,count:'exact'});
    if(shopId)q=q.eq('shop_id',shopId);
    const {count,error}=await q.limit(1);
    if(error)throw error;
    return ok('Banco respondeu normalmente.',{latency_ms:Date.now()-started,count:count??null});
  }catch(error){
    return fail(String(error?.message||error),{latency_ms:Date.now()-started});
  }
}

export async function GET(){
  const started=Date.now();
  try{
    const shop=await getActiveShop();
    if(!shop){
      return NextResponse.json({
        ok:true,
        checked_at:now(),
        duration_ms:Date.now()-started,
        shop:{status:'warning',detail:'Nenhuma loja Shopee conectada.'},
        dependencies:{},
        modules:{
          funnel:warn('Precisa de uma loja conectada e do Motor Sênior.'),
          super_analysis:warn('Precisa de uma loja conectada para validar o histórico.'),
          competitors:warn('Precisa de uma loja conectada para validar o monitoramento.'),
          priorities:warn('Precisa de uma loja conectada para validar tarefas.')
        }
      });
    }

    const db=supabaseAdmin();
    const [analysis,competitors,tasks,preferences]=await Promise.all([
      dbProbe(db,'extension_analysis_reports',shop.shop_id),
      dbProbe(db,'gs_competitor_watches',shop.shop_id),
      dbProbe(db,'gs_tasks',shop.shop_id),
      dbProbe(db,'gs_notification_preferences',shop.shop_id)
    ]);

    const database=[analysis,competitors,tasks,preferences].every(x=>x.status==='ok')
      ? ok('Supabase acessível e tabelas principais responderam.')
      : fail('Uma ou mais tabelas principais falharam.');

    return NextResponse.json({
      ok:true,
      checked_at:now(),
      duration_ms:Date.now()-started,
      shop:ok(shop.shop_name||`Loja #${shop.shop_id}`,{shop_id:shop.shop_id}),
      dependencies:{database,analysis,competitors,tasks,preferences},
      modules:{
        funnel:database.status==='ok'?ok('Backend pronto. O teste completo do Funil depende do Motor Sênior no navegador.'):fail('Backend indisponível.'),
        super_analysis:analysis.status==='ok'?ok('Histórico da Super Análise acessível.',{records:analysis.count}):fail('Tabela da Super Análise indisponível.'),
        competitors:competitors.status==='ok'?ok('Monitoramento de concorrentes acessível.',{records:competitors.count}):fail('Tabela de concorrentes indisponível.'),
        priorities:tasks.status==='ok'?ok('Central de Prioridades acessível.',{records:tasks.count}):fail('Tabela de tarefas indisponível.')
      }
    });
  }catch(error){
    return NextResponse.json({ok:false,checked_at:now(),duration_ms:Date.now()-started,error:String(error?.message||error)},{status:500});
  }
}
