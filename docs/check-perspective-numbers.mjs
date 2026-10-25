// 针对“其他思维观点”的可复算数字；不把历史财务、情景压力值或持仓建议当当前行情。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadFramework} from './research-framework-files.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),scope=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),scope);
loadFramework(root,scope);
const {STOCK_RESEARCH:db,ShareholderModel:model,RESEARCH_FRAMEWORK:plans}=scope.window;
const errors=[];let checked=0;
const numeric=s=>Number(s.replaceAll(',','').replaceAll('−','-').replace('负','-'));
function compare(code,kind,match,expected){
 const raw=match[1],decimals=raw.split('.')[1]?.length||0,value=numeric(raw);
 if(Math.abs(value-expected)>.5*10**(-decimals)+1e-8)errors.push(code+' '+kind+': '+match[0]+' != '+expected.toFixed(5));
 checked++;
}
for(const s of db.stocks){
 const section=plans[s.code].sections.find(x=>x.id==='perspectives');assert(section,s.code+' missing perspectives');
 const result=model.evaluate(s),base=result?.base;
 for(const b of section.blocks)for(const text of b.p?[b.p]:b.bullets||[]){
  // 这里只检显式指向行情的格式；“退出PE”“正常化PE”和历史分位不能用TTM覆盖。
  for(const re of [/(\d+(?:\.\d+)?)倍(?:行情PE\(TTM\)|TTM|市盈率)/g,/(?:行情PE\(TTM\)|当前行情TTM|PE\(TTM\))\s*(?:为|约)?\s*(\d+(?:\.\d+)?)倍/g])for(const m of text.matchAll(re))compare(s.code,'PE(TTM)',m,s.quoteReview.pe);
  for(const re of [/(\d+(?:\.\d+)?)倍PB/g,/(?:当前行情PB|当前PB|行情PB|PB)\s*(?:为|约)?\s*(\d+(?:\.\d+)?)倍/g])for(const m of text.matchAll(re))compare(s.code,'PB',m,s.quoteReview.pb);
  if(!base)continue;
  const sum=base.rows.reduce((n,row)=>n+row.dividend,0);
  const rules=[
   ['基准IRR',/基准[^。；]{0,12}?IRR[约为：:\s]*([−+-]?\d+(?:\.\d+)?)%/g,base.irr*100],
   ['悲观IRR',/悲观情景(?:十年)?(?:IRR)?(?:仅|为|约|为负|负|\s)*([−+-]?\d+(?:\.\d+)?)%/g,result.scenarios[0].irr*100],
   ['累计分红',/十年(?:模型)?累计(?:预测|现金|领取|分红|股息){1,5}[约为合计\s]*([\d,]+(?:\.\d+)?)(?:港元|元)/g,sum],
   ['第十年卖出',/第十年(?:末)?卖出(?:所得)?(?:约|为|的|\s)*([\d,]+(?:\.\d+)?)(?:港元|元)/g,base.rows[9].sale],
   ['首年股息',/首年股息(?:约|为|\s)*([\d,]+(?:\.\d+)?)(?:港元|元)/g,base.rows[0].dividend]
  ];
  for(const [label,re,value]of rules)for(const m of text.matchAll(re)){
   if(label==='悲观IRR'&&/为负|负/.test(m[0])&&!/−|-/.test(m[1]))m[1]='-'+m[1];
   compare(s.code,label,m,value);
  }
  const higher=text.match(/回报要求从([\d.]+)%提高到([\d.]+)%.*?参考价约([\d.]+)元/);
  if(higher){
   assert(Math.abs(Number(higher[1])/100-s.model.requiredReturn)<1e-9,s.code+' incorrect original return hurdle');
   const fair=model.scenario(s.price,Number(higher[2])/100,{...s.model.assumptions[1],priceDate:s.priceDate}).fairPrice;
   compare(s.code,'更高回报门槛参考价',[higher[0],higher[3]],fair);
  }
  if(/第十一年卖出/.test(text))errors.push(s.code+' incorrect sale timing');
 }
}
assert.equal(errors.length,0,errors.join('\n'));
console.log(`PASS: ${db.stocks.length} perspective sections; ${checked} explicit quote/model values reconciled. Historical financial facts and scenario judgment still require source review.`);
