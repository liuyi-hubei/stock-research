/* One initial outlay, ten annual shareholder receipts; no reinvestment assumption. */
(function (root) {
  "use strict";
  function valid(value, name, condition) {
    if (!Number.isFinite(value) || !condition(value)) throw new Error(`Invalid ${name}`);
  }
  function pv(flows, rate) {
    valid(rate, "discount rate", x => x > -1);
    if (!Array.isArray(flows) || flows.length !== 10 || Array.from(flows).some(x => !Number.isFinite(x) || x < 0)) throw new Error("Invalid ten-year cash flows");
    return flows.reduce((sum, cash, index) => sum + cash / (1 + rate) ** (index + 1), 0);
  }
  function irr(price, flows) {
    valid(price, "price", x => x > 0);
    if (!Array.isArray(flows) || flows.length !== 10 || Array.from(flows).some(x => !Number.isFinite(x) || x < 0) || !flows.some(x => x > 0)) throw new Error("Invalid ten-year cash flows");
    let low = -0.999999, high = 1;
    while (pv(flows, high) > price && high < 1048576) high *= 2;
    if (pv(flows, high) > price) throw new Error("IRR outside supported range");
    for (let i = 0; i < 160; i += 1) {
      const mid = (low + high) / 2;
      if (pv(flows, mid) > price) low = mid; else high = mid;
    }
    const rate = (low + high) / 2;
    if (Math.abs(pv(flows, rate) / price - 1) >= 1e-8) throw new Error("IRR residual exceeds tolerance");
    return rate;
  }
  function scenario(price, requiredReturn, assumption) {
    if (!assumption || typeof assumption !== "object") throw new Error("Missing scenario assumptions");
    const { eps, early, late, payout, exitPE, firstDividend } = assumption;
    valid(eps, "EPS", x => x > 0);
    if (assumption.growthRates === undefined) for (const g of [early, late]) valid(g, "growth", x => x > -1 && x <= 1);
    if (assumption.payoutRates === undefined) valid(payout, "payout", x => x >= 0 && x <= 1);
    valid(exitPE, "exit PE", x => x > 0);
    valid(requiredReturn, "required return", x => x > 0 && x < 1);
    if (firstDividend !== undefined) valid(firstDividend, "first dividend", x => x >= 0);
    if (firstDividend !== undefined && assumption.firstDividendParts) throw new Error("Conflicting first-dividend overrides");
    const stageYears = assumption.stageYears ?? 3;
    valid(stageYears, "stage years", x => Number.isInteger(x) && x >= 1 && x <= 9);
    const series = (values, name, fallback, condition) => {
      if (values !== undefined && (!Array.isArray(values) || values.length !== 10)) throw new Error(`Invalid ${name}: expected ten years`);
      const result = values === undefined ? Array.from({ length: 10 }, (_, i) => fallback(i)) : Array.from(values);
      result.forEach(x => valid(x, name, condition));
      return result;
    };
    const growthRates = series(assumption.growthRates, "annual EPS growth", i => i < stageYears ? early : late, x => x > -1 && x <= 1);
    const payoutRates = series(assumption.payoutRates, "annual payout", () => payout, x => x >= 0 && x <= 1);
    let previousEps = eps;
    const rows = [];
    for (let year = 1; year <= 10; year += 1) {
      const growth = growthRates[year - 1], payoutRate = payoutRates[year - 1];
      const currentEps = previousEps * (1 + growth);
      const dividend = year === 1 && firstDividend !== undefined ? firstDividend : year === 1 && assumption.firstDividendParts ? firstYearDividend(previousEps * payoutRate, assumption.firstDividendParts, assumption.priceDate) : previousEps * payoutRate;
      const sale = year === 10 ? currentEps * exitPE : 0;
      rows.push({ year, growth, payoutRate, eps: currentEps, dividend, sale, cashFlow: dividend + sale });
      previousEps = currentEps;
    }
    const flows = rows.map(row => row.cashFlow);
    const rate = irr(price, flows);
    return { ...assumption, growthRates, payoutRates, irr: rate, surplus: rate - requiredReturn, fairPrice: pv(flows, requiredReturn), rows };
  }
  // 近期逐年预测后收敛；目标和年限由有依据的研究决定。
  function fadeGrowth(nearTerm, target, endYear = 7) {
    if (!Array.isArray(nearTerm) || !nearTerm.length || nearTerm.length >= 10) throw new Error("Invalid near-term growth");
    nearTerm.forEach(g => valid(g, "near-term growth", x => x > -1 && x <= 1));
    valid(target, "mature growth", x => x > -1 && x <= 1);
    valid(endYear, "fade end year", x => Number.isInteger(x) && x > nearTerm.length && x <= 10);
    const start = nearTerm[nearTerm.length - 1];
    return Array.from({ length: 10 }, (_, i) => i < nearTerm.length ? nearTerm[i] : start + (target - start) * Math.min(1, (i + 1 - nearTerm.length) / (endYear - nearTerm.length)));
  }
  function sensitivity(stock) {
    const a = { ...stock.model.assumptions[1], priceDate: stock.priceDate }, h = stock.model.requiredReturn;
    const base = scenario(stock.price, h, a);
    const test = patch => scenario(stock.price, h, { ...a, ...patch }).irr;
    const shiftLate = delta => base.growthRates.map((g, i) => i < (a.stageYears ?? 3) ? g : Math.max(-0.99, Math.min(1, g + delta)));
    const metrics = [
      { label: "起始 EPS", change: "−20% / +20%", low: test({ eps: a.eps * 0.8 }), high: test({ eps: a.eps * 1.2 }) },
      { label: `第${(a.stageYears ?? 3) + 1}—10年 EPS 增速`, change: "−2 / +2个百分点", low: test({ growthRates: shiftLate(-0.02) }), high: test({ growthRates: shiftLate(0.02) }) },
      { label: "退出 PE", change: "−20% / +20%", low: test({ exitPE: a.exitPE * 0.8 }), high: test({ exitPE: a.exitPE * 1.2 }) }
    ];
    const terminalPV = base.rows[9].sale / (1 + h) ** 10;
    return { metrics, terminalShare: terminalPV / base.fairPrice, epsMultiple: base.rows[9].eps / a.eps,
      hurdle: [-0.01, 0, 0.01].map(delta => ({ rate: h + delta, fairPrice: pv(base.rows.map(r => r.cashFlow), h + delta), surplus: base.irr - h - delta })) };
  }
  function evaluate(stock) {
    if (!stock?.model || stock.model.version !== "shareholder-irr-v1" || !Array.isArray(stock.model.assumptions) || stock.model.assumptions.length !== 3) throw new Error("Unsupported shareholder model");
    if (stock.model.assumptions.some((a, i) => a?.name !== ["悲观", "基准", "乐观"][i])) throw new Error("Invalid scenario labels/order");
    const scenarios = stock.model.assumptions.map(a => scenario(stock.price, stock.model.requiredReturn, { ...a, priceDate: stock.priceDate }));
    if (scenarios[0].irr > scenarios[1].irr || scenarios[1].irr > scenarios[2].irr) throw new Error("Scenario order needs review");
    return { scenarios, base: scenarios[1] };
  }
  // 已知股息替代同一年度预测的一部分；除息后买入没有该笔领取权。
  function firstYearDividend(predicted, parts, priceDate) {
    if (!parts || !/^\d{4}-\d{2}-\d{2}$/.test(priceDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(parts.exDate || "") || !parts.source) throw new Error("Invalid first-dividend evidence");
    valid(parts.known, "known dividend", x => x >= 0);
    valid(parts.replacedFraction, "replaced dividend fraction", x => x >= 0 && x <= 1);
    return predicted * (1 - parts.replacedFraction) + (priceDate < parts.exDate ? parts.known : 0);
  }
  function eligibility(stock, evaluation) {
    if (!evaluation) return { eligible: false, reason: "计算未通过核验" };
    const decision = stock.model?.rankingDecision;
    if (!decision || !["部分核验", "关键假设通过"].includes(decision.evidenceStatus) || decision.eligible !== true || stock.model.rankingEligible === false) return { eligible: false, reason: decision?.reason || stock.model?.rankingReason || "排名证据尚未审核" };
    if (!decision.reviewedAt || !decision.reason) return { eligible: false, reason: "排名审核记录不完整" };
    return { eligible: true, reason: decision.reason };
  }
  function ranked(stocks, mode = "surplus") {
    return stocks.map(stock => {
      try { const evaluation = evaluate(stock); return { stock, evaluation }; }
      catch { return { stock, evaluation: null }; }
    }).filter(r => eligibility(r.stock, r.evaluation).eligible).sort((a, b) => mode === "irr" ? b.evaluation.base.irr - a.evaluation.base.irr : b.evaluation.base.surplus - a.evaluation.base.surplus || b.evaluation.scenarios[0].irr - a.evaluation.scenarios[0].irr);
  }
  const api = { pv, irr, scenario, evaluate, fadeGrowth, sensitivity, firstYearDividend, eligibility, ranked };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ShareholderModel = api;
})(typeof window !== "undefined" ? window : globalThis);
