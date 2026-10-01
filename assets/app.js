(function () {
  const db = window.STOCK_RESEARCH;
  const price = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const precisePrice = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const returnValue = value => Number.parseFloat(String(value).replace("%", "")) || 0;
  const num = value => Number.parseFloat(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const pct = value => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  const currencySymbol = stock => stock.market.includes("港股") ? "HK$" : "¥";
  const formatPrice = value => (Math.abs(Number(value)) < 10 ? precisePrice : price).format(value);
  const displayPrice = stock => `${currencySymbol(stock)}${formatPrice(stock.price)}`;
  const freshnessAsOf = window.ResearchFreshness.today();
  const escapeText = value => String(value ?? '待补核').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function freshness(stock, detailed=false) {
    const f=window.ResearchFreshness.assess(stock,freshnessAsOf);
    const elapsed=n=>n===null?'日期待核':n<0?'日期异常':n===0?'今日':`${n}天前`;
    const badge=`<span class="freshness-status freshness-${f.state}">${f.label}</span>`;
    if(!detailed)return `<span class="freshness-inline">${badge}<span>行情 ${escapeText(f.priceDate)} · ${elapsed(f.priceAge)}</span><span>财报 ${escapeText(f.period)}</span><span>${f.reviewLabel} ${escapeText(f.reviewDate)}</span></span>`;
    return `<section class="freshness-panel" aria-label="数据时效"><div class="freshness-heading"><strong>数据时效</strong>${badge}<span>截至北京时间 ${f.asOf}</span></div><dl class="freshness-dates"><div><dt>行情基准</dt><dd>${escapeText(f.priceDate)}<small>${elapsed(f.priceAge)} · 非实时行情</small></dd></div><div><dt>实际财报期间</dt><dd>${escapeText(f.period)}<small>${f.financialDate?`截止 ${f.financialDate} · ${elapsed(f.financialAge)}`:'截止日待核'}，非披露日</small></dd></div><div><dt>${f.reviewLabel}</dt><dd>${escapeText(f.reviewDate)}<small>${elapsed(f.reviewAge)}${stock.researchDate?'':' · 未单列研究更新日'}</small></dd></div></dl>${f.reasons.length?`<ul class="freshness-reasons">${f.reasons.map(r=>`<li>${r}</li>`).join('')}</ul>`:''}<details class="freshness-policy"><summary>时效规则与边界</summary><p>按日历天提示：行情超过30天、研究/模型记录超过90天、财报截止超过240天建议复核；日期缺失或晚于今日单独提示。以上为本站提醒规则，不是交易日或法定披露期限。财报截止日由明确日期或自然年季度推算，不猜测非自然财年。日期较近不代表已核实全部最新公告；并购、增发和重大经营变化可随时使假设失效。模型记录和方法审阅不等于重新研究，本提示不自动更新价格、假设或排名。</p></details></section>`;
  }
  const isIRR = stock => stock.model?.version === "shareholder-irr-v1";
  // 研究池保留全部公司；无有效结果或关键假设待核验的公司不参与排名。
  for (const stock of db.stocks) {
    stock.returnEvaluation = null;
    stock.modelError = null;
    if (!isIRR(stock)) { stock.modelError = "缺少有效收益模型"; continue; }
    try { stock.returnEvaluation = window.ShareholderModel.evaluate(stock); }
    catch (error) { stock.modelError = `${stock.code}: ${error.message}`; console.warn(stock.modelError); }
  }
  const eligible = stock => window.ShareholderModel.eligibility(stock, stock.returnEvaluation).eligible;
  const stockReturn = stock => stock.returnEvaluation ? `${(stock.returnEvaluation.base.irr * 100).toFixed(1)}%${eligible(stock) ? "" : "（条件）"}` : "待核验";
  const irrOf = stock => (stock.returnEvaluation ? stock.returnEvaluation.base.irr : null);
  const surplusOf = stock => (stock.returnEvaluation ? stock.returnEvaluation.base.surplus : null);
  const bearOf = stock => (stock.returnEvaluation ? stock.returnEvaluation.scenarios[0].irr : null);
  const rankedBy = mode => window.ShareholderModel.ranked(db.stocks, mode).map(row => row.stock);
  let homeSort = "surplus";
  let homeAll = false;

  const navigation = [
    { id: "ranking", label: "收益率排行", href: "index.html" },
    { id: "reports", label: "个股研究", href: "reports.html?category=stocks" },
    { id: "industries", label: "行业研究", href: "reports.html?category=industries" }
  ];

  function header(active) {
    return `<header class="site-header"><div class="shell nav">
      <a class="brand" href="index.html" aria-label="返回研究首页"><img class="brand-mark" src="assets/brand-mark-ly-serif.png?v=20261001-ly-serif-1" width="32" height="32" alt=""><span>${db.meta.siteName}</span></a>
      <nav class="nav-links" aria-label="主导航">${navigation.map(item => `<a href="${item.href}"${item.id === active ? ' aria-current="page"' : ""}>${item.label}</a>`).join("")}</nav>
      <div class="header-meta"><span>研究库更新</span><strong>${db.meta.updatedAt}</strong></div>
    </div></header>`;
  }

  function footer() {
    return `<footer class="site-footer"><div class="shell footer-inner"><div><strong>${db.meta.siteName}</strong><p>研究生意，估算现金流，等待价格。</p></div><p>研究库更新于 ${db.meta.updatedAt}；各报告行情日不同。内容仅作个人研究记录，不构成投资建议。</p></div></footer>`;
  }

  const paragraphs = items => items.map(item => `<p>${item}</p>`).join("");
  const bullets = items => `<ul class="bullet-list">${items.map(item => `<li>${item}</li>`).join("")}</ul>`;

  function factTable(rows) {
    return `<div class="table-wrap"><table><thead><tr><th>指标</th><th>数值</th><th>期间 / 时点</th><th>口径</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function forecastTable(stock) {
    return `<div class="table-wrap"><table><thead><tr><th>情景</th><th>${stock.profitForecast.label || `${stock.profitForecast.year}正常化归母净利润`}</th><th>EPS</th><th>基准价对应预测PE</th><th>核心假设</th></tr></thead><tbody>${stock.profitForecast.scenarios.map(scenario => `<tr><td><strong>${scenario.name}</strong></td><td>${scenario.profit}</td><td>${scenario.eps}</td><td>${scenario.pe}</td><td>${scenario.reason}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function summaryMetrics(stock) {
    const base = stock.returnEvaluation?.base;
    const hurdle = Number.isFinite(stock.model?.requiredReturn) ? `${(stock.model.requiredReturn * 100).toFixed(1)}%` : "待核验";
    return `<div><span>基准十年 IRR${eligible(stock) ? "" : " · 条件演算"}</span><strong>${stockReturn(stock)}</strong></div><div><span>研究回报要求</span><strong>${hurdle}</strong></div><div><span>${eligible(stock) ? "达标参考价" : "条件参考价"}</span><strong>${base ? `${currencySymbol(stock)}${formatPrice(base.fairPrice)}` : "待核验"}</strong></div>`;
  }

  function annualPath(values) {
    const runs = [];
    values.forEach((value, i) => {
      const last = runs[runs.length - 1];
      if (last && last.value === value) last.end = i + 1;
      else runs.push({ start: i + 1, end: i + 1, value });
    });
    return runs.map(r => `第${r.start === r.end ? r.start : `${r.start}—${r.end}`}年 ${(r.value * 100).toFixed(1)}%`).join("；");
  }

  function modelReview(stock) {
    const review = stock.model.parameterReview;
    if (!review) return "";
    const d = window.ShareholderModel.sensitivity(stock);
    const pct = n => `${(n * 100).toFixed(1)}%`;
    return `<div class="model-review"><div class="section-head"><h3>假设依据与估值依赖</h3><p>${review.status} · 方法审阅 ${review.reviewedAt}</p></div>
      ${stock.model.rankAssessment ? `<p class="method-note">模型类型：${stock.model.rankAssessment.type} · 情景可信度：${stock.model.rankAssessment.confidence}。这是研究假设的证据分层，不是买入评级、概率或收益保证。</p>` : ''}
      <p>十年后EPS为起点的 <strong>${d.epsMultiple.toFixed(2)} 倍</strong>；第十年卖出所得占模型总现值的 <strong>${pct(d.terminalShare)}</strong>（按研究回报要求折现）。占比越高，结论越依赖远期盈利和退出估值。</p>
      <dl class="assumption-evidence"><div><dt>盈利起点</dt><dd>${stock.profitForecast.note}</dd></div><div><dt>经营路径</dt><dd>${review.operatingCheck}</dd></div><div><dt>资金约束</dt><dd>${review.capitalCheck}</dd></div><div><dt>每股口径</dt><dd>${review.shareCheck}</dd></div><div><dt>退出估值</dt><dd>${review.exitCheck}</dd></div></dl><ul class="bullet-list">${(review.references || []).map(r => `<li><a href="${r.url}" target="_blank" rel="noopener">${r.label}</a>（${r.date}） · ${r.locator} · ${r.status}</li>`).join("")}</ul>
      <details class="projection"><summary>敏感性分析 · 单项假设变化会带来什么影响</summary>
      <p class="method-note">每次只改变一项，其余保持基准情景；下表是压力测试，不是概率区间。调高分红率不能被视为无成本增加收益，因此不单独做“多分红更好”的测试。</p>
      <div class="table-wrap"><table><caption>基准IRR对假设的敏感性</caption><thead><tr><th>参数</th><th>变化幅度</th><th>下调后IRR</th><th>原基准IRR</th><th>上调后IRR</th></tr></thead><tbody>${d.metrics.map(m => `<tr><th scope="row">${m.label}</th><td>${m.change}</td><td>${pct(m.low)}</td><td>${pct(stock.returnEvaluation.base.irr)}</td><td>${pct(m.high)}</td></tr>`).join("")}</tbody></table></div>
      <div class="table-wrap"><table><caption>回报门槛变化 · 不改变同一组现金流的IRR</caption><thead><tr><th>研究回报要求</th><th>达标参考价</th><th>IRR与门槛差额</th></tr></thead><tbody>${d.hurdle.map(h => `<tr><th scope="row">${pct(h.rate)}</th><td>${currencySymbol(stock)}${formatPrice(h.fairPrice)}</td><td>${(h.surplus * 100).toFixed(1)}个百分点</td></tr>`).join("")}</tbody></table></div></details></div>`;
  }

  function priceTrialResults(stock, evaluation, buyPrice) {
    const percent = n => `${(n * 100).toFixed(1)}%`;
    const base = evaluation.base;
    const gap = base.surplus * 100;
    const distance = (buyPrice / base.fairPrice - 1) * 100;
    return `<div class="price-trial-scenarios">${evaluation.scenarios.map(s => `<div><span>${s.name}十年 IRR</span><strong>${percent(s.irr)}</strong></div>`).join('')}</div><dl class="price-trial-details"><div><dt>基准 IRR − 回报要求</dt><dd>${gap >= 0 ? '+' : ''}${gap.toFixed(1)} 个百分点</dd></div><div><dt>${eligible(stock) ? '达标' : '条件'}参考价 · 假设不变</dt><dd>${currencySymbol(stock)}${formatPrice(base.fairPrice)}</dd></div><div><dt>试算价相对参考价</dt><dd>${distance >= 0 ? '高于' : '低于'} ${Math.abs(distance).toFixed(1)}%</dd></div></dl><p class="price-trial-status">${buyPrice === stock.price ? '当前显示原报告基准价的演算。' : `按 ${currencySymbol(stock)}${formatPrice(buyPrice)} 试算，不修改原报告。`}${eligible(stock) ? '' : ' 关键假设待核验，仍为条件演算，不恢复排名资格。'}</p>`;
  }

  function priceTrial(stock) {
    return `<article class="price-trial" aria-labelledby="price-trial-title"><div class="price-trial-heading"><div><span class="section-label">独立试算 · 不写入报告</span><h3 id="price-trial-title">换一个买入价，看看回报变化</h3></div><span>研究基准 ${displayPrice(stock)} · ${escapeText(stock.priceDate)}</span></div><form id="price-trial-form" novalidate><label for="trial-price">试算买入价（${escapeText(stock.model.currency)}）</label><div class="price-trial-controls"><input id="trial-price" name="buyPrice" type="number" inputmode="decimal" min="0" step="any" value="${stock.price}" aria-describedby="price-trial-note price-trial-error"><button type="button" id="reset-trial-price">恢复研究基准价</button></div><p id="price-trial-error" class="price-trial-error" role="alert"></p></form><div id="price-trial-results" aria-live="polite" aria-atomic="true">${priceTrialResults(stock, stock.returnEvaluation, stock.price)}</div><p id="price-trial-note" class="method-note">只改变买入价，沿用原报告盈利、分红、退出估值和回报要求。参考价在同一组现金流下不变；首页排名和报告正文不变。此处不获取实时行情，也不保存输入。分红领取权沿用 ${escapeText(stock.priceDate)} 的时序；若今天买入已跨除息日、送转或增发等边界，须先正式更新研究，不能仅用本试算替代。</p></article>`;
  }

  function bindPriceTrial(stock) {
    const form = document.querySelector('#price-trial-form');
    if (!form) return;
    const input = form.querySelector('#trial-price');
    const results = document.querySelector('#price-trial-results');
    const error = document.querySelector('#price-trial-error');
    const update = () => {
      const value = input.valueAsNumber;
      try {
        if (!Number.isFinite(value) || value <= 0) throw new Error('请输入大于 0 的有效买入价。');
        const evaluation = window.ShareholderModel.evaluate({ ...stock, price: value });
        results.innerHTML = priceTrialResults(stock, evaluation, value);
        error.textContent = '';
        input.removeAttribute('aria-invalid');
      } catch (e) {
        input.setAttribute('aria-invalid', 'true');
        error.textContent = Number.isFinite(value) && value > 0 ? '该价格无法完成有效演算，请调整输入；原报告未改变。' : '请输入大于 0 的有效买入价。';
        results.innerHTML = '<p class="price-trial-status">暂无有效试算结果，原报告未改变。</p>';
      }
    };
    input.addEventListener('input', update);
    form.addEventListener('submit', event => { event.preventDefault(); update(); });
    form.querySelector('#reset-trial-price').addEventListener('click', () => {
      input.value = String(stock.price);
      update();
    });
  }

  function irrSection(stock) {
    const result = stock.returnEvaluation;
    if (!result) return `<section class="section" id="valuation"><h2>十年模型待核验</h2><p>参数未通过检查，暂不展示收益率。</p></section>`;
    const percent = value => `${(value * 100).toFixed(1)}%`;
    const base = result.base;
    const delta = `${base.surplus >= 0 ? "+" : ""}${(base.surplus * 100).toFixed(1)}`;
    return `<section class="section irr-section" id="valuation"><div class="section-head"><h2>十年股东现金流收益</h2><p>领取分红 · 第十年末卖出 · 税费前${stock.model.currency}名义回报${stock.market.includes("港股") ? " · 未计未来汇率变化" : ""}</p></div>
      ${!eligible(stock) ? `<p class="irr-verdict"><strong>关键假设待核验</strong> · ${window.ShareholderModel.eligibility(stock, stock.returnEvaluation).reason} 以下仅保留所列假设的条件演算。</p>` : `<p class="irr-verdict">基准 IRR <strong>${percent(base.irr)}</strong>，相对回报要求 <strong>${delta} 个百分点</strong>。达标参考价 <strong>${currencySymbol(stock)}${formatPrice(base.fairPrice)}</strong>，仅在下述假设成立时有效。</p>`}
      ${priceTrial(stock)}
      <div class="table-wrap"><table><caption>三情景${!eligible(stock) ? "条件演算" : "假设与结果"} · 起始 EPS 为研究预测值</caption><thead><tr><th>情景</th><th>起始EPS</th><th>EPS年增长路径</th><th>逐年分红率</th><th>退出PE</th><th>十年IRR</th></tr></thead><tbody>${result.scenarios.map(s => `<tr><th scope="row">${s.name}</th><td>${price.format(s.eps)}${stock.model.currency}</td><td>${annualPath(s.growthRates)}</td><td>${annualPath(s.payoutRates)}</td><td>${s.exitPE}倍</td><td><strong>${percent(s.irr)}</strong></td></tr>`).join("")}</tbody></table></div>
      <p class="method-note">${stock.model.assumptionNote} 行情日 ${stock.priceDate}；财务报告期 ${stock.model.financialPeriod}；模型复核日 ${stock.model.reviewedAt}。${stock.model.requiredReturnReason}</p>
      <details class="projection irr-formula"><summary>展开计算公式与基准逐年现金流</summary><div class="irr-explanation"><p>${stock.model.method}</p><p>EPS<sub>t</sub> = EPS<sub>t−1</sub> × (1 + g<sub>t</sub>)；分红 D<sub>t</sub> = EPS<sub>t−1</sub> × 分红率；卖出价 P<sub>10</sub> = EPS<sub>10</sub> × 退出 PE。</p><p class="irr-equation">P<sub>0</sub> = Σ<sub>t=1…10</sub> D<sub>t</sub> / (1 + r)<sup>t</sup> + P<sub>10</sub> / (1 + r)<sup>10</sup></p><p>求出的 r 为 IRR。达标参考价是这些现金流按 ${(stock.model.requiredReturn * 100).toFixed(1)}% 回报要求折现之和。${base.firstDividend !== undefined ? "首年采用已核定年度金额" : base.firstDividendParts ? "首年已知金额替代对应预测部分，详见分红说明" : "首年分红为预测"}，第十年同时收到分红和卖出价。IRR 不等于领取分红后实际财富的复合增长率。</p></div>
      <div class="table-wrap"><table><caption>每买入1股的现金流 · 单位${stock.model.currency}</caption><thead><tr><th>持有年度</th><th>EPS增速</th><th>当年EPS</th><th>分红率</th><th>领取分红</th><th>卖出所得</th><th>净现金流</th></tr></thead><tbody><tr><th scope="row">买入</th><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>−${formatPrice(stock.price)}</td></tr>${base.rows.map(r => `<tr><th scope="row">第${r.year}年</th><td>${percent(r.growth)}</td><td>${price.format(r.eps)}</td><td>${percent(r.payoutRate)}</td><td>${price.format(r.dividend)}</td><td>${r.sale ? price.format(r.sale) : "—"}</td><td>${price.format(r.cashFlow)}</td></tr>`).join("")}</tbody></table></div><p class="footnote">按未四舍五入数值计算；买入价按行情精度展示，年度预测现金流保留两位小数。不计个人税费、通胀和未来股本变化；情景范围不代表统计置信区间。</p></details>
      <article class="dividend-view"><div class="section-label">分红与现金口径</div><p>${stock.model.dividendNote}</p><p>${stock.dividendView}</p></article>${modelReview(stock)}<p class="method-note">第十年基准卖出所得：${currencySymbol(stock)}${formatPrice(base.rows[9].sale)}；由第十年EPS和退出PE生成。</p></section>`;
  }

  function rankingRows() {
    const list = rankedBy(homeSort);
    const shown = homeAll ? list : list.slice(0, 10);
    const pct = value => (value === null ? "待核验" : `${(value * 100).toFixed(1)}%`);
    if (!list.length) return '<p class="ranking-empty">暂无证据审核通过的可排名标的。完整报告与条件演算仍可在个股研究目录查看。</p>';
    return (list.every(s => s.returnEvaluation.base.surplus < 0) ? '<p class="ranking-empty">当前可排名标的均未达到各自研究回报要求；以下仅为研究排序。</p>' : "") + shown.map((stock, index) => {
      const result = stock.returnEvaluation;
      const gap = result ? `${result.base.surplus >= 0 ? "+" : ""}${(result.base.surplus * 100).toFixed(1)}pp` : "—";
      const gapClass = result ? (result.base.surplus >= 0 ? "cell-up" : "cell-down") : "";
      return `<a class="ranking-row" data-podium="${index<3?index+1:''}" href="stock.html?code=${stock.code}"><span class="rank-number">${String(index + 1).padStart(2, "0")}</span><span class="rank-company"><strong>${stock.name}</strong><small>${stock.code} · ${stock.industry}</small>${freshness(stock)}<small>${stock.model.rankingDecision.evidenceStatus} · ${stock.model.rankingDecision.reason}</small></span><span class="rank-scenarios"><strong>${pct(bearOf(stock))} / <em class="rank-base">${pct(irrOf(stock))}</em> / ${pct(result ? result.scenarios[2].irr : null)}</strong><small>悲观 / 基准 / 乐观 · 回报要求 ${(stock.model.requiredReturn * 100).toFixed(1)}%</small><small>基准价 ${displayPrice(stock)}（${stock.priceDate} 收盘）</small></span><span class="rank-surplus ${gapClass}"><strong>${gap}</strong><small>基准 IRR − 回报要求</small></span></a>`;
    }).join("");
  }

  function rankingChart() {
    const list=rankedBy(homeSort);
    if(!list.length)return '<section id="ranking-chart" class="return-chart"><h3>收益与门槛</h3><p>暂无可排名的研究情景。</p></section>';
    const shown=homeAll?list:list.slice(0,10);
    // 采用整个可排名池的共同尺度，切换排序或前十/全部不会改变尺度。
    const values=list.flatMap(s=>[irrOf(s)*100,s.model.requiredReturn*100]);
    const low=Math.floor(Math.min(0,...values)/5)*5;
    const high=Math.ceil(Math.max(5,...values)/5)*5;
    const at=v=>(v-low)/(high-low)*100;
    const step=(high-low)>40?10:5;
    const ticks=[];
    for(let v=low;v<=high;v+=step)ticks.push(v);
    if(ticks[ticks.length-1]!==high)ticks.push(high);
    const percent=v=>`${v.toFixed(1)}%`;
    const rows=shown.map((s,i)=>{
      const base=irrOf(s)*100,hurdle=s.model.requiredReturn*100,gap=base-hurdle;
      const a=at(base),b=at(hurdle),positive=gap>=0;
      const label=`${s.name}：基准IRR ${percent(base)}，回报要求 ${percent(hurdle)}，差额${gap>=0?'+':''}${gap.toFixed(1)}个百分点；行情${s.priceDate}，${s.model.rankingDecision.evidenceStatus}`;
      return `<a class="return-chart-row" data-podium="${i<3?i+1:''}" href="stock.html?code=${s.code}" aria-label="${escapeText(label)}"><span class="return-chart-name"><span class="return-chart-rank">${String(i+1).padStart(2,'0')}</span><span>${escapeText(s.name)}<small>${s.code}</small></span></span><span class="return-chart-track" aria-hidden="true">${ticks.map(t=>`<i class="return-chart-guide${t===0?' is-zero':''}" style="left:${at(t)}%"></i>`).join('')}<i class="return-chart-gap ${positive?'is-positive':'is-shortfall'}" style="left:${Math.min(a,b)}%;width:${Math.abs(a-b)}%"></i><i class="return-chart-hurdle" style="left:${b}%"></i><i class="return-chart-point ${positive?'is-positive':'is-shortfall'}" style="left:${a}%"></i></span><span class="return-chart-values"><strong>${percent(base)}</strong><small>${gap>=0?'+':''}${gap.toFixed(1)} pp${positive?' · 达到门槛':' · 未达门槛'}</small></span></a>`;
    }).join('');
    return `<section id="ranking-chart" class="return-chart" aria-label="基准收益率与研究回报要求对比"><div class="return-chart-head"><div><span class="eyebrow">RETURN / REQUIRED RETURN</span><h3>收益与门槛</h3><p>${homeAll?'全部研究情景':'前十研究情景'} · ${shown.length}只 · ${homeSort==='irr'?'按基准 IRR':'按回报差额'}排序</p></div><div class="return-chart-legend"><span><i class="legend-return"></i>基准十年 IRR</span><span><i class="legend-hurdle"></i>研究回报要求</span></div></div><div class="return-chart-scroll"><div class="return-chart-axis" aria-hidden="true"><span>公司</span><span class="return-chart-ticks">${ticks.map(t=>`<span style="left:${at(t)}%">${t}%</span>`).join('')}</span><span>IRR / 差额</span></div>${rows}</div><p class="return-chart-note">圆点与短刻度之间是回报差额；橙色连线表示达到门槛，灰色表示未达。点击公司查看完整假设。图中仅为基准条件情景，不是收益承诺；各股行情日不同，未展示悲观／乐观范围，三情景详见下方列表。</p></section>`;
  }

  function rankingControls() {
    const total = rankedBy(homeSort).length;
    const topCount = Math.min(10, total);
    const shown = homeAll ? total : topCount;
    const toggleLabel = total <= 10 ? `全部排行（${total}只）` : homeAll ? `只看前${topCount}（${topCount}只）` : `查看全部排行（${total}只）`;
    const button = (mode, label) => `<button type="button" class="toggle" data-sort="${mode}" aria-pressed="${homeSort === mode}">${label}</button>`;
    return `<div class="ranking-controls"><span class="control-label">排序</span>${button("surplus", "按回报差额")}${button("irr", "按基准 IRR")}<button type="button" class="toggle" id="toggle-all" aria-pressed="${homeAll}" ${total <= 10 ? "disabled" : ""}>${toggleLabel}</button><span class="ranking-count" aria-live="polite">当前显示 <strong>${shown}</strong> / ${total} 只可排名 · 研究库 ${db.stocks.length} 只</span></div>`;
  }

  function rankingDisclosure() {
    const total=rankedBy(homeSort).length;
    const count=homeAll?total:Math.min(10,total);
    return `<details class="ranking-disclosure" id="ranking-details"><summary><span class="ranking-detail-icon" aria-hidden="true"><i></i><i></i><i></i></span><span class="ranking-detail-copy"><strong>查看详细排名</strong><small>从图形概览，深入三情景收益、数据时效与研究依据</small></span><span class="ranking-detail-meta"><span id="ranking-detail-count">${count}只公司</span><span class="ranking-detail-chevron" aria-hidden="true">⌄</span></span></summary><div class="ranking-detail-body"><div class="ranking-detail-heading"><span>详细研究索引</span><span>与上方图表使用相同排序与范围</span></div><div class="ranking-list">${rankingRows()}</div></div></details>`;
  }

  function renderRanking() {
    const list = document.querySelector("#ranking .ranking-list");
    const controls = document.querySelector("#ranking .ranking-controls");
    const chart = document.querySelector("#ranking-chart");
    if (list) list.innerHTML = rankingRows();
    if (controls) controls.outerHTML = rankingControls();
    if (chart) chart.outerHTML = rankingChart();
    const detailCount=document.querySelector('#ranking-detail-count');
    if(detailCount)detailCount.textContent=`${homeAll?rankedBy(homeSort).length:Math.min(10,rankedBy(homeSort).length)}只公司`;
    bindRanking();
  }

  function bindRanking() {
    const box = document.querySelector("#ranking");
    if (!box) return;
    box.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => { homeSort = button.dataset.sort; renderRanking(); }));
    const all = box.querySelector("#toggle-all");
    if (all) all.addEventListener("click", () => { homeAll = !homeAll; renderRanking(); });
  }

  function reportRows(list = db.stocks) {
    return list.map(stock => `<a class="report-row" href="stock.html?code=${stock.code}"><div class="report-main"><div class="report-kicker">${stock.market} · ${stock.code} · ${stock.industry}</div><h3>${stock.name}</h3><p>${stock.thesis}</p>${freshness(stock)}</div><dl class="report-metrics"><div><dt>十年IRR</dt><dd>${stockReturn(stock)}</dd></div><div><dt>收盘基准</dt><dd>${displayPrice(stock)}</dd></div><div><dt>研究结论</dt><dd>${stock.valuation}${eligible(stock) ? "" : " · 暂停排名"}</dd></div></dl><span class="report-action">阅读报告 <b>↗</b></span></a>`).join("");
  }

  function reportFilters() {
    const params=new URLSearchParams(location.search);
    const options=values=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,'zh-CN'));
    const select=(key,label,values)=>`<label class="report-filter"><span>${label}</span><select name="${key}"><option value="">全部${label}</option>${values.map(value=>{const [v,text]=Array.isArray(value)?value:[value,value];return `<option value="${escapeText(v)}"${params.get(key)===v?' selected':''}>${escapeText(text)}</option>`;}).join('')}</select></label>`;
    return `<form id="report-filters" class="report-filters" role="search" aria-label="搜索与筛选个股报告"><label class="report-search"><span>搜索报告</span><input type="search" name="q" value="${escapeText(params.get('q')||'')}" placeholder="公司名称、股票代码或行业" autocomplete="off"></label><div class="report-filter-grid">${select('market','市场',options(db.stocks.map(window.ReportQuery.market)))}${select('industry','行业',options(db.stocks.map(s=>s.industry)))}${select('freshness','数据时效',[['recent','日期较近'],['review','建议复核'],['unknown','日期待核／异常']])}${select('evidence','证据状态',options(db.stocks.map(window.ReportQuery.evidence)))}</div><div class="report-filter-bottom"><p id="report-result-count" role="status" aria-live="polite" aria-atomic="true"></p><button type="button" id="report-filter-reset">重置筛选</button></div><p class="filter-footnote">组合条件同时生效；数据时效不代表研究质量或最新公告已查全。</p></form>`;
  }

  function bindReportFilters() {
    const form=document.querySelector('#report-filters');
    if(!form)return;
    const list=document.querySelector('#stock-report-results');
    const count=document.querySelector('#report-result-count');
    const reset=document.querySelector('#report-filter-reset');
    const update=(syncURL=true)=>{
      const query=Object.fromEntries(['q','market','industry','freshness','evidence'].map(key=>[key,form.elements.namedItem(key).value]));
      const matches=window.ReportQuery.filter(db.stocks,query,freshnessAsOf);
      count.textContent=`显示 ${matches.length} / ${db.stocks.length} 份报告${Object.values(query).some(v=>v.trim())?' · 已筛选':''}`;
      list.innerHTML=matches.length?reportRows(matches):'<div class="report-filter-empty"><h2>没有符合条件的报告</h2><p>试试缩短关键词、减少筛选条件，或点击“重置筛选”。</p></div>';
      reset.disabled=!Object.values(query).some(v=>v.trim());
      if(syncURL && window.history){
        const params=new URLSearchParams(location.search);
        params.set('category','stocks');
        for(const [key,value] of Object.entries(query)){if(value.trim())params.set(key,value);else params.delete(key);}
        window.history.replaceState(null,'',`${location.pathname}?${params.toString()}${location.hash||''}`);
      }
    };
    let composing=false;
    form.addEventListener('compositionstart',()=>{composing=true;});
    form.addEventListener('compositionend',()=>{composing=false;update();});
    form.addEventListener('input',()=>{if(!composing)update();});
    form.addEventListener('change',()=>update());
    form.addEventListener('submit',event=>{event.preventDefault();update();});
    reset.addEventListener('click',()=>{for(const key of ['q','market','industry','freshness','evidence'])form.elements.namedItem(key).value='';update();form.elements.namedItem('q').focus();});
    update(false);
  }

  function industryReportLink() {
    const industries = window.INDUSTRY_REPORTS || {};
    const entries = Object.values(industries);
    if (!entries.length) return `<p class="report-page-intro">行业报告整理中。</p>`;
    return `<div class="report-list">${entries.map(report => `<a class="report-row industry-report-row" href="industry.html?id=${report.id}"><div class="report-main"><div class="report-kicker">${report.kicker}</div><h3>${report.title}</h3><p>${report.subject} · 数据截至 ${report.date}</p></div><dl class="report-metrics">${(report.stats || []).slice(0, 2).map(stat => `<div><dt>${stat.label}</dt><dd>${stat.value}</dd></div>`).join("")}<div><dt>报告形式</dt><dd>网页版全文</dd></div></dl><span class="report-action">阅读报告 <b>↗</b></span></a>`).join("")}</div>`;
  }

  const cellClass = value => (/^[+-]\d/.test(value) ? (value.startsWith("+") ? "cell-up" : "cell-down") : "");

  function industryChart(chart) {
    let body;
    if (chart.type === "share") {
      const segments = chart.segments.map((part, index) => `<span class="viz-segment viz-segment-${index + 1}" style="width:${part.value}%" title="${part.label} ${part.value}%"></span>`).join("");
      const legend = chart.segments.map((part, index) => `<li><i class="viz-key viz-segment-${index + 1}" aria-hidden="true"></i><span>${part.label}</span><strong>${part.value}%</strong></li>`).join("");
      body = `<div class="viz-share" role="img" aria-label="${chart.segments.map(part => `${part.label}占${part.value}%`).join("，")}">${segments}</div><ul class="viz-share-legend">${legend}</ul>`;
    } else {
      const max = Math.max(...chart.rows.map(row => Math.abs(row.value)), 1);
      body = `<div class="viz-rows ${chart.type === "loss" ? "viz-loss" : ""} ${chart.rows.some(row => row.change) ? "viz-with-change" : ""}">${chart.rows.map(row => {
        const percent = Math.max(2, Math.abs(row.value) / max * 100);
        const value = chart.type === "loss" ? `${row.value.toFixed(2)}%` : `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(row.value)}${chart.unit || ""}`;
        const change = row.change ? `<small class="viz-change ${row.change.startsWith("+") ? "cell-up" : "cell-down"}">同比 ${row.change}</small>` : "";
        return `<div class="viz-row"><span class="viz-label">${row.label}</span><span class="viz-track" aria-hidden="true"><i style="width:${percent}%"></i></span><strong class="viz-value">${value}</strong>${change}</div>`;
      }).join("")}</div>`;
    }
    return `<figure class="report-figure data-figure"><figcaption>${escapeText(chart.caption)}</figcaption>${body}<p class="fig-note">${escapeText(chart.note || '')}</p></figure>`;
  }

  function industryBlock(block) {
    if (block.h3) return `<h3 class="ind-h3">${escapeText(block.h3)}</h3>`;
    if (block.p) return `<p class="ind-p">${escapeText(block.p)}</p>`;
    if (block.bullets) return bullets(block.bullets.map(escapeText));
    if (block.numbered) return `<ol class="ind-numbered">${block.numbered.map(item => `<li>${escapeText(item)}</li>`).join("")}</ol>`;
    if (block.panels) return `<div class="debate-grid">${block.panels.map(panel => `<article class="panel"><h3>${escapeText(panel.title)}</h3>${panel.body ? `<p>${escapeText(panel.body)}</p>` : bullets((panel.items || []).map(escapeText))}</article>`).join("")}</div>`;
    if (block.chart) return industryChart(block.chart);
    if (block.evidence) return `<div class="evidence-grid">${block.evidence.map(item => `<article${item.danger ? ' class="danger"' : ""}><div class="section-label">${escapeText(item.label)}</div><h2>${escapeText(item.heading)}</h2>${bullets(item.items.map(escapeText))}</article>`).join("")}</div>`;
    if (block.table) {
      const t = block.table;
      return `<div class="table-wrap${t.head.length <= 3 ? ' compact-table' : ''}"><table>${t.caption ? `<caption>${escapeText(t.caption)}</caption>` : ''}<thead><tr>${t.head.map(h => `<th scope="col">${escapeText(h)}</th>`).join("")}</tr></thead><tbody>${t.rows.map(row => `<tr>${row.map(cell => { const cls = cellClass(String(cell)); return `<td${cls ? ` class="${cls}"` : ""}>${escapeText(cell)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>${t.note ? `<p class="footnote">${escapeText(t.note)}</p>` : ""}`;
    }
    return "";
  }

  function renderIndustry(report) {
    document.body.className = "industry-page";
    document.title = `${report.title} | ${db.meta.siteName}`;
    const sections = report.sections.map((section, index) => `<section class="section" id="${escapeText(section.id)}"><div class="section-head"><span class="section-label">${String(index + 2).padStart(2, "0")} / 研究正文</span><h2>${escapeText(section.title)}</h2>${section.sub ? `<p>${escapeText(section.sub)}</p>` : ''}</div>${section.blocks.map(industryBlock).join("")}</section>`).join("");
    const rawSource = report.sourceFile || (report.pdf ? { href: report.pdf, format: 'PDF' } : null);
    const source = rawSource && /^(?:https:\/\/|reports\/)/.test(rawSource.href || '') ? rawSource : null;
    const download = source ? `<a class="industry-download" href="${escapeText(source.href)}" target="_blank" rel="noopener noreferrer"${/^reports\//.test(source.href) ? ' download' : ''}>下载原始 ${escapeText(source.format || '报告')} ↗</a>` : '';
    const navItems = [['summary', '摘要'], ...(report.nav || report.sections.map(s => [s.id, s.title])), ['sources', '来源']].filter(([id], i, all) => all.findIndex(item => item[0] === id) === i);
    const sourceLinks = (report.sources || []).filter(item => Array.isArray(item) && /^https:\/\//.test(item[2] || '')).map(item => `<a href="${escapeText(item[2])}" target="_blank" rel="noopener noreferrer"><span>${escapeText(item[0])}</span><time>${escapeText(item[1] || '')}</time><b aria-hidden="true">↗</b></a>`).join('');
document.body.innerHTML = `${header("industries")}<main><section class="detail-cover industry-cover"><div class="shell"><a class="back" href="reports.html?category=industries">← 返回行业报告</a><div class="industry-title"><span class="eyebrow">${escapeText(report.kicker || "行业研究")} </span><h1>${escapeText(report.title)}</h1><p>${escapeText(report.subject || "")}</p><div class="industry-meta"><span>数据截至 ${escapeText(report.date)}</span>${report.author ? `<span>来源 / ${escapeText(report.author)}</span>` : ""}${download}</div></div>${report.aside?.length ? `<dl class="industry-market-strip">${report.aside.map(item => `<div><dt>${escapeText(item.label)}</dt><dd>${escapeText(item.value)}</dd>${item.note ? `<small>${escapeText(item.note)}</small>` : ""}</div>`).join("")}</dl>` : ""}<nav class="report-nav" aria-label="报告目录">${navItems.map(([id,label]) => `<a href="#${escapeText(id)}">${escapeText(label)}</a>`).join("")}</nav></div></section><div class="shell report-body industry-reading"><section class="section industry-summary" id="summary"><span class="section-label">01 / 报告摘要</span><h2>${escapeText(report.summaryTitle || "核心观点")}</h2><p class="lede">${escapeText(report.coreConclusion || "")}</p>${report.stats?.length ? `<dl class="industry-summary-stats">${report.stats.map(stat => `<div><dt>${escapeText(stat.label)}</dt><dd>${escapeText(stat.value)}</dd>${stat.note ? `<small>${escapeText(stat.note)}</small>` : ""}</div>`).join("")}</dl>` : ""}</section>${sections}<section class="section sources" id="sources"><div class="section-head"><h2>来源与原文</h2><p>网页统一排版，原始报告保留溯源</p></div>${sourceLinks ? `<div class="source-list">${sourceLinks}</div>` : ''}${report.sourcesNote ? `<p class="method-note">${escapeText(report.sourcesNote)}</p>` : ""}${report.disclaimer ? `<p class="method-note">${escapeText(report.disclaimer)}</p>` : ""}${download}</section></div></main>${footer()}`;
  }

  function renderHome() {
    document.body.className = "home-page";
    document.title = `收益率排行 | ${db.meta.siteName}`;
    document.body.innerHTML = `${header("ranking")}<main><section class="home-intro"><div class="shell"><div class="intro-copy"><span class="eyebrow">长期研究 · 固定情景模型</span><h1>把判断放在数据前面</h1><p>从企业质量、估值和风险出发，比较十年基准情景下的预期收益。每个数字都能回到完整报告。</p><a class="primary-link" href="reports.html?category=stocks">浏览研究报告 <span aria-hidden="true">↗</span></a></div><div class="intro-facts"><div><span>跟踪公司</span><strong>${db.stocks.length}</strong><small>份个股研究</small></div><div><span>研究库更新</span><strong class="fact-date">${db.meta.updatedAt}</strong><small>查看报告中的口径与来源</small></div></div></div></section><section class="ranking-section" id="ranking"><div class="shell"><div class="list-heading"><div><span class="eyebrow">研究索引</span><h2>预期收益率排行</h2></div><p>按基准 IRR 相对回报要求的差额排序，点击公司查看假设与风险。</p></div>${rankingControls()}${rankingChart()}${rankingDisclosure()}<p class="ranking-note">研究池 ${db.stocks.length} 只，参与排名 ${rankedBy(homeSort).length} 只；其余无法建立明确基准路径，保留演算但不排名。榜单比较的是条件研究情景，不表示未来预测已核实；有限可信度及零股息终值型需额外关注资本约束与终值依赖。各股行情日不同，细小差额不代表确定优势。统一采用十年股东现金流 IRR（税前、交易币种名义回报；港股未计未来汇率变化）。差额 = 基准 IRR − 研究回报要求，单位为百分点，负值表示未达门槛；榜单用于安排研究优先级，不构成买入建议。</p></div></section></main>${footer()}`;
    bindRanking();
  }

  function renderReports() {
    const category = new URLSearchParams(location.search).get("category") === "industries" ? "industries" : "stocks";
    const title = category === "industries" ? "行业报告" : "个股报告";
    document.body.className = "reports-page";
    document.title = `${title} | ${db.meta.siteName}`;
    const content = category === "industries" ? industryReportLink() : `${reportFilters()}<div id="stock-report-results" class="report-list">${reportRows()}</div>`;
    document.body.innerHTML = `${header(category === "industries" ? "industries" : "reports")}<main><section class="reports-section" id="reports"><div class="shell"><div class="section-label report-page-label">研究档案</div><h1 class="report-page-title">${title}</h1><p class="report-page-intro">${category === "industries" ? "从行业变化理解企业所处的位置。" : "从结论进入报告，继续核对模型假设、事实与风险。"}</p>${content}</div></section></main>${footer()}`;
    if(category === 'stocks')bindReportFilters();
  }

  function reportNav() {
    return `<nav class="report-nav" aria-label="报告目录"><a href="#summary">结论</a><a href="#status">现状</a><a href="#tracking">跟踪</a><a href="#forecast">利润</a><a href="#valuation">估值</a><a href="#framework">视角</a><a href="#risks">风险</a><a href="#sources">来源</a></nav>`;
  }

  function setupReadingTables() {
    if (!document.querySelectorAll) return;
    for (const wrapper of document.querySelectorAll('.report-body .table-wrap')) {
      const caption = wrapper.querySelector('caption')?.textContent;
      wrapper.tabIndex = 0;
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', `${caption || '研究数据表格'}，可左右滚动`);
      const hint = document.createElement('p');
      hint.className = 'mobile-table-hint';
      if (wrapper.classList.contains('compact-table')) hint.classList.add('compact-table-hint');
      hint.textContent = '左右滑动查看完整表格 ↔';
      wrapper.before(hint);
    }
  }

  function setupReportNav() {
    const nav = document.querySelector(".report-nav");
    if (!nav) return;
    document.body.classList.add('has-report-nav');
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
    const setCurrent = id => {
      links.forEach(link => {
        if (link.hash === `#${id}`) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      const current = links.find(link => link.hash === `#${id}`);
      if (current && window.matchMedia?.('(max-width: 680px)').matches) {
        const left = current.offsetLeft;
        if (left < nav.scrollLeft || left + current.offsetWidth > nav.scrollLeft + nav.clientWidth) {
          nav.scrollTo({ left: Math.max(0, left - (nav.clientWidth - current.offsetWidth) / 2), behavior: 'auto' });
        }
      }
    };
    setCurrent(sections.some(section => `#${section.id}` === location.hash) ? location.hash.slice(1) : links[0]?.hash.slice(1));
    nav.addEventListener("click", event => {
      const link = event.target.closest('a[href^="#"]');
      if (link && nav.contains(link)) setCurrent(link.hash.slice(1));
    });
    window.addEventListener("hashchange", () => setCurrent(location.hash.slice(1)));
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      }, { rootMargin: "-120px 0px -55% 0px" });
      sections.forEach(section => observer.observe(section));
    }
  }

  function evidenceTracking(stock) {
    const tracking = stock.evidenceTracking;
    if (!tracking) return "";
    const cards = tracking.observations.map(item => `<article class="signal-card"><div class="section-label">${item.label}</div><strong>${item.value}</strong><time>${item.date}</time><p>${item.detail}</p><a href="${item.source[1]}" target="_blank" rel="noopener noreferrer">查看原始披露 ↗</a></article>`).join("");
    const rows = tracking.prices.rows.map(([date, guojiao, wuliangye, url]) => `<tr><td><time>${date}</time></td><td>¥${guojiao}</td><td>¥${wuliangye}</td><td>¥${guojiao - wuliangye}</td><td><a href="${url}" target="_blank" rel="noopener noreferrer">原始价格记录 ↗</a></td></tr>`).join("");
    return `<section class="section tracking-section" id="tracking"><div class="section-head"><h2>经营证据跟踪</h2><p>最近核对 ${tracking.updatedAt} · 每项保留披露日期和口径</p></div><p class="tracking-intro">${tracking.intro}</p><div class="signal-grid">${cards}</div><div class="tracking-price-head"><h3>国窖1573与普五价格记录</h3><p>${tracking.prices.note}</p></div><div class="table-wrap"><table class="tracking-table"><thead><tr><th scope="col">日期</th><th scope="col">高度国窖</th><th scope="col">普五八代</th><th scope="col">价差</th><th scope="col">数据来源</th></tr></thead><tbody>${rows}</tbody></table></div><p class="footnote">价格稳定只能验证价格表现；判断去库存是否完成，还需后续开瓶、渠道库存和回款数据交叉核对。</p></section>`;
  }

  function renderStock(stock) {
    document.body.className = "stock-page";
    document.title = `${stock.name}完整研究报告 | ${db.meta.siteName}`;
    document.body.innerHTML = `${header("reports")}<main><section class="detail-cover dark-band"><div class="shell"><a class="back" href="reports.html?category=stocks">← 返回个股报告</a><div class="detail-hero"><div><div class="eyebrow">${stock.status} · ${stock.industry}</div><div class="title-row"><h1>${stock.name}</h1><span class="ticker">${stock.market} / ${stock.code}</span></div><div class="ticker ticker-sub">价格基准 ${stock.priceDate} · 完整个股研究报告</div></div><aside class="price-panel"><span>${stock.priceDate} 收盘</span><strong>${displayPrice(stock)}</strong><small>${stock.marketCap}</small></aside></div>${stock.evidenceTracking ? reportNav() : reportNav().replace('<a href="#tracking">跟踪</a>', "")}</div></section><div class="shell report-body">${freshness(stock,true)}<section class="section lead-panel" id="summary"><div class="section-label">01 / 投资结论</div><h2>${stock.valuation}</h2><p class="lede">${stock.conclusion}</p><div class="verdict-grid">${summaryMetrics(stock)}</div></section><section class="section" id="status"><div class="section-head"><h2>行业与企业现状</h2><p>先看生意，再看价格</p></div><div class="status-stack"><section class="status-block"><div class="status-side"><span class="section-label">行业</span></div><div class="status-text">${paragraphs(stock.industryStatus)}</div></section><section class="status-block"><div class="status-side"><span class="section-label">公司</span></div><div class="status-text">${paragraphs(stock.companyStatus)}</div></section></div></section><section class="section"><div class="section-head"><h2>关键事实</h2><p>最新实际披露与行情</p></div>${factTable(stock.facts)}</section>${evidenceTracking(stock)}<section class="section"><div class="section-head"><h2>关键争议</h2><p>结论与反证分开</p></div><div class="debate-grid">${stock.debate.map(item => `<article class="panel"><h3>${item.title}</h3><p>${item.body}</p></article>`).join("")}</div></section><section class="section" id="forecast"><div class="section-head"><h2>${stock.profitForecast.label || `${stock.profitForecast.year}年利润预测`}</h2><p>不把半年数据简单乘二</p></div><article class="model-intro"><p>${stock.profitForecast.note}</p></article>${forecastTable(stock)}</section>${irrSection(stock)}<section class="section"><div class="section-head"><h2>护城河与商业质量</h2><p>优势必须转化为所有者现金流</p></div><article class="panel">${bullets(stock.moat)}</article></section><section class="section" id="framework"><div class="section-head"><h2>五种独立研究视角</h2><p>同一家公司，五套独立判断</p></div><div class="view-grid">${stock.masterViews.map((view, index) => `<article class="panel view-card"><div class="view-head"><span class="view-num">${String(index + 1).padStart(2, "0")}</span><span class="section-label">${view.name}</span></div><h3>${view.verdict}</h3><p>${view.text}</p></article>`).join("")}</div></section><section class="section evidence-grid" id="risks"><article><div class="section-label">后续验证</div><h2>什么会提高置信度</h2>${bullets(stock.questions)}</article><article class="danger"><div class="section-label">失效条件</div><h2>什么会推翻判断</h2>${bullets(stock.risks)}</article></section><section class="section sources" id="sources"><div class="section-head"><h2>来源与方法</h2><p>公开来源可直接打开</p></div><div class="source-list">${stock.sources.map(source => `<a href="${source[2]}" target="_blank" rel="noopener"><span>${source[0]}</span><time>${source[1]}</time><b>↗</b></a>`).join("")}</div><p class="method-note">研究框架参考巴菲特股东信、芒格决策清单、段永平投资问答、散户乙历史发言及杰克·韦尔奇管理框架。相关材料仅用于方法论推演；五位视角不等于其本人对当前价格的公开评级。</p></section></div></main>${footer()}`;
  }

  const isStock = location.pathname.endsWith("stock.html");
  const isIndustry = location.pathname.endsWith("industry.html");
  if (isStock) {
    const code = new URLSearchParams(location.search).get("code");
    const stock = db.stocks.find(item => item.code === code);
    if (stock) {
      renderStock(stock);
      bindPriceTrial(stock);
      if (stock.supplementaryReport) {
        const link = document.createElement("a");
        link.className = "primary-link";
        link.href = stock.supplementaryReport;
        link.textContent = "阅读补充报告：2026-09-21 全面体检 ↗";
        document.querySelector("#summary").append(link);
      }
    }
    else document.body.innerHTML = `${header()}<main class="shell empty"><h1>未找到这个标的</h1><p>请返回<a class="text-link" href="reports.html?category=stocks">个股报告</a>选择研究公司。</p></main>${footer()}`;
  } else if (isIndustry) {
    const id = new URLSearchParams(location.search).get("id");
    const report = (window.INDUSTRY_REPORTS || {})[id];
    if (report) renderIndustry(report);
    else document.body.innerHTML = `${header()}<main class="shell empty"><h1>未找到这份行业报告</h1><p>请返回<a class="text-link" href="reports.html?category=industries">行业报告</a>列表选择。</p></main>${footer()}`;
  } else if (location.pathname.endsWith("reports.html")) renderReports();
  else renderHome();
  setupReportNav();
  setupReadingTables();
})();
