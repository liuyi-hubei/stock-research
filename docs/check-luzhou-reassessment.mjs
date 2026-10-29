import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const c=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','assets/research-freshness.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const matches=c.window.STOCK_RESEARCH.stocks.filter(s=>s.code==='000568');
assert.equal(matches.length,1);
const s=matches[0],m=s.model,r=c.window.ShareholderModel.evaluate(s);
assert.equal(m.parameterReview.reviewedAt,s.researchDate);
assert.equal(m.rankingDecision.reviewedAt,s.researchDate);
assert.equal(c.window.ResearchFreshness.financialEnd(m.financialPeriod),'2026-09-30');
for(let i=0;i<3;i++){
 const a=m.assumptions[i],v=r.scenarios[i];
 assert.equal(a.growthRates.length,10);assert.equal(a.payoutRates.length,10);
 assert.equal(v.rows.length,10);assert(Number.isFinite(v.irr));
 if(i>0){
  assert(Math.abs(a.firstDividend-85/14.71901463)<1e-10);
  assert.equal(v.rows[0].dividend,a.firstDividend);
  assert(!a.firstDividendParts);
  assert(a.firstDividendNote);
 }else assert.equal(a.firstDividend,undefined);
 assert(Math.abs(v.rows[9].sale-v.rows[9].eps*a.exitPE)<1e-10);
}
for(const suffix of ['','-模型核验'])assert(fs.existsSync(path.join(root,`reports/stocks/泸州老窖-000568${suffix}.md`)));
console.log('PASS: Luzhou current review survives legacy patches; exact dividend denominator, replacement rights and common-engine scenarios.');
