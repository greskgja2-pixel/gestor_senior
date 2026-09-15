import Link from "next/link";
import Image from "next/image";
import { getActiveShop } from "../../lib/shop";
import { supabaseAdmin } from "../../lib/supabase";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function money(v) {
  const x = n(v);
  return x == null ? "—" : x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(v) {
  const x = n(v);
  return x == null ? "—" : `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
function date(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}
function firstImage(product = {}) {
  return product.imageUrl || product.image_url || product.imageUrls?.[0] || product.image?.image_url_list?.[0] || null;
}
function titleOf(report) {
  const p = report?.product_snapshot || {};
  return p.title || p.item_name || `Produto ${report?.item_id || ""}`;
}
function metric(report, key) {
  const m = report?.metrics || {};
  const a = report?.ads_snapshot || {};
  return m[key] ?? a[key] ?? null;
}
function delta(cur, prev, key) {
  const a = n(metric(cur, key));
  const b = n(metric(prev, key));
  if (a == null || b == null || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}
function tone(value, inverse = false) {
  if (value == null || Math.abs(value) < 0.01) return styles.small;
  const good = inverse ? value < 0 : value > 0;
  return good ? styles.good : styles.bad;
}
function reportDimensions(report) {
  const dims = report?.report?.dimensions;
  return Array.isArray(dims) ? dims : [];
}

export default async function ExtensionIntelligencePage() {
  const shop = await getActiveShop();
  if (!shop) {
    return <main className={styles.page}><div className={styles.empty}>Nenhuma loja Shopee conectada.</div></main>;
  }

  const db = supabaseAdmin();
  const [{ data: reports, error }, { data: schedules }] = await Promise.all([
    db.from("extension_analysis_reports")
      .select("id,item_id,analyzed_at,next_reanalysis_at,extension_version,objective,situation,bottleneck,score,product_snapshot,ads_snapshot,finance_snapshot,competitors,report,suggestions,metrics")
      .eq("shop_id", shop.shop_id)
      .order("analyzed_at", { ascending: false })
      .limit(500),
    db.from("extension_analysis_schedules")
      .select("item_id,enabled,frequency_days,mode,next_run_at,last_run_at")
      .eq("shop_id", shop.shop_id),
  ]);

  if (error) {
    return <main className={styles.page}><div className={styles.empty}>Erro carregando o histórico: {error.message}</div></main>;
  }

  const grouped = new Map();
  for (const r of reports || []) {
    const k = String(r.item_id);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(r);
  }
  const scheduleMap = new Map((schedules || []).map((s) => [String(s.item_id), s]));
  const items = [...grouped.entries()].map(([itemId, history]) => ({ itemId, history, latest: history[0], previous: history[1], schedule: scheduleMap.get(itemId) || null }));
  items.sort((a, b) => new Date(b.latest?.analyzed_at || 0) - new Date(a.latest?.analyzed_at || 0));

  const scheduled = (schedules || []).filter((s) => s.enabled).length;
  const avgScore = items.length ? items.reduce((s, x) => s + (n(x.latest?.score) || 0), 0) / items.length : 0;
  const dueSoon = (schedules || []).filter((s) => s.enabled && s.next_run_at && new Date(s.next_run_at).getTime() <= Date.now() + 3 * 86400000).length;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <div className={styles.logo}>GS</div>
          <div><h1>Extensão Shopee Intelligence</h1><p>Histórico centralizado de Super Análises, reanálises e evolução por anúncio.</p></div>
        </div>
        <Link className={styles.back} href="/">← Voltar ao Gestor</Link>
      </header>

      <section className={styles.summary}>
        <div className={styles.kpi}><span>Anúncios analisados</span><b>{items.length}</b></div>
        <div className={styles.kpi}><span>Relatórios salvos</span><b>{(reports || []).length}</b></div>
        <div className={styles.kpi}><span>Nota média atual</span><b>{items.length ? avgScore.toFixed(1) : "—"}</b></div>
        <div className={styles.kpi}><span>Reanálises ativas / próximas 3d</span><b>{scheduled} / {dueSoon}</b></div>
      </section>

      <section className={styles.content}>
        {!items.length && <div className={styles.empty}>Ainda não há análises sincronizadas pela extensão. Conclua uma Super Análise para ela aparecer aqui automaticamente.</div>}
        {items.map(({ itemId, history, latest, previous, schedule }) => {
          const product = latest.product_snapshot || {};
          const scoreDelta = previous && n(latest.score) != null && n(previous.score) != null ? n(latest.score) - n(previous.score) : null;
          const roasDelta = delta(latest, previous, "roas");
          const gmvDelta = delta(latest, previous, "gmv");
          const marginPct = n(latest.finance_snapshot?.marginPct ?? latest.metrics?.marginPct);
          const img = firstImage(product);
          return (
            <article className={styles.item} key={itemId}>
              <div className={styles.itemHead}>
                <div className={styles.product}>
                  {img ? <img className={styles.thumb} src={img} alt="" /> : <div className={styles.thumb} />}
                  <div className={styles.productText}><strong>{titleOf(latest)}</strong><small>ID {itemId} · última análise {date(latest.analyzed_at)}</small></div>
                </div>
                <div className={styles.metric}><span>Super Análise</span><b className={styles.score}>{latest.score ?? "—"}/100</b>{scoreDelta != null && <span className={tone(scoreDelta)}>{scoreDelta >= 0 ? "+" : ""}{scoreDelta} pts</span>}</div>
                <div className={styles.metric}><span>ROAS</span><b>{n(metric(latest, "roas"))?.toFixed(2) ?? "—"}</b>{roasDelta != null && <span className={tone(roasDelta)}>{roasDelta >= 0 ? "+" : ""}{roasDelta.toFixed(1)}%</span>}</div>
                <div className={styles.metric}><span>GMV</span><b>{money(metric(latest, "gmv"))}</b>{gmvDelta != null && <span className={tone(gmvDelta)}>{gmvDelta >= 0 ? "+" : ""}{gmvDelta.toFixed(1)}%</span>}</div>
                <div className={styles.metric}><span>Gasto Ads</span><b>{money(metric(latest, "spend"))}</b></div>
                <div className={styles.metric}><span>Margem</span><b className={marginPct != null && marginPct < 0 ? styles.bad : styles.good}>{pct(marginPct)}</b></div>
              </div>

              <div className={styles.history}>
                <div className={styles.historyTitle}>
                  <h2>Evolução e relatórios</h2>
                  {schedule?.enabled ? <span className={styles.schedule}>Reanálise a cada {schedule.frequency_days} dias · próxima {date(schedule.next_run_at)} · {schedule.mode === "automatic" ? "automático" : "aprovação"}</span> : <span className={styles.small}>Sem reanálise ativa</span>}
                </div>
                <div className={styles.timeline}>
                  {history.map((r, index) => {
                    const dims = reportDimensions(r);
                    const sug = r.suggestions || {};
                    return (
                      <details className={styles.report} key={r.id} open={index === 0}>
                        <summary><span>{date(r.analyzed_at)}</span><span>Nota {r.score ?? "—"}/100</span></summary>
                        <div className={styles.reportBody}>
                          <div className={styles.chips}>
                            {r.objective && <span className={styles.chip}>Objetivo: {r.objective}</span>}
                            {r.situation && <span className={styles.chip}>Situação: {r.situation}</span>}
                            {r.bottleneck && <span className={styles.chip}>Gargalo: {r.bottleneck}</span>}
                            {r.extension_version && <span className={styles.chip}>Extensão {r.extension_version}</span>}
                          </div>
                          {!!dims.length && <div className={styles.dimensions}>{dims.map((d, i) => <div className={styles.dim} key={`${d.name}-${i}`}><div><span>{d.name}</span><span>{d.score}/{d.maxScore}</span></div><p>{d.reason}</p></div>)}</div>}
                          <div className={styles.suggestions}>
                            {sug.title && <div className={styles.suggestion}><b>Título sugerido</b><p>{sug.title}</p></div>}
                            {sug.description && <div className={styles.suggestion}><b>Descrição sugerida</b><p>{sug.description}</p></div>}
                            {sug.category && <div className={styles.suggestion}><b>Categoria sugerida</b><p>{String(sug.category)}</p></div>}
                            <div className={styles.suggestion}><b>Ads / Financeiro</b><p>ROAS: {n(metric(r, "roas"))?.toFixed(2) ?? "—"} · Meta: {n(metric(r, "targetRoas"))?.toFixed(2) ?? "—"} · Gasto: {money(metric(r, "spend"))}</p></div>
                          </div>
                          {!!r.competitors?.length && <div className={styles.competitors}><b>Concorrentes selecionados</b><ul>{r.competitors.slice(0, 3).map((c, i) => <li key={c.itemId || c.item_id || i}>{c.title || c.name || `Concorrente ${i + 1}`} {n(c.price) != null ? `· ${money(c.price)}` : ""}</li>)}</ul></div>}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
