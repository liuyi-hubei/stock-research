import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { irr, pv, scenario, evaluate } = createRequire(import.meta.url)('../assets/shareholder-model.js');
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
console.log(`PASS: shareholder cash-flow IRR across ${stocks.length} stocks, plus discounting, validation, and Luzhou Laojiao assumptions.`);
