import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../../lib/shop';
import {supabaseAdmin} from '../../../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const int=v=>Number.isSafeInteger(Number(v))?Number(v):null;
const num=v=>Number.isFinite(Number(v))?Number(v):null;

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const itemId=int(new URL(request.url).searchParams.get('item_id'));
  if(!itemId)return NextResponse.json({error:'item_id inválido.'},{status:400});
  const db=supabaseAdmin();
  const {data,error}=await db.from('flash_sale_automations').select('*').eq('shop_id',shop.shop_id).eq('item_id',itemId).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,automation:data||null});
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const itemId=int(body?.item_id),promo=num(body?.promo_price),stock=int(body?.stock),purchaseLimit=int(body?.purchase_limit??1);
  const lookbackDays=[7,30,60,90].includes(Number(body?.lookback_days))?Number(body.lookback_days):30;
  const minGapHours=Math.min(336,Math.max(1,int(body?.min_gap_hours)||20));
  const enabled=body?.enabled===true;
  if(!itemId||!(promo>0)||!(stock>0)||purchaseLimit==null||purchaseLimit<0){
    return NextResponse.json({error:'Informe produto, preço promocional, estoque e limite de compra válidos.'},{status:400});
  }
  const db=supabaseAdmin();
  const {data:product,error:productError}=await db.from('products_cache').select('item_id').eq('shop_id',shop.shop_id).eq('item_id',itemId).maybeSingle();
  if(productError)return NextResponse.json({error:productError.message},{status:500});
  if(!product)return NextResponse.json({error:'Produto não pertence à loja conectada.'},{status:403});

  const row={
    shop_id:shop.shop_id,item_id:itemId,enabled,
    promo_price:promo,stock,purchase_limit:purchaseLimit,
    lookback_days:lookbackDays,use_best_time:body?.use_best_time!==false,
    min_gap_hours:minGapHours,
    next_run_at:enabled?new Date().toISOString():null,
    settings:{create_when_no_offer:true,source:'super-analysis-price-card'},
    updated_at:new Date().toISOString()
  };
  const {data,error}=await db.from('flash_sale_automations').upsert(row,{onConflict:'shop_id,item_id'}).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,automation:data});
}
