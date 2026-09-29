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
  const isIRR = stock => stock.model.version === "shareholder-irr-v1";
  // 研究池保留全部公司；无有效结果或关键假设待核验的公司不参与排名。
  for (const stock of db.stocks) {
    stock.returnEvaluation = null;
    if (!isIRR(stock)) continue;
    try { stock.returnEvaluation = window.ShareholderModel.evaluate(stock); }
    catch { stock.returnEvaluation = null; }
  }
  const stockReturn = stock => stock.returnEvaluation && stock.model.rankingEligible !== false ? `${(stock.returnEvaluation.base.irr * 100).toFixed(1)}%` : "待核验";
  const irrOf = stock => (stock.returnEvaluation ? stock.returnEvaluation.base.irr : null);
  const surplusOf = stock => (stock.returnEvaluation ? stock.returnEvaluation.base.surplus : null);
  const bearOf = stock => (stock.returnEvaluation ? stock.returnEvaluation.scenarios[0].irr : null);
  const rankedBy = mode => db.stocks.filter(s => s.returnEvaluation && s.model.rankingEligible !== false).sort((a, b) => {
    if (mode === "irr") return (irrOf(b) ?? -9) - (irrOf(a) ?? -9);
    const gap = (surplusOf(b) ?? -9) - (surplusOf(a) ?? -9);
    if (gap !== 0) return gap;
    return (bearOf(b) ?? -9) - (bearOf(a) ?? -9);
  });
  let homeSort = "surplus";
  let homeAll = false;

  const navigation = [
    { id: "ranking", label: "收益率排行", href: "index.html" },
    { id: "reports", label: "个股研究", href: "reports.html?category=stocks" },
    { id: "industries", label: "行业研究", href: "reports.html?category=industries" }
  ];

  function header(active) {
    return `<header class="site-header"><div class="shell nav">
      <a class="brand" href="index.html" aria-label="返回研究首页"><img class="brand-mark" src="assets/brand-mark.svg?v=20260917-orange-1" width="32" height="32" alt=""><span>${db.meta.siteName}</span></a>
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
    return `<div class="table-wrap"><table><thead><tr><th>情景</th><th>2026归母净利润</th><th>EPS</th><th>当前PE</th><th>核心假设</th></tr></thead><tbody>${stock.profitForecast.scenarios.map(scenario => `<tr><td><strong>${scenario.name}</strong></td><td>${scenario.profit}</td><td>${scenario.eps}</td><td>${scenario.pe}</td><td>${scenario.reason}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function summaryMetrics(stock) {
    const base = stock.model.rankingEligible === false ? null : stock.returnEvaluation?.base;
    return `<div><span>基准十年 IRR</span><strong>${stockReturn(stock)}</strong></div><div><span>研究回报要求</span><strong>${(stock.model.requiredReturn * 100).toFixed(1)}%</strong></div><div><span>达标参考价</span><strong>${base ? `${currencySymbol(stock)}${formatPrice(base.fairPrice)}` : "待核验"}</strong></div>`;
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
      <p>十年后EPS为起点的 <strong>${d.epsMultiple.toFixed(2)} 倍</strong>；第十年卖出所得占模型总现值的 <strong>${pct(d.terminalShare)}</strong>（按研究回报要求折现）。占比越高，结论越依赖远期盈利和退出估值。</p>
      <dl class="assumption-evidence"><div><dt>盈利起点</dt><dd>${stock.profitForecast.note}</dd></div><div><dt>经营路径</dt><dd>${review.operatingCheck}</dd></div><div><dt>资金约束</dt><dd>${review.capitalCheck}</dd></div><div><dt>每股口径</dt><dd>${review.shareCheck}</dd></div><div><dt>退出估值</dt><dd>${review.exitCheck}</dd></div></dl>
      <details class="projection"><summary>敏感性分析 · 单项假设变化会带来什么影响</summary>
      <p class="method-note">每次只改变一项，其余保持基准情景；下表是压力测试，不是概率区间。调高分红率不能被视为无成本增加收益，因此不单独做“多分红更好”的测试。</p>
      <div class="table-wrap"><table><caption>基准IRR对假设的敏感性</caption><thead><tr><th>参数</th><th>变化幅度</th><th>下调后IRR</th><th>原基准IRR</th><th>上调后IRR</th></tr></thead><tbody>${d.metrics.map(m => `<tr><th scope="row">${m.label}</th><td>${m.change}</td><td>${pct(m.low)}</td><td>${pct(stock.returnEvaluation.base.irr)}</td><td>${pct(m.high)}</td></tr>`).join("")}</tbody></table></div>
      <div class="table-wrap"><table><caption>回报门槛变化 · 不改变同一组现金流的IRR</caption><thead><tr><th>研究回报要求</th><th>达标参考价</th><th>IRR与门槛差额</th></tr></thead><tbody>${d.hurdle.map(h => `<tr><th scope="row">${pct(h.rate)}</th><td>${currencySymbol(stock)}${formatPrice(h.fairPrice)}</td><td>${(h.surplus * 100).toFixed(1)}个百分点</td></tr>`).join("")}</tbody></table></div></details></div>`;
  }

  function irrSection(stock) {
    const result = stock.returnEvaluation;
    if (!result) return `<section class="section" id="valuation"><h2>十年模型待核验</h2><p>参数未通过检查，暂不展示收益率。</p></section>`;
    const percent = value => `${(value * 100).toFixed(1)}%`;
    const base = result.base;
    const delta = `${base.surplus >= 0 ? "+" : ""}${(base.surplus * 100).toFixed(1)}`;
    return `<section class="section irr-section" id="valuation"><div class="section-head"><h2>十年股东现金流收益</h2><p>领取分红 · 第十年末卖出 · 税费前${stock.model.currency}名义回报${stock.market.includes("港股") ? " · 未计未来汇率变化" : ""}</p></div>
      ${stock.model.rankingEligible === false ? `<p class="irr-verdict"><strong>关键假设待核验</strong> · ${stock.model.rankingReason} 以下仅保留原参数的条件演算。</p>` : `<p class="irr-verdict">基准 IRR <strong>${percent(base.irr)}</strong>，相对回报要求 <strong>${delta} 个百分点</strong>。达标参考价 <strong>${currencySymbol(stock)}${formatPrice(base.fairPrice)}</strong>，仅在下述假设成立时有效。</p>`}
      <div class="table-wrap"><table><caption>三情景${stock.model.rankingEligible === false ? "条件演算" : "假设与结果"} · 起始 EPS 为研究预测值</caption><thead><tr><th>情景</th><th>起始EPS</th><th>EPS年增长路径</th><th>逐年分红率</th><th>退出PE</th><th>十年IRR</th></tr></thead><tbody>${result.scenarios.map(s => `<tr><th scope="row">${s.name}</th><td>${price.format(s.eps)}${stock.model.currency}</td><td>${annualPath(s.growthRates)}</td><td>${annualPath(s.payoutRates)}</td><td>${s.exitPE}倍</td><td><strong>${percent(s.irr)}</strong></td></tr>`).join("")}</tbody></table></div>
      <p class="method-note">${stock.model.assumptionNote} 行情日 ${stock.priceDate}；财务报告期 ${stock.model.financialPeriod}；模型复核日 ${stock.model.reviewedAt}。${stock.model.requiredReturnReason}</p>
      <details class="projection irr-formula"><summary>展开计算公式与基准逐年现金流</summary><div class="irr-explanation"><p>${stock.model.method}</p><p>EPS<sub>t</sub> = EPS<sub>t−1</sub> × (1 + g<sub>t</sub>)；分红 D<sub>t</sub> = EPS<sub>t−1</sub> × 分红率；卖出价 P<sub>10</sub> = EPS<sub>10</sub> × 退出 PE。</p><p class="irr-equation">P<sub>0</sub> = Σ<sub>t=1…10</sub> D<sub>t</sub> / (1 + r)<sup>t</sup> + P<sub>10</sub> / (1 + r)<sup>10</sup></p><p>求出的 r 为 IRR。达标参考价是这些现金流按 ${(stock.model.requiredReturn * 100).toFixed(1)}% 回报要求折现之和。首年分红为预测，第十年同时收到分红和卖出价。IRR 不等于领取分红后实际财富的复合增长率。</p></div>
      <div class="table-wrap"><table><caption>每买入1股的现金流 · 单位${stock.model.currency}</caption><thead><tr><th>持有年度</th><th>EPS增速</th><th>当年EPS</th><th>分红率</th><th>领取分红</th><th>卖出所得</th><th>净现金流</th></tr></thead><tbody><tr><th scope="row">买入</th><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>−${formatPrice(stock.price)}</td></tr>${base.rows.map(r => `<tr><th scope="row">第${r.year}年</th><td>${percent(r.growth)}</td><td>${price.format(r.eps)}</td><td>${percent(r.payoutRate)}</td><td>${price.format(r.dividend)}</td><td>${r.sale ? price.format(r.sale) : "—"}</td><td>${price.format(r.cashFlow)}</td></tr>`).join("")}</tbody></table></div><p class="footnote">按未四舍五入数值计算；买入价按行情精度展示，年度预测现金流保留两位小数。不计个人税费、通胀和未来股本变化；情景范围不代表统计置信区间。</p></details>
      <article class="dividend-view"><div class="section-label">分红与现金口径</div><p>${stock.model.dividendNote}</p><p>${stock.dividendView}</p></article>${modelReview(stock)}</section>`;
  }

  function rankingRows() {
    const list = rankedBy(homeSort);
    const shown = homeAll ? list : list.slice(0, 10);
    const pct = value => (value === null ? "待核验" : `${(value * 100).toFixed(1)}%`);
    return shown.map((stock, index) => {
      const result = stock.returnEvaluation;
      const gap = result ? `${result.base.surplus >= 0 ? "+" : ""}${(result.base.surplus * 100).toFixed(1)}pp` : "—";
      const gapClass = result ? (result.base.surplus >= 0 ? "cell-up" : "cell-down") : "";
      return `<a class="ranking-row" href="stock.html?code=${stock.code}"><span class="rank-number">${String(index + 1).padStart(2, "0")}</span><span class="rank-company"><strong>${stock.name}</strong><small>${stock.code} · ${stock.industry}</small></span><span class="rank-scenarios"><strong>${pct(bearOf(stock))} / <em class="rank-base">${pct(irrOf(stock))}</em> / ${pct(result ? result.scenarios[2].irr : null)}</strong><small>悲观 / 基准 / 乐观 · 回报要求 ${(stock.model.requiredReturn * 100).toFixed(1)}%</small><small>基准价 ${displayPrice(stock)}（${stock.priceDate} 收盘）</small></span><span class="rank-surplus ${gapClass}"><strong>${gap}</strong><small>基准 IRR − 回报要求</small></span></a>`;
    }).join("");
  }

  function rankingControls() {
    const total = rankedBy(homeSort).length;
    const button = (mode, label) => `<button type="button" class="toggle" data-sort="${mode}" aria-pressed="${homeSort === mode}">${label}</button>`;
    return `<div class="ranking-controls"><span class="control-label">排序</span>${button("surplus", "按回报差额")}${button("irr", "按基准 IRR")}<button type="button" class="toggle" id="toggle-all" aria-pressed="${homeAll}">${homeAll ? "只看前十" : `查看全部 ${total} 只`}</button></div>`;
  }

  function renderRanking() {
    const list = document.querySelector("#ranking .ranking-list");
    const controls = document.querySelector("#ranking .ranking-controls");
    if (list) list.innerHTML = rankingRows();
    if (controls) controls.outerHTML = rankingControls();
    bindRanking();
  }

  function bindRanking() {
    const box = document.querySelector("#ranking");
    if (!box) return;
    box.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => { homeSort = button.dataset.sort; renderRanking(); }));
    const all = box.querySelector("#toggle-all");
    if (all) all.addEventListener("click", () => { homeAll = !homeAll; renderRanking(); });
  }

  function reportRows() {
    return db.stocks.map(stock => `<a class="report-row" href="stock.html?code=${stock.code}"><div class="report-main"><div class="report-kicker">${stock.market} · ${stock.code} · ${stock.industry}</div><h3>${stock.name}</h3><p>${stock.thesis}</p></div><dl class="report-metrics"><div><dt>十年IRR</dt><dd>${stockReturn(stock)}</dd></div><div><dt>收盘基准</dt><dd>${displayPrice(stock)}</dd></div><div><dt>研究结论</dt><dd>${stock.valuation}</dd></div></dl><span class="report-action">阅读报告 <b>↗</b></span></a>`).join("");
  }

  function industryReportLink() {
    const industries = window.INDUSTRY_REPORTS || {};
    const entries = Object.values(industries);
    if (!entries.length) return `<p class="report-page-intro">行业报告整理中。</p>`;
    return `<div class="report-list">${entries.map(report => `<a class="report-row" href="industry.html?id=${report.id}"><div class="report-main"><div class="report-kicker">${report.kicker}</div><h3>${report.title}</h3><p>${report.subject} · 数据截至 ${report.date}</p></div><dl class="report-metrics">${report.stats.slice(0, 2).map(stat => `<div><dt>${stat.label}</dt><dd>${stat.value}</dd></div>`).join("")}<div><dt>报告形式</dt><dd>网页版全文</dd></div></dl><span class="report-action">阅读报告 <b>↗</b></span></a>`).join("")}</div>`;
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
    return `<figure class="report-figure data-figure"><figcaption>${chart.caption}</figcaption>${body}<p class="fig-note">${chart.note}</p></figure>`;
  }

  function industryBlock(block) {
    if (block.h3) return `<h3 class="ind-h3">${block.h3}</h3>`;
    if (block.p) return `<p class="ind-p">${block.p}</p>`;
    if (block.bullets) return bullets(block.bullets);
    if (block.numbered) return `<ol class="ind-numbered">${block.numbered.map(item => `<li>${item}</li>`).join("")}</ol>`;
    if (block.panels) return `<div class="debate-grid">${block.panels.map(panel => `<article class="panel"><h3>${panel.title}</h3>${panel.body ? `<p>${panel.body}</p>` : bullets(panel.items)}</article>`).join("")}</div>`;
    if (block.chart) return industryChart(block.chart);
    if (block.evidence) return `<div class="evidence-grid">${block.evidence.map(item => `<article${item.danger ? ' class="danger"' : ""}><div class="section-label">${item.label}</div><h2>${item.heading}</h2>${bullets(item.items)}</article>`).join("")}</div>`;
    if (block.table) {
      const t = block.table;
      return `<div class="table-wrap"><table><thead><tr>${t.head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${t.rows.map(row => `<tr>${row.map(cell => { const cls = cellClass(String(cell)); return `<td${cls ? ` class="${cls}"` : ""}>${cell}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>${t.note ? `<p class="footnote">${t.note}</p>` : ""}`;
    }
    return "";
  }

  function renderIndustry(report) {
    document.body.className = "industry-page";
    document.title = `${report.title} | ${db.meta.siteName}`;
    const sections = report.sections.map((section, index) => `<section class="section" id="${section.id}"><div class="section-head"><span class="section-label">${String(index + 2).padStart(2, "0")} / ${section.title}</span><h2>${section.title}</h2><p>${section.sub}</p></div>${section.blocks.map(industryBlock).join("")}</section>`).join("");
    document.body.innerHTML = `${header("industries")}<main><section class="detail-cover dark-band"><div class="shell"><a class="back" href="reports.html?category=industries">← 返回行业报告</a><div class="detail-hero"><div><div class="eyebrow">${report.kicker}</div><div class="title-row"><h1>${report.title}</h1></div><div class="ticker ticker-sub">${report.subject} · 数据截至 ${report.date}</div></div><aside class="price-panel">${report.aside.map(item => `<div class="ind-aside"><span>${item.label}</span><strong>${item.value}</strong><small>${item.note}</small></div>`).join("")}</aside></div><nav class="report-nav" aria-label="报告目录">${report.nav.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("")}</nav></div></section><div class="shell report-body"><section class="section lead-panel" id="summary"><div class="section-label">01 / 核心结论</div><h2>“基本面底 + 估值底 + 筹码底”三底共振</h2><p class="lede">${report.coreConclusion}</p><div class="verdict-grid">${report.stats.map(stat => `<div><span>${stat.label}</span><strong>${stat.value}</strong></div>`).join("")}</div></section>${sections}<section class="section sources" id="sources"><div class="section-head"><h2>来源与说明</h2><p>原始报告归档可下载</p></div><p class="method-note">${report.sourcesNote}</p><p class="method-note">${report.disclaimer}</p><a class="text-link" href="${report.pdf}" target="_blank" rel="noopener">下载原始 PDF 报告 ↗</a></section></div></main>${footer()}`;
  }

  function renderHome() {
    document.body.className = "home-page";
    document.title = `收益率排行 | ${db.meta.siteName}`;
    document.body.innerHTML = `${header("ranking")}<main><section class="home-intro"><div class="shell"><div class="intro-copy"><span class="eyebrow">长期研究 · 固定情景模型</span><h1>把判断放在数据前面</h1><p>从企业质量、估值和风险出发，比较十年基准情景下的预期收益。每个数字都能回到完整报告。</p><a class="primary-link" href="reports.html?category=stocks">浏览研究报告 <span aria-hidden="true">↗</span></a></div><div class="intro-facts"><div><span>跟踪公司</span><strong>${db.stocks.length}</strong><small>份个股研究</small></div><div><span>研究库更新</span><strong class="fact-date">${db.meta.updatedAt}</strong><small>查看报告中的口径与来源</small></div></div></div></section><section class="ranking-section" id="ranking"><div class="shell"><div class="list-heading"><div><span class="eyebrow">研究索引</span><h2>预期收益率排行</h2></div><p>按基准 IRR 相对回报要求的差额排序，点击公司查看假设与风险。</p></div>${rankingControls()}<div class="ranking-list">${rankingRows()}</div><p class="ranking-note">研究池 ${db.stocks.length} 只，参与排名 ${rankedBy(homeSort).length} 只；其余因关键假设待核验暂停排名，仍可在报告目录查看。各股行情日不同，细小差额不代表确定优势。统一采用十年股东现金流 IRR（税前、交易币种名义回报；港股未计未来汇率变化）。差额 = 基准 IRR − 研究回报要求，单位为百分点，负值表示未达门槛；榜单用于安排研究优先级，不构成买入建议。</p></div></section></main>${footer()}`;
    bindRanking();
  }

  function renderReports() {
    const category = new URLSearchParams(location.search).get("category") === "industries" ? "industries" : "stocks";
    const title = category === "industries" ? "行业报告" : "个股报告";
    document.body.className = "reports-page";
    document.title = `${title} | ${db.meta.siteName}`;
    const content = category === "industries" ? industryReportLink() : `<div class="report-list">${reportRows()}</div>`;
    document.body.innerHTML = `${header(category === "industries" ? "industries" : "reports")}<main><section class="reports-section" id="reports"><div class="shell"><div class="section-label report-page-label">研究档案</div><h1 class="report-page-title">${title}</h1><p class="report-page-intro">${category === "industries" ? "从行业变化理解企业所处的位置。" : "从结论进入报告，继续核对模型假设、事实与风险。"}</p>${content}</div></section></main>${footer()}`;
  }

  function reportNav() {
    return `<nav class="report-nav" aria-label="报告目录"><a href="#summary">结论</a><a href="#status">现状</a><a href="#tracking">跟踪</a><a href="#forecast">利润</a><a href="#valuation">估值</a><a href="#framework">视角</a><a href="#risks">风险</a><a href="#sources">来源</a></nav>`;
  }

  function setupReportNav() {
    const nav = document.querySelector(".report-nav");
    if (!nav) return;
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
    const setCurrent = id => {
      links.forEach(link => {
        if (link.hash === `#${id}`) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
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
    document.body.innerHTML = `${header("reports")}<main><section class="detail-cover dark-band"><div class="shell"><a class="back" href="reports.html?category=stocks">← 返回个股报告</a><div class="detail-hero"><div><div class="eyebrow">${stock.status} · ${stock.industry}</div><div class="title-row"><h1>${stock.name}</h1><span class="ticker">${stock.market} / ${stock.code}</span></div><div class="ticker ticker-sub">价格基准 ${stock.priceDate} · 完整个股研究报告</div></div><aside class="price-panel"><span>${stock.priceDate} 收盘</span><strong>${displayPrice(stock)}</strong><small>${stock.marketCap}</small></aside></div>${stock.evidenceTracking ? reportNav() : reportNav().replace('<a href="#tracking">跟踪</a>', "")}</div></section><div class="shell report-body"><section class="section lead-panel" id="summary"><div class="section-label">01 / 投资结论</div><h2>${stock.valuation}</h2><p class="lede">${stock.conclusion}</p><div class="verdict-grid">${summaryMetrics(stock)}</div></section><section class="section" id="status"><div class="section-head"><h2>行业与企业现状</h2><p>先看生意，再看价格</p></div><div class="status-stack"><section class="status-block"><div class="status-side"><span class="section-label">行业</span></div><div class="status-text">${paragraphs(stock.industryStatus)}</div></section><section class="status-block"><div class="status-side"><span class="section-label">公司</span></div><div class="status-text">${paragraphs(stock.companyStatus)}</div></section></div></section><section class="section"><div class="section-head"><h2>关键事实</h2><p>最新实际披露与行情</p></div>${factTable(stock.facts)}</section>${evidenceTracking(stock)}<section class="section"><div class="section-head"><h2>关键争议</h2><p>结论与反证分开</p></div><div class="debate-grid">${stock.debate.map(item => `<article class="panel"><h3>${item.title}</h3><p>${item.body}</p></article>`).join("")}</div></section><section class="section" id="forecast"><div class="section-head"><h2>2026年利润预测</h2><p>不把半年数据简单乘二</p></div><article class="model-intro"><p>${stock.profitForecast.note}</p></article>${forecastTable(stock)}</section>${irrSection(stock)}<section class="section"><div class="section-head"><h2>护城河与商业质量</h2><p>优势必须转化为所有者现金流</p></div><article class="panel">${bullets(stock.moat)}</article></section><section class="section" id="framework"><div class="section-head"><h2>五种独立研究视角</h2><p>同一家公司，五套独立判断</p></div><div class="view-grid">${stock.masterViews.map((view, index) => `<article class="panel view-card"><div class="view-head"><span class="view-num">${String(index + 1).padStart(2, "0")}</span><span class="section-label">${view.name}</span></div><h3>${view.verdict}</h3><p>${view.text}</p></article>`).join("")}</div></section><section class="section evidence-grid" id="risks"><article><div class="section-label">后续验证</div><h2>什么会提高置信度</h2>${bullets(stock.questions)}</article><article class="danger"><div class="section-label">失效条件</div><h2>什么会推翻判断</h2>${bullets(stock.risks)}</article></section><section class="section sources" id="sources"><div class="section-head"><h2>来源与方法</h2><p>公开来源可直接打开</p></div><div class="source-list">${stock.sources.map(source => `<a href="${source[2]}" target="_blank" rel="noopener"><span>${source[0]}</span><time>${source[1]}</time><b>↗</b></a>`).join("")}</div><p class="method-note">研究框架参考巴菲特股东信、芒格决策清单、段永平投资问答、散户乙历史发言及杰克·韦尔奇管理框架。相关材料仅用于方法论推演；五位视角不等于其本人对当前价格的公开评级。</p></section></div></main>${footer()}`;
  }

  const isStock = location.pathname.endsWith("stock.html");
  const isIndustry = location.pathname.endsWith("industry.html");
  if (isStock) {
    const code = new URLSearchParams(location.search).get("code");
    const stock = db.stocks.find(item => item.code === code);
    if (stock) {
      renderStock(stock);
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
})();
