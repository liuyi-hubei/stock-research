async(page)=>{
 const failures=[],errors=[],check=(ok,label)=>{if(!ok)failures.push(label);};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:8080/')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:8080/');
 await page.getByRole('button',{name:'按基准 IRR',exact:true}).click();await page.getByRole('button',{name:/查看全部/}).click();
 check(await page.locator('.ranking-row').filter({hasText:'万华化学'}).count()===0,'Wanhua pending excluded');
 for(const code of ['600309','600406']){
  await page.goto('http://127.0.0.1:8080/reports.html?category=stocks&q='+code);
  check((await page.locator('body').innerText()).includes(code),'search '+code);
  for(const width of [1440,320,390,430]){
   await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:8080/stock.html?code='+code);
   check(await page.locator('.research-section').count()===6,'six sections '+code+'/'+width);
   for(const id of ['business','culture','perspectives'])check(await page.locator('#'+id).count()===1,'new section '+id);
   await page.getByRole('navigation',{name:'报告目录'}).getByRole('link',{name:'企业文化',exact:true}).click();
   check(page.url().endsWith('#culture'),'new title navigation '+width);
   if(code==='600309')check(await page.locator('#trial-price').count()===0,'pending has no trial');
   else {const before=await page.locator('#price-trial-results').innerText();await page.locator('#trial-price').fill('15');check(await page.locator('#price-trial-results').innerText()!==before,'trial');await page.getByRole('button',{name:'恢复研究基准价'}).click();}
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+code+'/'+width);
   await page.locator('#business').scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/merge-${code}-${width}.png`});
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:8080/stock.html?code=01179');
 check(await page.locator('a[href="report-01179-20261026.html"]').count()===0,'no supplement entry');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});check(await page.locator('.research-section').count()===6,'Huazhu formal sections');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Huazhu overflow '+width);await page.getByRole('navigation',{name:'报告目录'}).getByRole('link',{name:'企业文化',exact:true}).click();check(page.url().endsWith('#culture'),'Huazhu formal navigation');await page.locator('#business').scrollIntoViewIfNeeded();await page.screenshot({path:`output/playwright/formal-huazhu-${width}.png`});}
 if(failures.length||errors.length)throw Error(JSON.stringify({failures,errors}));return {failures,errors};
}
