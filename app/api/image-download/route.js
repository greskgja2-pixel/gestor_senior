import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_HOSTS = [
  "susercontent.com",
  "shopee.com.br",
  "shopeemobile.com",
];

function isAllowedHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return ALLOWED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function safeName(value) {
  return String(value || "imagem-shopee")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _.-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110) || "imagem-shopee";
}

function extensionFor(contentType) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("avif")) return "avif";
  return "jpg";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  const requestedName = searchParams.get("name");

  if (!rawUrl) {
    return NextResponse.json({ error: "URL da imagem ausente." }, { status: 400 });
  }

  let imageUrl;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "URL da imagem inválida." }, { status: 400 });
  }

  if (!["https:", "http:"].includes(imageUrl.protocol) || !isAllowedHost(imageUrl.hostname)) {
    return NextResponse.json({ error: "Origem de imagem não autorizada." }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 GestorSenior/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `A Shopee não liberou esta imagem para download agora (HTTP ${response.status}).` },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "O endereço não retornou uma imagem." }, { status: 502 });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 20_000_000) {
      return NextResponse.json({ error: "Imagem grande demais para download pelo painel." }, { status: 413 });
    }

    const ext = extensionFor(contentType);
    const base = safeName(requestedName).replace(/\.(jpg|jpeg|png|webp|gif|avif)$/i, "");
    const filename = `${base}.${ext}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error?.message || "Não foi possível baixar a imagem agora.") },
      { status: 502 },
    );
  }
}
