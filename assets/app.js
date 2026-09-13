(function () {
  const db = window.STOCK_RESEARCH;
  const price = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function favicon() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#071019"/><path d="M14 45V19h8v26zm14 0V29h8v16zm14 0V13h8v32z" fill="#d7a447"/></svg>`;
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    document.head.appendChild(link);
  }

  function header(active) {
    return `<header class="site-header"><div class="shell nav">
      <a class="brand" href="index.html"><span class="brand-mark">研</span><span>${db.meta.siteName}</span></a>
      <nav class="nav-links" aria-label="主导航"><a class="${active === "stocks" ? "active" : ""}" href="index.html#stocks">个股</a><a class="${active === "updates" ? "active" : ""}" href="index.html#updates">更新</a></nav>
      <div class="header-meta">DATA · ${db.meta.updatedAt}<br>${db.meta.dataMode}</div>
    </div></header>`;
  }

  function footer() {
    return `<footer><div class="shell">研究数据截至 ${db.meta.updatedAt}。事实、推断与情景假设已尽量分开；内容仅作个人研究记录，不构成投资建议。</div></footer>`;
  }

  const paragraphs = items => items.map(x => `<p>${x}</p>`).join("");
  const bullets = items => `<ul class="bullet-list">${items.map(x => `<li>${x}</li>`).join("")}</ul>`;

  function factTable(rows) {
    return `<div class="table-wrap"><table><thead><tr><th>指标</th><th>数值</th><th>期间 / 时点</th><th>口径</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function forecastTable(stock) {
    return `<div class="table-wrap"><table><thead><tr><th>情景</th><th>2026归母净利润</th><th>EPS</th><th>当前PE</th><th>核心假设</th></tr></thead><tbody>${stock.profitForecast.scenarios.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.profit}</td><td>${s.eps}</td><td>${s.pe}</td><td>${s.reason}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function scenarioCards(stock) {
    return `<div class="scenario-grid">${stock.model.scenarios.map((s, i) => `<article class="scenario ${i === 1 ? "base" : ""}">
      <div class="scenario-title"><span>${s.name}情景</span>${i === 1 ? '<em>核心估计</em>' : ''}</div>
      <strong class="scenario-return">${s.cagr}</strong><small>十年分红复投年化</small>
      <dl><div><dt>起始EPS</dt><dd>${s.startEps}</dd></div><div><dt>利润增速</dt><dd>${s.growth}</dd></div><div><dt>分红率</dt><dd>${s.payout}</dd></div><div><dt>退出PE</dt><dd>${s.exitPE}</dd></div><div><dt>累计分红①</dt><dd>${s.dividends}</dd></div><div><dt>期末持股</dt><dd>${s.shares}</dd></div><div><dt>期末总价值</dt><dd>${s.terminal}</dd></div><div><dt>10%折现值</dt><dd>${s.pv}</dd></div></dl>
    </article>`).join("")}</div><p class="footnote">①累计分红为复投过程中收到的名义现金合计，已全部用于增持，不能与期末价值再次相加。</p>`;
  }

  function modelTable(stock) {
    return `<div class="table-wrap"><table><thead><tr><th>年度</th><th>EPS（元）</th><th>当年分红②</th><th>年末持股</th><th>年末总价值（元）</th></tr></thead><tbody>${stock.model.baseRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="footnote">②当年分红按年初持股计算并在年内按基准情景PE复投；金额随累计持股增加。</p>`;
  }

  function renderHome() {
    document.body.innerHTML = `${header("stocks")}<main><div class="shell">
      <section class="home-hero"><div class="eyebrow">Evidence before opinion</div><h1>研究生意，估算现金流，等待价格。</h1><p class="lede">每家公司保留一份可复算的完整报告：行业与企业现状、利润预测、十年分红复投现金流和失效条件。模型采用统一研究时点，不使用个人成本价。</p><div class="notice">当前行情基准：${db.meta.priceDate}。报告不是实时交易信号；价格或基本面变化后需要重新估算。</div></section>
      <section class="section" id="stocks"><div class="section-head"><h2>完整个股研究</h2><p>${db.stocks.length} 家公司 · 2026年中报口径</p></div><div class="stock-grid">
        ${db.stocks.map(stock => `<a class="stock-card" data-code="${stock.code}" href="stock.html?code=${stock.code}">
          <div class="card-top"><span class="tag">${stock.status}</span><span class="market">${stock.market} · ${stock.industry}</span></div>
          <div class="stock-title"><h2>${stock.name}</h2><span class="stock-code">${stock.code}</span></div>
          <p class="thesis">${stock.thesis}</p>
          <div class="metric-row"><div class="metric"><span>最新收盘</span><strong>¥${price.format(stock.price)}</strong></div><div class="metric"><span>基准十年年化</span><strong>${stock.baseReturn}</strong></div><div class="metric wide"><span>研究结论</span><strong>${stock.valuation}</strong></div><span class="arrow">↗</span></div>
        </a>`).join("")}
      </div></section>
      <section class="section" id="updates"><div class="section-head"><h2>研究更新</h2><p>保留判断变化，而不只展示最新答案</p></div><div class="timeline">${db.updates.map(item => `<article class="timeline-item"><time>${item.date}</time><span class="type">${item.type}</span><div><h3>${item.title}</h3><p>${item.detail}</p></div></article>`).join("")}</div></section>
    </div></main>${footer()}`;
  }

  function reportNav() {
    return `<nav class="report-nav" aria-label="报告目录"><a href="#summary">结论</a><a href="#status">现状</a><a href="#forecast">利润</a><a href="#valuation">估值</a><a href="#framework">五视角</a><a href="#risks">风险</a><a href="#sources">来源</a></nav>`;
  }

  function renderStock(stock) {
    document.title = `${stock.name}完整研究报告 | ${db.meta.siteName}`;
    document.body.innerHTML = `${header("stocks")}<main><div class="shell">
      <a class="back" href="index.html">← 返回研究首页</a>
      <section class="detail-hero"><div><div class="eyebrow">${stock.status} · ${stock.industry}</div><h1>${stock.name}</h1><div class="ticker">${stock.market} / ${stock.code} · 研究日 ${db.meta.updatedAt}</div></div><aside class="price-panel"><span>${stock.priceDate} 收盘</span><strong>¥${price.format(stock.price)}</strong><small>${stock.marketCap}</small></aside></section>
      ${reportNav()}
      <section class="section panel lead-panel" id="summary"><div class="section-label">01 / 投资结论</div><h2>${stock.valuation}</h2><p class="lede">${stock.conclusion}</p><div class="verdict-grid"><div><span>基准十年年化</span><strong>${stock.baseReturn}</strong></div><div><span>研究置信度</span><strong>${stock.confidence}</strong></div><div><span>模型价格</span><strong>¥${price.format(stock.price)}</strong></div></div></section>
      <section class="section" id="status"><div class="section-head"><h2>行业与企业现状</h2><p>先看生意，再看价格</p></div><div class="two-col prose-grid"><article class="panel"><div class="section-label">行业</div>${paragraphs(stock.industryStatus)}</article><article class="panel"><div class="section-label">公司</div>${paragraphs(stock.companyStatus)}</article></div></section>
      <section class="section"><div class="section-head"><h2>关键事实</h2><p>最新实际披露与行情</p></div>${factTable(stock.facts)}</section>
      <section class="section"><div class="section-head"><h2>今天讨论的关键争议</h2><p>结论与反证分开</p></div><div class="debate-grid">${stock.debate.map(x => `<article class="panel"><h3>${x.title}</h3><p>${x.body}</p></article>`).join("")}</div></section>
      <section class="section" id="forecast"><div class="section-head"><h2>2026年利润预测</h2><p>不把半年数据简单乘二</p></div><article class="panel model-intro"><p>${stock.profitForecast.note}</p></article>${forecastTable(stock)}</section>
      <section class="section" id="valuation"><div class="section-head"><h2>十年分红复投与现金流折现</h2><p>${stock.model.period} · 起始价 ${stock.model.price}</p></div><article class="panel model-intro"><div class="section-label">计算口径</div><p>${stock.model.method}</p></article>${scenarioCards(stock)}<article class="panel dividend-view"><div class="section-label">分红判断</div><p>${stock.dividendView}</p></article><details class="projection"><summary>展开基准情景逐年现金流</summary>${modelTable(stock)}</details></section>
      <section class="section"><div class="section-head"><h2>护城河与商业质量</h2><p>优势必须转化为所有者现金流</p></div><article class="panel">${bullets(stock.moat)}</article></section>
      <section class="section" id="framework"><div class="section-head"><h2>五种独立研究视角</h2><p>框架推演，不代表本人当前评级</p></div><div class="view-grid">${stock.masterViews.map(v => `<article class="panel view-card"><div class="section-label">${v.name}</div><h3>${v.verdict}</h3><p>${v.text}</p></article>`).join("")}</div></section>
      <section class="section two-col" id="risks"><article class="panel"><div class="section-label">后续验证</div><h2>什么会提高置信度</h2>${bullets(stock.questions)}</article><article class="panel danger"><div class="section-label">失效条件</div><h2>什么会推翻判断</h2>${bullets(stock.risks)}</article></section>
      <section class="section sources" id="sources"><div class="section-head"><h2>来源与方法</h2><p>公开来源可直接打开</p></div><div class="source-list">${stock.sources.map(s => `<a href="${s[2]}" target="_blank" rel="noopener"><span>${s[0]}</span><time>${s[1]}</time><b>↗</b></a>`).join("")}</div><p class="method-note">研究框架参考巴菲特股东信（内在价值、经济商誉与所有者收益）、芒格决策清单、段永平投资问答、散户乙历史发言合集及杰克·韦尔奇管理框架。相关材料仅用于方法论推演；五位视角不是本人对该公司当前价格的公开评级。</p></section>
    </div></main>${footer()}`;
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
