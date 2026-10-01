// 行业正文单一结构源导出；不改原始PDF，不覆盖已有人工Markdown。
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scope = {window:{}};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root,'data/industries.js'),'utf8'), scope);
const id = process.argv.find(arg => arg.startsWith('--id='))?.slice(5);
const report = scope.window.INDUSTRY_REPORTS[id];
assert(report, '请指定有效 --id=行业id');
assert(report.sourceFile?.format === 'Markdown', '仅导出声明为Markdown的结构源');
const target = path.resolve(root, report.sourceFile.href);
assert(target.startsWith(path.join(root,'reports/industries')+path.sep) && target.endsWith('.md'), '归档路径越界');
const cell = value => String(value).replaceAll('|','\\|').replaceAll('\n','<br>');
const table = t => [t.caption || '', '| '+t.head.map(cell).join(' | ')+' |','| '+t.head.map(()=> '---').join(' | ')+' |',...t.rows.map(row=>'| '+row.map(cell).join(' | ')+' |'),t.note ? '\n口径：'+t.note : ''].filter(Boolean).join('\n');
function block(b){
  if(b.p)return b.p;
  if(b.h3)return '### '+b.h3;
  if(b.bullets)return b.bullets.map(item=>'- '+item).join('\n');
  if(b.numbered)return b.numbered.map((item,i)=>(i+1)+'. '+item).join('\n');
  if(b.table)return table(b.table);
  if(b.panels)return b.panels.map(p=>'### '+p.title+'\n\n'+(p.body || p.items.map(item=>'- '+item).join('\n'))).join('\n\n');
  if(b.chart){
    const c=b.chart;
    if(c.type==='share')return table({caption:c.caption,head:['组成','占比'],rows:c.segments.map(s=>[s.label,s.value+'%']),note:c.note});
    assert(['bars','loss'].includes(c.type),'未支持的图表类型');
    const change=c.rows.some(row=>row.change);
    return table({caption:c.caption,head:['项目','数值'+(c.unit?'（'+c.unit+'）':''),...(change?['同比']:[])],rows:c.rows.map(row=>[row.label,String(row.value)+(c.type==='loss'?'%':''),...(change?[row.change || '—']:[])]),note:c.note});
  }
  if(b.evidence)return b.evidence.map(e=>'### '+e.label+'：'+e.heading+'\n\n'+e.items.map(item=>'- '+item).join('\n')).join('\n\n');
  throw new Error('存在未支持的归档块；不能静默漏掉内容');
}
const md = ['# '+report.title,report.subject,'研究日期与口径：'+report.date,'作者：'+report.author,'## '+report.summaryTitle,report.coreConclusion,...report.sections.flatMap(s=>['## '+s.title,s.sub,...s.blocks.map(block)]),'## 来源与研究边界',...report.sources.map(s=>'- ['+s[0]+']('+s[2]+') · '+s[1]),report.sourcesNote,report.disclaimer,'<!-- 由 docs/export-industry-archive.mjs 从结构源导出；内容修改后重新导出。 -->',''].join('\n\n');
if(process.argv.includes('--check')){
  assert(fs.existsSync(target) && fs.readFileSync(target,'utf8')===md,'行业Markdown与网页结构源不一致');
  console.log('PASS: 行业网页与Markdown完整一致');
}else{
  if(fs.existsSync(target))assert(fs.readFileSync(target,'utf8').includes('<!-- 由 docs/export-industry-archive.mjs'),'拒绝覆盖人工原件');
  fs.writeFileSync(target,md);
  console.log('已导出：'+report.sourceFile.href+'；'+md.length+'字符');
}
