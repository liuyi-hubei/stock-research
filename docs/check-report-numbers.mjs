// 核对当前报告正文中的明确模型数字；自动审阅区由sync --check另行验证。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),scope);
let checked=0;
for(const stock of scope.window.STOCK_RESEARCH.stocks){
  const result=scope.window.ShareholderModel.evaluate(stock);
  assert(fs.existsSync(path.join(root,`reports/stocks/${stock.name}-${stock.code}.md`)),`${stock.code}: missing primary report`);
  for(const file of fs.readdirSync(path.join(root,'reports/stocks')).filter(f=>f.includes(`-${stock.code}`)&&f.endsWith('.md'))){
    const text=fs.readFileSync(path.join(root,'reports/stocks',file),'utf8').replace(/<!-- MODEL_REVIEW_START -->[\s\S]*?<!-- MODEL_REVIEW_END -->/g,'');
    const tests=[[/基准\s*IRR\s*为\s*([+-]?\d+(?:\.\d+)?)%/g,result.base.irr*100],[/达标参考买入价为\s*(?:¥|HK\$)?\s*([\d.]+)/g,result.base.fairPrice]];
    for(const [pattern,expected] of tests)for(const match of text.matchAll(pattern)){
      const decimals=match[1].split('.')[1]?.length || 0;
      assert(Math.abs(Number(match[1])-expected)<=.5*10**(-decimals)+1e-8,`${file}: ${match[0]} conflicts with current model ${expected}`); checked++;
    }
  }
}
console.log(`PASS: primary archives exist; ${checked} explicit model values reconciled. Historical facts are not inferred from these tests.`);
