// GET /api/shopee/product-public?item_ids=1,2,3 - dados públicos da vitrine Shopee (histórico
// de vendas "desde sempre", preço e preço antes de desconto) pra um lote de itens da própria loja.
// Primeiro tenta UMA chamada listando os itens da loja inteira (mais rápido e confiável); pra
// qualquer item que não apareça nessa listagem, cai pra uma consulta individual como reserva.
// Só é chamado sob demanda (ex.: usuário liga "vendas totais" ou expande variações), nunca no
// carregamento automático da página inteira de produtos — pra não sobrecarregar a vitrine pública.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getPublicItemInfo, getShopItemsPublic } from "../../../../lib/shopee-public";

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

  let shopMap = null;
  let shopMapError = null;
  try {
    shopMap = await getShopItemsPublic(shop.shop_id);
  } catch (err) {
    shopMapError = String(err.message || err);
  }

  const results = [];
  for (const itemId of itemIds) {
    const fromShop = shopMap && shopMap.get(String(itemId));
    if (fromShop) {
      results.push({ item_id: itemId, ok: true, ...fromShop });
      continue;
    }
    try {
      const info = await getPublicItemInfo(shop.shop_id, itemId);
      results.push({ item_id: itemId, ok: true, ...info });
    } catch (err) {
      const detail = String(err.message || err);
      results.push({
        item_id: itemId,
        ok: false,
        error: shopMapError ? `Listagem da loja falhou (${shopMapError}). Consulta individual: ${detail}` : detail,
      });
    }
  }
  return NextResponse.json({ results });
}
