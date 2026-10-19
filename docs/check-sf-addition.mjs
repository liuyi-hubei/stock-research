import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const c=vm.createContext({window:{}});
for(const file of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
const matches=c.window.STOCK_RESEARCH.stocks.filter(s=>s.code==='002352');
assert.equal(matches.length,1);
const s=matches[0],m=s.model,result=c.window.ShareholderModel.evaluate(s);
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
assert(s.market.includes('A股') && m.currency==='元');
assert.equal(m.financialAsOf,'2026-06-30');
assert(s.priceDate<=s.researchDate && m.reviewedAt===s.researchDate);
assert.equal(s.masterViews.length,5);
assert.equal(new Set(s.masterViews.map(v=>v.text)).size,5);
assert(m.parameterReview.references.length>=6);
assert(m.rankingDecision.reviewedAt && m.rankAssessment.completed);
for(const a of m.assumptions){
 assert.equal(a.growthRates.length,10);assert.equal(a.payoutRates.length,10);
 // 独立验证股本与已除息处理，收益不写死；后来更新日期/权利时须同步重审此夹具。
 const profit=Number.parseFloat(a.profit);
 near(a.eps,profit/(5105148078/1e8));
 near(a.firstDividend,Math.max(0,a.eps*a.payoutRates[0]-.49));
 assert(a.firstDividendNote.includes('预测') && a.firstDividendNote.includes('替代'));
}
for(const v of result.scenarios){
 assert(Number.isFinite(v.irr));assert.equal(v.rows.length,10);
 near(v.rows[0].dividend,v.firstDividend);
 near(v.rows[9].sale,v.rows[9].eps*v.exitPE);
 near(v.rows[9].cashFlow,v.rows[9].sale+v.rows[9].dividend);
}
near(c.window.ShareholderModel.pv(result.base.rows.map(r=>r.cashFlow),result.base.irr),s.price);
for(const suffix of ['','-数据核验'])assert(fs.existsSync(path.join(root,`reports/stocks/${s.name}-${s.code}${suffix}.md`)));
for(const f of ['index.html','stock.html','reports.html','industry.html'])assert(fs.readFileSync(path.join(root,f),'utf8').includes('additional-stocks.js?v=20261019-sf-1'));
console.log('PASS: SF unique A-share/CNY, actual dates, total share basis, expired dividend exclusion, five views and common IRR engine. This is not financial fact certification.');
