// 2026-09-30逐股补证记录的一致性检查；不推断财务事实或保证预测。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window:{} });
for (const file of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
}
const codes = ['000568','600519','000333','09992','000858','600900','600863','600036','601318','600750','000651','600660','601298','00902','01030','01378','09961','01810','002594','002304','09988','600873','01179','300059','601919'];
const { STOCK_RESEARCH:db, ShareholderModel:model } = context.window;
for (const code of codes) {
  const stock = db.stocks.find(s=>s.code===code);
  assert(stock,`Missing audited stock: ${code}`);
  const review = stock.model.parameterReview, decision = stock.model.rankingDecision;
  assert(review.capitalCheck.length > 80,`Missing individual cash evidence: ${code}`);
  assert(review.references.some(r=>r.locator && r.url.startsWith('https://')),`Missing source locator: ${code}`);
  assert.equal(decision.eligible,stock.model.rankingEligible,`Eligibility mismatch: ${code}`);
  assert.equal(decision.reason,stock.model.rankingReason,`Reason mismatch: ${code}`);
  assert.equal(decision.evidenceStatus,'部分核验',`Must not claim full validation: ${code}`);
  assert.equal(model.eligibility(stock,model.evaluate(stock)).eligible,decision.eligible,`Engine mismatch: ${code}`);
}
const ranked=db.stocks.filter(s=>model.eligibility(s,model.evaluate(s)).eligible);
const continued=db.stocks.filter(s=>s.model.rankAssessment);
for(const stock of continued){
  const a=stock.model.rankAssessment;
  assert(a.completed && a.analysis.length>80 && a.conditions.length>80,`${stock.code}: incomplete individual follow-up`);
  assert(['中等','有限','不足'].includes(a.confidence),`${stock.code}: missing confidence`);
  assert.equal(a.confidence,stock.model.rankingDecision.confidence);
}
assert(db.stocks.find(s=>s.code==='01810').model.assumptions.every(a=>a.payoutRates.length===10 && a.payoutRates.every(p=>p===0)),'Zero-dividend path must not assume restoration');
assert.equal(db.stocks.find(s=>s.code==='01030').model.rankingEligible,false);
assert.equal(db.stocks.find(s=>s.code==='600036').model.assumptions[1].payout,.35);
assert.equal(db.stocks.find(s=>s.code==='300059').model.assumptions[1].payout,.10);
console.log(`PASS: ${codes.length} individual cash reviews; pool ${db.stocks.length}; ranked ${ranked.length}; pending ${db.stocks.length-ranked.length}; Top 10 ${Math.min(10,ranked.length)}.`);
