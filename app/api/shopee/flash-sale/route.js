import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {getItemBaseInfo,getFlashSaleTimeSlots,createShopFlashSale,addShopFlashSaleItems,updateShopFlashSale} from '../../../../lib/shopee';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;

const int=v=>Number.isSafeInteger(Number(v))?Number(v):null;
const num=v=>Number.isFinite(Number(v))?Number(v):null;

export async function GET(){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const now=Math.floor(Date.now()/1000)+60;
  const end=now+7*24*3600;
  try{
    const raw=await getFlashSaleTimeSlots({shopId:shop.shop_id,accessToken:shop.access_token,startTime:now,endTime:end});
    const slots=Array.isArray(raw?.response)?raw.response:[];
    return NextResponse.json({ok:true,slots});
  }catch(error){
    return NextResponse.json({error:String(error?.message||error)},{status:502});
  }
}

export async function POST(request){
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  let body={};try{body=await request.json()}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const itemId=int(body?.item_id),timeslotId=int(body?.timeslot_id),promo=num(body?.promo_price),stock=int(body?.stock),purchaseLimit=int(body?.purchase_limit??0);
  if(!(itemId>0&&timeslotId>0&&promo>0&&stock>0&&purchaseLimit>=0))return NextResponse.json({error:'Preencha horário, preço promocional, estoque e limite de compra corretamente.'},{status:400});
  try{
    const base=await getItemBaseInfo({shopId:shop.shop_id,accessToken:shop.access_token,itemIdList:[itemId]});
    const current=base?.response?.item_list?.find(x=>Number(x?.item_id)===itemId);
    if(!current)return NextResponse.json({error:'Anúncio não encontrado na loja conectada.'},{status:404});
    if(current?.has_model)return NextResponse.json({error:'Este anúncio possui variações. Para segurança, a Oferta Relâmpago precisa ser configurada por variação antes do envio.'},{status:409});

    const created=await createShopFlashSale({shopId:shop.shop_id,accessToken:shop.access_token,timeslotId});
    const flashSaleId=created?.response?.flash_sale_id;
    if(!flashSaleId)throw new Error('A Shopee não retornou o ID da Oferta Relâmpago.');

    const added=await addShopFlashSaleItems({
      shopId:shop.shop_id,accessToken:shop.access_token,flashSaleId,
      items:[{item_id:itemId,purchase_limit:purchaseLimit,item_input_promo_price:promo,item_stock:stock}]
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
