import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const s={window:{}};vm.createContext(s);
vm.runInContext(fs.readFileSync(new URL('../data/industries.js',import.meta.url),'utf8'),s);
const r=s.window.INDUSTRY_REPORTS.baijiu,m=r.demandModel;
const near=(a,b)=>assert(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
near(m.base.industry,7963.84);
near(m.bridge*(14.0828*.3*.6*10*400),7963.84);
for(const c of m.paths){
 assert.equal(c.rows.length,12);
 for(const row of c.rows){
  assert(row.values.every(v=>Number.isFinite(v)&&v>0));
  assert(row.values[1]<=1&&row.values[2]<=1);
  assert(row.shares.every(v=>v>=0&&v<=1)&&row.other>=0);
  near(row.shares.reduce((a,b)=>a+b,0)+row.other,1);
  near(row.shares.reduce((a,b)=>a+row.industry*b,0)+row.industry*row.other,row.industry);
  near(row.retail,row.values.reduce((a,b)=>a*b,1));
  near(row.industry,row.retail*m.bridge);
  near(row.values[0]*row.values[1]*row.values[2]*row.values[3]*row.values[4]*1.1*m.bridge,row.industry*1.1);
 }
 near(c.rows[0].industry,7963.84);
}
const tail=m.paths.map(c=>c.rows.at(-1));
assert(tail[0].industry<tail[1].industry&&tail[1].industry<tail[2].industry);
assert(tail[0].shares[0]>m.companies[0][1]/m.base.industry);
assert(tail[0].industry*tail[0].shares[0]<m.companies[0][1]);
const blocks=r.sections.flatMap(x=>x.blocks);
for(const b of blocks)if(b.table)assert(b.table.rows.every(row=>row.length===b.table.head.length));
for(const id of ['demand-cake','leader-cake'])assert(r.sections.some(x=>x.id===id)&&r.nav.some(x=>x[0]===id));
assert(r.sourceFile.href.includes('需求与份额预测'));
console.log('PASS: 2024 calibration, 36 annual scenario rows, units, closed shares/revenue, sensitivity, share gain with revenue decline, tables and navigation');
console.log(JSON.stringify(tail.map((x,i)=>({scenario:m.paths[i].name,industry2035:x.industry,retail2035:x.retail,company2035:x.shares.map(v=>x.industry*v)})),null,2));
