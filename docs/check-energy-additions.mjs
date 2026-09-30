// 结构回归不替代原始财报事实核验。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({window:{}});
for (const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const views=[];
for (const [code,shares,profit,hurdle] of [['001286',37.5,28,.105],['000933',22.49004399,65,.125]]) {
  const matches=ctx.window.STOCK_RESEARCH.stocks.filter(s=>s.code===code);
  assert.equal(matches.length,1);
  const s=matches[0];
  assert.equal(s.priceDate,'2026-09-30');
  assert.equal(s.researchDate,'2026-10-01');
  assert.equal(s.market,'深交所 A股');
  assert.equal(s.model.financialPeriod,'2026H1');
  assert.equal(s.model.requiredReturn,hurdle);
  assert(Math.abs(s.model.assumptions[1].eps-profit/shares)<1e-10);
  assert.equal(s.masterViews.length,5);
  views.push(...s.masterViews.map(v=>v.text));
  assert(s.masterViews.every(v=>v.text.length>100));
  for(const a of s.model.assumptions){
    assert.equal(a.growthRates.length,10);
    assert.equal(a.payoutRates.length,10);
    assert(a.payoutRates.every(p=>p>=0&&p<=1));
    assert(a.growthRates[9]<=.03);
    assert(!a.firstDividendParts);
  }
  assert(Number.isFinite(ctx.window.ShareholderModel.evaluate(s).base.irr));
  assert.equal(s.model.rankingDecision.confidence,s.model.rankAssessment.confidence);
  assert(s.model.parameterReview.references.some(r=>r.locator&&r.url.startsWith('https://')));
  for(const suffix of ['', '-数据核验']) assert(fs.existsSync(path.join(root,`reports/stocks/${s.name}-${code}${suffix}.md`)));
}
assert.equal(new Set(views).size,10);
console.log('PASS: two energy studies, ten independent views, normalized profit/share bases, annual paths, dates and archives.');
