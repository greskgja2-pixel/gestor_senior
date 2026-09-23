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
    ads:{roas:m.roas??a.manual?.roas??a.roas,targetRoas:m.targetRoas??a.manual?.targetRoas??a.targetRoas,spend:m.spend??a.manual?.spend??a.spend,gmv:m.gmv??a.manual?.gmv??a.gmv,costPerSale:m.costPerSale??a.manual?.costPerSale??a.costPerSale??a.cpa,ctr:m.ctr??a.ctr},
    finance:{productCost:f.productCost,profit:f.profit,marginPct:f.marginPct,breakEvenRoas:f.breakEvenRoas},
    competitors:safeArray(row.competitors).slice(0,3).map((c,i)=>({competitor:i+1,title:c.title,price:c.price,sold:c.sold,rating:c.rating,reviewCount:c.reviewCount,description:c.description,imageCount:c.imageCount,hasVideo:c.hasVideo,variationCount:c.variationCount,attributesCount:c.attributesCount,offerSignals:c.offerSignals,offerComposition:c.offerComposition,variationDetails:c.variationDetails}))
  };
}

function promptFor(row){
  const data=compactReport(row),competitorCount=data.competitors.length;
  return `Você é o motor de análise do Gestor Sênior para anúncios da Shopee Brasil. Analise o anúncio do usuário e os ${competitorCount} concorrente(s) selecionado(s), podendo haver de 1 a 3. Use somente os concorrentes realmente fornecidos.\n\nREGRAS IMPORTANTES:\n- Seja conservador: não invente dados nem atribua causalidade sem evidência.\n- Compare título, descrição, imagens, vídeo, preço/oferta, atributos, variações, reputação e concorrentes.\n- Para título e descrição, considere SEO da busca Shopee, clareza, intenção de compra e AIDA quando fizer sentido.\n- Dê peso aos padrões dos concorrentes com maior tração, mas diferencie correlação de causa.\n- Se o anúncio do usuário já estiver melhor em um critério, ELOGIE, registre isso em strengths e recomende preservar. Não crie mudança só para preencher espaço.\n- Se o usuário estiver visualmente melhor mas um concorrente vender mais, investigue e mencione outros fatores concretos: preço, avaliações, composição da oferta, frete, Ads, reputação, histórico, variações ou estoque. Não afirme causa sem evidência.\n- Para imagens, analise VISUALMENTE as imagens anexadas ou, quando houver fallback de provedor, use as observações visuais fornecidas. Avalie legibilidade em miniatura, hierarquia, clareza do produto, excesso de texto, benefícios, prova visual, sequência da galeria, consistência e diferenciação.\n- Se houver somente 1 ou 2 concorrentes, faça a comparação com essa amostra menor e deixe claro quando uma conclusão estiver limitada pela quantidade de concorrentes.\n- Categoria: NÃO invente categoria. Retorne apenas termos de busca em category.searchTerms; a interface cruzará esses termos com a árvore OFICIAL da Shopee.\n- Nunca recomende copiar afirmações, brindes, atributos ou características que o produto não possui.\n- Preço e ROAS são recomendações para avaliação; não determine alteração automática.\n- O resultado 'depois' é uma estimativa da qualidade do conteúdo sugerido, não promessa de vendas.\n- NUNCA proponha uma alteração que reduza a nota estimada daquela área. Se a versão atual for melhor ou igual, preserve o conteúdo atual e deixe a sugestão vazia.\n- Explique de forma curta POR QUE cada mudança é sugerida, incluindo SEO/AIDA/concorrentes/clareza/conversão quando aplicável.\n\nRetorne SOMENTE JSON válido neste formato:\n{\n  "afterScore": 0-100,\n  "afterScores":{"title":0-100,"description":0-100,"images":0-100,"video":0-100,"category":0-100,"price":0-100,"variations":0-100},\n  "title":{"suggestion":"texto completo","reason":"breve explicação objetiva","seo":"...","aida":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "description":{"suggestion":"descrição completa pronta para revisão","reason":"...","seo":"...","aida":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "images":{"suggestion":"plano completo de mudanças ou elogio/preservação","competitorInsight":"comparação visual objetiva","reason":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "video":{"suggestion":"...","reason":"...","competitors":"...","conversion":"..."},\n  "category":{"searchTerms":["termo1","termo2"],"reason":"..."},\n  "price":{"suggestion":"...","reason":"...","competitors":"...","conversion":"..."},\n  "variations":{"suggestion":"...","reason":"...","competitors":"...","clarity":"...","conversion":"..."},\n  "strengths":["pontos fortes do usuário que devem ser preservados"],\n  "priorities":[{"area":"Título|Descrição|Imagens|Vídeo|Categoria|Preço|Variações","priority":"alta|media|baixa","why":"..."}]\n}\n\nDADOS ESTRUTURADOS:\n${JSON.stringify(data)}`;
}

function normalizeName(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function beforeScores(row){
  const dims=safeArray(safeObject(row.report).dimensions);
  const map={title:['titulo'],description:['descricao'],images:['imagem'],video:['video'],category:['categoria'],price:['preco','concorr'],variations:['atributo','varia']};
  return Object.fromEntries(Object.entries(map).map(([key,terms])=>{
    const d=dims.find(x=>terms.some(t=>normalizeName(x?.name).includes(t)));
    const score=Number(d?.score),max=Number(d?.maxScore)||100;
    return [key,Number.isFinite(score)?Math.round(Math.max(0,Math.min(100,score/max*100))):null];
  }));
}
function normalizedAnalysis(row,analysis){
  const out={...safeObject(analysis),afterScores:{...safeObject(analysis?.afterScores)}};
  const before=beforeScores(row);
  for(const key of Object.keys(before)){
    const b=before[key],a=Number(out.afterScores?.[key]);
    if(b==null||!Number.isFinite(a)||a>=b)continue;
    out.afterScores[key]=b;
    if(out[key]&&typeof out[key]==='object'){
      out[key]={...out[key],suggestion:'',reason:'O conteúdo atual já pontua melhor nesta área. Preservar como está.'};
    }
  }
  const overall=Number(row?.score),after=Number(out.afterScore);
  if(Number.isFinite(overall)&&Number.isFinite(after)&&after<overall)out.afterScore=overall;
  return out;
}

async function appendImageGroup(parts,label,urls,visualEntries){
  const list=safeArray(urls).filter(Boolean).slice(0,3);
  if(!list.length)return 0;
  parts.push({text:`\n${label}\n`});
  let count=0;
  for(let i=0;i<list.length;i++){
    const part=await imagePart(list[i]);
    if(part){
      parts.push(part);
      visualEntries.push({label:`${label} — imagem ${i+1}`,inlineData:part.inlineData});
      count++;
    }
  }
  return count;
}

function providerError(provider,message,status=502){
  const error=new Error(message||`${provider} falhou.`);
  error.provider=provider;
  error.status=status;
  return error;
}

async function analyzeWithGemini({key,model,parts}){
  if(!key)throw providerError('gemini','Gemini sem chave configurada.',503);
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response;
  try{
    response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json'}}),signal:AbortSignal.timeout(52000)});
  }catch(e){throw providerError('gemini',`Falha chamando Gemini: ${String(e?.message||e)}`);}
  let raw={};try{raw=await response.json();}catch{}
  if(!response.ok)throw providerError('gemini',raw?.error?.message||`Gemini HTTP ${response.status}`,response.status);
  const text=safeArray(raw?.candidates?.[0]?.content?.parts).map(x=>x?.text||'').join('').trim();
  try{return JSON.parse(cleanJson(text));}catch{throw providerError('gemini','O Gemini respondeu, mas o JSON da análise não pôde ser interpretado.');}
}

async function groqChat({key,model,messages,maxTokens=3500}){
  let response;
  try{
    response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model,messages,temperature:0.2,max_completion_tokens:maxTokens,response_format:{type:'json_object'},stream:false}),signal:AbortSignal.timeout(22000)});
  }catch(e){throw providerError('groq',`Falha chamando Groq: ${String(e?.message||e)}`);}
  let raw={};try{raw=await response.json();}catch{}
  if(!response.ok)throw providerError('groq',raw?.error?.message||`Groq HTTP ${response.status}`,response.status);
  const text=raw?.choices?.[0]?.message?.content||'';
  if(!text)throw providerError('groq','Groq não retornou conteúdo para a análise.');
  return text;
}

function groqImageContent(entry){
  const mime=entry?.inlineData?.mimeType||'image/jpeg';
  const data=entry?.inlineData?.data||'';
  return[
    {type:'text',text:entry.label},
    {type:'image_url',image_url:{url:`data:${mime};base64,${data}`}}
  ];
}

async function analyzeWithGroq({key,model,row,visualEntries}){
  if(!key)throw providerError('groq','GROQ_API_KEY não está configurada.',503);
  const visualSummaries=[];
  const chunks=[];
  for(let i=0;i<visualEntries.length;i+=5)chunks.push(visualEntries.slice(i,i+5));

  for(let i=0;i<chunks.length;i++){
    const content=[{type:'text',text:`Analise visualmente este lote ${i+1}/${chunks.length} de imagens de anúncios da Shopee Brasil. Compare somente o que é visível. Observe legibilidade em miniatura, hierarquia, clareza do produto, excesso de texto, benefícios, prova visual, consistência, diferenciação e possíveis pontos fortes. Retorne JSON com a chave "observacoes" contendo uma síntese objetiva por rótulo de imagem. Não invente características do produto.`}];
    for(const entry of chunks[i])content.push(...groqImageContent(entry));
    const text=await groqChat({key,model,messages:[{role:'user',content}],maxTokens:2200});
    visualSummaries.push(cleanJson(text));
  }

  const visualContext=visualSummaries.length?`\n\nOBSERVAÇÕES VISUAIS EXTRAÍDAS DOS LOTES DE IMAGENS:\n${visualSummaries.join('\n\n')}`:'\n\nNenhuma imagem pôde ser enviada ao provedor visual. Não invente conclusões visuais.';
  const finalText=await groqChat({key,model,messages:[{role:'user',content:`${promptFor(row)}${visualContext}\n\nIMPORTANTE: gere agora o JSON final exatamente no formato solicitado acima.`}],maxTokens:7000});
  try{return JSON.parse(cleanJson(finalText));}catch{throw providerError('groq','A Groq respondeu, mas o JSON da análise não pôde ser interpretado.');}
}

export async function POST(request){
  let body={};try{body=await request.json();}catch{return NextResponse.json({error:'JSON inválido.'},{status:400})}
  const reportId=String(body?.report_id||'').trim();if(!reportId)return NextResponse.json({error:'report_id obrigatório.'},{status:400});

  const geminiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  const groqKey=process.env.GROQ_API_KEY;
  if(!geminiKey&&!groqKey)return NextResponse.json({error:'Nenhum provedor de IA está configurado. Configure GEMINI_API_KEY ou GROQ_API_KEY.'},{status:503});

  const shop=await getActiveShop();if(!shop)return NextResponse.json({error:'Nenhuma loja Shopee conectada.'},{status:400});
  const db=supabaseAdmin();
  const {data:row,error}=await db.from('extension_analysis_reports').select('*').eq('shop_id',shop.shop_id).eq('id',reportId).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});if(!row)return NextResponse.json({error:'Relatório não encontrado.'},{status:404});

  const p=safeObject(row.product_snapshot),comps=safeArray(row.competitors).slice(0,3);
  if(comps.length<1)return NextResponse.json({error:'A Super Análise precisa de pelo menos 1 concorrente coletado.'},{status:400});

  const parts=[{text:promptFor(row)}];
  const visualEntries=[];
  let visualImages=0;
  visualImages+=await appendImageGroup(parts,'IMAGENS DO ANÚNCIO DO USUÁRIO — compare estas imagens com os concorrentes selecionados.',safeArray(p.imageUrls||p.image?.image_url_list),visualEntries);
  for(let i=0;i<comps.length;i++){
    const c=comps[i]||{};
    const urls=safeArray(c.imageUrls||c.images||c.image?.image_url_list);
    visualImages+=await appendImageGroup(parts,`IMAGENS DO CONCORRENTE ${i+1} — título: ${String(c.title||'não informado')} — vendidos: ${String(c.sold??'não informado')} — preço: ${String(c.price??'não informado')}`,urls.slice(0,2),visualEntries);
  }

  const geminiModel=process.env.GEMINI_MODEL||'gemini-3.6-flash';
  const groqModel=process.env.GROQ_MODEL||'qwen/qwen3.6-27b';
  let analysis=null,provider=null,model=null,fallbackFrom=null,fallbackReason=null;

  if(geminiKey){
    try{
      analysis=await analyzeWithGemini({key:geminiKey,model:geminiModel,parts});
      provider='gemini';model=geminiModel;
    }catch(error){
      fallbackFrom='gemini';fallbackReason=String(error?.message||error);
    }
  }

  if(!analysis&&groqKey){
    try{
      analysis=await analyzeWithGroq({key:groqKey,model:groqModel,row,visualEntries});
      provider='groq';model=groqModel;
    }catch(error){
      const groqReason=String(error?.message||error);
      const prefix=fallbackReason?`Gemini falhou: ${fallbackReason} | `:'';
      return NextResponse.json({error:`${prefix}Groq também falhou: ${groqReason}`,providersTried:[geminiKey?'gemini':null,'groq'].filter(Boolean)},{status:502});
    }
  }

  if(!analysis)return NextResponse.json({error:fallbackReason||'Nenhum provedor conseguiu concluir a análise.'},{status:502});
  analysis=normalizedAnalysis(row,analysis);

  const newReport={...safeObject(row.report),ai_analysis:analysis,ai_provider:provider,ai_model:model,ai_analyzed_at:new Date().toISOString(),visual_images_sent:visualImages,ai_fallback_from:fallbackFrom||null,ai_fallback_reason:fallbackReason||null};
  const newSuggestions={...safeObject(row.suggestions),title:analysis?.title?.suggestion||row.suggestions?.title||null,description:analysis?.description?.suggestion||row.suggestions?.description||null,ai:analysis};
  const {error:updateError}=await db.from('extension_analysis_reports').update({report:newReport,suggestions:newSuggestions}).eq('shop_id',shop.shop_id).eq('id',reportId);
  if(updateError)return NextResponse.json({error:updateError.message},{status:500});

  return NextResponse.json({ok:true,analysis,provider,model,visualImages,fallbackFrom,fallbackReason});
}
