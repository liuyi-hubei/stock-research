async (page) => {
  const errors=[], failures=[];
  await page.emulateMedia({reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:8080/')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  for(const width of [1440,320,390,430]){
    await page.setViewportSize({width,height:1000});
    await page.goto('http://127.0.0.1:8080/industry.html?id=media-film-content');
    if(await page.locator('h1').innerText()!=='影视行业深度研究报告')failures.push('title '+width);
    const picture=page.locator('figure img');await picture.scrollIntoViewIfNeeded();
    await picture.evaluate(img=>img.decode());
    if(!await picture.evaluate(img=>img.naturalWidth>1000))failures.push('original image '+width);
    if(await page.locator('.industry-reading table').count()!==4)failures.push('four tables '+width);
    if(await page.locator('#original-references .ind-p').count()!==43)failures.push('references '+width);
    if(await page.locator('#sources .source-list').count()!==0)failures.push('duplicate references '+width);
    if(await page.locator('.industry-reading h3.ind-h3').count()!==10 || await page.locator('.industry-reading h4.ind-h4').count()<10)failures.push('heading hierarchy '+width);
    if(await page.locator('.industry-reading > section').nth(1).getAttribute('id')!=='chapter-1')failures.push('chapter begins with text '+width);
    if(!await page.locator('.industry-reading').evaluate(el=>el.getBoundingClientRect().width<=820))failures.push('reading width '+width);
    const sizes=await page.locator('#chapter-2').evaluate(el=>({p:getComputedStyle(el.querySelector('.ind-p')).fontSize,li:getComputedStyle(el.querySelector('.bullet-list li')).fontSize,h3:parseFloat(getComputedStyle(el.querySelector('h3')).fontSize),h4:parseFloat(getComputedStyle(el.querySelector('h4')).fontSize),border:getComputedStyle(el.querySelector('.bullet-list li')).borderBottomWidth}));
    if(sizes.p!==sizes.li || sizes.h3<=sizes.h4 || sizes.border!=='0px')failures.push('typography '+width);
    if(await page.locator('.industry-download').first().getAttribute('href')!=='reports/industries/影视行业深度研究报告-用户提供-导入20261023.md')failures.push('download '+width);
    await page.getByRole('navigation',{name:'报告目录'}).getByRole('link',{name:'投资逻辑',exact:true}).click();
    if(!page.url().endsWith('#chapter-5'))failures.push('navigation '+width);
    if(!await page.locator('.report-nav a').evaluateAll(links=>links.every(a=>a.scrollWidth<=a.clientWidth+1)))failures.push('navigation labels overlap '+width);
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1))failures.push('overflow '+width);
    await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0);});
    await page.screenshot({path:`output/playwright/media-import-${width}.png`,fullPage:false});
    await page.locator('#chapter-2 h3').first().evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await page.screenshot({path:`output/playwright/media-reading-${width}.png`,fullPage:false});
  }
  await page.goto('http://127.0.0.1:8080/reports.html?category=industries');
  const item=page.locator('a.industry-report-row[href="industry.html?id=media-film-content"]');
  if(await item.count()!==1 || !(await item.innerText()).includes('影视行业深度研究报告'))failures.push('listing');
  if(errors.length||failures.length)throw Error(JSON.stringify({errors,failures}));
  return {widths:[1440,320,390,430],tables:4,references:43,errors,failures};
}
