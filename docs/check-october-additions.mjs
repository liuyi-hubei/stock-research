// 数据结构回归不替代原始财报核验。
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const c=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const views=[];
for(const [code,shares,profit,hurdle] of [['600886',80.04494262,70,.095],['000538',17.84262603,55,.10],['603288',58.43973444,75,.09]]){
 const matches=c.window.STOCK_RESEARCH.stocks.filter(s=>s.code===code);
 assert.equal(matches.length,1);
 const s=matches[0];
 assert.equal(s.priceDate,'2026-09-30');
 assert.equal(s.researchDate,'2026-10-01');
 assert.equal(s.model.requiredReturn,hurdle);
 assert(Math.abs(s.model.assumptions[1].eps-profit/shares)<1e-10);
 assert.equal(s.masterViews.length,5);
 views.push(...s.masterViews.map(v=>v.text));
 for(const a of s.model.assumptions){
  assert.equal(a.growthRates.length,10);
  assert.equal(a.payoutRates.length,10);
  assert(a.payoutRates.every(p=>p>=0&&p<=1));
  assert(a.growthRates[9]<=.03);
  assert(!a.firstDividendParts);
 }
 assert(Number.isFinite(c.window.ShareholderModel.evaluate(s).base.irr));
 for(const suffix of ['','-数据核验']) assert(fs.existsSync(path.join(root,`reports/stocks/${s.name}-${code}${suffix}.md`)));
}
assert.equal(new Set(views).size,15);
const oil=c.window.STOCK_RESEARCH.stocks.filter(s=>s.code==='00883');
assert.equal(oil.length,1);
const s=oil[0];
assert.equal(s.market,'港交所 港股');
assert.equal(s.price,23.96);
assert.equal(s.priceDate,'2026-09-30');
assert.equal(s.researchDate,'2026-10-01');
assert.equal(s.model.currency,'港元');
assert.equal(s.model.fx.unitsPerModelCurrency,.85842);
assert(s.model.fx.rateSource.includes('2026-09-30'));
assert.equal(s.model.requiredReturn,.115);
assert(Math.abs(s.model.assumptions[1].eps-1300/475.29953984/.85842)<1e-10);
assert.equal(s.masterViews.length,5);
assert.equal(new Set(s.masterViews.map(v=>v.text)).size,5);
assert(s.masterViews.every(v=>v.text.length>200));
assert(s.model.parameterReview.capitalCheck.includes('848.72'));
assert(s.model.dividendNote.includes('已除息'));
for(const a of s.model.assumptions){
 assert.equal(a.growthRates.length,10);
 assert.equal(a.payoutRates.length,10);
 assert(!a.firstDividend && !a.firstDividendParts);
}
assert(Number.isFinite(c.window.ShareholderModel.evaluate(s).base.irr));
for(const suffix of ['','-数据核验']) assert(fs.existsSync(path.join(root,`reports/stocks/中国海洋石油-00883${suffix}.md`)));
console.log('PASS: three October studies, fifteen distinct views, share bases, normalized EPS, dates and archives.');
console.log('PASS: CNOOC H-share study, five independent views, total shares, HKD conversion, ex-dividend boundary and archives.');
