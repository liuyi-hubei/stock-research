async (page) => {
  const failures=[], errors=[];
  const check=(ok,label)=>{if(!ok) failures.push(label);};
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:8080/')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:8080/');
  await page.getByRole('button',{name:'按基准 IRR',exact:true}).click();
  await page.getByRole('button',{name:/查看全部/}).click();
  check(await page.locator('.ranking-row').filter({hasText:'牧原股份'}).count()===0,'excluded from ranking');
  await page.getByRole('button',{name:'按回报差额',exact:true}).click();
  await page.goto('http://127.0.0.1:8080/reports.html?category=stocks&q=002714');
  check(await page.getByText('牧原股份',{exact:true}).count()>0,'searchable listing');
  for(const width of [1440,320,390,430]){
    await page.setViewportSize({width,height:1000});
    await page.goto('http://127.0.0.1:8080/stock.html?code=002714');
    check((await page.locator('h1').innerText()).includes('牧原股份'),'heading '+width);
    await page.getByRole('navigation',{name:'报告目录'}).getByRole('link',{name:'估值',exact:true}).click();
    check(page.url().endsWith('#valuation'),'directory '+width);
    const text=await page.locator('body').innerText();
    check(text.includes('待重新评估') && /参考买入价[：:\s]*暂不提供/.test(text),'pending disclosure '+width);
    check(await page.locator('#trial-price, #price-trial-form, #price-trial-results').count()===0,'pending has no trial '+width);
    check(!/下调后IRR|上调后IRR|第1—10年EPS增速/.test(text),'pending has no scenario/sensitivity '+width);
    check(await page.locator('#forecast tbody tr, #valuation table').count()===0,'pending has no numerical tables '+width);
    check(await page.evaluate(()=>{
      const s=window.STOCK_RESEARCH.stocks.find(s=>s.code==='002714'),m=window.ShareholderModel;
      return m.isPending(s) && m.evaluate(s)===null && m.sensitivity(s)===null && !m.eligibility(s).eligible;
    }),'pending engine '+width);
    const details=page.locator('details').first();await details.locator('summary').click();
    check(await details.getAttribute('open')!==null,'expand '+width);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);
    await page.screenshot({path:`output/playwright/muyuan-${width}.png`,fullPage:false});
  }
  console.log(JSON.stringify({failures,errors}));
  if(failures.length||errors.length)throw new Error('Muyuan browser regression failed: '+JSON.stringify({failures,errors}));
}
