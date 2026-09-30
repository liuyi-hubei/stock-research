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
  check(initial === Math.min(10,total) && expanded === total, 'expand ranking rows');
  await page.getByRole('button', {name:'只看前十'}).click();
  check(await rowCount() === Math.min(10,total), 'collapse ranking rows');
  await page.getByRole('button', {name:'按回报差额'}).click();
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:width === 390 ? 844 : 1000});
    for (const code of ['01810','300750','600941','01030','002594','600809','002304','09988','600873']) {
      await page.goto('http://127.0.0.1:8080/stock.html?code=' + code);
      check(await page.locator('h1').count() === 1, code + ' heading');
      await page.getByRole('navigation', {name:'报告目录'}).getByRole('link', {name:'估值',exact:true}).click();
      check(page.url().endsWith('#valuation'), code + ' navigation');
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
