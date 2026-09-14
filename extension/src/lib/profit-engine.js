export const DEFAULT_FINANCE = Object.freeze({
  commissionRate: 0.20,
  fixedFee: 4,
  packagingCost: 0,
  taxRate: 0,
  otherCost: 0,
  minMarginPct: 20,
  minProfit: 8,
  priceFloor: 0,
  maxDailyAdsSpend: 50,
  maxWeeklyAdsSpend: 300
});

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;

export function computeProfit({price, productCost, commissionRate, fixedFee, packagingCost, taxRate, otherCost, adsCostPerSale = 0}) {
  const sale = n(price);
  const cfg = {...DEFAULT_FINANCE, commissionRate, fixedFee, packagingCost, taxRate, otherCost};
  const cost = n(productCost);
  if (!(sale > 0)) return {valid:false, reason:'Preço inválido'};
  const commission = sale * n(cfg.commissionRate);
  const tax = sale * n(cfg.taxRate);
  const variableCosts = commission + tax + n(cfg.fixedFee) + n(cfg.packagingCost) + n(cfg.otherCost) + n(adsCostPerSale) + cost;
  const profit = sale - variableCosts;
  const marginPct = (profit / sale) * 100;
  const contributionBeforeAds = sale - cost - commission - tax - n(cfg.fixedFee) - n(cfg.packagingCost) - n(cfg.otherCost);
  const contributionMargin = contributionBeforeAds / sale;
  const breakEvenRoas = contributionMargin > 0 ? 1 / contributionMargin : null;
  return {valid:true, sale, productCost:cost, commission, tax, fixedFee:n(cfg.fixedFee), packagingCost:n(cfg.packagingCost), otherCost:n(cfg.otherCost), adsCostPerSale:n(adsCostPerSale), profit, marginPct, contributionBeforeAds, contributionMargin, breakEvenRoas};
}

export function financialGuard({price, proposedPrice, productCost, weeklyAdsSpend = 0, dailyAdsSpend = 0, finance = {}}) {
  const cfg = {...DEFAULT_FINANCE, ...finance};
  const targetPrice = n(proposedPrice || price);
  const result = computeProfit({price:targetPrice, productCost, ...cfg});
  const reasons = [];
  if (!result.valid) reasons.push(result.reason);
  if (cfg.priceFloor > 0 && targetPrice < cfg.priceFloor) reasons.push(`Preço abaixo do piso R$ ${cfg.priceFloor.toFixed(2)}`);
  if (result.valid && result.marginPct < cfg.minMarginPct) reasons.push(`Margem ${result.marginPct.toFixed(1)}% abaixo do mínimo ${cfg.minMarginPct}%`);
  if (result.valid && result.profit < cfg.minProfit) reasons.push(`Lucro R$ ${result.profit.toFixed(2)} abaixo do mínimo R$ ${cfg.minProfit.toFixed(2)}`);
  if (cfg.maxDailyAdsSpend > 0 && n(dailyAdsSpend) > cfg.maxDailyAdsSpend) reasons.push('Limite diário de Ads excedido');
  if (cfg.maxWeeklyAdsSpend > 0 && n(weeklyAdsSpend) > cfg.maxWeeklyAdsSpend) reasons.push('Limite semanal de Ads excedido');
  return {ok: reasons.length === 0, reasons, finance:result, config:cfg};
}
