const HOUR_MS=3600000;
const DAY_MS=86400000;

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;

function localParts(epochSeconds){
  const d=new Date(Number(epochSeconds)*1000);
  if(Number.isNaN(d.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(d);
  const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  const dayIndex={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[map.weekday];
  return{hour:Number(map.hour),weekday:dayIndex,date:d};
}

export async function analyzeItemSalesHistory(db,{shopId,itemId,days=30}={}){
  const safeDays=[7,30,60,90].includes(Number(days))?Number(days):30;
  const cutoff=Math.floor((Date.now()-safeDays*DAY_MS)/1000);
  const {data,error}=await db.from('orders_cache').select('data').eq('shop_id',shopId).limit(5000);
  if(error)throw new Error(error.message);
  const byHour=Array(24).fill(0),byDay=Array(7).fill(0);
  let orders=0,units=0,revenue=0;
  for(const row of data||[]){
    const order=row?.data||{};
    const created=num(order?.create_time);
    if(created==null||created<cutoff)continue;
    const status=String(order?.order_status||'').toUpperCase();
    if(['CANCELLED','IN_CANCEL','UNPAID'].includes(status))continue;
    const matches=(Array.isArray(order?.item_list)?order.item_list:[]).filter(x=>Number(x?.item_id)===Number(itemId));
    if(!matches.length)continue;
    const parts=localParts(created);if(!parts)continue;
    let orderUnits=0,orderRevenue=0;
    for(const item of matches){
      const q=Math.max(1,Number(item?.model_quantity_purchased||item?.active_qty||1)||1);
      const price=Number(item?.model_discounted_price||0)||0;
      orderUnits+=q;orderRevenue+=q*price;
    }
    orders+=1;units+=orderUnits;revenue+=orderRevenue;
    byHour[parts.hour]+=orderUnits;
    byDay[parts.weekday]+=orderUnits;
  }
  const windowScores=Array.from({length:24},(_,hour)=>{
    const score=byHour[hour]+byHour[(hour+1)%24]+byHour[(hour+2)%24];
    return{hour,score};
  }).sort((a,b)=>b.score-a.score||a.hour-b.hour);
  const best=windowScores[0]||{hour:null,score:0};
  const dayScores=byDay.map((score,weekday)=>({weekday,score})).sort((a,b)=>b.score-a.score||a.weekday-b.weekday);
  const confidence=units>=20?'high':units>=8?'medium':units>=3?'low':'insufficient';
  const topHours=byHour.map((score,hour)=>({hour,score})).sort((a,b)=>b.score-a.score||a.hour-b.hour).slice(0,5);
  return{
    source:'orders_history',
    days:safeDays,orders,units,revenue,
    byHour,byWeekday:byDay,
    bestHour:best.score>0?best.hour:null,
    bestWindow:best.score>0?{startHour:best.hour,endHour:(best.hour+3)%24,units:best.score}:null,
    bestWeekday:dayScores[0]?.score>0?dayScores[0].weekday:null,
    topHours,confidence
  };
}

function intervalContainsHour(startSec,endSec,targetHour){
  const duration=(Number(endSec)-Number(startSec))*1000;
  if(!Number.isFinite(duration)||duration<=0)return false;
  if(duration>=DAY_MS)return true;
  const start=new Date(Number(startSec)*1000);
  const end=new Date(Number(endSec)*1000);
  for(let t=start.getTime();t<=end.getTime();t+=HOUR_MS){
    const p=localParts(Math.floor(t/1000));
    if(p?.hour===targetHour)return true;
  }
  return false;
}

export function rankFlashSaleSlots(slots,insight){
  const now=Date.now()/1000;
  return (Array.isArray(slots)?slots:[]).filter(x=>Number(x?.start_time)>now).map(slot=>{
    const p=localParts(Number(slot.start_time));
    let score=0;
    if(insight?.bestWeekday!=null&&p?.weekday===Number(insight.bestWeekday))score+=40;
    if(insight?.bestHour!=null&&intervalContainsHour(slot.start_time,slot.end_time,Number(insight.bestHour)))score+=50;
    score-=Math.max(0,(Number(slot.start_time)-now)/86400)*0.2;
    return{...slot,recommendationScore:score};
  }).sort((a,b)=>b.recommendationScore-a.recommendationScore||Number(a.start_time)-Number(b.start_time));
}

export function formatHourRange(window){
  if(!window)return null;
  const hh=n=>String((n+24)%24).padStart(2,'0')+':00';
  return `${hh(window.startHour)}–${hh(window.endHour)}`;
}
