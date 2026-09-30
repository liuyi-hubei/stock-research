// 从 data/*.js 生成 docs/model-explained.md。
// 用法：node docs/gen-model-explained.mjs
// 所有表格与数量都由数据推导，增删标的只需改 data/ 下的文件，然后重跑本脚本。
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatedFile } from './generated-file.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(ROOT + '/assets/shareholder-model.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(ROOT + '/data/stocks.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(ROOT + '/data/additional-stocks.js', 'utf8'), ctx);
const SM = ctx.window.ShareholderModel;
const stocks = ctx.window.STOCK_RESEARCH.stocks;
const hkdStocks = stocks.filter(s => s.model.currency === '港元');

const p1 = v => (v * 100).toFixed(1);
const p2 = v => (v * 100).toFixed(2);
const n2 = v => v.toFixed(2);
const annual = values => values.map(v => p1(v) + '%').join(' / ');
const cur = s => (s.model.currency === '港元' ? 'HK$' : '¥');

const money = s => cur(s) + (Math.abs(s.price) < 10 ? s.price.toFixed(3) : s.price.toFixed(2));

const rows = stocks.map(s => {
  const ev = SM.evaluate(s);
  const a = ev.base;
  let reason = s.requiredReturnReason || '';
  if (!reason) {
    const m = /反映(.+?)[；;]/.exec(s.model.requiredReturnReason || '');
    reason = m ? m[1] : (s.model.requiredReturnReason || '');
  }
  return { s, ev, a, reason: reason.replace(/[；;。]$/, '') };
});

// 最近一次模型复核日：取各标 reviewedAt 的最大值，避免文档里的日期过期。
const reviewedAt = stocks.map(s => s.model.reviewedAt).filter(Boolean).sort().pop() || '未标注';

let out = '';
out += '# 十年股东现金流 IRR：公式与逐股参数来源\n\n';
out += `> 本文件由 \`node docs/gen-model-explained.mjs\` 从 \`data/*.js\` 生成，请勿手工编辑其中的参数表、排名表与数量。增删标的或调整参数后重跑即可。\n\n`;
out += `本文件说明 \`shareholder-irr-v1\` 的计算过程、每个参数的取数位置，以及全研究池 ${stocks.length} 只标的的当前参数快照。\n`;
out += '规范条文见仓库根目录 `AGENTS.md`「十年投资收益模型与页面规范」；计算实现见 `assets/shareholder-model.js`；自动核对脚本 `docs/check-shareholder-model.mjs`。\n';
out += '参数快照生成时间以各标的 `priceDate` / `reviewedAt` 为准，模型审核日 ' + reviewedAt + '。\n\n';
out += '---\n\n';

out += '## 1. 一句话口径\n\n';
out += '按基准价格买入 1 股，之后十年逐年领取现金分红，并在第十年末按预测 EPS 乘退出 PE 卖出，求使这 11 笔现金流现值等于买入价的年化折现率。\n';
out += '不假设分红复投，不计红利税、交易费用、未来回购与稀释。\n\n';

out += '## 2. 公式\n\n';
out += '```text\n';
out += '已知（输入）：\n';
out += '  P0    买入基准价（有明确日期）\n';
out += '  E0    正常化的起始年度预测 EPS（第一年年初水平）\n';
out += '  g(t)  第 t 年的 EPS 增速（逐年数组优先）\n';
out += '  d(t)  第 t 年分红率（逐年数组优先）\n';
out += '  旧数据按 stageYears 展开 early / late / payout\n';
out += '  M     第十年完整股权口径退出 PE\n';
out += '  h     研究者设定的必要回报率（研究门槛，不是模型解出的值）\n\n';
out += '递推（t = 1, 2, …, 10）：\n';
out += '  g(t)  = growthRates[t-1]，或兼容两阶段路径\n';
out += '  E(t)  = E(t-1) × [1 + g(t)]\n';
out += '  D(t)  = E(t-1) × d(t)         分红按【上一年度】EPS 估算\n';
out += '  P10   = E(10) × M             第十年末卖出所得\n';
out += '  CF(t) = D(t)          (t < 10)\n';
out += '  CF(10)= D(10) + P10\n\n';
out += '求解（二分法，迭代 160 次，残差 < 1e-8）：\n';
out += '  P0 = Σ[t=1…10] CF(t) / (1 + r)^t      →  r = 基准 IRR\n\n';
out += '派生：\n';
out += '  相对回报要求差额 = r − h                      单位：个百分点\n';
out += '  达标参考买入价   = Σ[t=1…10] CF(t) / (1 + h)^t  该组现金流下 r = h 的价格\n';
out += '```\n\n';

out += '- 三个情景（悲观 / 基准 / 乐观）各自独立求 IRR，基准是中间那组假设；差额全部以「基准情景」计算。\n';
out += '- `D(10)` 使用 `E(9)` 是派息滞后一年的时序近似；同年盈利与除息后出售价值可以同时存在，不能将这个约定解释为防止重复计算的必要条件。\n';
out += '- 首年分红默认用预测起点 `E0 × d`；已公告且买入后仍享有的派息须核对除息日，并替换同一笔预测金额。\n\n';
out += '- 完整首年覆盖可用 `firstDividend`；单笔部分已知用 `firstDividendParts`，两者互斥。保存已知金额、来源、除息日和被替换预测比例：首年现金 = 原预测 × (1 − 替换比例) + 买入日在除息日前仍享有的已知金额。除息日及之后买入不享有该笔股息，但仍扣除对应预测，防止重复计算。比例是研究近似，须披露依据；实际派息时间仍按年度近似。当前字段不支持多笔已知股息数组，不得擅自叠加。\n\n';

out += '## 3. 七类数字的取数位置\n\n';
out += '| 参数 | 从哪里来 | 典型做法 |\n';
out += '| --- | --- | --- |\n';
out += '| 买入价 P0 | 有明确日期的可核实收盘价 | 只用港股/成交币种价格，不混用 A/H，不把过期行情称为当前价 |\n';
out += '| 起点 EPS E0 | 起始年度正常化归母净利润预测 ÷ 总股本 | 结合最近一期财报与后续经营假设推导，不机械年化半年报 |\n';
out += '| 增速 g1 / g2 | 原报告对该公司经营节奏的判断 | 拆成「前三年修复/增长」和「后七年趋于常态」两段，避免十年单一高增速 |\n';
out += '| 分红率 d | 公司分红规划、历史分红率、现金流覆盖能力 | 规划底线不作永久承诺；需用经营现金流与资本开支交叉检验 |\n';
out += '| 退出 PE M | 第十年的成熟期估值假设 | 三档给出；周期股取低档，消费/平台取中高档 |\n';
out += '| 必要回报率 h | 风险分档（见第 4 节） | 主观投资门槛，按生意可预测性、现金流波动与资产负债表风险分档，不由模型解出 |\n';
out += '| 币种 | 与股价同一币种 | 港股标的须把报表币种利润按固定汇率折成港元再算 EPS，并在 `model.fx` 中声明（见第 8 节） |\n\n';

out += '## 4. 必要回报率 h 的分档依据\n\n';
const requiredReturns = stocks.map(s => s.model.requiredReturn);
out += `\`h\` 不是由 CAPM 或 WACC 算出来的，是按「生意可预测性 + 现金流波动 + 资产负债表风险」主观分档；当前标的取值 ${p1(Math.min(...requiredReturns))}%—${p1(Math.max(...requiredReturns))}%。\n`;
out += '`h` 在数据文件中以 `requiredReturn` 保存，由 `requiredReturnReason` 记录该档理由。档位只为安排研究优先级，不是对生意质量的评分，也不得为提高排名而下调。\n\n';
const bucket = new Map();
for (const r of rows) {
  const k = (r.s.model.requiredReturn * 100).toFixed(1) + '%';
  if (!bucket.has(k)) bucket.set(k, []);
  bucket.get(k).push(r);
}
out += '| h | 该档标的与各自设定理由 |\n';
out += '| --- | --- |\n';
for (const [k, list] of [...bucket.entries()].sort((x, y) => parseFloat(x[0]) - parseFloat(y[0]))) {
  out += '| ' + k + ' | ' + list.map(r => '<b>' + r.s.name + '</b>：' + r.reason).join('<br>') + ' |\n';
}
out += '\n档位越高，表示研究者要求越高的风险补偿。同一档内各标的理由不同，档位只是门槛高低的标识，不是对生意质量的评分。\n\n';

out += '## 5. 参数快照（基准情景）\n\n';
out += '| 标的 | 代码 | 币种 | 基准价 | 起点 EPS | 第1—10年EPS增速 | 第1—10年分红率 | 退出 PE | h |\n';
out += '| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const r of rows) {
  const a = r.a;
  out += '| ' + r.s.name + ' | ' + r.s.code + ' | ' + r.s.model.currency + ' | ' + money(r.s) + ' | ' + a.eps.toFixed(2) + ' | ' + annual(a.growthRates) + ' | ' + annual(a.payoutRates) + ' | ' + a.exitPE + '× | ' + p1(r.s.model.requiredReturn) + '% |\n';
}
out += '\n港股模型的 EPS 一律为港元；报表币种与换算关系见第 8 节。原报告中有个别参数的展示值与存储值存在末位舍入差异，本表直接读取存储值，不从页面文案反推。\n\n';

out += '## 6. 经排名资格审核的计算结果（按基准 IRR − h 降序）\n\n';
out += '| # | 标的 | 悲观 | 基准 IRR | 乐观 | 差额(pp) | 达标参考价 | 基准价 |\n';
out += '| --- | --- | --- | --- | --- | --- | --- | --- |\n';
const sorted = SM.ranked(stocks).map(item => rows.find(r => r.s.code === item.stock.code));
sorted.forEach((r, i) => {
  const bear = r.ev.scenarios[0].irr, bull = r.ev.scenarios[2].irr;
  out += '| ' + (i + 1) + ' | ' + r.s.name + ' | ' + p1(bear) + '% | ' + p2(r.a.irr) + '% | ' + p1(bull) + '% | ' + (r.a.surplus >= 0 ? '+' : '') + p2(r.a.surplus) + ' | ' + cur(r.s) + n2(r.a.fairPrice) + ' | ' + money(r.s) + ' |\n';
});
out += '\n差额 = 基准 IRR − h。达到门槛仅表示条件情景超过主观要求；基准IRR红色用于识别该列，并非买入信号。\n\n';
for (const r of rows.filter(r => !SM.eligibility(r.s, r.ev).eligible)) out += `- 暂停排名：${r.s.name}，${r.s.model.rankingReason}\n`;
out += '\n逐年数组 `growthRates` / `payoutRates` 优先于旧两阶段字段；每个数组必须有10个值。未提供数组时按原参数展开，保持历史假设不被自动改写。`stageYears` 可调整分段年限；`fadeGrowth` 用近期逐年增速、成熟增速与收敛年份生成路径，必须在研究说明中记录依据。\n\n';

out += '## 7. 退出 PE 敏感性\n\n';
out += '以泸州老窖基准情景为例，其他参数不变，只改退出 PE：\n\n';
const lz = stocks.find(s => s.code === '000568');
const mk = pe => SM.scenario(lz.price, lz.model.requiredReturn, Object.assign({}, lz.model.assumptions[1], { exitPE: pe })).irr;
const basePE = lz.model.assumptions[1].exitPE;
const exitPEs = [...new Set([-5, -3, -2, 0, 2, 3, 5].map(delta => basePE + delta).filter(pe => pe > 0))];
out += '| 退出 PE | ' + exitPEs.map(pe => `${pe}×${pe === basePE ? '（基准）' : ''}`).join(' | ') + ' |\n';
out += '| --- | ' + exitPEs.map(() => '---').join(' | ') + ' |\n';
out += '| 基准 IRR | ' + exitPEs.map(pe => p2(mk(pe)) + '%').join(' | ') + ' |\n\n';
const peSensitivity = (mk(basePE + 1) - mk(basePE)) * 100;
const baseCash = SM.evaluate(lz).base;
const dividendPV = baseCash.rows.reduce((sum, row) => sum + row.dividend / (1 + lz.model.requiredReturn) ** row.year, 0);
out += `在其余假设不变时，退出 PE 从 ${basePE} 倍升至 ${basePE + 1} 倍，基准 IRR 增加 ${peSensitivity.toFixed(2)} 个百分点；按回报要求折现的十年分红现值约占买入价的 ${(dividendPV / lz.price * 100).toFixed(1)}%。这一敏感性只适用于当前参数，参数变化后会重新计算。\n\n`;

out += '## 8. 币种口径与自动校验\n\n';
out += '模型输出的 P0、EPS、逐年分红与期末卖出价值必须与股价使用同一币种。港股标的的经营报表可能是人民币或美元，须先按固定研究汇率折成港元，再据此计算 EPS 与现金流。\n\n';
out += `- 当前 ${hkdStocks.length} 只港股模型均声明 \`model.fx\`（报表币种、汇率、汇率来源、折算前的报表口径基准 EPS）。\n`;
for (const s of hkdStocks) out += `  - ${s.name}：${s.model.fx.reportCurrency}报表；${s.model.fx.rateSource}。\n`;
out += '- `docs/check-shareholder-model.mjs` 会校验「模型基准 EPS × 汇率 ≈ 报表口径基准 EPS」，容差取 0.5% 与 0.01 的较大者；新增港股模型若未声明换算关系会直接报错，声明后若换算不一致同样报错。\n';
out += '- **2026-09-29 修正记录**：腾讯控股与泡泡玛特原先把人民币每股盈利直接标为港元 EPS，未做汇率折算，使当时的基准 IRR 被低估。此次只修正 EPS 币种；当前 IRR 和排名以第 6 节根据现有价格与参数生成的表格为准。\n';
out += '- 银行、保险的 EPS 与 PE 是简化情景，须另行检查资本充足率、资产质量与偿付能力。\n';
out += '- 模型不含红利税、交易费用、未来回购与稀释；港股结果未计未来汇率变化。\n';

generatedFile(ROOT + '/docs/model-explained.md', out);
console.log(process.argv.includes('--check') ? (process.exitCode ? 'OUT OF DATE' : 'PASS: generated model matches') : 'Generated model', out.length, 'chars;', stocks.length, 'stocks;', hkdStocks.length, 'HKD models');
console.log('buckets', [...bucket.keys()].sort((a, b) => parseFloat(a) - parseFloat(b)).join(' '));
