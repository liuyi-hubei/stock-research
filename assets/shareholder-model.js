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
    for (const g of [early, late]) valid(g, "growth", x => x > -1 && x <= 1);
    valid(payout, "payout", x => x >= 0 && x <= 1);
    valid(exitPE, "exit PE", x => x > 0);
    valid(requiredReturn, "required return", x => x > 0 && x < 1);
    if (firstDividend !== undefined) valid(firstDividend, "first dividend", x => x >= 0);
    let previousEps = eps;
    const rows = [];
    for (let year = 1; year <= 10; year += 1) {
      const currentEps = previousEps * (1 + (year <= 3 ? early : late));
      const dividend = year === 1 && firstDividend !== undefined ? firstDividend : previousEps * payout;
      const sale = year === 10 ? currentEps * exitPE : 0;
      rows.push({ year, eps: currentEps, dividend, sale, cashFlow: dividend + sale });
      previousEps = currentEps;
    }
    const flows = rows.map(row => row.cashFlow);
    const rate = irr(price, flows);
    return { ...assumption, irr: rate, surplus: rate - requiredReturn, fairPrice: pv(flows, requiredReturn), rows };
  }
  function evaluate(stock) {
    if (stock.model.version !== "shareholder-irr-v1" || stock.model.assumptions.length !== 3) throw new Error("Unsupported shareholder model");
    const scenarios = stock.model.assumptions.map(a => scenario(stock.price, stock.model.requiredReturn, a));
    if (scenarios[0].irr > scenarios[1].irr || scenarios[1].irr > scenarios[2].irr) throw new Error("Scenario order needs review");
    return { scenarios, base: scenarios[1] };
  }
  const api = { pv, irr, scenario, evaluate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ShareholderModel = api;
})(typeof window !== "undefined" ? window : globalThis);
