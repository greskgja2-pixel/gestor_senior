// Junta os custos cadastrados em product_costs (etapa Contexto, Ads e custos / Produtos)
// aos relatórios salvos da Super Análise.
//
// Regra: product_costs é a fonte de verdade do custo. O snapshot salvo na análise só é
// usado quando não existe custo cadastrado para o item. Sem variações, o custo é o
// custo único (model_id 0). Com variações, cada variação usa o custo do próprio model_id.
// Ausência de custo continua null — nunca vira zero.
//
// Fórmula de margem: mesma regra do painel de precificação (20% Shopee, taxa fixa R$ 4,50,
// imposto/outros = 0 quando não configurados). Ads não entra na margem por padrão.

const num = (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);

function marginOf(price, cost, finance) {
  const sale = num(price);
  const productCost = num(cost);
  if (!(sale > 0) || productCost == null || productCost < 0) return null;
  const commissionRate = num(finance.commissionRate) ?? 0.2;
  const fixedFee = num(finance.fixedFee) ?? 4.5;
  const taxRate = num(finance.taxRate) ?? 0;
  const otherCost = num(finance.otherCost) ?? 0;
  const profit = sale - sale * commissionRate - sale * taxRate - fixedFee - otherCost - productCost;
  return { profit, marginPct: (profit / sale) * 100 };
}

function idOf(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

export function applySavedCosts(report, costRows) {
  if (!report) return report;
  const rows = arr(costRows).filter((r) => String(r?.item_id) === String(report.item_id));
  if (!rows.length) return report;

  const saved = new Map(rows.map((r) => [String(r.model_id ?? 0), { cost: num(r.cost), packaging: num(r.packaging_cost) ?? 0 }]));
  const product = { ...obj(report.product_snapshot) };
  const finance = { ...obj(report.finance_snapshot) };
  const rawVars = arr(product.variations).length ? arr(product.variations) : arr(product.models);

  if (rawVars.length) {
    const variationCosts = [];
    const vars = rawVars.map((v, i) => {
      const id = String(v?.modelId ?? v?.model_id ?? v?.id ?? i);
      const s = saved.get(id);
      const cost = s && s.cost != null ? s.cost + s.packaging : num(v?.cost);
      if (cost != null) variationCosts.push({ modelId: idOf(id), cost, source: s && s.cost != null ? "product_costs" : "snapshot" });
      return { ...v, cost, ...(s && s.cost != null ? { costSource: "product_costs" } : {}) };
    });
    product.variations = vars;
    if (Array.isArray(product.models)) product.models = vars;
    product.variationCosts = variationCosts;
    product.variationCount = vars.length;

    const margins = vars.map((v) => marginOf(v.price ?? v.currentPrice ?? v.current_price, v.cost, finance));
    if (margins.length && margins.every(Boolean)) {
      const pcts = margins.map((m) => m.marginPct);
      const profits = margins.map((m) => m.profit);
      Object.assign(finance, {
        marginCalculationMode: "variation-range",
        marginStatus: "ok",
        marginPct: Math.min(...pcts),
        profit: Math.min(...profits),
        marginMinPct: Math.min(...pcts),
        marginMaxPct: Math.max(...pcts),
        profitMin: Math.min(...profits),
        profitMax: Math.max(...profits),
      });
    } else {
      Object.assign(finance, {
        marginCalculationMode: "variation-range",
        marginStatus: "incomplete",
        marginPct: null,
        profit: null,
        marginMinPct: null,
        marginMaxPct: null,
        profitMin: null,
        profitMax: null,
      });
    }
  } else {
    const s = saved.get("0");
    if (s && s.cost != null) {
      const total = s.cost + s.packaging;
      const price = num(report.metrics?.price) ?? num(product.price);
      const calc = marginOf(price, total, finance);
      Object.assign(finance, {
        productCost: total,
        marginCalculationMode: "single",
        marginStatus: calc ? "ok" : "incomplete",
        marginPct: calc ? calc.marginPct : null,
        profit: calc ? calc.profit : null,
      });
    }
  }

  return { ...report, product_snapshot: product, finance_snapshot: finance };
}
