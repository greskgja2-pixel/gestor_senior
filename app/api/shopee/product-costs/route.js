// GET/POST /api/shopee/product-costs - custo e custo de embalagem por produto (e, opcionalmente,
// por variação/model_id). A Shopee não devolve custo do produto (isso não existe na API dela) —
// são valores que o próprio lojista cadastra aqui. Guardados em product_costs (Supabase).
// model_id=0 representa o custo "do produto inteiro": usado direto em produtos sem variação e
// como valor padrão/fallback pra qualquer variação que ainda não tenha custo próprio cadastrado.
// Nunca inventamos um valor: quando não cadastrado, o campo some do retorno e o painel mostra
// "sem dados" / "cadastre custo".
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("product_costs")
    .select("item_id, model_id, cost, packaging_cost, updated_at")
    .eq("shop_id", shop.shop_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ costs: data || [] });
}

function parseMoney(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { error: true };
  return n;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const itemId = Number(body?.item_id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "item_id inválido." }, { status: 400 });
  }
  // model_id ausente/0 = custo do produto inteiro (ou padrão pra variações sem custo próprio).
  const modelIdRaw = body?.model_id;
  const modelId = modelIdRaw === undefined || modelIdRaw === null || modelIdRaw === "" ? 0 : Number(modelIdRaw);
  if (!Number.isFinite(modelId) || modelId < 0) {
    return NextResponse.json({ error: "model_id inválido." }, { status: 400 });
  }

  const cost = parseMoney(body?.cost);
  const packagingCost = parseMoney(body?.packaging_cost);
  if (cost?.error) return NextResponse.json({ error: "Custo inválido." }, { status: 400 });
  if (packagingCost?.error) return NextResponse.json({ error: "Custo de embalagem inválido." }, { status: 400 });

  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from("product_costs").upsert(
    {
      shop_id: shop.shop_id,
      item_id: itemId,
      model_id: modelId,
      cost,
      packaging_cost: packagingCost,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_id,item_id,model_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item_id: itemId, model_id: modelId, cost, packaging_cost: packagingCost });
}
