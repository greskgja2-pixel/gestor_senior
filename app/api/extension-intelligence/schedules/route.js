import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function positiveInt(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function text(value, max = 500) { if (value === null || value === undefined) return null; return String(value).trim().slice(0, max) || null; }

export async function GET() {
  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });
  const db = supabaseAdmin();
  const { data, error } = await db.from("extension_analysis_schedules").select("id,item_id,title,product_url,enabled,frequency_days,mode,next_run_at,last_run_at,last_report_id,settings,created_at,updated_at").eq("shop_id", shop.shop_id).order("next_run_at", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data || [] });
}

export async function POST(request) {
  let body; try { body = await request.json(); } catch { return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 }); }
  const itemId = positiveInt(body?.item_id ?? body?.itemId); if (!itemId) return NextResponse.json({ error: "item_id inválido." }, { status: 400 });
  const shop = await getActiveShop(); if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });
  const frequencyDays = Math.min(90, Math.max(1, Number(body?.frequency_days || 10) || 10)), mode = body?.mode === "automatic" ? "automatic" : "approve", enabled = body?.enabled !== false;
  const nextRunAt = body?.next_run_at ? new Date(body.next_run_at) : new Date(Date.now() + frequencyDays * 86400000);
  if (Number.isNaN(nextRunAt.getTime())) return NextResponse.json({ error: "next_run_at inválido." }, { status: 400 });
  const db = supabaseAdmin();
  const { data: exists, error: productError } = await db.from("products_cache").select("item_id").eq("shop_id", shop.shop_id).eq("item_id", itemId).maybeSingle();
  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
  if (!exists) return NextResponse.json({ error: "Produto não encontrado na loja conectada." }, { status: 403 });
  const settings = body?.settings && typeof body.settings === "object" && !Array.isArray(body.settings) ? body.settings : {};
  const { data, error } = await db.from("extension_analysis_schedules").upsert({ shop_id: shop.shop_id, item_id: itemId, title: text(body?.title, 300), product_url: text(body?.product_url ?? body?.url, 1000), enabled, frequency_days: frequencyDays, mode, next_run_at: enabled ? nextRunAt.toISOString() : null, settings, updated_at: new Date().toISOString() }, { onConflict: "shop_id,item_id" }).select("id,item_id,title,product_url,enabled,frequency_days,mode,next_run_at,last_run_at,last_report_id,settings,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, schedule: data });
}
