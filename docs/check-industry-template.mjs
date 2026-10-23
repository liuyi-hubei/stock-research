import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function render(report) {
  const body = { innerHTML: '', className: '' };
  const c = { window: {}, document: {body, querySelector: () => null}, console, location:{pathname:'/industry.html',search:'?id=test',hash:''}, Intl, URLSearchParams };
  vm.createContext(c);
  for(const file of ['data/stocks.js','data/additional-stocks.js','assets/shareholder-model.js','assets/research-freshness.js','assets/report-query.js']) vm.runInContext(read(file), c);
  c.window.INDUSTRY_REPORTS = {test:report};
  vm.runInContext(read('assets/app.js'),c);
  return body.innerHTML;
}
const report = { id:'test', title:'通用行业报告', date:'日期待核', coreConclusion:'<img src=x onerror=alert(1)>', sections:[{id:'body',title:'正文',blocks:[{p:'测试 <script>内容</script>'},{table:{head:['项','数'],rows:[['A','1']]}}]}], sourceFile:{href:'reports/industries/测试.md',format:'Markdown'} };
let html = render(report);
assert(html.includes('核心观点') && !html.includes('三底共振'));
assert(html.includes('下载原始 Markdown'));
assert(html.includes('compact-table'));
assert(!html.includes('undefined') && !html.includes('<script>内容') && !html.includes('<img src=x'));
assert(html.includes('&lt;script&gt;') && html.includes('&lt;img'));
const links = [...html.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(links, ['summary','body','sources']);
html = render({...report,sourceFile:{href:'javascript:alert(1)',format:'HTML'}});
assert(!html.includes('javascript:') && !html.includes('下载原始 HTML'));
html = render({...report, sourceFile:undefined,pdf:'reports/industries/测试.pdf',summaryTitle:'自定义摘要'});
assert(html.includes('下载原始 PDF') && html.includes('自定义摘要'));
html = render({...report, sourceFile:undefined});
assert(!html.includes('下载原始'));
html = render({...report,sources:[['来源 <script>','日期','https://example.org/verified'],['无效链接','','javascript:alert(1)']]});
assert(html.includes('https://example.org/verified') && html.includes('来源 &lt;script&gt;'));
assert(!html.includes('javascript:') && !html.includes('无效链接'));
console.log('PASS: generic industry template, optional metadata, Markdown/PDF source links, narrow tables and text escaping');
const imageReport={...report,sections:[{id:'chart',title:'原图',blocks:[{image:{src:'assets/industry-reports/media-film-content/test.png',alt:'<img onerror=x>',caption:'原图标题',note:'仅恢复原件'}}]}]};
html=render(imageReport);
assert(html.includes('loading="lazy"') && html.includes('原图标题') && html.includes('&lt;img onerror=x&gt;'));
for(const src of ['javascript:alert(1)','https://example.org/track.png','assets/industry-reports/../secret.png','assets/industry-reports/x/chart.svg']){
  html=render({...imageReport,sections:[{id:'chart',title:'原图',blocks:[{image:{src,alt:'blocked-picture'}}]}]});
  assert(!html.includes('blocked-picture'),`Unsafe image source: ${src}`);
}
console.log('PASS: original report image, escaped metadata and safe local-image paths');
const paperReport={...report,layout:'research-paper',referencesSectionId:'refs',sourceSectionTitle:'原稿说明',downloadLabel:'下载整理版 Markdown',sources:[['独有来源','','https://example.org/only-once']],sections:[{id:'body',title:'1. 第一章',blocks:[{h3:'1.1 小节'},{h4:'<script>小标题</script>'}]},{id:'refs',title:'参考文献',blocks:[{p:'完整来源'}]}]};
html=render(paperReport);
assert(html.includes('<h4 class="ind-h4">&lt;script&gt;小标题&lt;/script&gt;</h4>'));
assert(!html.includes('/ 研究正文') && !html.includes('独有来源') && html.includes('原稿说明') && html.includes('下载整理版 Markdown'));
html=render({...paperReport,referencesSectionId:'missing'});
assert(html.includes('独有来源'),'Missing references section must not hide sources');
console.log('PASS: paper heading hierarchy, one references section and fallback sources');
