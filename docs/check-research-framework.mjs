import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {frameworkFiles,loadFramework} from './research-framework-files.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const c=vm.createContext({window:{}});
for(const file of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(read(file),c);
const before=JSON.stringify(c.window.STOCK_RESEARCH);
loadFramework(root,c);
const {STOCK_RESEARCH:db,RESEARCH_FRAMEWORK:plans,ResearchFramework:framework,ShareholderModel:model}=c.window;
assert.equal(JSON.stringify(db),before,'Framework changed financial source');
assert.equal(Object.keys(plans).length,frameworkFiles(root).length,'Duplicate or missing stock registration');
for(const [code,p] of Object.entries(plans)){
 const stock=db.stocks.find(s=>s.code===code);assert(stock,`Unregistered stock ${code}`);framework.validate(p,stock);
 const texts=p.sections.flatMap(s=>s.blocks).filter(b=>b.evidence);
 assert(texts.length>=4,`${code}: evidence and counterpoint required`);
 for(const {evidence:e} of texts)for(const i of e.sourceRefs)assert(stock.sources[i][0] && stock.sources[i][1] && /^(https:\/\/|reports\/)/.test(stock.sources[i][2]),`${code}: source mapping`);
 assert(p.sections[5].blocks.some(b=>b.table),`${code}: tracking/forecast audit table missing`);
 const tracking=p.sections[5].blocks.find(b=>b.table?.head[0]==='指标')?.table;
 assert(tracking && tracking.rows.length>=3 && tracking.rows.length<=5,`${code}: expected 3—5 core monitoring metrics`);
 assert(p.sections[5].blocks.filter(b=>b.table).length>=2,`${code}: forecast deviation log missing`);
 if(p.reviewState==='pending'){assert(model.isPending(stock),`${code}: description says pending but model still computes`);assert.equal(model.evaluate(stock),null);}
 const clone=JSON.parse(JSON.stringify(p));clone.sections[1].blocks.push({evidence:{claim:'x',basis:'x',counterpoint:'x',state:'已披露事实',sourceRefs:[stock.sources.length]}});assert.throws(()=>framework.validate(clone,stock),/evidence/);
 const escaped=framework.renderBlocks({...p,sections:p.sections.map((s,i)=>i? s:{...s,blocks:[{p:'<script>unsafe</script>'}]})},stock,x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;'));
 assert(escaped({...p.sections[0],blocks:[{p:'<script>unsafe</script>'}]}).includes('&lt;script&gt;'));
 const original=read(`reports/stocks/${stock.name}-${code}.md`);assert(original.includes('<!-- RESEARCH_FRAMEWORK: evidence-first-v1 -->'),`${code}: archive not migrated`);
 for(const section of p.sections)assert(original.includes('## '+section.title),`${code}: missing archive section`);
 for(const file of ['index.html','stock.html','reports.html','industry.html']){
  const html=read(file),src=`data/research/${code}.js`;
  assert(html.includes(src) && html.indexOf(src)<html.indexOf('assets/app.js'),`${file}: missing ${src}`);
 }
}
assert.equal(JSON.stringify(db),before,'Tests mutated financial source');
console.log(`PASS: ${Object.keys(plans).length} evidence-first plans, six sections, source bounds, pending consistency, archives and safe rendering. Not a financial audit.`);
