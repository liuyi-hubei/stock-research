async (page) => {
  const failures = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith('http://127.0.0.1:8080/') && response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  const check = (ok, label) => { if (!ok) failures.push(label); };
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:8080/');
  await page.getByRole('button', {name:'按基准 IRR'}).click();
  const rowCount = () => page.locator('.ranking-row').count();
  const initial = await rowCount();
  const total = Number((await page.getByRole('button', {name:/查看全部/}).innerText()).match(/\d+/)[0]);
  await page.getByRole('button', {name:/查看全部/}).click();
  const expanded = await rowCount();
  check(await page.locator('.return-chart-row').count() === expanded, 'chart and ranking count');
  check(initial === Math.min(10,total) && expanded === total, 'expand ranking rows');
  await page.getByRole('button', {name:/只看前/}).click();
  check(await rowCount() === Math.min(10,total), 'collapse ranking rows');
  await page.getByRole('button', {name:'按回报差额'}).click();
  for (const width of [1440,320,390,430]) {
    await page.setViewportSize({width,height:width === 390 ? 844 : 1000});
    await page.goto('http://127.0.0.1:8080/');
    check(await page.locator('.return-chart-row').count() === Math.min(10,total), 'chart top ten '+width);
    const chartDimensions = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth}));
    check(chartDimensions.scroll <= chartDimensions.width + 1, 'chart overflow '+width);
    for (const code of ['01810','300750','600941','01030','002594','600809','002304','09988','600873']) {
      await page.goto('http://127.0.0.1:8080/stock.html?code=' + code);
      check(await page.locator('h1').count() === 1, code + ' heading');
      await page.getByRole('navigation', {name:'报告目录'}).getByRole('link', {name:'估值',exact:true}).click();
      check(page.url().endsWith('#valuation'), code + ' navigation');
      const reading = await page.evaluate(() => ({
        directory: getComputedStyle(document.querySelector('.report-nav')).position,
        tables: [...document.querySelectorAll('.report-body .table-wrap')].every(t => t.tabIndex === 0 && t.getAttribute('role') === 'region'),
        hints: document.querySelectorAll('.mobile-table-hint').length,
        bodies: document.querySelectorAll('.report-body .table-wrap').length
      }));
      check(reading.directory === (width <= 680 ? 'fixed' : 'static'), code + ' responsive directory '+width);
      check(reading.tables && reading.hints === reading.bodies, code + ' accessible tables '+width);
      const originalVerdict = await page.locator('.irr-verdict').innerText();
      const trialInput = page.locator('#trial-price');
      const originalPrice = await trialInput.inputValue();
      const originalTrial = await page.locator('#price-trial-results').innerText();
      await trialInput.fill(String(Number(originalPrice) * .8));
      check(await page.locator('#price-trial-results').innerText() !== originalTrial, code + ' trial changes');
      check(await page.locator('.irr-verdict').innerText() === originalVerdict, code + ' original verdict preserved');
      await trialInput.fill('0');
      check(await trialInput.getAttribute('aria-invalid') === 'true', code + ' invalid trial');
      check((await page.locator('#price-trial-results').innerText()).includes('暂无有效'), code + ' hides stale trial');
      await page.getByRole('button',{name:'恢复研究基准价',exact:true}).click();
      check(await trialInput.inputValue() === originalPrice && await page.locator('#price-trial-results').innerText() === originalTrial, code + ' reset trial');
      const detail = page.locator('details').first();
      if (await detail.count()) { await detail.locator('summary').click(); check(await detail.getAttribute('open') !== null, code + ' expand details'); }
      const dimensions = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth}));
      check(dimensions.scroll <= dimensions.width + 1, code + ' overflow ' + width);
      if (['01810','300750','002594','600809','002304','09988','600873'].includes(code)) await page.screenshot({path:'output/playwright/' + code + '-' + width + '.png',fullPage:true});
    }
    await page.goto('http://127.0.0.1:8080/reports.html?category=stocks');
    check(await page.getByText('小米集团', {exact:true}).count() > 0, 'xiaomi listing');
    check(await page.getByText('宁德时代', {exact:true}).count() > 0, 'catl listing');
    for (const name of ['比亚迪','山西汾酒','洋河股份','阿里巴巴','梅花生物']) check(await page.getByText(name, {exact:true}).count() > 0, name + ' listing');
    const dimensions = await page.evaluate(() => ({width:innerWidth, scroll:document.documentElement.scrollWidth}));
    check(dimensions.scroll <= dimensions.width + 1, 'listing overflow');
  }
  if (failures.length || errors.length) throw new Error(JSON.stringify({failures,errors}));
  return {initial,expanded,failures,errors};
}
