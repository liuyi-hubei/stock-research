/* One initial outlay, ten annual shareholder receipts; no reinvestment assumption. */
(function (root) {
  "use strict";
  function valid(value, name, condition) {
    if (!Number.isFinite(value) || !condition(value)) throw new Error(`Invalid ${name}`);
  }
  function pv(flows, rate) {
    valid(rate, "discount rate", x => x > -1);
    return flows.reduce((sum, cash, index) => sum + cash / (1 + rate) ** (index + 1), 0);
  }
  function irr(price, flows) {
    valid(price, "price", x => x > 0);
    if (!flows.length || flows.some(x => !Number.isFinite(x) || x < 0) || !flows.some(x => x > 0)) throw new Error("Invalid cash flows");
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
    const { eps, early, late, payout, exitPE, firstDividend } = assumption;
    valid(eps, "EPS", x => x > 0);
    if (assumption.growthRates === undefined) for (const g of [early, late]) valid(g, "growth", x => x > -1 && x <= 1);
    if (assumption.payoutRates === undefined) valid(payout, "payout", x => x >= 0 && x <= 1);
    valid(exitPE, "exit PE", x => x > 0);
    valid(requiredReturn, "required return", x => x > 0 && x < 1);
    if (firstDividend !== undefined) valid(firstDividend, "first dividend", x => x >= 0);
    const stageYears = assumption.stageYears ?? 3;
    valid(stageYears, "stage years", x => Number.isInteger(x) && x >= 1 && x <= 9);
    const series = (values, name, fallback, condition) => {
      if (values !== undefined && (!Array.isArray(values) || values.length !== 10)) throw new Error(`Invalid ${name}: expected ten years`);
      const result = values === undefined ? Array.from({ length: 10 }, (_, i) => fallback(i)) : values.slice();
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
      const dividend = year === 1 && firstDividend !== undefined ? firstDividend : previousEps * payoutRate;
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
    const a = stock.model.assumptions[1], h = stock.model.requiredReturn;
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
    if (stock.model.version !== "shareholder-irr-v1" || stock.model.assumptions.length !== 3) throw new Error("Unsupported shareholder model");
    const scenarios = stock.model.assumptions.map(a => scenario(stock.price, stock.model.requiredReturn, a));
    if (scenarios[0].irr > scenarios[1].irr || scenarios[1].irr > scenarios[2].irr) throw new Error("Scenario order needs review");
    return { scenarios, base: scenarios[1] };
  }
  const api = { pv, irr, scenario, evaluate, fadeGrowth, sensitivity };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ShareholderModel = api;
})(typeof window !== "undefined" ? window : globalThis);
