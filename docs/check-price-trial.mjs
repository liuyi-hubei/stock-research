import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { evaluate, eligibility, isPending, sensitivity } = createRequire(import.meta.url)('../assets/shareholder-model.js');
globalThis.window = {};
await import('../data/stocks.js');
await import('../data/additional-stocks.js');
const stocks = window.STOCK_RESEARCH.stocks;
for (const stock of stocks) {
  const original = JSON.stringify(stock);
  const baseline = evaluate(stock);
  if (isPending(stock)) {
    assert.equal(baseline,null);
    for (const price of [stock.price*.8,stock.price*1.2,0,-1,NaN,Infinity]) {
      const trialStock={...stock,price};
      assert.equal(evaluate(trialStock),null,`${stock.code}: pending must not run trials`);
      assert.equal(sensitivity(trialStock),null);
      assert.equal(eligibility(trialStock).eligible,false);
    }
    assert.equal(JSON.stringify(stock),original,`${stock.code}: pending source mutated`);
    continue;
  }
  for (const factor of [.8, 1.2]) {
    const trial = evaluate({ ...stock, price: stock.price * factor });
    trial.scenarios.forEach((s, i) => {
      const old = baseline.scenarios[i];
      assert.equal(s.fairPrice, old.fairPrice, `${stock.code}: reference changed`);
      assert.deepEqual(s.rows, old.rows, `${stock.code}: cash flows changed`);
      assert(factor < 1 ? s.irr > old.irr : s.irr < old.irr, `${stock.code}: price monotonicity`);
    });
    assert.equal(eligibility(stock, trial).eligible, eligibility(stock, baseline).eligible);
  }
  for (const price of [0, -1, NaN, Infinity]) assert.throws(() => evaluate({ ...stock, price }));
  assert.equal(JSON.stringify(stock), original, `${stock.code}: source mutated`);
}
console.log(`PASS price-only trials: ${stocks.filter(s=>!isPending(s)).length} active; ${stocks.filter(isPending).length} pending skip calculation explicitly; sources unchanged`);
