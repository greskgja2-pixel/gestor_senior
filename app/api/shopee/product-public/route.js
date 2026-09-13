// GET /api/shopee/product-public?item_ids=1,2,3 - dados públicos da vitrine Shopee (histórico
// de vendas "desde sempre", preço e preço antes de desconto) pra um lote de itens da própria loja.
// Só é chamado sob demanda (ex.: usuário liga "vendas totais" ou expande variações), nunca no
// carregamento automático da página inteira de produtos — pra não sobrecarregar a vitrine pública.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getPublicItemInfo } from "../../../../lib/shopee-public";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_ITEMS = 40;

export async function GET(request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("item_ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const itemIds = [...new Set(raw)].slice(0, MAX_ITEMS).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!itemIds.length) return NextResponse.json({ error: "Informe item_ids." }, { status: 400 });

  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });

  const results = [];
  // Sequencial e com pequena pausa: é a vitrine pública, não a Partner API, mas evitamos
  // disparar dezenas de requisições simultâneas pro mesmo host.
  for (const itemId of itemIds) {
    try {
      const info = await getPublicItemInfo(shop.shop_id, itemId);
      results.push({ item_id: itemId, ok: true, ...info });
    } catch (err) {
      results.push({ item_id: itemId, ok: false, error: String(err.message || err) });
    }
  }
  return NextResponse.json({ results });
}

