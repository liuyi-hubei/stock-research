(function () {
  const db = window.STOCK_RESEARCH;
  const money = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

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
    return `<footer><div class="shell">仅作个人研究记录，不构成投资建议。模型输出取决于假设，正式决策前请核对原始披露。</div></footer>`;
  }

  function calculate(model) {
    let eps = Number(model.eps);
    let shares = 1;
    let dividends = 0;
    for (let year = 1; year <= 10; year += 1) {
      const growth = year <= 3 ? Number(model.growth1) / 100 : Number(model.growth2) / 100;
      eps *= 1 + growth;
      const dividend = eps * Number(model.payout) / 100 * shares;
      dividends += dividend;
      const reinvestPrice = eps * Number(model.exitPE);
      shares += dividend / reinvestPrice;
    }
    const terminal = shares * eps * Number(model.exitPE);
    const cagr = (Math.pow(terminal / Number(model.cost), 1 / 10) - 1) * 100;
    return { eps, shares, dividends, terminal, cagr };
  }

  function renderHome() {
    document.body.innerHTML = `${header("stocks")}<main><div class="shell">
      <section><div class="eyebrow">Personal equity research</div><h1>把观点变成可以持续验证的记录。</h1><p class="lede">围绕财报、公告、渠道和价格信号，保留每一次预测、修正与反证。这里不追逐即时结论，只跟踪长期现金流。</p><div class="notice">初版展示的是模型结构与演示参数；正式研究结论将在每次财报发布后手动触发更新，并附原始来源。</div></section>
      <section class="section" id="stocks"><div class="section-head"><h2>研究标的</h2><p>${db.stocks.length} 家公司 · 点击进入独立研究页</p></div><div class="stock-grid">
        ${db.stocks.map(stock => { const r = calculate(stock.model); return `<a class="stock-card" data-code="${stock.code}" href="stock.html?code=${stock.code}">
          <div class="card-top"><span class="tag">${stock.status}</span><span class="market">${stock.market} · ${stock.industry}</span></div>
          <div class="stock-title"><h2>${stock.name}</h2><span class="stock-code">${stock.code}</span></div>
          <p class="thesis">${stock.thesis}</p>
          <div class="metric-row"><div class="metric"><span>估值状态</span><strong>${stock.valuation}</strong></div><div class="metric"><span>演示模型年化</span><strong>${Number.isFinite(r.cagr) ? r.cagr.toFixed(1) + "%" : "—"}</strong></div><span class="arrow">↗</span></div>
        </a>`; }).join("")}
      </div></section>
      <section class="section" id="updates"><div class="section-head"><h2>研究更新</h2><p>保留判断变化，而不只展示最新答案</p></div><div class="timeline">
        ${db.updates.map(item => `<article class="timeline-item"><time>${item.date}</time><span class="type">${item.type}</span><div><h3>${item.title}</h3><p>${item.detail}</p></div></article>`).join("")}
      </div></section>
    </div></main>${footer()}`;
  }

  function renderStock(stock) {
    document.title = `${stock.name}研究 | ${db.meta.siteName}`;
    document.body.innerHTML = `${header("stocks")}<main><div class="shell">
      <a class="back" href="index.html">← 返回研究标的</a>
      <section class="detail-hero"><div><div class="eyebrow">${stock.status} · ${stock.industry}</div><h1>${stock.name}</h1><div class="ticker">${stock.market} / ${stock.code}</div></div><aside class="verdict"><span>当前研究状态</span><strong>${stock.valuation}</strong><span>${stock.confidence}</span></aside></section>
      <section class="section panel"><h2>核心判断</h2><p class="lede">${stock.thesis}</p></section>
      <section class="section two-col"><article class="panel"><h2>下一步验证</h2><ul class="bullet-list">${stock.questions.map(x => `<li>${x}</li>`).join("")}</ul></article><article class="panel"><h2>失效与风险</h2><ul class="bullet-list">${stock.risks.map(x => `<li>${x}</li>`).join("")}</ul></article></section>
      <section class="section"><div class="section-head"><h2>十年分红复投模型</h2><p>参数可编辑，结果即时重算</p></div><div class="model-layout">
        <form class="panel form-grid" id="model-form">
          <label>买入成本（元）<input name="cost" type="number" step="0.01" min="0.01" value="${stock.model.cost}"></label>
          <label>起始每股收益（元）<input name="eps" type="number" step="0.01" min="0.01" value="${stock.model.eps}"></label>
          <label>前3年增速（%）<input name="growth1" type="number" step="0.1" value="${stock.model.growth1}"></label>
          <label>后7年增速（%）<input name="growth2" type="number" step="0.1" value="${stock.model.growth2}"></label>
          <label>分红率（%）<input name="payout" type="number" step="1" min="0" max="100" value="${stock.model.payout}"></label>
          <label>第10年退出PE<input name="exitPE" type="number" step="0.5" min="1" value="${stock.model.exitPE}"></label>
        </form>
        <article class="panel result"><div><span class="eyebrow">Estimated annual return</span><div class="result-number" id="cagr">—</div><p>含现金分红按当年模型估值复投，不考虑税费和交易成本。</p></div><div><div class="result-grid"><div><span>第10年EPS</span><strong id="terminal-eps">—</strong></div><div><span>累计持股</span><strong id="shares">—</strong></div><div><span>期末价值</span><strong id="terminal">—</strong></div></div><p class="model-note">${stock.modelNote}</p></div></article>
      </div></section>
    </div></main>${footer()}`;

    const form = document.querySelector("#model-form");
    function update() {
      const values = Object.fromEntries(new FormData(form).entries());
      const r = calculate(values);
      document.querySelector("#cagr").textContent = Number.isFinite(r.cagr) ? `${r.cagr.toFixed(1)}%` : "—";
      document.querySelector("#terminal-eps").textContent = Number.isFinite(r.eps) ? `¥${money.format(r.eps)}` : "—";
      document.querySelector("#shares").textContent = Number.isFinite(r.shares) ? `${r.shares.toFixed(2)} 股` : "—";
      document.querySelector("#terminal").textContent = Number.isFinite(r.terminal) ? `¥${money.format(r.terminal)}` : "—";
    }
    form.addEventListener("input", update);
    update();
  }

  favicon();
  const isStock = location.pathname.endsWith("stock.html");
  if (isStock) {
    const code = new URLSearchParams(location.search).get("code");
    const stock = db.stocks.find(item => item.code === code);
    if (stock) renderStock(stock);
    else document.body.innerHTML = `${header()}<main class="shell empty"><h1>未找到这个标的</h1><p>请返回首页选择研究公司。</p></main>${footer()}`;
  } else {
    renderHome();
  }
})();
