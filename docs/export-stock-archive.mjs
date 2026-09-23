// Export a local snapshot of existing structured research, never fetch new data.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scope = { window: {} };
vm.createContext(scope);
for (const file of ['data/stocks.js', 'data/additional-stocks.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), scope);
const cell = value => String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const table = (head, rows) => `| ${head.map(cell).join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')}`;
const list = items => items.map(item => `- ${item}`).join('\n');
const requested = process.argv.slice(2);
if (!requested.length) throw Error('Usage: node docs/export-stock-archive.mjs CODE [CODE...]');
// Validate all targets before writing. Existing hand-maintained reports are kept.
const jobs = requested.map(code => {
  const s = scope.window.STOCK_RESEARCH.stocks.find(stock => stock.code === code);
  if (!s) throw Error(`Unknown stock ${code}`);
  const target = path.join(root, 'reports/stocks', `${s.name}-${s.code}.md`);
  if (fs.existsSync(target)) throw Error(`Archive already exists: ${target}`);
  return { s, target };
});
for (const { s, target } of jobs) {
  const sections = [
    `# ${s.name}（${s.code}）研究归档`,
    `本文件导出自现有网站结构化数据，未进行新一轮研究。行情基准：${s.priceDate}；财报期间以事实表为准。`,
    `价格：${s.price}（${s.market}）；基准十年年化：${s.baseReturn}；研究置信度：${s.confidence}。`,
    `## 结论\n\n${s.valuation}\n\n${s.thesis}\n\n${s.conclusion}`,
    `## 行业现状\n\n${s.industryStatus.join('\n\n')}`,
    `## 公司现状\n\n${s.companyStatus.join('\n\n')}`,
    `## 关键事实\n\n${table(['指标','数值','期间','口径'], s.facts)}`,
    `## 关键争议\n\n${s.debate.map(d => `### ${d.title}\n\n${d.body}`).join('\n\n')}`,
    `## 利润预测\n\n${s.profitForecast.note}\n\n${table(['情景','净利润','EPS','PE','假设'],s.profitForecast.scenarios.map(v => [v.name,v.profit,v.eps,v.pe,v.reason]))}`,
    `## 十年模型\n\n${s.model.period}；起始价 ${s.model.price}；折现率 ${s.model.discountRate}。\n\n${s.model.method}\n\n${table(['情景','起始EPS','增长','分红率','退出PE','累计分红（已复投）','期末持股','期末价值','折现值','年化'],s.model.scenarios.map(v => [v.name,v.startEps,v.growth,v.payout,v.exitPE,v.dividends,v.shares,v.terminal,v.pv,v.cagr]))}\n\n${table(['年度','EPS','当年分红','年末持股','年末价值'],s.model.baseRows)}`,
    `## 分红判断\n\n${s.dividendView}`,
    `## 护城河\n\n${list(s.moat)}`,
    `## 五种研究视角\n\n${s.masterViews.map(v => `### ${v.name}：${v.verdict}\n\n${v.text}`).join('\n\n')}`,
    `## 后续验证\n\n${list(s.questions)}`,
    `## 失效条件\n\n${list(s.risks)}`,
    `## 来源\n\n${s.sources.map(v => `- [${v[0]}](${v[2]})（${v[1]}）`).join('\n')}`,
    '仅为研究记录，不构成投资建议；研究视角不等于相关投资者本人对当前价格的公开评级。'
  ];
  fs.writeFileSync(target, sections.join('\n\n') + '\n', { encoding:'utf8', flag:'wx' });
  console.log(`Exported ${s.name} ${s.code}`);
}
