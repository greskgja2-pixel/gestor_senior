// Estado seguro da conexao para o painel. Nunca devolve tokens ou chaves.
import { NextResponse } from "next/server";
import { getConnectionState } from "../../../../lib/shop";
import { currentShopeeEnv } from "../../../../lib/shopee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30; // teto de seguranca: nunca deixa o painel pendurado indefinidamente

export async function GET() {
    try {
          const state = await getConnectionState();
          return NextResponse.json({
                  connected: state.connected,
                  paused: state.paused,
                  environment: currentShopeeEnv(),
                  shopId: state.shopId,
                  shopName: state.shopName || null,
          });
    } catch (error) {
          return NextResponse.json(
            { connected: false, paused: false, error: String(error.message || error) },
            { status: 500 }
                );
    }
}
