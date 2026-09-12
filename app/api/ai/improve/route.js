import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KEY_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_KEY",
];

function getGeminiConfig() {
  for (const name of KEY_NAMES) {
    const value = process.env[name]?.trim();
    if (value) {
      return {
        apiKey: value,
        source: name,
        model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
      };
    }
  }
  return {
    apiKey: "",
    source: null,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
  };
}

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

function promptFor(body) {
  const type = body.type;
  const title = cleanText(body.title, 500);
  const description = cleanText(body.description, 10000);
  const currentCategory = cleanText(body.currentCategory, 500);

  if (type === "title") {
    return `Você é especialista em anúncios da Shopee Brasil.\n\nTarefa: melhorar o TÍTULO atual do anúncio, deixando-o claro, natural e fácil de encontrar na busca.\n\nRegras obrigatórias:\n- escreva em português do Brasil;\n- preserve os fatos já existentes;\n- NÃO invente marca, cor, tamanho, quantidade, material, benefício, certificação, modelo ou característica que não apareça no conteúdo fornecido;\n- evite repetição de palavras e spam de palavras-chave;\n- entregue somente o novo título, sem aspas, explicações ou prefixos.\n\nCategoria atual: ${currentCategory || "não informada"}\nTítulo atual: ${title}\nDescrição atual:\n${description}`;
  }

  if (type === "description") {
    return `Você é especialista em anúncios da Shopee Brasil.\n\nTarefa: melhorar a DESCRIÇÃO atual do anúncio para ficar mais clara, organizada, persuasiva e fácil de ler.\n\nRegras obrigatórias:\n- escreva em português do Brasil;\n- preserve somente informações presentes no texto original;\n- NÃO invente especificações, medidas, composição, resultados, garantias, certificações, brindes, promoções, preço ou prazo;\n- mantenha uma estrutura boa para celular, com parágrafos curtos e marcadores quando ajudarem;\n- não use Markdown com # ou tabelas; emojis leves são permitidos quando fizerem sentido;\n- entregue somente a nova descrição, sem comentários sobre o que foi alterado.\n\nCategoria atual: ${currentCategory || "não informada"}\nTítulo atual: ${title}\nDescrição atual:\n${description}`;
  }

  if (type === "category") {
    const candidates = Array.isArray(body.candidates)
      ? body.candidates.slice(0, 80).map((c) => ({
          id: String(c.id ?? ""),
          path: cleanText(c.path, 500),
        })).filter((c) => c.id && c.path)
      : [];

    if (!candidates.length) throw new Error("Nenhuma categoria oficial candidata foi enviada.");

    const list = candidates.map((c) => `${c.id} | ${c.path}`).join("\n");
    return `Você é especialista em categorização de produtos na Shopee Brasil.\n\nEscolha a categoria MAIS adequada para este anúncio. Você é obrigado a escolher SOMENTE uma das categorias oficiais candidatas abaixo.\n\nNão invente categoria nem ID. Se a categoria atual já for a mais adequada, pode mantê-la.\n\nProduto:\nTítulo: ${title}\nDescrição: ${description}\nCategoria atual: ${currentCategory || "não informada"}\n\nCategorias oficiais candidatas (ID | caminho):\n${list}\n\nResponda SOMENTE com o ID numérico da melhor categoria.`;
  }

  throw new Error("Tipo de melhoria inválido.");
}

async function callGemini({ apiKey, model, prompt }) {
  const models = [model, "gemini-3.7-flash"].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastError = "Falha ao consultar o Gemini.";

  for (const modelName of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 2400,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

    if (response.ok) {
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("")
        .trim();
      if (text) return { text, model: modelName };
      lastError = "O Gemini respondeu sem conteúdo.";
      continue;
    }

    lastError = data?.error?.message || raw.slice(0, 500) || `HTTP ${response.status}`;
    if (![400, 404].includes(response.status)) break;
  }

  throw new Error(lastError);
}

export async function GET() {
  const cfg = getGeminiConfig();
  return NextResponse.json({
    configured: Boolean(cfg.apiKey),
    source: cfg.source,
    model: cfg.model,
  });
}

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  }

  const cfg = getGeminiConfig();
  if (!cfg.apiKey) {
    return NextResponse.json(
      {
        error: "A chave do Gemini não foi encontrada nas variáveis de ambiente deste projeto Vercel.",
        expected: KEY_NAMES,
      },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  try {
    const prompt = promptFor(body || {});
    const result = await callGemini({ apiKey: cfg.apiKey, model: cfg.model, prompt });

    if (body.type === "category") {
      const match = result.text.match(/\b\d{3,}\b/);
      const categoryId = match?.[0] || "";
      const allowed = new Set((body.candidates || []).map((c) => String(c.id)));
      if (!categoryId || !allowed.has(categoryId)) {
        throw new Error("A IA não retornou uma categoria válida da lista oficial da Shopee.");
      }
      return NextResponse.json({ categoryId, model: result.model });
    }

    return NextResponse.json({ text: result.text, model: result.model });
  } catch (error) {
    return NextResponse.json(
      { error: String(error?.message || error || "Falha ao gerar sugestão.") },
      { status: 500 }
    );
  }
}
