// 核对当前报告正文中的明确模型数字；自动审阅区由sync --check另行验证。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),scope);
// 匹配结果标签与紧邻数值，不能把“暂不提供IRR”或来源日期/页码当成计算结果。
const pendingResults = text => [
  /IRR\s*(?:为|[：:=])?\s*[+−-]?\d+(?:\.\d+)?\s*[%％]/i,
  /(?:达标|条件)?参考(?:买入)?价\s*(?:为|[：:=])?\s*(?:¥|￥|HK\$)?\s*[+−-]?\d+(?:\.\d+)?/i,
  /第十年基准卖出所得\s*[：:=]?\s*(?:¥|￥|HK\$)?\s*\d/,
  /十年后EPS为起点的\s*\d/i,
  /^\|[^\n]*(?:下调后IRR|上调后IRR|原基准IRR|起始\s*EPS|回报门槛[^\n]*达标参考价)[^\n]*\|/im
].some(pattern=>pattern.test(text));
assert(!pendingResults('暂不提供IRR、敏感性或参考买入价。PDF第9、64—73、151—155页；2026-08-29；元÷1亿。'));
for(const stale of ['IRR 8.24%','基准IRR：−2.50%','达标参考价 ¥12.30','参考买入价为 HK$10.00','第十年基准卖出所得：¥50','十年后EPS为起点的2.50倍','| 单项变化 | 下调后IRR | 原基准IRR | 上调后IRR |'])assert(pendingResults(stale),`Pending guard missed: ${stale}`);
let checked=0;
for(const stock of scope.window.STOCK_RESEARCH.stocks){
  const result=scope.window.ShareholderModel.evaluate(stock);
  assert(fs.existsSync(path.join(root,`reports/stocks/${stock.name}-${stock.code}.md`)),`${stock.code}: missing primary report`);
  for(const file of fs.readdirSync(path.join(root,'reports/stocks')).filter(f=>f.includes(`-${stock.code}`)&&f.endsWith('.md'))){
    const original=fs.readFileSync(path.join(root,'reports/stocks',file),'utf8');
    const text=original.replace(/<!-- MODEL_REVIEW_START -->[\s\S]*?<!-- MODEL_REVIEW_END -->/g,'');
    if(scope.window.ShareholderModel.isPending(stock)){
      assert.equal(result,null,`${stock.code}: pending evaluation must be null`);
      assert(/待重新评估/.test(text),`${file}: missing explicit pending state`);
      assert(/参考买入价[：:\s]*暂不提供/.test(text),`${file}: missing unavailable reference price`);
      const review=original.match(/<!-- MODEL_REVIEW_START -->[\s\S]*?<!-- MODEL_REVIEW_END -->/)?.[0];
      if(review){
        assert(/待重新评估/.test(review) && /参考买入价[：:\s]*暂不提供/.test(review),`${file}: stale review state`);
        assert(!pendingResults(review),`${file}: pending review contains calculated results`);
      }
      assert(!pendingResults(text),`${file}: pending report contains stale model conclusion`);
      continue;
    }
    const tests=[[/基准\s*IRR\s*为\s*([+-]?\d+(?:\.\d+)?)%/g,result.base.irr*100],[/达标参考买入价为\s*(?:¥|HK\$)?\s*([\d.]+)/g,result.base.fairPrice]];
    for(const [pattern,expected] of tests)for(const match of text.matchAll(pattern)){
      const decimals=match[1].split('.')[1]?.length || 0;
      assert(Math.abs(Number(match[1])-expected)<=.5*10**(-decimals)+1e-8,`${file}: ${match[0]} conflicts with current model ${expected}`); checked++;
    }
  }
}
console.log(`PASS: primary archives exist; ${checked} explicit model values reconciled. Historical facts are not inferred from these tests.`);
