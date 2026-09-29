import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { irr, pv, scenario, evaluate, fadeGrowth, sensitivity } = createRequire(import.meta.url)('../assets/shareholder-model.js');
const near = (actual, expected, tolerance = 1e-10) => assert(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

const couponFlows = Array(9).fill(5).concat(105);
near(irr(100, couponFlows), 0.05);
near(irr(100, Array(9).fill(0).concat(200)), 2 ** (1 / 10) - 1);
assert(irr(100, Array(9).fill(0).concat(80)) < 0);
assert(irr(120, couponFlows) < irr(100, couponFlows));

const base = scenario(100, 0.11, { name: '基准', eps: 5, early: 0.03, late: 0.02, payout: 0.6, exitPE: 15 });
near(irr(base.fairPrice, base.rows.map(row => row.cashFlow)), 0.11);
near(pv(base.rows.map(row => row.cashFlow), base.irr) / 100, 1, 1e-8);
assert.equal(base.rows[0].dividend, 3);
assert.equal(base.rows[9].cashFlow, base.rows[9].dividend + base.rows[9].sale);
assert.throws(() => scenario(100, 0.11, { eps: 0, early: 0, late: 0, payout: 0.5, exitPE: 10 }));
const annual = scenario(100, 0.1, { eps: 10, exitPE: 10, growthRates: Array(10).fill(0), payoutRates: [0, 0, 0, ...Array(7).fill(0.5)] });
assert.deepEqual(annual.rows.map(r => r.dividend), [0, 0, 0, 5, 5, 5, 5, 5, 5, 5]);
near(annual.irr, irr(100, [0, 0, 0, 5, 5, 5, 5, 5, 5, 105]));
const override = scenario(100, 0.1, { eps: 10, exitPE: 10, early: 0, late: 0, payout: 0.5, firstDividend: 2 });
assert.equal(override.rows[0].dividend, 2);
assert.equal(override.rows[1].dividend, 5);
const fade = fadeGrowth([0.1, 0.08, 0.06], 0.02, 7);
near(fade[3], 0.05); near(fade[6], 0.02); near(fade[9], 0.02);
assert.throws(() => scenario(100, 0.1, { eps: 10, exitPE: 10, growthRates: [0], payoutRates: Array(10).fill(0) }));
assert.throws(() => scenario(100, 0.1, { eps: 10, exitPE: 10, growthRates: Array(10).fill(0), payoutRates: Array(10).fill(1.1) }));

globalThis.window = {};
await import('../data/stocks.js');
await import('../data/additional-stocks.js');
const stocks = window.STOCK_RESEARCH.stocks;
assert(stocks.length > 1, 'Expected the full research pool');
for (const stock of stocks) {
  assert(stock.model.version === 'shareholder-irr-v1', `${stock.code}: not on the unified IRR caliber`);
  const evaluation = evaluate(stock);
  const [bear, base, bull] = evaluation.scenarios;
  assert(bear.irr <= base.irr && base.irr <= bull.irr, `${stock.code}: scenario order needs review`);
  near(pv(base.rows.map(row => row.cashFlow), base.irr) / stock.price, 1, 1e-8);
  for (const item of evaluation.scenarios) {
    assert(Number.isFinite(item.irr) && item.irr > -1, `${stock.code}: invalid IRR`);
    assert(Number.isFinite(item.fairPrice) && item.fairPrice >= 0, `${stock.code}: invalid reference price`);
  }
}
const stock = stocks.find(item => item.code === '000568');
const result = evaluate(stock);
near(result.base.irr, 0.08291604324606527);
near(result.base.fairPrice, 57.84628269165934);
const stress = sensitivity(stock);
assert(stress.metrics.every(m => m.low < result.base.irr && m.high > result.base.irr));
assert(stress.hurdle[0].fairPrice > stress.hurdle[1].fairPrice && stress.hurdle[1].fairPrice > stress.hurdle[2].fairPrice);
assert(stress.terminalShare > 0 && stress.terminalShare < 1);
assert.equal(stocks.find(s => s.code === '01030').model.rankingEligible, false);

// 币种口径：模型币种为港元时，价格、EPS、分红与终值都必须是港元，
// 而经营报表可能是人民币或美元。每只港股模型都要声明换算关系，
// 并校验「模型 EPS × 汇率 ≈ 报表口径 EPS」，防止再把报表币种的每股盈利当作港元使用。
// 港股只数不写死：增删港股只改 data/*.js。漏写 model.fx 的港股模型会在
// data/additional-stocks.js 加载阶段直接抛错，这里只保证校验循环确实跑到了标的。
const hkdStocks = stocks.filter(item => item.model.currency === '港元');
assert(hkdStocks.length > 0, '港股模型数量异常：0');
for (const item of hkdStocks) {
  const fx = item.model.fx;
  assert(fx && fx.reportCurrency && Number.isFinite(fx.unitsPerModelCurrency), `${item.code}: 港股模型缺少币种声明`);
  assert(Number.isFinite(fx.baseEpsInReportCurrency), `${item.code}: 缺少报表口径基准 EPS`);
  assert(fx.rateSource, `${item.code}: 缺少汇率来源说明`);
  const reporting = item.model.assumptions[1].eps * fx.unitsPerModelCurrency;
  const drift = Math.abs(reporting - fx.baseEpsInReportCurrency);
  const tolerance = Math.max(0.01, fx.baseEpsInReportCurrency * 0.005);
  assert(drift < tolerance, `${item.code}: 港元 EPS ${item.model.assumptions[1].eps} × ${fx.unitsPerModelCurrency} = ${reporting.toFixed(4)}，与报表口径 ${fx.baseEpsInReportCurrency} 相差 ${drift.toFixed(4)}，疑似把${fx.reportCurrency}每股盈利当作港元使用`);
}
console.log(`PASS: shareholder cash-flow IRR across ${stocks.length} stocks, plus discounting, validation, and Luzhou Laojiao assumptions.`);
console.log(`PASS: ${hkdStocks.length} HKD models declare a reporting-currency conversion and reconcile with it.`);
