// Export a local snapshot of existing structured research, never fetch new data.
// 归档模板对应 shareholder-irr-v1：只输出股东现金流 IRR 口径，不生成复投/期末持股等旧口径字段。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scope = { window: {} };
vm.createContext(scope);
for (const file of ['assets/shareholder-model.js', 'data/stocks.js', 'data/additional-stocks.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), scope);
}
const { ShareholderModel } = scope.window;
const stocks = scope.window.STOCK_RESEARCH.stocks;
const cell = value => String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const table = (head, rows) => `| ${head.map(cell).join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')}`;
const list = items => items.map(item => `- ${item}`).join('\n');
const pct = value => `${(value * 100).toFixed(2)}%`;
const cur = s => (s.model.currency === '港元' ? 'HK$' : '¥');
const money = (s, value = s.price) => cur(s) + (Math.abs(value) < 10 ? value.toFixed(3) : value.toFixed(2));
const requested = process.argv.slice(2);
if (!requested.length) throw Error('Usage: node docs/export-stock-archive.mjs CODE [CODE...]');
// 默认写入 reports/stocks；ARCHIVE_DIR 只用于试跑校验，不改变正式归档位置。
const outDir = process.env.ARCHIVE_DIR || path.join(root, 'reports/stocks');
fs.mkdirSync(outDir, { recursive: true });
// Validate all targets before writing. Existing hand-maintained reports are kept.
const jobs = requested.map(code => {
  const s = stocks.find(stock => stock.code === code);
  if (!s) throw Error(`Unknown stock ${code}`);
  const target = path.join(outDir, `${s.name}-${s.code}.md`);
  if (fs.existsSync(target)) throw Error(`Archive already exists: ${target}`);
  return { s, target };
});
// 与页面同一计算函数：IRR、差额与达标参考价都由 shareholder-model 求出，不在此重复实现。
const evaluate = s => {
  if (s.model.version !== 'shareholder-irr-v1') throw Error(`${s.code}: not on the shareholder cash-flow IRR caliber`);
  return ShareholderModel.evaluate(s);
};
for (const { s, target } of jobs) {
  const result = evaluate(s);
  const base = result.base;
  const [bear, , bull] = result.scenarios;
  const gap = `${base.surplus >= 0 ? '+' : '−'}${(Math.abs(base.surplus) * 100).toFixed(2)}`;
  const scenarioTable = table(
    ['情景', '起始EPS', '第1—10年EPS增速', '第1—10年分红率', '退出PE', '十年 IRR'],
    result.scenarios.map(v => [v.name, `${v.eps}${s.model.currency}`, v.growthRates.map(pct).join(' / '), v.payoutRates.map(pct).join(' / '), `${v.exitPE}倍`, pct(v.irr)])
  );
  const cashTable = table(
    ['持有年度', '当年EPS', '领取分红', '卖出所得', '净现金流'],
    [['买入', '—', '—', '—', `−${money(s)}`]].concat(
      base.rows.map(r => [`第${r.year}年`, r.eps.toFixed(2), r.dividend.toFixed(2), r.sale ? r.sale.toFixed(2) : '—', r.cashFlow.toFixed(2)])
    )
  );
  const sections = [
    `# ${s.name}（${s.code}）研究归档`,
    s.model.rankingEligible === false ? `> 关键假设待核验：${s.model.rankingReason} 下列IRR及参考价仅为原参数的条件演算。` : '> 收益是研究情景结果；增长、分红和资本约束的证据状态以最新参数审阅为准。',
    `本文件导出自现有网站结构化数据，未进行新一轮研究。行情基准：${s.priceDate}；财报期间：${s.model.financialPeriod}；模型复核日：${s.model.reviewedAt}。`,
    `价格：${money(s)}（${s.market}）；悲观／基准／乐观十年税费前 IRR：${pct(bear.irr)}／${pct(base.irr)}／${pct(bull.irr)}；研究回报要求：${(s.model.requiredReturn * 100).toFixed(1)}%；差额：${gap} 个百分点。`,
    `## 结论\n\n${s.valuation}\n\n${s.thesis}\n\n${s.conclusion}`,
    `## 行业现状\n\n${s.industryStatus.join('\n\n')}`,
    `## 公司现状\n\n${s.companyStatus.join('\n\n')}`,
    `## 关键事实\n\n${table(['指标', '数值', '期间', '口径'], s.facts)}`,
    `## 关键争议\n\n${s.debate.map(d => `### ${d.title}\n\n${d.body}`).join('\n\n')}`,
    `## 利润预测\n\n${s.profitForecast.note}\n\n${table(['情景', '净利润', 'EPS', 'PE', '假设'], s.profitForecast.scenarios.map(v => [v.name, v.profit, v.eps, v.pe, v.reason]))}`,
    `## 十年股东现金流模型\n\n${s.model.method}\n\n${scenarioTable}\n\n${s.model.assumptionNote}\n\n${s.model.requiredReturnReason}\n\n基准 IRR 为 ${pct(base.irr)}，比要求${base.irr >= s.model.requiredReturn ? '高' : '低'} ${(Math.abs(base.surplus) * 100).toFixed(2)} 个百分点；该组基准现金流按 ${(s.model.requiredReturn * 100).toFixed(1)}% 折现的达标参考买入价为 ${money(s, base.fairPrice)}，不是确定目标价。\n\n${cashTable}\n\n${s.model.dividendNote}`,
    `## 分红判断\n\n${s.dividendView}`,
    `## 护城河\n\n${list(s.moat)}`,
    `## 五种研究视角\n\n${s.masterViews.map(v => `### ${v.name}：${v.verdict}\n\n${v.text}`).join('\n\n')}`,
    `## 后续验证\n\n${list(s.questions)}`,
    `## 失效条件\n\n${list(s.risks)}`,
    `## 来源\n\n${s.sources.map(v => `- [${v[0]}](${v[2]})（${v[1]}）`).join('\n')}`,
    '仅为研究记录，不构成投资建议；研究视角不等于相关投资者本人对当前价格的公开评级。'
  ];
  fs.writeFileSync(target, sections.join('\n\n') + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log(`Exported ${s.name} ${s.code}`);
}
