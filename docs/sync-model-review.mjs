// 同步自动审阅区，保留人工正文；只用本地数据，不更新行情。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { generatedFile } from './generated-file.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scope = vm.createContext({ window: {} });
for (const f of ['assets/shareholder-model.js', 'data/stocks.js', 'data/additional-stocks.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), scope);
const { ShareholderModel: model, STOCK_RESEARCH: db } = scope.window;
const pct = v => `${(v * 100).toFixed(2)}%`;
let count = 0;
for (const file of fs.readdirSync(path.join(root, 'reports/stocks')).filter(f => f.endsWith('.md'))) {
  const stock = db.stocks.find(s => file.includes(`-${s.code}`));
  if (!stock?.model.parameterReview) continue;
  let evaluation;
  try { evaluation = model.evaluate(stock); } catch (error) { throw Error(`${stock.code}: ${error.message}`); }
  const r = stock.model.parameterReview, d = model.sensitivity(stock), b = evaluation.base;
  const pending = !model.eligibility(stock, evaluation).eligible;
  const cash = v => (stock.model.currency === '港元' ? 'HK$' : '¥') + v.toFixed(v < 10 ? 3 : 2);
  const block = ['<!-- MODEL_REVIEW_START -->', '## 参数审阅与敏感性（自动同步）',
    `方法审阅：${r.reviewedAt}；行情日：${stock.priceDate}；财报期：${stock.model.financialPeriod}。本节不代表重新核验了财务来源。`,
    pending ? `> 暂停排名：${stock.model.rankingReason} 本报告IRR及参考价为所列假设的条件演算，不能作为已验证预测。` : `状态：${r.status}。`,
    `当前参数${pending ? '条件演算' : '基准情景'}：IRR ${pct(b.irr)}；达标参考价 ${cash(b.fairPrice)}。`,
    `排名审核：${stock.model.rankingDecision.evidenceStatus}（${stock.model.rankingDecision.reviewedAt}）。${stock.model.rankingDecision.reason}`,
    `第十年基准卖出所得：${cash(b.rows[9].sale)}；由第十年EPS与退出PE生成。`,
    `- 经营路径：${r.operatingCheck}\n- 资金约束：${r.capitalCheck}\n- 每股口径：${r.shareCheck}\n- 退出估值：${r.exitCheck}`,
    (r.references || []).map(ref => `- [${ref.label}](${ref.url})（${ref.date}）：${ref.locator}；${ref.status}`).join('\n'),
    `十年后EPS为起点的${d.epsMultiple.toFixed(2)}倍；卖出所得现值占模型总现值的${pct(d.terminalShare)}，按研究回报要求折现。`,
    '| 单项变化 | 扰动 | 下调后IRR | 原基准IRR | 上调后IRR |\n| --- | --- | --- | --- | --- |\n' + d.metrics.map(m => `| ${m.label} | ${m.change} | ${pct(m.low)} | ${pct(b.irr)} | ${pct(m.high)} |`).join('\n'),
    '| 回报门槛 | 达标参考价 | IRR与门槛差额 |\n| --- | --- | --- |\n' + d.hurdle.map(h => `| ${pct(h.rate)} | ${cash(h.fairPrice)} | ${(h.surplus * 100).toFixed(2)}个百分点 |`).join('\n'),
    '以上逐项扰动保持其他条件不变，属于敏感性演算，不代表概率区间；改变回报门槛不会改变同一组现金流的IRR。', '<!-- MODEL_REVIEW_END -->'].join('\n\n');
  const target = path.join(root, 'reports/stocks', file), original = fs.readFileSync(target, 'utf8');
  const pattern = /<!-- MODEL_REVIEW_START -->[\s\S]*?<!-- MODEL_REVIEW_END -->/;
  const updated = pattern.test(original) ? original.replace(pattern, block) : `${original.trimEnd()}\n\n${block}\n`;
  if (generatedFile(target, updated)) count++;
}
console.log(process.argv.includes('--check') ? `${process.exitCode ? 'OUT OF DATE' : 'PASS'}: ${count} archive review differences; read-only.` : `Synced model review in ${count} archives.`);
