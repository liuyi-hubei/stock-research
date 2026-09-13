(function () {
  const db = window.STOCK_RESEARCH;
  const price = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const returnValue = value => Number.parseFloat(String(value).replace("%", "")) || 0;
  const rankedStocks = [...db.stocks].sort((a, b) => returnValue(b.baseReturn) - returnValue(a.baseReturn)).slice(0, 10);
  const highestReturn = Math.max(...rankedStocks.map(stock => returnValue(stock.baseReturn)), 1);

  function favicon() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#08090b"/><path d="M15 43V25h7v18zm13 0V18h7v25zm13 0V12h7v31z" fill="#f0c56d"/></svg>`;
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    document.head.appendChild(link);
  }

  function header(active) {
    return `<header class="site-header"><div class="shell nav">
      <a class="brand" href="index.html" aria-label="返回研究首页"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>${db.meta.siteName}</span></a>
      <nav class="nav-links" aria-label="主导航"><a class="${active === "ranking" ? "active" : ""}" href="index.html#ranking">收益率排行</a><a class="${active === "reports" ? "active" : ""}" href="index.html#reports">个股报告</a></nav>
      <div class="header-meta"><span>研究数据</span><strong>${db.meta.updatedAt}</strong></div>
    </div></header>`;
  }

  function footer() {
    return `<footer class="site-footer"><div class="shell footer-inner"><div><strong>${db.meta.siteName}</strong><p>研究生意，估算现金流，等待价格。</p></div><p>数据截至 ${db.meta.updatedAt}。内容仅作个人研究记录，不构成投资建议。</p></div></footer>`;
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
    return `<div class="scenario-grid">${stock.model.scenarios.map((scenario, index) => `<article class="scenario ${index === 1 ? "base" : ""}"><div class="scenario-title"><span>${scenario.name}情景</span>${index === 1 ? "<em>核心估计</em>" : ""}</div><strong class="scenario-return">${scenario.cagr}</strong><small>十年分红复投年化</small><dl><div><dt>起始EPS</dt><dd>${scenario.startEps}</dd></div><div><dt>利润增速</dt><dd>${scenario.growth}</dd></div><div><dt>分红率</dt><dd>${scenario.payout}</dd></div><div><dt>退出PE</dt><dd>${scenario.exitPE}</dd></div><div><dt>累计分红①</dt><dd>${scenario.dividends}</dd></div><div><dt>期末持股</dt><dd>${scenario.shares}</dd></div><div><dt>期末总价值</dt><dd>${scenario.terminal}</dd></div><div><dt>10%折现值</dt><dd>${scenario.pv}</dd></div></dl></article>`).join("")}</div><p class="footnote">①累计分红为复投过程中收到的名义现金合计，已全部用于增持，不能与期末价值再次相加。</p>`;
  }

  function modelTable(stock) {
    return `<div class="table-wrap"><table><thead><tr><th>年度</th><th>EPS（元）</th><th>当年分红②</th><th>年末持股</th><th>年末总价值（元）</th></tr></thead><tbody>${stock.model.baseRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="footnote">②当年分红按年初持股计算并在年内按基准情景PE复投；金额随累计持股增加。</p>`;
  }

  function rankingRows() {
    return rankedStocks.map((stock, index) => {
      const width = Math.max(12, returnValue(stock.baseReturn) / highestReturn * 100);
      return `<a class="ranking-row" href="stock.html?code=${stock.code}" style="--rank-width:${width}%"><span class="rank-number">${String(index + 1).padStart(2, "0")}</span><span class="rank-company"><strong>${stock.name}</strong><small>${stock.code} · ${stock.industry}</small></span><span class="rank-track" aria-hidden="true"><i></i></span><span class="rank-return"><strong>${stock.baseReturn}</strong><small>基准年化</small></span><span class="row-arrow" aria-hidden="true">↗</span></a>`;
    }).join("");
  }

  function reportRows() {
    return db.stocks.map((stock, index) => `<a class="report-row" href="stock.html?code=${stock.code}"><span class="report-index">${String(index + 1).padStart(2, "0")}</span><div class="report-main"><div class="report-kicker">${stock.market} · ${stock.status}</div><h3>${stock.name}</h3><p>${stock.thesis}</p></div><dl class="report-metrics"><div><dt>基准年化</dt><dd>${stock.baseReturn}</dd></div><div><dt>最新收盘</dt><dd>¥${price.format(stock.price)}</dd></div><div><dt>研究结论</dt><dd>${stock.valuation}</dd></div></dl><span class="report-action">阅读报告 <b>↗</b></span></a>`).join("");
  }

  function renderHome() {
    document.body.className = "home-page";
    document.body.innerHTML = `${header("ranking")}<main><section class="ranking-section dark-band" id="ranking"><div class="shell"><div class="section-intro inverse"><div><span class="section-number">01</span><h1>预期收益率排名</h1></div><p>按个股报告基准情景中的十年分红复投年化收益率排序，最多展示 10 家。</p></div><div class="ranking-head"><span>排名 / 公司</span><span>相对位置</span><span>预期回报</span></div><div class="ranking-list">${rankingRows()}</div><p class="ranking-note">收益率来自固定情景模型，是研究假设的可比结果，不是实时交易信号。</p></div></section><section class="reports-section light-band" id="reports"><div class="shell"><div class="section-intro"><div><span class="section-number">02</span><h2>个股报告</h2></div><p>每家公司保留完整判断链：事实、预测、估值、五种视角、风险与反证。</p></div><div class="report-list">${reportRows()}</div></div></section></main>${footer()}`;
  }

  function reportNav() {
    return `<nav class="report-nav" aria-label="报告目录"><a href="#summary">结论</a><a href="#status">现状</a><a href="#forecast">利润</a><a href="#valuation">估值</a><a href="#framework">五视角</a><a href="#risks">风险</a><a href="#sources">来源</a></nav>`;
  }

  function renderStock(stock) {
    document.body.className = "stock-page";
    document.title = `${stock.name}完整研究报告 | ${db.meta.siteName}`;
    document.body.innerHTML = `${header("reports")}<main><section class="detail-cover dark-band"><div class="shell"><a class="back" href="index.html#reports">← 返回个股报告</a><div class="detail-hero"><div><div class="eyebrow">${stock.status} · ${stock.industry}</div><h1>${stock.name}</h1><div class="ticker">${stock.market} / ${stock.code} · 研究日 ${db.meta.updatedAt}</div></div><aside class="price-panel"><span>${stock.priceDate} 收盘</span><strong>¥${price.format(stock.price)}</strong><small>${stock.marketCap}</small></aside></div>${reportNav()}</div></section><div class="shell report-body"><section class="section lead-panel" id="summary"><div class="section-label">01 / 投资结论</div><h2>${stock.valuation}</h2><p class="lede">${stock.conclusion}</p><div class="verdict-grid"><div><span>基准十年年化</span><strong>${stock.baseReturn}</strong></div><div><span>研究置信度</span><strong>${stock.confidence}</strong></div><div><span>模型价格</span><strong>¥${price.format(stock.price)}</strong></div></div></section><section class="section" id="status"><div class="section-head"><h2>行业与企业现状</h2><p>先看生意，再看价格</p></div><div class="two-col prose-grid"><article class="panel"><div class="section-label">行业</div>${paragraphs(stock.industryStatus)}</article><article class="panel"><div class="section-label">公司</div>${paragraphs(stock.companyStatus)}</article></div></section><section class="section"><div class="section-head"><h2>关键事实</h2><p>最新实际披露与行情</p></div>${factTable(stock.facts)}</section><section class="section"><div class="section-head"><h2>关键争议</h2><p>结论与反证分开</p></div><div class="debate-grid">${stock.debate.map(item => `<article class="panel"><h3>${item.title}</h3><p>${item.body}</p></article>`).join("")}</div></section><section class="section" id="forecast"><div class="section-head"><h2>2026年利润预测</h2><p>不把半年数据简单乘二</p></div><article class="model-intro"><p>${stock.profitForecast.note}</p></article>${forecastTable(stock)}</section><section class="section" id="valuation"><div class="section-head"><h2>十年分红复投与现金流折现</h2><p>${stock.model.period} · 起始价 ${stock.model.price}</p></div><article class="model-intro"><div class="section-label">计算口径</div><p>${stock.model.method}</p></article>${scenarioCards(stock)}<article class="dividend-view"><div class="section-label">分红判断</div><p>${stock.dividendView}</p></article><details class="projection"><summary>展开基准情景逐年现金流</summary>${modelTable(stock)}</details></section><section class="section"><div class="section-head"><h2>护城河与商业质量</h2><p>优势必须转化为所有者现金流</p></div><article class="panel">${bullets(stock.moat)}</article></section><section class="section" id="framework"><div class="section-head"><h2>五种独立研究视角</h2><p>同一家公司，五套独立判断</p></div><div class="view-grid">${stock.masterViews.map(view => `<article class="panel view-card"><div class="section-label">${view.name}</div><h3>${view.verdict}</h3><p>${view.text}</p></article>`).join("")}</div></section><section class="section evidence-grid" id="risks"><article><div class="section-label">后续验证</div><h2>什么会提高置信度</h2>${bullets(stock.questions)}</article><article class="danger"><div class="section-label">失效条件</div><h2>什么会推翻判断</h2>${bullets(stock.risks)}</article></section><section class="section sources" id="sources"><div class="section-head"><h2>来源与方法</h2><p>公开来源可直接打开</p></div><div class="source-list">${stock.sources.map(source => `<a href="${source[2]}" target="_blank" rel="noopener"><span>${source[0]}</span><time>${source[1]}</time><b>↗</b></a>`).join("")}</div><p class="method-note">研究框架参考巴菲特股东信、芒格决策清单、段永平投资问答、散户乙历史发言及杰克·韦尔奇管理框架。相关材料仅用于方法论推演；五位视角不等于其本人对当前价格的公开评级。</p></section></div></main>${footer()}`;
  }

  favicon();
  const isStock = location.pathname.endsWith("stock.html");
  if (isStock) {
    const code = new URLSearchParams(location.search).get("code");
    const stock = db.stocks.find(item => item.code === code);
    if (stock) renderStock(stock);
    else document.body.innerHTML = `${header()}<main class="shell empty"><h1>未找到这个标的</h1><p>请返回首页选择研究公司。</p></main>${footer()}`;
  } else renderHome();
})();
