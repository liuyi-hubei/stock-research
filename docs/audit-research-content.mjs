// 全池内容一致性检查；--patch [CODE ...]仅输出补丁，不写文件。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadFramework} from './research-framework-files.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scope=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),scope);
loadFramework(root,scope);
const {STOCK_RESEARCH:db,ShareholderModel:model,RESEARCH_FRAMEWORK:plans}=scope.window;
const pct=v=>(v*100).toFixed(2)+'%';
const number=s=>Number(String(s).replaceAll(',','').replaceAll('−','-').match(/-?\d+(?:\.\d+)?/)?.[0]);
const literal=s=>"'"+s.replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('\n','\\n')+"'";
export function tableRate(stock,buyPrice){return model.scenario(buyPrice,stock.model.requiredReturn,{...stock.model.assumptions[1],priceDate:stock.priceDate}).irr;}
function quoteCell(row,q){
  const label=row[0];
  if(/基准|正常化|退出|净债务/.test(label))return null;
  if(/市净率与历史分位/.test(label))return row[1].replace(/PB\s*[\d.]+倍(?:（(?:按新价折算|本轮行情)）)?/,'PB '+q.pb+'倍（本轮行情）');
  if(/PB.*PE|市净率.*市盈率/.test(label))return q.pb+'倍 / '+q.pe+'倍';
  if(/PE.*PB|市盈率.*市净率/.test(label))return q.pe+'倍 / '+q.pb+'倍';
  if(/TTM|^PE$/.test(label))return q.pe+'倍';
  if(/市净率|^PB$/.test(label))return q.pb+'倍';
  // “经营买入代价”可能按模型股本计算，不改成供应商市值。
  if(/^市值$|^市值口径$/.test(label))return '约'+q.marketCap+(q.currency==='港元'?'港元':'元')+'（供应商口径）';
  return null;
}
function correctConcepts(text){
 return text.replaceAll('这个模型的回报有近七成来自','该折现率下约七成模型现值来自')
  .replaceAll('回报的三分之二来自','模型现值约三分之二来自')
  .replaceAll('三分之二的回报','三分之二的模型现值').replaceAll('六成半的回报','六成半的模型现值')
  .replaceAll('近六成回报','近六成模型现值').replaceAll('一半以上的回报','一半以上的模型现值')
  .replaceAll('超过一半的回报','超过一半的模型现值').replaceAll('接近一半的回报','接近一半的模型现值')
  .replaceAll('回报一半以上押在','超过一半的模型现值依赖于')
  .replace(/([一二三四五六七八九十两半]成(?:以上)?(?:的)?)回报押在/g,'$1估值现值依赖于')
  .replace(/([一二三四五六七八九十两半]成(?:以上)?(?:的)?)回报来自/g,'$1估值现值来自')
  .replaceAll('因此回报的一半来自分红、一半来自十年后的倍数','因此该折现率下的模型现值约一半来自分红、另一半来自终值；不能按此拆分IRR')
  .replaceAll('三道门','三类现金约束').replaceAll('第一道门','第一项约束').replaceAll('第二道门','第二项约束').replaceAll('第三道门','第三项约束');
}
function currentMarketText(text,q){
 // 仅改无条件的当前行情陈述；历史、未来或情景句不按当前行情覆盖。
 return text.split(/(?<=[。；])/).map(sentence=>{
  if(/历史|202[0-5]年|2026-09|9月\d+日|若|假设|未来|退出PE|正常化PE/.test(sentence))return sentence;
  return sentence.replace(/((?:PE\(TTM\)|TTM\s*PE|市盈率(?:\(TTM\))?)[为约\s：:]*)-?\d+(?:\.\d+)?(?=倍)/g,'$1'+q.pe)
   .replace(/((?:市净率(?:\s*PB)?|PB)[为约\s：:]*)\d+(?:\.\d+)?(?=倍)/g,'$1'+q.pb)
   .replace(/\d+(?:\.\d+)?倍(?=TTM\s*PE)/g,q.pe+'倍');
 }).join('');
}
function repair(stock,plan){
 const q={...stock.quoteReview,currency:stock.model.currency==='港元'?'港元':'人民币'};
 const pairs=new Map();
 const change=(old,next)=>{if(old!==next)pairs.set(old,next);};
 for(const section of plan.sections)for(const b of section.blocks){
  if(b.table){
   const t=b.table;
   for(const row of t.rows){
    const next=section.id==='valuation'?quoteCell(row,q):null;
    if(next!==null)change(row[1],next);
    if(t.head[0].includes('买入价')&&t.head[1]?.includes('IRR')&&!model.isPending(stock)){
      const price=number(row[0]);if(price>0&&/%/.test(row[1]))change(row[1],row[1].replace(/[+−-]?\d+(?:\.\d+)?%/,'约'+pct(tableRate(stock,price))).replace('约约','约'));
    }
   }
  }
  const strings=b.p?[b.p]:b.h3?[b.h3]:b.bullets?b.bullets:b.evidence?[b.evidence.claim,b.evidence.basis,b.evidence.counterpoint]:[];
  for(const text of strings)change(text,currentMarketText(correctConcepts(text),q));
 }
 return pairs;
}
const wanted=process.argv.slice(2).filter(x=>!x.startsWith('--'));
if(process.argv.includes('--data-patch')){
 const files=['data/stocks.js','data/additional-stocks.js'];
 const texts=new Map(files.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
 const original=new Map(texts);
 const set=(old,next,code)=>{
  if(!old||old===next)return;
  let found=false;
  for(const [f,text]of texts){let updated=text;for(const [a,b]of [[JSON.stringify(old),JSON.stringify(next)],[literal(old),literal(next)]])if(updated.includes(a)){updated=updated.split(a).join(b);found=true;break;}texts.set(f,updated);}
  assert(found,code+' missing data literal '+old.slice(0,30));
 };
 // 只复算原文已给出的每股现金与当前价之比，不把历史派息变成未来承诺。
 const dividends={
  '600519':[[49.2,'3.9%']], '600900':[[.79,'2.8%']], '600863':[[.22,'4.6%']],
  '600750':[[.50,'2.3%']], '000651':[[2,'5.2%']], '02020':[[1.51,'2.1%']],
  '01378':[[1.65,'7.7%']], '000807':[[.887,'3.3%']], '601857':[[.26,'2.4%']],
  '01910':[[.8012,'6.5%'],[.6810,'5.6%']], '00902':[[.45475,'8.2%']]
 };
 for(const s of db.stocks){
  if(wanted.length&&!wanted.includes(s.code))continue;
  set(s.conclusion,plans[s.code].summary,s.code);
  set(s.thesis,currentMarketText(s.thesis,s.quoteReview),s.code);
  let dividend=s.dividendView;
  for(const [cash,old]of dividends[s.code]||[])dividend=dividend.replace(old,(cash/s.price*100).toFixed(2)+'%');
  set(s.dividendView,dividend,s.code);
 }
 let patch='*** Begin Patch\n';
 for(const [f,next]of texts){const old=original.get(f);if(next===old)continue;const a=old.trimEnd().split('\n'),b=next.trimEnd().split('\n');assert.equal(a.length,b.length);patch+='*** Update File: '+path.join(root,f)+'\n';for(let i=0;i<a.length;i++)if(a[i]!==b[i])patch+='@@\n-'+a[i]+'\n+'+b[i]+'\n';}
 console.log(patch+'*** End Patch');
}else if(process.argv.includes('--patch')){
 let patch='*** Begin Patch\n',count=0;
 for(const stock of db.stocks){
  if(wanted.length&&!wanted.includes(stock.code))continue;
  const f='data/research/'+stock.code+'.js',old=fs.readFileSync(path.join(root,f),'utf8');let next=old;
  const pairs=repair(stock,plans[stock.code]);
  for(const [from,to]of pairs){const a=literal(from),b=literal(to);if(!next.includes(a))throw Error(stock.code+' missing literal '+from.slice(0,60));next=next.split(a).join(b);}
  if(next===old)continue;
  // 逐行补丁，避免整份报告重新序列化而制造无关格式变化。
  const a=old.trimEnd().split('\n'),b=next.trimEnd().split('\n');assert.equal(a.length,b.length);
  patch+='*** Update File: '+path.join(root,f)+'\n';
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])patch+='@@\n-'+a[i]+'\n+'+b[i]+'\n';
  count++;
 }
 patch+='*** End Patch';console.log(patch);process.stderr.write('Report patches: '+count+'\n');
}else{
 let prices=0,quotes=0,currentIRRs=0;
 const errors=[];
 for(const s of db.stocks){
  const q=s.quoteReview,p=plans[s.code];
  if(s.conclusion!==p.summary)errors.push(s.code+' page conclusion differs from structured report summary');
  if(!q||q.date!==s.priceDate||q.close!==s.price||!q.rawFile){errors.push(s.code+' missing/mismatched quote review');continue;}
  const fact=s.facts.find(r=>r[0]==='收盘基准价');
  if(!fact||number(fact[1])!==s.price||fact[2]!==s.priceDate)errors.push(s.code+' quote fact/date mismatch');
  for(const sec of p.sections)for(const b of sec.blocks){
   if(b.table&&sec.id==='valuation')for(const row of b.table.rows){const value=quoteCell(row,{...q,currency:s.model.currency==='港元'?'港元':'人民币'});if(value!==null){quotes++;if(value!==row[1])errors.push(s.code+' stale market cell '+row[0]);}}
   if(b.table?.head[0].includes('买入价')&&b.table.head[1]?.includes('IRR')&&!model.isPending(s))for(const r of b.table.rows){const n=number(r[0]);if(n>0&&r[1].includes('%')){prices++;if(Math.abs(number(r[1])-tableRate(s,n)*100)>.0051)errors.push(s.code+' price/IRR table mismatch at '+n);}}
   const text=JSON.stringify(b);
   const prose=b.p?[b.p]:b.bullets?b.bullets:b.evidence?[b.evidence.claim,b.evidence.basis,b.evidence.counterpoint]:[];
   for(const item of prose){
    // 历史版本和明确的单项敏感性不是当前基准结论，不能强行覆盖。
    if(/原报告|原版本|上一版|上一基准|刷新前|9月\d+日|10月22日|2026-09-|退出PE下调/.test(item)||model.isPending(s))continue;
    for(const match of item.matchAll(/基准[^。；]{0,18}?IRR[约为：:\s]*([−+-]?\d+(?:\.\d+)?)%/g)){
     const decimals=match[1].split('.')[1]?.length||0;
     if(Math.abs(number(match[1])-model.evaluate(s).base.irr*100)>.5*10**(-decimals)+1e-8)errors.push(s.code+' stale current IRR in prose: '+match[0]);
     currentIRRs++;
    }
   }
   if(/仓位上限\d|首批不超过\d|上限不超过组合\d/.test(text))errors.push(s.code+' unsupported position percentage');
   if(/IRR里接近九成|\d+(?:\.\d+)?%有九成来自/.test(text))errors.push(s.code+' decomposed IRR as PV weight');
  }
 }
 // 确定性反例：同一引擎下腾讯退出PE下调20%，仍高于原9%门槛。
 const tx=db.stocks.find(s=>s.code==='00700');
 const lower=model.scenario(tx.price,tx.model.requiredReturn,{...tx.model.assumptions[1],exitPE:tx.model.assumptions[1].exitPE*.8}).irr;
 assert(lower>tx.model.requiredReturn);
 if(JSON.stringify(plans['00700']).includes('IRR就会明显跌破9%'))errors.push('00700 wrong exit-PE sensitivity direction');
 const txText=JSON.stringify(plans['00700']);
 if(/资本开支1,234|资本开支为1,234|保留全部非现金成本/.test(txText))errors.push('00700 stale capital expenditure or cost scope');
 assert(txText.includes('847.20')&&txText.includes('股份薪酬'),'00700 missing cash-flow scope qualification');
 const ledger=fs.readFileSync(path.join(root,'reports/stocks/全池行情核验-20261024.md'),'utf8');
 for(const s of db.stocks){
  const row=ledger.split('\n').find(line=>line.includes(' / '+s.code+' |'));
  if(!row||number(row.split('|')[2])!==s.price)errors.push(s.code+' published quote ledger price precision mismatch');
 }
 const yieldChecks={'600519':[49.2,'3.69%'],'600900':[.79,'2.68%'],'600863':[.22,'4.39%'],'600750':[.5,'2.18%'],'000651':[2,'5.37%'],'02020':[1.51,'2.01%'],'01378':[1.65,'8.68%'],'000807':[.887,'3.53%'],'601857':[.26,'2.04%'],'01910':[.8012,'6.03%'],'00902':[.45475,'8.06%']};
 for(const [code,[cash,label]]of Object.entries(yieldChecks)){
  const s=db.stocks.find(x=>x.code===code);
  const currentLabel=(cash/s.price*100).toFixed(2)+'%';
  if(!s.dividendView.includes(currentLabel))errors.push(code+' dividend/price arithmetic or published text mismatch: expected '+currentLabel);
 }
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: '+db.stocks.length+' quote reviews, '+quotes+' market cells, '+prices+' price/IRR rows, '+currentIRRs+' current prose IRRs and research safeguards. Financial source completeness not implied.');
}
