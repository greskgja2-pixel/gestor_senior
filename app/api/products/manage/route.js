import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';
import {getItemBaseInfo,getItemModelList,updateItemStock} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

const int=v=>Number.isSafeInteger(Number(v))?Number(v):null;
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const arr=v=>Array.isArray(v)?v:[];

function normalizeModels(raw){
  const response=raw?.response||{};
  const tiers=arr(response?.tier_variation);
  const models=arr(response?.model);
  const optionName=(tierIndex=[])=>arr(tierIndex).map((optionIndex,tierPos)=>{
    const tier=tiers[tierPos]||{},option=arr(tier?.option_list)[Number(optionIndex)]||{};
    return [tier?.name,option?.option||option?.name].filter(Boolean).join(': ');
  }).filter(Boolean).join(' · ');
  return models.map((m,index)=>{
    const p=arr(m?.price_info)[0]||{};
    const stock=num(m?.stock_info_v2?.summary_info?.total_available_stock??arr(m?.stock_info)[0]?.normal_stock??m?.normal_stock);
    return{
      model_id:int(m?.model_id),
      name:optionName(m?.tier_index)||m?.model_sku||('Variação '+(index+1)),
      sku:m?.model_sku||null,
      price:num(p?.current_price??p?.original_price),
      stock
    };
  }).filter(x=>x.model_id!=null);
}

export async function GET(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const itemId=int(new URL(request.url).searchParams.get('item_id'));
  if(!(itemId>0))return NextResponse.json({error:'item_id inválido.'},{status:400});
  try{
    const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
    const item=base?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
    if(!item)return NextResponse.json({error:'Produto não encontrado na loja conectada.'},{status:404});
    const db=supabaseAdmin();
    const {data:costRows}=await db.from('product_costs').select('item_id,model_id,cost,packaging_cost').eq('shop_id',shop.shop_id).eq('item_id',itemId);
    const costs=new Map(arr(costRows).map(x=>[String(x.model_id),x]));
    if(item?.has_model){
      const raw=await getItemModelList({shopId:shop.shop_id,accessToken:shop.access_token,itemId});
      const models=normalizeModels(raw).map(m=>({...m,cost:num(costs.get(String(m.model_id))?.cost),packaging_cost:num(costs.get(String(m.model_id))?.packaging_cost)??0}));
      return NextResponse.json({ok:true,item_id:itemId,has_model:true,models});
    }
    const baseCost=costs.get('0')||{};
    const stock=num(item?.stock_info_v2?.summary_info?.total_available_stock??item?.stock);
    const price=num(item?.price_info?.[0]?.current_price??item?.price_info?.[0]?.original_price);
    return NextResponse.json({ok:true,item_id:itemId,has_model:false,models:[{model_id:0,name:'Produto sem variação',price,stock,cost:num(baseCost?.cost),packaging_cost:num(baseCost?.packaging_cost)??0}]});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}

async function saveCosts(db,shopId,itemId,costs){
  for(const row of costs){
    const modelId=int(row?.model_id??row?.modelId??0)??0;
    const cost=num(row?.cost);
    if(cost==null||cost<0)throw new Error('Custo inválido.');
    const existing=await db.from('product_costs').select('item_id,model_id').eq('shop_id',shopId).eq('item_id',itemId).eq('model_id',modelId).maybeSingle();
    if(existing.error)throw new Error(existing.error.message);
    if(existing.data){
      const updated=await db.from('product_costs').update({cost,updated_at:new Date().toISOString()}).eq('shop_id',shopId).eq('item_id',itemId).eq('model_id',modelId);
      if(updated.error)throw new Error(updated.error.message);
    }else{
      const inserted=await db.from('product_costs').insert({shop_id:shopId,item_id:itemId,model_id:modelId,cost,packaging_cost:0,updated_at:new Date().toISOString()});
      if(inserted.error)throw new Error(inserted.error.message);
    }
  }
}

export async function PATCH(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const itemId=int(body?.item_id??body?.itemId);
  if(!(itemId>0))return NextResponse.json({error:'item_id inválido.'},{status:400});
  const costs=arr(body?.costs),stocks=arr(body?.stocks);
  if(!costs.length&&!stocks.length)return NextResponse.json({error:'Nenhuma alteração enviada.'},{status:400});
  try{
    if(costs.length)await saveCosts(supabaseAdmin(),shop.shop_id,itemId,costs);
    if(stocks.length){
      const safeStocks=stocks.map(row=>({model_id:int(row?.model_id??row?.modelId??0)??0,stock:num(row?.stock)}));
      if(safeStocks.some(x=>x.stock==null||x.stock<0))return NextResponse.json({error:'Estoque inválido.'},{status:400});
      await updateItemStock({shopId:shop.shop_id,accessToken:shop.access_token,itemId,stocks:safeStocks});
    }
    return NextResponse.json({ok:true,item_id:itemId,costs_saved:costs.length,stocks_saved:stocks.length});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}
