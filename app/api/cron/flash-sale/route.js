import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';
import {
  getItemBaseInfo,getFlashSaleTimeSlots,getShopFlashSaleList,getShopFlashSaleItems,
  createShopFlashSale,addShopFlashSaleItems,updateShopFlashSale
} from '../../../../lib/shopee';
import {analyzeItemSalesHistory,rankFlashSaleSlots} from '../../../../lib/flash-sale-intelligence';
import {sendTaskNotification} from '../../../../lib/notifications';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=55;

function findItemInFlash(raw,itemId){
  const response=raw?.response||{};
  const infos=Array.isArray(response?.item_info)?response.item_info:[];
  const models=Array.isArray(response?.models)?response.models:[];
  return infos.some(x=>Number(x?.item_id)===Number(itemId)&&Number(x?.status??1)===1)||
    models.some(x=>Number(x?.item_id)===Number(itemId)&&Number(x?.status??1)===1);
}

async function existingOfferForItem(shop,itemId){
  const listRaw=await getShopFlashSaleList({shopId:shop.shop_id,accessToken:shop.access_token,type:2,offset:0,limit:100});
  const sales=Array.isArray(listRaw?.response?.flash_sale_list)?listRaw.response.flash_sale_list:[];
  for(const sale of sales.filter(x=>Number(x?.status)===1&&Number(x?.type)===2).slice(0,30)){
    try{
      const itemsRaw=await getShopFlashSaleItems({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId:sale.flash_sale_id,offset:0,limit:100});
      if(findItemInFlash(itemsRaw,itemId))return sale;
    }catch(error){
      console.warn('[cron flash-sale] falha lendo oferta',sale?.flash_sale_id,error);
    }
  }
  return null;
}

async function runOne(db,shop,row){
  const itemId=Number(row.item_id);
  const now=new Date();
  try{
    const existing=await existingOfferForItem(shop,itemId);
    if(existing){
      const end=Number(existing?.end_time);
      const next=end?new Date(end*1000+Number(row.min_gap_hours||20)*3600000):new Date(now.getTime()+6*3600000);
      await db.from('flash_sale_automations').update({
        last_run_at:now.toISOString(),last_status:'offer_exists',last_error:null,
        last_flash_sale_id:Number(existing.flash_sale_id)||null,next_run_at:next.toISOString(),updated_at:now.toISOString()
      }).eq('shop_id',shop.shop_id).eq('item_id',itemId);
      return{itemId,status:'offer_exists',flashSaleId:existing.flash_sale_id};
    }

    const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
    const product=base?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
    if(!product)throw new Error('Produto não encontrado na Shopee.');
    if(product?.has_model)throw new Error('Automação de Oferta Relâmpago por variação ainda não está habilitada para este produto.');

    const start=Math.floor(Date.now()/1000)+300,end=start+7*24*3600;
    const slotsRaw=await getFlashSaleTimeSlots({shopId:shop.shop_id,accessToken:shop.access_token,startTime:start,endTime:end});
    const slots=Array.isArray(slotsRaw?.response)?slotsRaw.response:[];
    if(!slots.length)throw new Error('Shopee não retornou horários oficiais disponíveis.');

    const insight=row.use_best_time
      ?await analyzeItemSalesHistory(db,{shopId:shop.shop_id,itemId,days:Number(row.lookback_days||30)})
      :null;
    const ranked=row.use_best_time?rankFlashSaleSlots(slots,insight):slots;
    const slot=ranked[0];
    if(!slot?.timeslot_id)throw new Error('Nenhum horário elegível encontrado.');

    const created=await createShopFlashSale({shopId:shop.shop_id,accessToken:shop.access_token,timeslotId:slot.timeslot_id});
    const flashSaleId=created?.response?.flash_sale_id;
    if(!flashSaleId)throw new Error('Shopee não retornou o ID da Oferta Relâmpago.');

    const added=await addShopFlashSaleItems({
      shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId,
      items:[{
        item_id:itemId,
        purchase_limit:Number(row.purchase_limit||1),
        item_input_promo_price:Number(row.promo_price),
        item_stock:Number(row.stock)
      }]
    });
    const failed=added?.response?.failed_items||[];
    if(failed.length)throw new Error(failed.map(x=>x.err_msg||'Produto não elegível').join(' · '));
    await updateShopFlashSale({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId,status:1});

    const slotEnd=Number(slot?.end_time);
    const next=slotEnd?new Date(slotEnd*1000+Number(row.min_gap_hours||20)*3600000):new Date(now.getTime()+24*3600000);
    await db.from('flash_sale_automations').update({
      last_run_at:now.toISOString(),last_status:'created',last_error:null,last_flash_sale_id:Number(flashSaleId),
      next_run_at:next.toISOString(),
      settings:{...(row.settings||{}),last_recommendation:insight||null,last_timeslot_id:slot.timeslot_id},
      updated_at:now.toISOString()
    }).eq('shop_id',shop.shop_id).eq('item_id',itemId);
    return{itemId,status:'created',flashSaleId,timeslotId:slot.timeslot_id};
  }catch(error){
    const message=String(error?.message||error).slice(0,1000);
    await db.from('flash_sale_automations').update({
      last_run_at:now.toISOString(),last_status:'error',last_error:message,
      next_run_at:new Date(now.getTime()+6*3600000).toISOString(),updated_at:now.toISOString()
    }).eq('shop_id',shop.shop_id).eq('item_id',itemId);
    return{itemId,status:'error',error:message};
  }
}

export async function GET(request){
  const db=supabaseAdmin();
  const secret=request.headers.get('x-automation-secret');
  const {data:stored,error:secretError}=await db.from('app_scheduler_secrets').select('secret').eq('key','flash_sale_automation').maybeSingle();
  if(secretError||!stored?.secret||secret!==stored.secret)return NextResponse.json({error:'Unauthorized'},{status:401});

  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({ok:true,processed:[],note:'Nenhuma loja ativa.'});

  // Envia e-mails de término mesmo que o usuário não abra o Gestor.
  try{
    const nowIso=new Date().toISOString();
    const {data:due}=await db.from('gs_tasks').select('*')
      .eq('shop_id',shop.shop_id)
      .eq('task_type','flash_sale')
      .eq('source','flash-sale-expiry')
      .eq('status','open')
      .lte('due_at',nowIso)
      .is('last_notified_at',null)
      .limit(20);
    for(const task of due||[]){
      if(task?.metadata?.notify_email===true){
        try{await sendTaskNotification({db,shopId:shop.shop_id,task,allowWhatsApp:false})}
        catch(error){console.warn('[cron flash-sale] falha notificando término',String(error?.message||error))}
      }
    }
  }catch(error){console.warn('[cron flash-sale] falha lendo alertas de término',String(error?.message||error))}

  const {data,error}=await db.from('flash_sale_automations').select('*')
    .eq('shop_id',shop.shop_id).eq('enabled',true)
    .or('next_run_at.is.null,next_run_at.lte.'+new Date().toISOString())
    .order('next_run_at',{ascending:true,nullsFirst:true}).limit(8);
  if(error)return NextResponse.json({error:error.message},{status:500});

  const processed=[];
  for(const row of data||[])processed.push(await runOne(db,shop,row));
  return NextResponse.json({ok:true,processed});
}
