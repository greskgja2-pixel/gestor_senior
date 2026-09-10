// Endpoint TEMPORÁRIO de diagnóstico — não expõe a chave, só metadados seguros pra
// confirmar se as env vars chegaram certas no runtime da Vercel. Remover depois de resolver.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function safeInfo(name) {
  const v = process.env[name];
  if (v == null) return { present: false };
  return {
    present: true,
    length: v.length,
    isHex: /^[0-9a-fA-F]+$/.test(v),
    first4: v.slice(0, 4),
    last4: v.slice(-4),
    hasLeadingOrTrailingWhitespace: v !== v.trim(),
  };
}

export async function GET() {
  return NextResponse.json({
    SHOPEE_ENV: process.env.SHOPEE_ENV || null,
    SHOPEE_PARTNER_ID: safeInfo("SHOPEE_PARTNER_ID"),
    SHOPEE_PARTNER_KEY: safeInfo("SHOPEE_PARTNER_KEY"),
    serverTimeUTC: new Date().toISOString(),
  });
}

