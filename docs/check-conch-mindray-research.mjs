import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const c=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','assets/research-freshness.js','data/stocks.js','data/additional-stocks.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const db=c.window.STOCK_RESEARCH, engine=c.window.ShareholderModel;
for(const code of ['600585','300760']){
 const matches=db.stocks.filter(s=>s.code===code);
 assert.equal(matches.length,1,code+' must not be registered twice');
 const s=matches[0];
 assert(s.market.includes('A股') && s.model.currency==='元');
 assert.equal(s.masterViews.length,5);
 assert.equal(new Set(s.masterViews.map(v=>v.text)).size,5);
 assert(s.model.parameterReview.references.length>=3);
 const actualEnd=c.window.ResearchFreshness.financialEnd(s.model.financialPeriod);
 assert(actualEnd && actualEnd<=s.researchDate,code+' actual financial date cannot be a future appointment');
 assert(s.model.rankAssessment.completed && s.model.rankingDecision.reviewedAt);
 const result=engine.evaluate(s);
 for(let i=0;i<3;i++){
  const a=s.model.assumptions[i],v=result.scenarios[i];
  assert.equal(a.growthRates.length,10); assert.equal(a.payoutRates.length,10);
  assert(Number.isFinite(v.irr));
  const predicted=a.eps*a.payoutRates[0];
  if(a.firstDividendParts){
   assert(s.priceDate>=a.firstDividendParts.exDate);
   assert(Math.abs(v.rows[0].dividend-predicted*(1-a.firstDividendParts.replacedFraction))<1e-10,'Expired dividend must not be added');
  }else if(a.firstDividend!==undefined){
   assert.equal(v.rows[0].dividend,a.firstDividend);
   assert(a.firstDividendNote?.includes('预测'),'Budget remainder is not an announced dividend');
  }
  assert.equal(v.rows.length,10);
  assert(Math.abs(v.rows[9].sale-v.rows[9].eps*a.exitPE)<1e-10);
 }
 for(const suffix of ['','-数据核验'])assert(fs.existsSync(path.join(root,`reports/stocks/${s.name}-${code}${suffix}.md`)));
}
console.log('PASS: Conch/Mindray unique A-share reports, actual dates, explicit assumptions, dividend rights and common engine. Financial facts still require source review.');
