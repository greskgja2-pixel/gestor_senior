import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-3-flash-preview";
const AUDITOR_AI_URL = process.env.AUDITOR_AI_URL?.trim() || "https://auditor-ia-oficial.vercel.app/api/mobile-analysis";

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function cleanText(value, max = 12000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function normalize(value) {
  return cleanText(value, 1000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wordSet(value) {
  const stop = new Set(["para", "com", "sem", "uma", "uns", "das", "dos", "produto", "produtos", "categoria"]);
  return new Set(normalize(value).split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w)));
}

function promptFor(body) {
  const type = body.type;
  const title = cleanText(body.title, 500);
  const description = cleanText(body.description, 10000);
  const currentCategory = cleanText(body.currentCategory, 500);

  if (type === "title") {
    return `Você é especialista em anúncios da Shopee Brasil.

Melhore o TÍTULO atual para ficar mais claro, natural e fácil de encontrar na busca da Shopee.

Regras obrigatórias:
- português do Brasil;
- preserve somente fatos já presentes no anúncio;
- NÃO invente marca, cor, tamanho, quantidade, material, benefício, certificação, modelo ou característica;
- priorize termos que descrevem de fato o produto;
- evite repetição, caixa alta excessiva e spam de palavras-chave;
- entregue SOMENTE o novo título, sem aspas, explicações ou prefixos.

Categoria atual: ${currentCategory || "não informada"}
Título atual: ${title}
Descrição atual:
${description}`;
  }

  if (type === "description") {
    return `Você é especialista em anúncios da Shopee Brasil.

Melhore a DESCRIÇÃO atual para ficar mais clara, organizada, persuasiva e fácil de ler no celular.

Regras obrigatórias:
- português do Brasil;
- preserve somente informações presentes no anúncio original;
- NÃO invente especificações, medidas, composição, resultados, garantias, certificações, brindes, promoções, preço ou prazo;
- use parágrafos curtos e marcadores quando ajudarem;
- emojis leves são permitidos quando fizerem sentido;
- não use tabelas nem títulos com Markdown (#);
- entregue SOMENTE a nova descrição, sem comentários sobre as mudanças.

Categoria atual: ${currentCategory || "não informada"}
Título atual: ${title}
Descrição atual:
${description}`;
  }

  if (type === "category") {
    const candidates = Array.isArray(body.candidates)
      ? body.candidates
          .slice(0, 100)
          .map((c) => ({ id: String(c.id ?? ""), path: cleanText(c.path, 500) }))
          .filter((c) => c.id && c.path)
      : [];

    if (!candidates.length) throw new Error("Nenhuma categoria oficial candidata foi enviada.");

    const list = candidates.map((c) => `${c.id} | ${c.path}`).join("\n");
    return `Você é especialista em categorização de produtos na Shopee Brasil.

Escolha a categoria MAIS adequada para este anúncio.

Regras obrigatórias:
- você SÓ pode escolher uma das categorias oficiais candidatas fornecidas abaixo;
- NÃO invente categoria nem ID;
- se a categoria atual já for a melhor opção, mantenha-a;
- considere principalmente o que o produto realmente é, e não palavras promocionais;
- responda SOMENTE com o ID numérico da melhor categoria.

Título: ${title}
Descrição: ${description}
Categoria atual: ${currentCategory || "não informada"}

Categorias oficiais candidatas (ID | caminho):
${list}`;
  }

  throw new Error("Tipo de melhoria inválido.");
}

async function callGeminiDirect(prompt) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2400 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Não foi possível concluir a sugestão com Gemini.");
    error.status = response.status;
    throw error;
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.find((part) => typeof part?.text === "string")?.text?.trim();
  if (!text) throw new Error("Resposta vazia do Gemini.");
  return text;
}

async function callAuditorAI(body) {
  const response = await fetch(AUDITOR_AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product: {
        title: cleanText(body.title, 500),
        description: cleanText(body.description, 10000),
        category: cleanText(body.currentCategory, 500),
      },
      competitors: [],
      context: {
        origin: "Gestor Senior - editor de produto",
        task: body.type,
      },
    }),
    signal: AbortSignal.timeout(55000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || "O Auditor I.A. não conseguiu consultar o Gemini.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function chooseOfficialCategory(suggestion, candidates, currentCategory) {
  const list = Array.isArray(candidates) ? candidates.filter((c) => c?.id && c?.path) : [];
  if (!list.length) return null;

  const target = normalize(suggestion);
  const targetWords = wordSet(suggestion);
  const current = normalize(currentCategory);

  let best = null;
  let bestScore = -1;
  for (const candidate of list) {
    const path = normalize(candidate.path);
    const words = wordSet(candidate.path);
    let score = 0;
    if (target && path === target) score += 1000;
    if (target && (path.includes(target) || target.includes(path))) score += 300;
    for (const word of targetWords) if (words.has(word) || path.includes(word)) score += word.length >= 7 ? 18 : 10;
    if (current && path === current) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore > 0 ? best : list.find((c) => normalize(c.path) === current) || list[0];
}

export async function GET() {
  return NextResponse.json({
    configured: true,
    source: process.env.GEMINI_API_KEY?.trim() ? "local:GEMINI_API_KEY" : "auditor-ia-oficial",
    model: MODEL,
  });
}

export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 }); }

  try {
    const direct = await callGeminiDirect(promptFor(body || {}));
    if (direct) {
      if (body.type === "category") {
        const categoryId = direct.match(/\b\d{3,}\b/)?.[0] || "";
        const allowed = new Set((body.candidates || []).map((c) => String(c.id)));
        if (!categoryId || !allowed.has(categoryId)) throw new Error("A IA não retornou uma categoria válida da lista oficial da Shopee.");
        return NextResponse.json({ categoryId, model: MODEL, source: "local" });
      }
      return NextResponse.json({ text: direct, model: MODEL, source: "local" });
    }

    const analysis = await callAuditorAI(body || {});
    if (body.type === "title") {
      const text = cleanText(analysis?.optimizedTitle, 500);
      if (!text) throw new Error("O Auditor I.A. não retornou um título otimizado.");
      return NextResponse.json({ text, model: MODEL, source: "auditor-ia-oficial" });
    }
    if (body.type === "description") {
      const text = cleanText(analysis?.optimizedDescription, 12000);
      if (!text) throw new Error("O Auditor I.A. não retornou uma descrição otimizada.");
      return NextResponse.json({ text, model: MODEL, source: "auditor-ia-oficial" });
    }
    if (body.type === "category") {
      const picked = chooseOfficialCategory(analysis?.suggestedCategory || body.currentCategory, body.candidates, body.currentCategory);
      if (!picked) throw new Error("Não foi possível associar a sugestão a uma categoria oficial da Shopee.");
      return NextResponse.json({ categoryId: String(picked.id), suggestedCategory: analysis?.suggestedCategory || "", model: MODEL, source: "auditor-ia-oficial" });
    }

    throw new Error("Tipo de melhoria inválido.");
  } catch (error) {
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      { error: String(error?.message || error || "Falha ao gerar sugestão.") },
      { status: status >= 400 && status <= 599 ? status : 500 }
    );
  }
}
