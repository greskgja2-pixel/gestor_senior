import { NextResponse } from 'next/server';
import { getActiveShop } from '../../../../lib/shop';
import { supabaseAdmin } from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';

const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const safeObject=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const safeArray=v=>Array.isArray(v)?v:[];
const now=()=>new Date().toISOString();

function calcFinance({price,cost,finance={},cpa=0}){
  const sale=num(price),productCost=num(cost);
  if(!(sale>0)||productCost==null||productCost<0)return null;
  const commissionRate=num(finance.commissionRate)??0.20;
  const fixedFee=num(finance.fixedFee)??4;
  const packagingCost=num(finance.packagingCost)??0;
  const taxRate=num(finance.taxRate)??0;
  const otherCost=num(finance.otherCost)??0;
  const adsCostPerSale=Math.max(0,num(cpa)??0);
  const commission=sale*commissionRate;
  const tax=sale*taxRate;
  const profit=sale-commission-tax-fixedFee-packagingCost-otherCost-adsCostPerSale-productCost;
  const marginPct=(profit/sale)*100;
  const contributionBeforeAds=sale-productCost-commission-tax-fixedFee-packagingCost-otherCost;
  const contributionMargin=contributionBeforeAds/sale;
  const breakEvenRoas=contributionMargin>0?1/contributionMargin:null;
  return {sale,productCost,commissionRate,commission,fixedFee,packagingCost,taxRate,tax,otherCost,adsCostPerSale,profit,marginPct,breakEvenRoas};
}

function setOverride(metrics,field,value){
  metrics[field]=value;
  metrics.manualOverrides={...safeObject(metrics.manualOverrides),[field]:{value,updatedAt:now(),source:'user'}};
}

function recalcMargins({product,finance,metrics,ads}){
  const cpa=num(metrics.cpa??ads?.manual?.cpa??ads?.costPerOrder)??0;
  const rawVars=safeArray(product.variations).length?safeArray(product.variations):safeArray(product.models);
  const costs=safeArray(product.variationCosts);
  if(rawVars.length){
    const updated=rawVars.map((v,i)=>{
      const id=String(v?.modelId??v?.model_id??v?.id??i);
      const costRow=costs.find(c=>String(c?.modelId??c?.model_id)===id);
      const price=num(v?.price??v?.currentPrice??v?.current_price);
      const cost=num(v?.cost??costRow?.cost);
      const calc=calcFinance({price,cost,finance,cpa});
      return {...v,cost,profit:calc?.profit??null,marginPct:calc?.marginPct??null};
    });
    product.variations=updated;
    product.variationCount=updated.length;
    const validPrices=updated.map(v=>num(v.price)).filter(v=>v!=null&&v>0);
    product.price=validPrices.length?Math.min(...validPrices):null;
    const complete=updated.length>0&&updated.every(v=>num(v.price)>0&&num(v.cost)!=null&&num(v.marginPct)!=null);
    finance.marginCalculationMode='variation-range';
    if(complete){
      const margins=updated.map(v=>num(v.marginPct)),profits=updated.map(v=>num(v.profit));
      finance.marginPct=Math.min(...margins);finance.profit=Math.min(...profits);
      finance.marginMinPct=Math.min(...margins);finance.marginMaxPct=Math.max(...margins);
      finance.profitMin=Math.min(...profits);finance.profitMax=Math.max(...profits);finance.marginStatus='ok';
    }else{
      finance.marginPct=null;finance.profit=null;finance.marginMinPct=null;finance.marginMaxPct=null;finance.profitMin=null;finance.profitMax=null;finance.marginStatus='incomplete';
    }
  }else{
    const price=num(metrics.price??product.price),calc=calcFinance({price,cost:finance.productCost,finance,cpa});
    if(calc){Object.assign(finance,{profit:calc.profit,marginPct:calc.marginPct,breakEvenRoas:calc.breakEvenRoas,commissionRate:calc.commissionRate,fixedFee:calc.fixedFee,packagingCost:calc.packagingCost,taxRate:calc.taxRate,otherCost:calc.otherCost,adsCostPerSale:calc.adsCostPerSale,marginCalculationMode:'single',marginStatus:'ok'});}
    else{finance.profit=null;finance.marginPct=null;finance.marginStatus:'incomplete';}
  }
  metrics.price=product.price??metrics.price??null;
  metrics.marginPct=finance.marginPct??null;
  metrics.marginR=finance.profit??null;
}

export async function PATCH(request){
  let body;try{body=await request.json();}catch{return NextResponse.json({error:'Corpo JSON inválido.'},{status:400});}
  const reportId=String(body?.report_id||'').trim();
  if(!reportId)return NextResponse.json({error:'report_id obrigatório.'},{status:400});
  const shop=await getActiveShop();
  if(!shop)return NextResponse.json({error:'Nenhuma loja autorizada.'},{status:400});
  const db=supabaseAdmin();
  try{
    const {data:report,error}=await db.from('extension_analysis_reports').select('id,item_id,product_snapshot,finance_snapshot,metrics,ads_snapshot').eq('shop_id',shop.shop_id).eq('id',reportId).maybeSingle();
    if(error)throw new Error(error.message);
    if(!report)return NextResponse.json({error:'Relatório não encontrado.'},{status:404});

    const product={...safeObject(report.product_snapshot)};
    const finance={...safeObject(report.finance_snapshot)};
    const metrics={...safeObject(report.metrics)};
    const ads={...safeObject(report.ads_snapshot),manual:{...safeObject(report.ads_snapshot?.manual)}};
    const rawVars=safeArray(product.variations).length?safeArray(product.variations):safeArray(product.models);
    const costs=safeArray(product.variationCosts);
    let needsMarginRecalc=false;

    if(Array.isArray(body?.variation_prices)||body?.price!==undefined){
      const priceRows=safeArray(body?.variation_prices);
      const priceMap=new Map(priceRows.map(x=>[String(x?.model_id??x?.modelId),num(x?.price)]));
      if(rawVars.length){
        product.variations=rawVars.map((v,i)=>{
          const id=String(v?.modelId??v?.model_id??v?.id??i),has=priceMap.has(id),value=has?priceMap.get(id):num(v?.price??v?.currentPrice??v?.current_price);
          return {...v,price:value,manualPrice:has||Boolean(v?.manualPrice),manualPriceUpdatedAt:has?now():v?.manualPriceUpdatedAt};
        });
        product.variationCount=product.variations.length;
        product.manualPrice=priceRows.length>0||Boolean(product.manualPrice);if(priceRows.length)product.manualPriceUpdatedAt=now();
      }else{
        const price=num(body?.price);if(!(price>0))return NextResponse.json({error:'Informe um preço maior que zero.'},{status:400});
        product.price=price;product.manualPrice=true;product.manualPriceUpdatedAt=now();setOverride(metrics,'price',price);
      }
      needsMarginRecalc=true;
    }

    if(Array.isArray(body?.variation_costs)||body?.product_cost!==undefined){
      const rows=safeArray(body?.variation_costs),map=new Map(rows.map(x=>[String(x?.model_id??x?.modelId),num(x?.cost)]));
      if(rawVars.length){
        const merged=new Map(costs.map(x=>[String(x?.modelId??x?.model_id),{...x}]));
        for(const [id,cost] of map){if(cost==null||cost<0)return NextResponse.json({error:'Custo inválido.'},{status:400});merged.set(id,{modelId:Number(id),cost,manualCost:true,manualCostUpdatedAt:now()});}
        product.variationCosts=[...merged.values()];
        product.variations=(product.variations?.length?product.variations:rawVars).map((v,i)=>{const id=String(v?.modelId??v?.model_id??v?.id??i),cost=map.has(id)?map.get(id):num(v?.cost??merged.get(id)?.cost);return{...v,cost,manualCost:map.has(id)||Boolean(v?.manualCost),manualCostUpdatedAt:map.has(id)?now():v?.manualCostUpdatedAt};});
      }else{
        const cost=num(body?.product_cost);if(cost==null||cost<0)return NextResponse.json({error:'Informe um custo válido.'},{status:400});
        finance.productCost=cost;finance.manualProductCost=true;finance.manualProductCostUpdatedAt=now();
      }
      needsMarginRecalc=true;
    }

    if(body?.field){
      const field=String(body.field);
      const allowed=new Set(['roas','targetRoas','gmv','spend','cpa','ctr','sales']);
      if(!allowed.has(field))return NextResponse.json({error:'Campo não permitido para edição manual.'},{status:400});
      const value=num(body?.value);if(value==null||value<0)return NextResponse.json({error:'Informe um valor numérico válido.'},{status:400});
      setOverride(metrics,field,value);ads.manual[field]=value;ads.manualOverrides={...safeObject(ads.manualOverrides),[field]:{value,updatedAt:now(),source:'user'}};
      if(field==='cpa')needsMarginRecalc=true;
    }

    if(needsMarginRecalc)recalcMargins({product,finance,metrics,ads});
    const {error:updateError}=await db.from('extension_analysis_reports').update({product_snapshot:product,finance_snapshot:finance,metrics,ads_snapshot:ads}).eq('shop_id',shop.shop_id).eq('id',reportId);
    if(updateError)throw new Error(updateError.message);
    return NextResponse.json({ok:true,report_id:reportId,product_snapshot:product,finance_snapshot:finance,metrics,ads_snapshot:ads});
  }catch(error){return NextResponse.json({error:String(error?.message||error)},{status:500});}
}
