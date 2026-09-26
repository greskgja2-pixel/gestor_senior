import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getItemBaseInfo,getItemModelList,getFlashSaleTimeSlots,getShopFlashSaleList,getShopFlashSaleItems,createShopFlashSale,addShopFlashSaleItems,updateShopFlashSale} from '../../../../lib/shopee';
import {supabaseAdmin} from '../../../../lib/supabase';
import {analyzeItemSalesHistory,rankFlashSaleSlots,formatHourRange} from '../../../../lib/flash-sale-intelligence';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=55;

const int=v=>Number.isSafeInteger(Number(v))?Number(v):null;
const num=v=>Number.isFinite(Number(v))?Number(v):null;

function pickNumber(...values){
  for(const value of values){const n=Number(value);if(Number.isFinite(n))return n}
  return null;
}

function normalizeProductModels(raw){
  const response=raw?.response||{};
  const tiers=Array.isArray(response?.tier_variation)?response.tier_variation:[];
  const models=Array.isArray(response?.model)?response.model:[];
  const optionName=(tierIndex=[])=>tierIndex.map((optionIndex,tierPos)=>{
    const tier=tiers[tierPos]||{};
    const option=Array.isArray(tier?.option_list)?tier.option_list[Number(optionIndex)]:null;
    const tierName=String(tier?.name||'').trim();
    const optionText=String(option?.option||option?.name||'').trim();
    return [tierName,optionText].filter(Boolean).join(': ');
  }).filter(Boolean).join(' · ');
  return models.map((m,index)=>{
    const priceInfo=Array.isArray(m?.price_info)?m.price_info[0]||{}:{};
    const stock=pickNumber(
      m?.stock_info_v2?.summary_info?.total_available_stock,
      m?.stock_info?.[0]?.normal_stock,
      m?.stock_info?.normal_stock,
      m?.normal_stock
    );
    return{
      model_id:int(m?.model_id),
      name:optionName(m?.tier_index)||String(m?.model_sku||('Variação '+(index+1))),
      sku:m?.model_sku||null,
      status:m?.model_status||null,
      current_price:pickNumber(priceInfo?.current_price,priceInfo?.original_price),
      original_price:pickNumber(priceInfo?.original_price,priceInfo?.current_price),
      available_stock:stock
    };
  }).filter(x=>x.model_id);
}

function normalizeTimeSlots(raw){
  const candidates=[
    raw?.response,
    raw?.response?.time_slot_list,
    raw?.response?.timeslot_list,
    raw?.response?.time_slots,
    raw?.response?.slots,
    raw?.data,
    raw?.data?.time_slot_list,
    raw?.data?.timeslot_list,
    raw?.data?.time_slots,
    raw?.data?.slots
  ];
  for(const candidate of candidates){
    if(Array.isArray(candidate)){
      return candidate.filter(slot=>Number(slot?.timeslot_id)>0&&Number(slot?.start_time)>0&&Number(slot?.end_time)>0);
    }
  }
  return[];
}

async function loadOfficialTimeSlots({shop,startTime,endTime}){
  const safeStart=Math.max(Math.floor(Date.now()/1000)+120,Number(startTime)||0);
  const safeEnd=Math.max(safeStart+60,Number(endTime)||safeStart+7*24*3600);

  // A Central do Vendedor consulta uma janela contínua (agora -> fim do período).
  // Não quebrar em blocos móveis de 24h: os timeslots BR começam à 00:00
  // e podem atravessar a borda desses blocos, fazendo a Shopee retornar [].
  const raw=await getFlashSaleTimeSlots({
    shopId:shop.shop_id,accessToken:shop.access_token,startTime:safeStart,endTime:safeEnd
  });
  const rows=normalizeTimeSlots(raw)
    .filter(slot=>Number(slot?.start_time)>=safeStart&&Number(slot?.end_time)<=safeEnd+1)
    .sort((a,b)=>Number(a?.start_time||0)-Number(b?.start_time||0));

  if(!rows.length){
    console.warn('[flash-sale] janela contínua sem horários oficiais',{
      startTime:safeStart,endTime:safeEnd,
      shopeeError:raw?.error??null,message:raw?.message??null,
      hasResponse:raw?.response!==undefined
    });
  }
  return rows;
}

function normalizeOfferItem(itemId,sale,raw){
  const response=raw?.response||{};
  const infos=Array.isArray(response?.item_info)?response.item_info:[];
  const models=Array.isArray(response?.models)?response.models:[];
  const info=infos.find(x=>Number(x?.item_id)===Number(itemId))||null;
  const itemModels=models.filter(x=>Number(x?.item_id)===Number(itemId)&&Number(x?.status??1)===1);
  if(!info&&!itemModels.length)return null;
  if(info&&Number(info?.status??1)!==1&&!itemModels.length)return null;

  const prices=[
    pickNumber(info?.item_promotion_price,info?.item_input_promo_price,info?.promotion_price_with_tax,info?.input_promotion_price),
    ...itemModels.map(x=>pickNumber(x?.promotion_price_with_tax,x?.input_promotion_price,x?.input_promo_price))
  ].filter(v=>v!=null&&v>0);
  const stocks=[
    pickNumber(info?.item_promotion_stock,info?.item_stock,info?.campaign_stock,info?.stock),
    ...itemModels.map(x=>pickNumber(x?.campaign_stock,x?.stock))
  ].filter(v=>v!=null&&v>=0);
  return{
    flash_sale_id:Number(sale?.flash_sale_id),
    start_time:pickNumber(sale?.start_time),
    end_time:pickNumber(sale?.end_time),
    status:pickNumber(sale?.status),
    type:pickNumber(sale?.type),
    price:prices.length?Math.min(...prices):null,
    max_price:prices.length?Math.max(...prices):null,
    stock:stocks.length?stocks.reduce((sum,v)=>sum+v,0):null,
    item_name:info?.item_name||null,
    image:info?.image||null,
    variation_count:itemModels.length,
    variations:itemModels.map(x=>({
      model_id:x?.model_id,
      model_name:x?.model_name||null,
      price:pickNumber(x?.promotion_price_with_tax,x?.input_promotion_price,x?.input_promo_price),
      stock:pickNumber(x?.campaign_stock,x?.stock)
    }))
  };
}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const url=new URL(request.url);
  const now=Math.floor(Date.now()/1000)+60;
  const parseDay=value=>{if(!value)return null;const d=new Date(String(value)+'T00:00:00-03:00');return Number.isNaN(d.getTime())?null:Math.floor(d.getTime()/1000)};
  const requestedStart=parseDay(url.searchParams.get('start_date'));
  const requestedEnd=parseDay(url.searchParams.get('end_date'));
  const start=Math.max(now,requestedStart||now);
  const maxEnd=start+45*24*3600;
  const end=Math.min(maxEnd,(requestedEnd?requestedEnd+24*3600-1:start+7*24*3600));
  const itemId=int(url.searchParams.get('item_id'));
  const recommendationDays=[7,30,60,90].includes(Number(url.searchParams.get('days')))?Number(url.searchParams.get('days')):30;
  try{
    const slots=await loadOfficialTimeSlots({shop,startTime:start,endTime:end});
    if(!itemId)return NextResponse.json({ok:true,slots});

    let recommendation=null,recommendedSlots=[];
    try{
      recommendation=await analyzeItemSalesHistory(supabaseAdmin(),{shopId:shop.shop_id,itemId,days:recommendationDays});
      recommendedSlots=rankFlashSaleSlots(slots,recommendation).slice(0,3);
      recommendation={...recommendation,bestWindowLabel:formatHourRange(recommendation.bestWindow)};
    }catch(error){
      console.warn('[flash-sale] falha calculando melhor horário',error);
    }

    let productModels=[],productHasVariations=false,productModelError=null;
    try{
      const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
      const current=base?.response?.item_list?.find(x=>Number(x?.item_id)===Number(itemId));
      productHasVariations=!!current?.has_model;
      if(productHasVariations){
        const modelRaw=await getItemModelList({shopId:shop.shop_id,accessToken:shop.access_token,itemId});
        productModels=normalizeProductModels(modelRaw).filter(x=>String(x.status||'').toUpperCase()!=='MODEL_UNAVAILABLE');
      }
    }catch(error){
      productModelError=String(error?.message||error);
      console.warn('[flash-sale] falha lendo variações do produto',error);
    }

    const listRaw=await getShopFlashSaleList({shopId:shop.shop_id,accessToken:shop.access_token,type:2,offset:0,limit:100});
    const sales=Array.isArray(listRaw?.response?.flash_sale_list)?listRaw.response.flash_sale_list:[];
    const candidates=sales
      .filter(x=>Number(x?.type)===2&&Number(x?.end_time||0)>now-60)
      .sort((a,b)=>Number(a?.start_time||0)-Number(b?.start_time||0))
      .slice(0,40);

    const activeOffers=[],scheduledOffers=[];
    for(const sale of candidates){
      try{
        const itemsRaw=await getShopFlashSaleItems({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId:sale.flash_sale_id,offset:0,limit:100});
        const offer=normalizeOfferItem(itemId,sale,itemsRaw);
        if(!offer)continue;
        const start=Number(offer.start_time||0),endTime=Number(offer.end_time||0);
        if(start<=now&&endTime>now)activeOffers.push(offer);
        else if(start>now)scheduledOffers.push(offer);
      }catch(error){
        console.warn('[flash-sale] falha lendo itens da oferta',sale?.flash_sale_id,error);
      }
    }

    const db=supabaseAdmin();
    let automation=null;
    try{
      const result=await db.from('flash_sale_automations').select('enabled,next_run_at,last_run_at,last_status,last_error,last_flash_sale_id,promo_price,stock,purchase_limit,lookback_days,use_best_time,min_gap_hours').eq('shop_id',shop.shop_id).eq('item_id',itemId).maybeSingle();
      if(!result.error)automation=result.data||null;
    }catch(error){
      console.warn('[flash-sale] falha lendo automação',error);
    }

    const allCoverage=[...activeOffers,...scheduledOffers].map(x=>Number(x?.end_time||0)).filter(Boolean);
    const coverageUntil=allCoverage.length?Math.max(...allCoverage):null;
    const nextScheduled=scheduledOffers[0]||null;
    return NextResponse.json({
      ok:true,slots,activeOffers,scheduledOffers,recommendation,recommendedSlots,automation,
      productHasVariations,productModels,productModelError,
      planning:{
        coverage_until:coverageUntil,
        next_scheduled_start:nextScheduled?.start_time||null,
        needs_attention:!scheduledOffers.length&&!automation?.enabled
      }
    });
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const itemId=int(body?.item_id),timeslotId=int(body?.timeslot_id),promo=num(body?.promo_price),stock=int(body?.stock),purchaseLimit=int(body?.purchase_limit??0);
  const timeslotIds=(Array.isArray(body?.timeslot_ids)?body.timeslot_ids:[timeslotId]).map(int).filter(Boolean);
  const submittedModels=Array.isArray(body?.models)?body.models:[];
  const notifyApp=body?.notify_app!==false,notifyEmail=body?.notify_email===true;
  if(!(itemId>0&&timeslotIds.length>0&&purchaseLimit>=0))return NextResponse.json({error:'Preencha produto, período/horário e limite de compra corretamente.'},{status:400});
  if(timeslotIds.length>45)return NextResponse.json({error:'Selecione no máximo 45 horários oficiais por criação.'},{status:400});
  try{
    const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
    const current=base?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
    if(!current)return NextResponse.json({error:'Anúncio não encontrado na loja conectada.'},{status:404});
    let flashItem;
    if(current?.has_model){
      const modelRaw=await getItemModelList({shopId:shop.shop_id,accessToken:shop.access_token,itemId});
      const currentModels=normalizeProductModels(modelRaw).filter(x=>String(x.status||'').toUpperCase()!=='MODEL_UNAVAILABLE');
      if(!currentModels.length)return NextResponse.json({error:'A Shopee informou que este anúncio possui variações, mas não retornou os modelos disponíveis.'},{status:409});
      const submitted=new Map(submittedModels.map(x=>[String(x?.model_id),x]));
      const missing=currentModels.filter(x=>!submitted.has(String(x.model_id)));
      if(missing.length)return NextResponse.json({error:'Defina o preço da Oferta Relâmpago para todas as variações antes de continuar.',missing_models:missing.map(x=>({model_id:x.model_id,name:x.name}))},{status:400});
      const models=currentModels.map(model=>{
        const input=submitted.get(String(model.model_id))||{};
        const modelPromo=num(input?.promo_price??input?.input_promo_price);
        const modelStock=int(input?.stock);
        if(!(modelPromo>0))throw new Error('Preço promocional inválido na variação "'+model.name+'".');
        if(!(modelStock>0))throw new Error('Estoque reservado inválido na variação "'+model.name+'".');
        if(model.available_stock!=null&&modelStock>model.available_stock)throw new Error('O estoque reservado de "'+model.name+'" excede o estoque disponível ('+model.available_stock+').');
        return{model_id:model.model_id,input_promo_price:modelPromo,stock:modelStock};
      });
      flashItem={item_id:itemId,purchase_limit:purchaseLimit,models};
    }else{
      if(!(promo>0&&stock>0))return NextResponse.json({error:'Preencha preço promocional e estoque corretamente.'},{status:400});
      flashItem={item_id:itemId,purchase_limit:purchaseLimit,item_input_promo_price:promo,item_stock:stock};
    }

    const official=await loadOfficialTimeSlots({
      shop,
      startTime:Math.floor(Date.now()/1000)+30,
      endTime:Math.floor(Date.now()/1000)+46*24*3600
    });
    const byId=new Map(official.map(slot=>[Number(slot?.timeslot_id),slot]));
    const invalid=timeslotIds.filter(id=>!byId.has(Number(id)));
    if(invalid.length)return NextResponse.json({error:'Um ou mais horários escolhidos não estão mais disponíveis na Shopee. Atualize os horários e tente novamente.',invalid_timeslot_ids:invalid},{status:409});

    const createdOffers=[],failures=[];
    for(const id of timeslotIds){
      try{
        const created=await createShopFlashSale({shopId:shop.shop_id,accessToken:shop.access_token,timeslotId:id});
        const flashSaleId=created?.response?.flash_sale_id;
        if(!flashSaleId)throw new Error('A Shopee não retornou o ID da Oferta Relâmpago.');
        const added=await addShopFlashSaleItems({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId,items:[flashItem]});
        const failed=added?.response?.failed_items||[];
        if(failed.length)throw new Error(failed.map(x=>x.err_msg||x.unqualified_conditions?.map?.(y=>y.unqualified_msg).filter(Boolean).join(', ')||'Produto não elegível').join(' · '));
        await updateShopFlashSale({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId,status:1});
        const slot=byId.get(Number(id))||{};
        createdOffers.push({timeslot_id:Number(id),flash_sale_id:Number(flashSaleId),start_time:num(slot?.start_time),end_time:num(slot?.end_time)});
      }catch(error){
        failures.push({timeslot_id:Number(id),error:String(error?.message||error)});
      }
    }
    if(!createdOffers.length)return NextResponse.json({error:failures.map(x=>x.error).join(' · ')||'Nenhuma Oferta Relâmpago foi criada.'},{status:409});

    const maxEnd=Math.max(...createdOffers.map(x=>Number(x.end_time)||0));
    let notificationTask=null;
    if((notifyApp||notifyEmail)&&maxEnd>0){
      const db=supabaseAdmin();
      const dueAt=new Date(maxEnd*1000).toISOString();
      const task={
        shop_id:shop.shop_id,item_id:itemId,task_type:'flash_sale',
        title:'Ofertas Relâmpago encerradas',
        description:'O período de Ofertas Relâmpago deste produto terminou. Revise os resultados e programe o próximo período.',
        priority:'medium',status:'open',due_at:dueAt,remind_at:dueAt,source:'flash-sale-expiry',
        action_url:`/extensao-shopee-intelligence?section=super-anuncio&item_id=${itemId}`,
        dedupe_key:`flash-expiry:${itemId}:${maxEnd}`,
        metadata:{notify_app:notifyApp,notify_email:notifyEmail,flash_sale_ids:createdOffers.map(x=>x.flash_sale_id),period_end:dueAt},
        updated_at:new Date().toISOString()
      };
      const saved=await db.from('gs_tasks').upsert(task,{onConflict:'shop_id,dedupe_key'}).select('*').single();
      if(!saved.error)notificationTask=saved.data;
    }

    return NextResponse.json({
      ok:failures.length===0,
      partial:failures.length>0,
      created_count:createdOffers.length,
      failed_count:failures.length,
      flash_sale_id:createdOffers[0]?.flash_sale_id||null,
      flash_sale_ids:createdOffers.map(x=>x.flash_sale_id),
      offers:createdOffers,failures,
      notification_task:notificationTask
    },{status:failures.length?207:200});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
