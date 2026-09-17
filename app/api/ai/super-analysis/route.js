import {NextResponse} from 'next/server';
import {getActiveShop} from '../../../../lib/shop';
import {supabaseAdmin} from '../../../../lib/supabase';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;

const safeArray=v=>Array.isArray(v)?v:[];
const safeObject=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const cleanJson=text=>String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');

async function imagePart(url){
  try{
    if(!/^https?:\/\//i.test(String(url||'')))return null;
    const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(9000)});
    if(!r.ok)return null;
    const type=(r.headers.get('content-type')||'image/jpeg').split(';')[0];
    if(!type.startsWith('image/'))return null;
    const buf=Buffer.from(await r.arrayBuffer());
    if(!buf.length||buf.length>4*1024*1024)return null;
    return{inlineData:{mimeType:type,data:buf.toString('base64')}};
  }catch{return null;}
}

function compactReport(row){
  const p=safeObject(row.product_snapshot),a=safeObject(row.ads_snapshot),f=safeObject(row.finance_snapshot),m=safeObject(row.metrics);
  return{
    itemId:row.item_id,objective:row.objective,situation:row.situation,bottleneck:row.bottleneck,score:row.score,
    product:{title:p.title||p.item_name,description:p.description,category:p.category,categoryId:p.categoryId??p.category_id,price:m.price??p.price,rating:p.rating,reviewCount:p.reviewCount,sold:m.sold??p.sold,imageCount:p.imageCount,hasVideo:p.hasVideo,attributesCount:p.attributesCount,variationCount:p.variationCount,variations:p.variations||p.models||[],variationCosts:p.variationCosts||[]},
    ads:{roas:m.roas??a.manual?.roas??a.roas,targetRoas:m.targetRoas??a.manual?.targetRoas??a.targetRoas,spend:m.spend??a.manual?.spend??a.spend,gmv:m.gmv??a.gmv,ctr:m.ctr??a.ctr},
    finance:{productCost:f.productCost,profit:f.profit,marginPct:f.marginPct,breakEvenRoas:f.breakEvenRoas},
    competitors:safeArray(row.competitors).slice(0,3).map(c=>({title:c.title,price:c.price,sold:c.sold,rating:c.rating,reviewCount:c.reviewCount,description:c.description,imageCount:c.imageCount,hasVideo:c.hasVideo,variationCount:c.variationCount,attributesCount:c.attributesCount,offerSignals:c.offerSignals,offerComposition:c.offerComposition,variationDetails:c.variationDetails}))
  };
}

function promptFor(row){
  const data=compactReport(row);
  return `Você é o motor de análise do Gestor Sênior para anúncios da Shopee Brasil. Analise o anúncio do usuário e EXATAMENTE os 3 concorrentes selecionados.\n\nREGRAS IMPORTANTES:\n- Seja conservador: não invente dados nem atribua causalidade sem evidência.\n- Compare título, descrição, imagens, vídeo, preço/oferta, atributos, variações, reputação e concorrentes.\n- Para título e descrição, considere SEO da busca Shopee, clareza, intenção de compra e AIDA quando fizer sentido.\n- Dê peso aos padrões dos concorrentes com maior tração, mas diferencie correlação de causa.\n- Se o anúncio do usuário já estiver melhor em um critério, ELOGIE e recomende preservar. Se mesmo assim o concorrente vende mais, indique outros fatores concretos a investigar (preço, avaliações, oferta, frete, Ads, histórico etc.).\n- Para imagens, analise VISUALMENTE as imagens anexadas: legibilidade em miniatura, hierarquia, clareza do produto, excesso de texto, benefícios, prova visual, sequência da galeria, consistência e diferenciação. Compare com as imagens anexadas dos concorrentes.\n- Categoria: NÃO invente categoria. Retorne apenas termos de busca em category.searchTerms; a interface cruzará esses termos com a árvore OFICIAL da Shopee.\n- Nunca recomende copiar afirmações, brindes, atributos ou características que o produto não possui.\n- O resultado 'depois' é uma estimativa da qualidade do conteúdo sugerido, não promessa de vendas.\n\nRetorne SOMENTE JSON válido neste formato:\n{\n  "afterScore": 0-100,\n  "afterScores":{"title":0-100,"description":0-100,"images":0-100,"video":0-100,"category":0-100,"price":0-100,"variations":0-100},\n  "title":{"suggestion":"texto completo","reason":"breve explicação objetiva","seo":"...","aida":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "description":{"suggestion":"descrição completa pronta para revisão","reason":"...","seo":"...","aida":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "images":{"suggestion":"plano completo de mudanças ou elogio/preservação","competitorInsight":"comparação visual objetiva","reason":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "video":{"suggestion":"...","reason":"...","competitors":"...","conversion":"..."},\n  "category":{"searchTerms":["termo1","termo2"],"reason":"..."},\n  "price":{"suggestion":"...","reason":"...","competitors":"...","conversion":"..."},\n  "variations":{"suggestion":"...","reason":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "strengths":["pontos fortes do usuário"],\n  "priorities":[{"area":"Título|Descrição|Imagens|Vídeo|Categoria|Preço|Variações","priority":"alta|media|baixa","why":"..."}]\n}\n\nDADOS ESTRUTURADOS:\n${JSON.stringify(data)}`;
}

export async function POST(request){
  let body={};try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const reportId=String(body?.report_id||'').trim();if(!reportId)return NextResponse.json({error:'report_id obrigatório.'},{status:400});
  const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(!key)return NextResponse.json({error:'A chave GEMINI_API_KEY ainda não está configurada no servidor.'},{status:503});
  const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const db=supabaseAdmin();
  const {data:row,error}=await db.from('extension_analysis_reports').select('*').eq('shop_id',shop.shop_id).eq('id',reportId).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});if(!row)return NextResponse.json({error:'Relatório não encontrado.'},{status:404});

  const p=safeObject(row.product_snapshot),comps=safeArray(row.competitors).slice(0,3);
  const ownImages=safeArray(p.imageUrls||p.image?.image_url_list).slice(0,3);
  const competitorImages=comps.flatMap(c=>safeArray(c.imageUrls).slice(0,2));
  const imageUrls=[...ownImages,...competitorImages].slice(0,9);
  const parts=[{text:promptFor(row)}];
  for(const url of imageUrls){const part=await imagePart(url);if(part)parts.push(part);}

  const model=process.env.GEMINI_MODEL||'gemini-3.6-flash';
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json'}}),signal:AbortSignal.timeout(55000)});}catch(e){return NextResponse.json({error:`Falha chamando Gemini: ${String(e?.message||e)}`},{status:502})}
  let raw={};try{raw=await response.json();}catch{}
  if(!response.ok)return NextResponse.json({error:raw?.error?.message||`Gemini HTTP ${response.status}`},{status:502});
  const text=safeArray(raw?.candidates?.[0]?.content?.parts).map(x=>x?.text||'').join('').trim();
  let analysis;try{analysis=JSON.parse(cleanJson(text));}catch{return NextResponse.json({error:'O Gemini respondeu, mas o JSON da análise não pôde ser interpretado.',raw:text.slice(0,1000)},{status:502})}

  const newReport={...safeObject(row.report),ai_analysis:analysis,ai_model:model,ai_analyzed_at:new Date().toISOString(),visual_images_sent:parts.length-1};
  const newSuggestions={...safeObject(row.suggestions),title:analysis?.title?.suggestion||row.suggestions?.title||null,description:analysis?.description?.suggestion||row.suggestions?.description||null,ai:analysis};
  const {error:updateError}=await db.from('extension_analysis_reports').update({report:newReport,suggestions:newSuggestions}).eq('shop_id',shop.shop_id).eq('id',reportId);
  if(updateError)return NextResponse.json({error:updateError.message},{status:500});
  return NextResponse.json({ok:true,analysis,model,visualImages:parts.length-1});
}
