// GET /api/shopee/product-status - conta ao vivo quantos produtos estao BANNED/UNLIST na Shopee.
// Nao usa cache (numero pequeno, chamada rapida). Nunca inventa numero: se a Shopee falhar,
// o contador daquele status volta null e o front mostra "sem dados".
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { getProductStatusCounts } from "../../../../lib/products";

export const dynamic = "force-dynamic";
export const maxDuration = 20; // teto de seguranca: nunca deixa o painel pendurado indefinidamente

export async function GET() {
  let shop;
  try {
    shop = await getActiveShop();
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
  if (!shop) {
    return NextResponse.json(
      { error: "Nenhuma loja autorizada ainda. Va em /api/shopee/authorize pra conectar." },
      { status: 400 }
    );
  }

  try {
    const counts = await getProductStatusCounts(shop);
    return NextResponse.json(counts);
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
