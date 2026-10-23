async(page)=>{
 const failures=[],errors=[];await page.emulateMedia({reducedMotion:'reduce'});
 const check=(v,m)=>{if(!v)failures.push(m);};
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:8080/')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
 for(const width of [1440,320,390,430]){
  await page.setViewportSize({width,height:1000});
  for(const code of ['000568','002555','002714']){
   await page.goto('http://127.0.0.1:8080/stock.html?code='+code);
   check(await page.locator('.research-section').count()===6,code+' six chapters '+width);
   check(await page.locator('.view-card').count()===0,code+' no five persona cards');
   check(await page.locator('.research-evidence').count()>=4,code+' evidence and counterpoint');
   const heading=await page.locator('h1').innerText();check(heading.length>0,code+' heading');
   await page.getByRole('navigation',{name:'报告目录'}).getByRole('link',{name:'路径',exact:true}).click();
   check(page.url().endsWith('#path'),code+' driver navigation');
   if(code==='002714'){
    check(await page.locator('#price-trial-form').count()===0,'pending trial absent');
    check((await page.locator('#valuation').innerText()).includes('参考买入价：暂不提供'),'pending disclosure');
   }else{
    check((await page.locator('#summary').innerText()).includes('条件演算'),'conditional summary '+code);
    const input=page.locator('#trial-price'),initial=await input.inputValue(),output=await page.locator('#price-trial-results').innerText();
    await input.fill(String(Number(initial)*.8));check(await page.locator('#price-trial-results').innerText()!==output,code+' existing engine trial');
    await page.locator('#reset-trial-price').click();check(await input.inputValue()===initial,code+' reset');
   }
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),code+' overflow '+width);
   check(await page.locator('.report-nav a').evaluateAll(links=>links.every(a=>a.scrollWidth<=a.clientWidth+1)),code+' nav label overflow '+width);
   await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0);});
   await page.screenshot({path:`output/playwright/framework-${code}-${width}.png`,fullPage:false});
  }
 }
 await page.goto('http://127.0.0.1:8080/');check((await page.locator('body').innerText()).includes('条件收益比较'),'home comparison label');
 if(failures.length||errors.length)throw Error(JSON.stringify({failures,errors}));
 return {stocks:['000568','002555','002714'],widths:[1440,320,390,430],failures,errors};
}
