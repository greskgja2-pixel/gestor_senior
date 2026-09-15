import { NextResponse } from "next/server";
import { getActiveShop } from "../../../../lib/shop";
import { supabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function positiveInt(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function safeObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, max = 500) {
  if (value === null || value === undefined) return null;
  return String(value).trim().slice(0, max) || null;
}

async function itemBelongsToShop(db, shopId, itemId) {
  const { data, error } = await db
    .from("products_cache")
    .select("item_id")
    .eq("shop_id", shopId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.item_id);
}

export async function GET(request) {
  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });

  const url = new URL(request.url);
  const itemId = positiveInt(url.searchParams.get("item_id"));
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200) || 200));
  const db = supabaseAdmin();

  let query = db
    .from("extension_analysis_reports")
    .select("id,item_id,analyzed_at,next_reanalysis_at,extension_version,source,objective,situation,bottleneck,score,product_snapshot,ads_snapshot,finance_snapshot,competitors,report,suggestions,metrics,created_at")
    .eq("shop_id", shop.shop_id)
    .order("analyzed_at", { ascending: false })
    .limit(limit);
  if (itemId) query = query.eq("item_id", itemId);

  const [{ data: reports, error }, { data: schedules, error: scheduleError }] = await Promise.all([
    query,
    db
      .from("extension_analysis_schedules")
      .select("id,item_id,title,product_url,enabled,frequency_days,mode,next_run_at,last_run_at,last_report_id,settings,created_at,updated_at")
      .eq("shop_id", shop.shop_id)
      .order("updated_at", { ascending: false }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (scheduleError) return NextResponse.json({ error: scheduleError.message }, { status: 500 });

  return NextResponse.json({
    reports: reports || [],
    schedules: schedules || [],
    shop: { shopId: shop.shop_id, shopName: shop.shop_name || null },
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const itemId = positiveInt(body?.item_id ?? body?.itemId);
  if (!itemId) return NextResponse.json({ error: "item_id inválido." }, { status: 400 });

  const shop = await getActiveShop();
  if (!shop) return NextResponse.json({ error: "Nenhuma loja autorizada." }, { status: 400 });
  const db = supabaseAdmin();

  try {
    if (!(await itemBelongsToShop(db, shop.shop_id, itemId))) {
      return NextResponse.json({ error: "O item informado não pertence à loja conectada." }, { status: 403 });
    }

    const scoreRaw = body?.score ?? body?.report?.score;
    const score = Number.isFinite(Number(scoreRaw)) ? Math.max(0, Math.min(100, Math.round(Number(scoreRaw)))) : null;
    const analyzedAt = body?.analyzed_at ? new Date(body.analyzed_at) : new Date();
    const nextAt = body?.next_reanalysis_at ? new Date(body.next_reanalysis_at) : null;
    if (Number.isNaN(analyzedAt.getTime()) || (nextAt && Number.isNaN(nextAt.getTime()))) {
      return NextResponse.json({ error: "Data de análise/reanálise inválida." }, { status: 400 });
    }

    const row = {
      shop_id: shop.shop_id,
      item_id: itemId,
      analyzed_at: analyzedAt.toISOString(),
      next_reanalysis_at: nextAt ? nextAt.toISOString() : null,
      extension_version: safeText(body?.extension_version, 40),
      source: safeText(body?.source, 60) || "chrome-extension",
      objective: safeText(body?.objective, 120),
      situation: safeText(body?.situation, 120),
      bottleneck: safeText(body?.bottleneck, 180),
      score,
      product_snapshot: safeObject(body?.product_snapshot ?? body?.product),
      ads_snapshot: safeObject(body?.ads_snapshot ?? body?.ads),
      finance_snapshot: safeObject(body?.finance_snapshot ?? body?.finance),
      competitors: safeArray(body?.competitors).slice(0, 20),
      report: safeObject(body?.report),
      suggestions: safeObject(body?.suggestions),
      metrics: safeObject(body?.metrics),
    };

    const { data: inserted, error } = await db
      .from("extension_analysis_reports")
      .insert(row)
      .select("id,item_id,analyzed_at,next_reanalysis_at,score")
      .single();
    if (error) throw new Error(error.message);

    if (nextAt) {
      const frequencyDays = Math.min(90, Math.max(1, Number(body?.frequency_days || 10) || 10));
      const mode = body?.mode === "automatic" ? "automatic" : "approve";
      const product = row.product_snapshot || {};
      const { error: scheduleError } = await db.from("extension_analysis_schedules").upsert(
        {
          shop_id: shop.shop_id,
          item_id: itemId,
          title: safeText(product.title ?? product.item_name, 300),
          product_url: safeText(product.url, 1000),
          enabled: true,
          frequency_days: frequencyDays,
          mode,
          next_run_at: nextAt.toISOString(),
          last_run_at: row.analyzed_at,
          last_report_id: inserted.id,
          settings: safeObject(body?.schedule_settings),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop_id,item_id" }
      );
      if (scheduleError) throw new Error(scheduleError.message);
    }

    return NextResponse.json({ ok: true, report: inserted });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
