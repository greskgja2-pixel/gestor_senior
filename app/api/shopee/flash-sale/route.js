import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getItemBaseInfo,getItemModelList,getFlashSaleTimeSlots,getShopFlashSaleList,getShopFlashSaleItems,createShopFlashSale,addShopFlashSaleItems,updateShopFlashSale} from '../../../../lib/shopee';
import {supabaseAdmin} from '../../../../lib/supabase';
import {analyzeItemSalesHistory,rankFlashSaleSlots,formatHourRange} from '../../../../lib/flash-sale-intelligence';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

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
  const now=Math.floor(Date.now()/1000)+60;
  const end=now+7*24*3600;
  const url=new URL(request.url);
  const itemId=int(url.searchParams.get('item_id'));
  const recommendationDays=[7,30,60,90].includes(Number(url.searchParams.get('days')))?Number(url.searchParams.get('days')):30;
  try{
    const raw=await getFlashSaleTimeSlots({shopId:shop.shop_id,accessToken:shop.access_token,startTime:now,endTime:end});
    const slots=Array.isArray(raw?.response)?raw.response:[];
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
  const submittedModels=Array.isArray(body?.models)?body.models:[];
  if(!(itemId>0&&timeslotId>0&&purchaseLimit>=0))return NextResponse.json({error:'Preencha produto, horário e limite de compra corretamente.'},{status:400});
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

    const created=await createShopFlashSale({shopId:shop.shop_id,accessToken:shop.access_token,timeslotId});
    const flashSaleId=created?.response?.flash_sale_id;
    if(!flashSaleId)throw new Error('A Shopee não retornou o ID da Oferta Relâmpago.');

    const added=await addShopFlashSaleItems({
      shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId,
      items:[flashItem]
    });
    const failed=added?.response?.failed_items||[];
    if(failed.length){
      return NextResponse.json({error:failed.map(x=>x.err_msg||x.unqualified_conditions?.map?.(y=>y.unqualified_msg).filter(Boolean).join(', ')||'Produto não elegível').join(' · '),flash_sale_id:flashSaleId},{status:409});
    }
    await updateShopFlashSale({shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId,status:1});
    return NextResponse.json({ok:true,flash_sale_id:flashSaleId});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
