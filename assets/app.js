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
  const rankedStocks = [...db.stocks].sort((a, b) => returnValue(b.baseReturn) - returnValue(a.baseReturn)).slice(0, 10);

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

  function scenarioCards(stock) {
    return `<div class="scenario-grid">${stock.model.scenarios.map((scenario, index) => `<article class="scenario ${index === 1 ? "base" : ""}"><div class="scenario-title"><span>${scenario.name}情景</span>${index === 1 ? "<em>核心估计</em>" : ""}</div><strong class="scenario-return">${scenario.cagr}</strong><small>十年分红复投年化</small><dl><div><dt>起始EPS</dt><dd>${scenario.startEps}</dd></div><div><dt>利润增速</dt><dd>${scenario.growth}</dd></div><div><dt>分红率</dt><dd>${scenario.payout}</dd></div><div><dt>退出PE</dt><dd>${scenario.exitPE}</dd></div><div><dt>累计分红①</dt><dd>${scenario.dividends}</dd></div><div><dt>期末持股</dt><dd>${scenario.shares}</dd></div><div><dt>期末总价值</dt><dd>${scenario.terminal}</dd></div><div><dt>${stock.model.discountRate}折现值</dt><dd>${scenario.pv}</dd></div></dl></article>`).join("")}</div><p class="footnote">①累计分红为复投过程中收到的名义现金合计，已全部用于增持，不能与期末价值再次相加。</p>`;
  }

  function modelTable(stock) {
    const unit = stock.model.currency || "元";
    return `<div class="table-wrap"><table><thead><tr><th>年度</th><th>EPS（${unit}）</th><th>当年分红②（${unit}）</th><th>年末持股</th><th>年末总价值（${unit}）</th></tr></thead><tbody>${stock.model.baseRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="footnote">②当年分红按年初持股计算并在年内按基准情景PE复投；金额随累计持股增加。</p>`;
  }

  function scenarioChart(stock) {
    const W = 760, H = 210, padL = 96, padR = 110, top = 34, rowH = 52;
    const discountStr = String(stock.model.discountRate).trim();
    const discount = num(discountStr) || 10;
    const rows = stock.model.scenarios.map((s, i) => ({ name: `${s.name}情景`, v: num(s.cagr), cls: ["bear", "base", "bull"][i] }));
    const min = Math.min(0, ...rows.map(r => r.v), discount) * 1.18;
    const max = Math.max(0, ...rows.map(r => r.v), discount) * 1.18;
    const x = v => padL + ((v - min) / (max - min || 1)) * (W - padL - padR);
    const bars = rows.map((r, i) => {
      const y = top + i * rowH;
      const start = Math.min(x(0), x(r.v));
      const w = Math.abs(x(r.v) - x(0));
      return `<g class="chart-row ${r.cls}"><text class="axis-label" x="${padL - 14}" y="${y + 19}" text-anchor="end">${r.name}</text><line x1="${x(0)}" y1="${y - 4}" x2="${x(0)}" y2="${y + 30}" class="ref-line"/><rect x="${start}" y="${y}" width="${w}" height="26" rx="6" class="bar"/><text class="bar-value" x="${Math.max(x(0), x(r.v)) + 12}" y="${y + 18}">${r.v.toFixed(1)}%</text></g>`;
    }).join("");
    const dx = x(discount);
    return `<figure class="chart-card"><figcaption class="chart-title">三情景十年年化收益率对比<span>虚线为该公司目标折现率 ${discountStr}，按企业风险分别校准</span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="三情景年化收益率对比图">${bars}<line x1="${dx}" y1="${top - 12}" x2="${dx}" y2="${top + rows.length * rowH - 14}" class="ref-line" stroke-dasharray="5 5"/><text class="ref-label" x="${dx}" y="${top - 18}" text-anchor="middle">折现率 ${discountStr}</text></svg><div class="chart-legend"><span class="bear">悲观</span><span class="base">基准</span><span class="bull">乐观</span></div></figure>`;
  }

  function modelChart(stock) {
    const W = 760, H = 300, padL = 76, padR = 96, top = 28, bottom = 46;
    const rows = stock.model.baseRows.map(r => ({ year: r[0], value: num(r[4]) }));
    const current = num(stock.model.price);
    const lo = Math.min(current, ...rows.map(r => r.value)) * 0.9;
    const hi = Math.max(...rows.map(r => r.value)) * 1.06;
    const x = i => padL + (i / (rows.length - 1)) * (W - padL - padR);
    const y = v => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
    const pts = rows.map((r, i) => `${x(i)},${y(r.value)}`).join(" ");
    const area = `${padL},${H - bottom} ${pts} ${x(rows.length - 1)},${H - bottom}`;
    const grid = [0.25, 0.5, 0.75].map(t => {
      const v = lo + (hi - lo) * (1 - t);
      return `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" class="grid-line"/><text class="axis-label" x="${padL - 12}" y="${y(v) + 4}" text-anchor="end">${v >= 1000 ? Math.round(v) : v.toFixed(0)}</text>`;
    }).join("");
    const yearLabels = rows.map((r, i) => `<text class="axis-label" x="${x(i)}" y="${H - bottom + 22}" text-anchor="middle">${r.year.slice(2)}年</text>`).join("");
    const dots = rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.value)}" r="3.5" class="dot"/>`).join("");
    const last = rows.at(-1);
    const first = rows[0];
    const symbol = currencySymbol(stock);
    return `<figure class="chart-card"><figcaption class="chart-title">基准情景：分红复投下每股总价值增长<span>起始价 ${symbol}${formatPrice(current)} → ${last.year}年 ${symbol}${formatPrice(last.value)}</span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="十年分红复投价值增长曲线"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f56a16" stop-opacity=".22"/><stop offset="100%" stop-color="#f56a16" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#areaFill)"/><polyline points="${pts}" class="main-line" fill="none"/><line x1="${padL}" y1="${y(current)}" x2="${W - padR}" y2="${y(current)}" class="ref-line" stroke-dasharray="5 5"/><text class="ref-label" x="${W - padR}" y="${y(current) - 8}" text-anchor="end">当前价 ${symbol}${formatPrice(current)}</text>${dots}${yearLabels}</svg><div class="chart-endpoints"><span>${first.year}年 <strong>${symbol}${formatPrice(first.value)}</strong></span><span>${last.year}年 <strong>${symbol}${formatPrice(last.value)}</strong></span></div></figure>`;
  }

  function rankingRows() {
    return rankedStocks.map((stock, index) => {
      return `<a class="ranking-row" href="stock.html?code=${stock.code}"><span class="rank-number">${String(index + 1).padStart(2, "0")}</span><span class="rank-company"><strong>${stock.name}</strong><small>${stock.code} · ${stock.industry}</small></span><span class="rank-verdict">${stock.valuation}</span><span class="rank-return"><small>十年基准年化</small><strong>${stock.baseReturn}</strong></span><span class="row-arrow" aria-hidden="true">查看报告 ↗</span></a>`;
    }).join("");
  }

  function reportRows() {
    return db.stocks.map(stock => `<a class="report-row" href="stock.html?code=${stock.code}"><div class="report-main"><div class="report-kicker">${stock.market} · ${stock.code} · ${stock.industry}</div><h3>${stock.name}</h3><p>${stock.thesis}</p></div><dl class="report-metrics"><div><dt>基准年化</dt><dd>${stock.baseReturn}</dd></div><div><dt>最新收盘</dt><dd>${displayPrice(stock)}</dd></div><div><dt>研究结论</dt><dd>${stock.valuation}</dd></div></dl><span class="report-action">阅读报告 <b>↗</b></span></a>`).join("");
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
    document.body.innerHTML = `${header("ranking")}<main><section class="home-intro"><div class="shell"><div class="intro-copy"><span class="eyebrow">长期研究 · 固定情景模型</span><h1>把判断放在数据前面</h1><p>从企业质量、估值和风险出发，比较十年基准情景下的预期收益。每个数字都能回到完整报告。</p><a class="primary-link" href="reports.html?category=stocks">浏览研究报告 <span aria-hidden="true">↗</span></a></div><div class="intro-facts"><div><span>跟踪公司</span><strong>${db.stocks.length}</strong><small>份个股研究</small></div><div><span>研究库更新</span><strong class="fact-date">${db.meta.updatedAt}</strong><small>查看报告中的口径与来源</small></div></div></div></section><section class="ranking-section" id="ranking"><div class="shell"><div class="list-heading"><div><span class="eyebrow">研究索引</span><h2>预期收益率排行</h2></div><p>按基准情景排序，点击公司查看假设与风险。</p></div><div class="ranking-list">${rankingRows()}</div><p class="ranking-note">收益率来自固定情景模型，是研究假设的可比结果，不是实时交易信号。各报告的行情基准日见详情。</p></div></section></main>${footer()}`;
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
    return `<nav class="report-nav" aria-label="报告目录"><a href="#summary">结论</a><a href="#status">现状</a><a href="#forecast">利润</a><a href="#valuation">估值</a><a href="#framework">五视角</a><a href="#risks">风险</a><a href="#sources">来源</a></nav>`;
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

  function renderStock(stock) {
    document.body.className = "stock-page";
    document.title = `${stock.name}完整研究报告 | ${db.meta.siteName}`;
    document.body.innerHTML = `${header("reports")}<main><section class="detail-cover dark-band"><div class="shell"><a class="back" href="reports.html?category=stocks">← 返回个股报告</a><div class="detail-hero"><div><div class="eyebrow">${stock.status} · ${stock.industry}</div><div class="title-row"><h1>${stock.name}</h1><span class="ticker">${stock.market} / ${stock.code}</span></div><div class="ticker ticker-sub">价格基准 ${stock.priceDate} · 完整个股研究报告</div></div><aside class="price-panel"><span>${stock.priceDate} 收盘</span><strong>${displayPrice(stock)}</strong><small>${stock.marketCap}</small></aside></div>${reportNav()}</div></section><div class="shell report-body"><section class="section lead-panel" id="summary"><div class="section-label">01 / 投资结论</div><h2>${stock.valuation}</h2><p class="lede">${stock.conclusion}</p><div class="verdict-grid"><div><span>基准十年年化</span><strong>${stock.baseReturn}</strong></div><div><span>研究置信度</span><strong>${stock.confidence}</strong></div><div><span>模型价格</span><strong>${displayPrice(stock)}</strong></div></div></section><section class="section" id="status"><div class="section-head"><h2>行业与企业现状</h2><p>先看生意，再看价格</p></div><div class="status-stack"><section class="status-block"><div class="status-side"><span class="section-label">行业</span></div><div class="status-text">${paragraphs(stock.industryStatus)}</div></section><section class="status-block"><div class="status-side"><span class="section-label">公司</span></div><div class="status-text">${paragraphs(stock.companyStatus)}</div></section></div></section><section class="section"><div class="section-head"><h2>关键事实</h2><p>最新实际披露与行情</p></div>${factTable(stock.facts)}</section><section class="section"><div class="section-head"><h2>关键争议</h2><p>结论与反证分开</p></div><div class="debate-grid">${stock.debate.map(item => `<article class="panel"><h3>${item.title}</h3><p>${item.body}</p></article>`).join("")}</div></section><section class="section" id="forecast"><div class="section-head"><h2>2026年利润预测</h2><p>不把半年数据简单乘二</p></div><article class="model-intro"><p>${stock.profitForecast.note}</p></article>${forecastTable(stock)}</section><section class="section" id="valuation"><div class="section-head"><h2>十年分红复投与现金流折现</h2><p>${stock.model.period} · 起始价 ${stock.model.price}</p></div><article class="model-intro"><div class="section-label">计算口径</div><p>${stock.model.method}</p></article>${scenarioChart(stock)}${scenarioCards(stock)}<article class="dividend-view"><div class="section-label">分红判断</div><p>${stock.dividendView}</p></article>${modelChart(stock)}<details class="projection"><summary>展开基准情景逐年现金流</summary>${modelTable(stock)}</details></section><section class="section"><div class="section-head"><h2>护城河与商业质量</h2><p>优势必须转化为所有者现金流</p></div><article class="panel">${bullets(stock.moat)}</article></section><section class="section" id="framework"><div class="section-head"><h2>五种独立研究视角</h2><p>同一家公司，五套独立判断</p></div><div class="view-grid">${stock.masterViews.map((view, index) => `<article class="panel view-card"><div class="view-head"><span class="view-num">${String(index + 1).padStart(2, "0")}</span><span class="section-label">${view.name}</span></div><h3>${view.verdict}</h3><p>${view.text}</p></article>`).join("")}</div></section><section class="section evidence-grid" id="risks"><article><div class="section-label">后续验证</div><h2>什么会提高置信度</h2>${bullets(stock.questions)}</article><article class="danger"><div class="section-label">失效条件</div><h2>什么会推翻判断</h2>${bullets(stock.risks)}</article></section><section class="section sources" id="sources"><div class="section-head"><h2>来源与方法</h2><p>公开来源可直接打开</p></div><div class="source-list">${stock.sources.map(source => `<a href="${source[2]}" target="_blank" rel="noopener"><span>${source[0]}</span><time>${source[1]}</time><b>↗</b></a>`).join("")}</div><p class="method-note">研究框架参考巴菲特股东信、芒格决策清单、段永平投资问答、散户乙历史发言及杰克·韦尔奇管理框架。相关材料仅用于方法论推演；五位视角不等于其本人对当前价格的公开评级。</p></section></div></main>${footer()}`;
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
