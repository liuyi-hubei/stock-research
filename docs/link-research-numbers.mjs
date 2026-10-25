// 一次性把可证明对应的正文数字转成只读绑定；只输出补丁。不同期间、判断语句不得机械替换。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadFramework} from './research-framework-files.mjs';
import {readStore} from './research-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),c=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
loadFramework(root,c);
const store=readStore(),publication=JSON.parse(fs.readFileSync(path.join(root,'research-data/publication.json'),'utf8'));
const wanted=process.argv.slice(2);assert(wanted.length,'Pass explicit stock codes');
const literal=s=>"'"+s.replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('\n','\\n')+"'";
const number=s=>Number(s.replaceAll(',','').replace('−','-').replace('负','-'));
let patch='*** Begin Patch\n',count=0;
for(const code of wanted){
 const stock=c.window.STOCK_RESEARCH.stocks.find(x=>x.code===code),plan=c.window.RESEARCH_SOURCE_PLANS[code],result=c.window.ShareholderModel.evaluate(stock),base=result?.base;
 const candidates=[];
 for(const sid of publication.reports[code].statementSnapshotIds)for(const o of store.snapshots.get(sid).observations){
  if(o.value===null||o.dimensions?.kind!=='fact_row'||!o.dimensions.reportedUnit)continue;
  const raw=o.rawValue.match(/[-−]?\d[\d,]*(?:\.\d+)?/);if(!raw)continue;
  const period=String(o.dimensions.periodLabel||'').match(/(20\d{2})(H[12]|Q[1-4]|A)?/);if(!period)continue;
  candidates.push({o,raw:raw[0],period:period[0]});
 }
 const bind=(text,re,key,expected,percent=false,override)=>text.replace(re,(full,captured)=>{
  const numeric=number(captured),decimals=captured.split('.')[1]?.length||0;
  if(Math.abs(numeric-expected)>.5*10**(-decimals)+1e-7)return full;
  const format=override||((percent?'p':'n')+decimals+(captured.includes(',')?'c':''));
  return full.replace(captured,'{{'+key+'|'+format+'}}');
 });
 function transform(text){
  if(/原版本|上一版|上一基准|刷新前|9月\d+日收盘|2026-09-\d+.*收盘/.test(text))return text;
  let t=text;
  t=bind(t,/(?:收盘(?:价)?(?:为|约)?\s*|现价(?:为)?\s*|相对|对|以|买入价|投入)([\d,]+(?:\.\d+)?)(?:港元|元)/g,'quote.close',stock.price,false,'n'+Math.max(2,stock.price.toString().split('.')[1]?.length||0));
  if(/行情|收盘|价格基准/.test(t))t=t.replaceAll(stock.priceDate,'{{quote.date|date}}');
  for(const re of [/(\d+(?:\.\d+)?)倍(?:行情PE\(TTM\)|TTM|市盈率)/g,/(?:行情PE\(TTM\)|当前行情TTM|PE\(TTM\))\s*(?:为|约)?\s*(\d+(?:\.\d+)?)倍/g])t=bind(t,re,'quote.pe_ttm',stock.quoteReview.pe);
  for(const re of [/(\d+(?:\.\d+)?)倍PB/g,/(?:当前行情PB|当前PB|行情PB|PB)\s*(?:为|约)?\s*(\d+(?:\.\d+)?)倍/g])t=bind(t,re,'quote.pb',stock.quoteReview.pb);
  if(base){
   const rules=[
    [/基准[^。；]{0,12}?IRR[约为：:\s]*([−+-]?\d+(?:\.\d+)?)%/g,'base.irr',base.irr*100,true],
    [/([−+-]?\d+(?:\.\d+)?)%的基准IRR/g,'base.irr',base.irr*100,true],
    [/悲观情景(?:十年)?(?:IRR)?(?:仅|为|约|\s)*(负?[−+-]?\d+(?:\.\d+)?)%/g,'bear.irr',result.scenarios[0].irr*100,true],
    [/十年(?:模型)?累计(?:预测|现金|领取|分红|股息){1,5}[约为合计\s]*([\d,]+(?:\.\d+)?)(?:港元|元)/g,'base.sumDividends',base.rows.reduce((n,r)=>n+r.dividend,0)],
    [/第十年(?:末)?卖出(?:所得)?(?:约|为|的|\s)*([\d,]+(?:\.\d+)?)(?:港元|元)/g,'base.sale',base.rows[9].sale],
    [/首年股息(?:约|为|\s)*([\d,]+(?:\.\d+)?)(?:港元|元)/g,'base.firstDividend',base.rows[0].dividend],
    [/达标参考(?:买入)?价(?:为|约|[：:]|\s)*(?:HK\$|¥)?\s*([\d,]+(?:\.\d+)?)(?:港元|元)?/g,'base.fairPrice',base.fairPrice],
    [/([\d,]+(?:\.\d+)?)(?:港元|元)的(?:达标价|达标参考价|条件达标价|条件参考价|旧模型阈值)/g,'base.fairPrice',base.fairPrice],
    [/按条件EPS计算约([\d.]+)倍/g,'base.pe',stock.price/base.eps],
    [/基准条件EPS\s*([\d.]+)港元/g,'base.eps',base.eps]
   ];
   for(const [re,key,n,p]of rules)t=bind(t,re,key,n,p);
   if(/回报要求从[\d.]+%提高到[\d.]+%/.test(t)){
    t=bind(t,/回报要求从([\d.]+)%/g,'hurdle',stock.model.requiredReturn*100,true);
    t=bind(t,/提高到([\d.]+)%/g,'hurdlePlus',(stock.model.requiredReturn+.01)*100,true);
    t=bind(t,/参考价约([\d.]+)元/g,'base.higherFairPrice',c.window.ShareholderModel.scenario(stock.price,stock.model.requiredReturn+.01,{...stock.model.assumptions[1],priceDate:stock.priceDate}).fairPrice);
   }
  }
  // 只链接明确同期间、同单位且无重复候选的已存表格值，不跨期间猜测。
  t=t.split(/(?<=[。；])/).map(sentence=>{
   if(/若|假设|预测|情景|年化/.test(sentence))return sentence;
   for(const candidate of candidates){
    const {o,raw,period}=candidate;
    if(!sentence.includes(period)&&!(period==='2026H1'&&sentence.includes('H1')))continue;
    const fragment=raw+o.dimensions.reportedUnit;
    if(candidates.filter(x=>x.raw+x.o.dimensions.reportedUnit===fragment&&x.period===period).length!==1)continue;
    const decimals=raw.split('.')[1]?.length||0,format='n'+decimals+'e'+o.dimensions.scale+(raw.includes(',')?'c':'');
    sentence=sentence.replaceAll(fragment,'{{fact.'+o.id+'|'+format+'}}'+o.dimensions.reportedUnit);
   }
   return sentence;
  }).join('');
  return t;
 }
 const pairs=new Map();const change=(a,b)=>{if(a!==b)pairs.set(a,b);};
 change(plan.summary,transform(plan.summary));
 for(const section of plan.sections){
  let history=false;
  for(const block of section.blocks){
   if(block.h3==='预测偏差台账')history=true;if(history)continue;
   for(const str of block.p?[block.p]:block.h3?[block.h3]:block.bullets?block.bullets:block.evidence?[block.evidence.claim,block.evidence.basis,block.evidence.counterpoint]:[])change(str,transform(str));
   if(block.table&&section.id==='valuation')for(const row of block.table.rows){
    if(/PE|TTM|市盈率/.test(row[0])&&!/基准|正常化|退出/.test(row[0])&&/^[\d.]+倍$/.test(row[1]))change(row[1],bind(row[1],/([\d.]+)倍/g,'quote.pe_ttm',stock.quoteReview.pe));
    if(/PB|市净率/.test(row[0])&&!/历史|基准|退出/.test(row[0])&&/^[\d.]+倍$/.test(row[1]))change(row[1],bind(row[1],/([\d.]+)倍/g,'quote.pb',stock.quoteReview.pb));
    if(base&&block.table.head[0].includes('买入价')&&block.table.head[1]?.includes('IRR')){
     if(row[0].includes('{{quote.close|')){change(row[1],row[1].replace(/\{\{trial\.[^|]+\|p(\d+)\}\}/g,'{{base.irr|p$1}}'));continue;}
     if(row[0].includes('{{base.fairPrice|')){const decimals=row[0].match(/\|n(\d+)/)?.[1]||'2';change(row[1],row[1].replace(/\{\{(?:trial\.[^|]+|hurdle)\|p(\d+)\}\}/g,'{{fairTrial.'+decimals+'|p$1}}'));continue;}
     const price=number(row[0].match(/[\d.]+/)?.[0]||'0');
     if(price>0){const rate=c.window.ShareholderModel.scenario(price,stock.model.requiredReturn,{...stock.model.assumptions[1],priceDate:stock.priceDate}).irr;
      if(Math.abs(price-stock.price)<1e-9){change(row[0],bind(row[0],/([\d.]+)/,'quote.close',stock.price,false,'n'+Math.max(2,stock.price.toString().split('.')[1]?.length||0)).replaceAll(stock.priceDate,'{{quote.date|date}}'));change(row[1],bind(row[1],/([−+-]?\d+(?:\.\d+)?)%/g,'base.irr',base.irr*100,true).replace(/\{\{trial\.[^|]+\|p(\d+)\}\}/g,'{{base.irr|p$1}}'));}
      else if(Math.abs(price-base.fairPrice)<=.0051){change(row[0],bind(row[0],/([\d.]+)/,'base.fairPrice',base.fairPrice));change(row[1],bind(row[1],/([−+-]?\d+(?:\.\d+)?)%/g,'hurdle',stock.model.requiredReturn*100,true).replace(/\{\{trial\.[^|]+\|p(\d+)\}\}/g,'{{hurdle|p$1}}'));}
      else change(row[1],bind(row[1],/([−+-]?\d+(?:\.\d+)?)%/g,'trial.'+price.toString().replace('.','_'),rate*100,true));}
    }
   }
  }
 }
 const file=path.join(root,'data/research/'+code+'.js'),old=fs.readFileSync(file,'utf8');let next=old;
 for(const [a,b]of pairs){assert(next.includes(literal(a)),code+' missing literal for '+a.slice(0,50));next=next.split(literal(a)).join(literal(b));}
 if(next!==old){const a=old.trimEnd().split('\n'),b=next.trimEnd().split('\n');assert.equal(a.length,b.length);patch+='*** Update File: '+file+'\n';for(let i=0;i<a.length;i++)if(a[i]!==b[i])patch+='@@\n-'+a[i]+'\n+'+b[i]+'\n';count++;}
}
console.log(patch+'*** End Patch');process.stderr.write('Linked files: '+count+'\n');
