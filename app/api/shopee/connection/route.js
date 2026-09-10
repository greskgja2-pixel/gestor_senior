// Estado seguro da conexão para o painel. Nunca devolve tokens ou chaves.
import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { currentShopeeEnv } from "../../../../lib/shopee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const shop = await getActiveShop();
    return NextResponse.json({
      connected: Boolean(shop),
      environment: currentShopeeEnv(),
      shopId: shop ? String(shop.shop_id) : null,
    });
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: String(error.message || error) },
      { status: 500 }
    );
  }
}
