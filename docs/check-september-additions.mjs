// 本批次新增研究的回归测试：校验结构与计算一致性，不代替事实核验。
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
const { STOCK_RESEARCH:db, ShareholderModel:model } = context.window;
const targets = [
  ['605499',7.3419931,50,.105],
  ['601058',32.88100259,40,.12],
  ['600690',93.03,190,.095],
  ['600887',63.25,105,.10]
];
const allViews = [];
for (const [code,shares,profit,hurdle] of targets) {
  const matches = db.stocks.filter(s=>s.code === code);
  assert.equal(matches.length,1,`${code}: duplicate or missing stock`);
  const s = matches[0];
  assert.equal(s.priceDate,'2026-09-30');
  assert.equal(s.model.financialPeriod,'2026H1');
  assert.equal(s.model.requiredReturn,hurdle);
  assert(Math.abs(s.model.assumptions[1].eps-profit/shares)<1e-10,`${code}: share denominator`);
  assert.equal(s.masterViews.length,5);
  assert(s.masterViews.every(v=>v.text.length>100));
  allViews.push(...s.masterViews.map(v=>v.text));
  for (const a of s.model.assumptions) {
    assert.equal(a.growthRates.length,10);
    assert.equal(a.payoutRates.length,10);
    assert(a.payoutRates.every(p=>p>=0 && p<=1));
    assert(a.growthRates[9]<=.03);
    assert(!a.firstDividendParts,'Historical ex-dividend payments must not be added');
  }
  assert(Number.isFinite(model.evaluate(s).base.irr));
  assert(s.model.parameterReview.references.some(r=>r.locator && r.url.startsWith('https://')));
  assert.equal(s.model.rankingDecision.confidence,s.model.rankAssessment.confidence);
  for (const suffix of ['', '-数据核验']) {
    assert(fs.existsSync(path.join(root,`reports/stocks/${s.name}-${code}${suffix}.md`)));
  }
}
assert.equal(new Set(allViews).size,20,'Independent investor/stock analyses');
assert.equal(new Set(targets.map(t=>t[3])).size,4,'Risk hurdles must differ');
console.log('PASS: four new studies, 20 distinct views, share denominators, annual paths, local archives and declared evidence. Financial truth is reviewed separately.');
