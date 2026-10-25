// 将现有项目资料完整迁为有出处的历史声明；只生成补丁，不联网、不升级证据等级。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadFramework} from './research-framework-files.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),data=path.join(root,'research-data'),c=vm.createContext({window:{}});
for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
loadFramework(root,c);
const registry=JSON.parse(fs.readFileSync(path.join(data,'registry.json'),'utf8'));
const selected=process.argv.slice(2);assert(selected.length,'Pass explicit stock codes');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let patch='*** Begin Patch\n';
function add(file,value){const target=path.join(data,file);assert(!fs.existsSync(target),'Refuse to overwrite '+file);let text=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';if(value?.observations)text=JSON.stringify({...value,observations:null},null,2).replace('"observations": null','"observations": [\n'+value.observations.map(o=>'    '+JSON.stringify(o)).join(',\n')+'\n  ]')+'\n';patch+='*** Add File: '+target+'\n'+text.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';return {text,file,sha256:hash(text)};}
function update(file,old,value){patch+='*** Update File: '+path.join(data,file)+'\n@@\n'+old.trimEnd().split('\n').map(l=>'-'+l).join('\n')+'\n'+(JSON.stringify(value,null,2)+'\n').trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';}
function primary(raw){
 const m=raw.match(/^(?:约|人民币|\s)*([-−]?\d[\d,]*(?:\.\d+)?)(亿元人民币|亿港元|万亿元|亿元|亿股|万股|港元|元|股|%|天|家|倍)/);if(!m)return null;
 const n=m[1].replaceAll(',','').replace('−','-'),u=m[2],exponent=u.startsWith('万亿')?12:u.startsWith('亿')?8:u.startsWith('万')?4:u==='%'?-2:0;
 // 固定十进制位移，不通过网页舍入数字逆推。
 const sign=n.startsWith('-')?'-':'',clean=n.replace('-',''),[whole,fraction='']=clean.split('.'),digits=(whole+fraction).replace(/^0+(?=\d)/,''),offset=fraction.length-exponent;
 let value=offset<=0?digits+'0'.repeat(-offset):digits.length>offset?digits.slice(0,-offset)+'.'+digits.slice(-offset):'0.'+'0'.repeat(offset-digits.length)+digits;
 value=value.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
 return {value:sign+value,unit:u.includes('股')?'shares':u==='%'?'ratio':u==='倍'?'times':u==='天'?'days':u==='家'?'count':'currency',currency:u.includes('人民币')?'CNY':u.includes('港元')?'HKD':null,reportedUnit:u,exponent:String(exponent),primary:n};
}
function allStrings(x,p=''){if(typeof x==='string')return /\d/.test(x)?[[p,x]]:[];if(!x||typeof x!=='object')return [];return Object.entries(x).flatMap(([k,v])=>allStrings(v,p+'/'+k));}
for(const code of selected){
 const stock=c.window.STOCK_RESEARCH.stocks.find(s=>s.code===code);assert(stock,'Unknown '+code);
 const reg=registry.securities.find(s=>s.reportCode===code),id=reg.securityId,sourceId='legacy-project-'+id+'-20261025';
 const capsule={securityId:id,archivedAt:'2026-10-25',warning:'项目历史声明原样归档；并非本次重取或原始披露复核。内含事实、假设、推导和缺口，不作为同一证据等级。',facts:stock.facts,dividendView:stock.dividendView,companyStatus:stock.companyStatus,industryStatus:stock.industryStatus,evidenceTracking:stock.evidenceTracking||null,plan:c.window.RESEARCH_FRAMEWORK[code],sources:stock.sources};
 const evidence=add('evidence/'+sourceId+'.json',capsule);
 add('sources/'+sourceId+'.json',{schemaVersion:'1.0',sourceId,provider:'本项目已有报告及数据文件',type:'legacy_project_archive',publishedAt:null,collectedAt:'2026-10-25',evidence:{file:evidence.file,sha256:evidence.sha256},notes:'collectedAt为本次本地归档日；原取数日未逐条确认。原报告链接保存在证据sources中，保留线索但不声称本次已阅读原件。'});
 const buckets={financials:[],dividends:[],operating:[],events:[]};
 const make=(key,text,locator,label,periodLabel,extra={})=>({id:key,metric:key,value:null,rawValue:text,textValue:text,unit:'source_text',currency:null,period:{kind:'instant',start:null,end:'2026-10-25'},basis:{scope:'legacy_as_stated',accountingStandard:'unknown',adjustment:'unknown',shareBasis:'unknown'},nature:'legacy_claim',verification:'unreviewed',precision:'as_reported',missingReason:null,sourceRefs:[{sourceId,locator}],notes:'归档截止日不是财务报告期；实际期间原文见dimensions.periodLabel。未复核原件，不自动用作估值参数。',dimensions:{label,periodLabel,...extra}});
 stock.facts.forEach((row,index)=>{
  if(index<3)return;const [label,raw,periodLabel,note]=row;
  const group=/分红|股息|派息/.test(label)?'dividends':/发电量|吞吐|销量|产量|周转|月活|门店|经销商|电价|上网|库存天数/.test(label)?'operating':'financials';
  const key='fact_'+hash(label+'|'+periodLabel).slice(0,12),o=make(key,raw,'/facts/'+index,label,periodLabel,{originalIndex:String(index),originalRow:JSON.stringify(row),scopeNote:note||'',kind:'fact_row'}),n=primary(raw);
  if(n){o.value=n.value;o.unit=n.unit;o.currency=n.currency||(/元/.test(n.reportedUnit)&&reg.exchange!=='XHKG'?'CNY':null);o.dimensions.reportedUnit=n.reportedUnit;o.dimensions.scale=n.exponent;}
  buckets[group].push(o);
 });
 buckets.dividends.push(make('dividend_commentary',stock.dividendView,'/dividendView','分红口径与研究说明',stock.model.financialPeriod,{kind:'research_commentary'}));
 for(const field of ['companyStatus','industryStatus'])for(const [i,text]of(stock[field]||[]).entries())buckets.operating.push(make(field.toLowerCase()+'_'+i,text,'/'+field+'/'+i,field,stock.model.financialPeriod,{kind:'legacy_context'}));
 for(const [locator,text]of allStrings(capsule.plan,'/plan'))buckets.events.push(make('claim_'+hash(locator).slice(0,12),text,locator,'报告中的数值声明（可能含假设，非公告认证）',stock.model.financialPeriod,{kind:'report_claim'}));
 const currentFile='securities/'+id+'/current.json',old=fs.readFileSync(path.join(data,currentFile),'utf8'),pointer=JSON.parse(old);
 for(const [dataset,observations]of Object.entries(buckets))if(observations.length){
  const snapshotId=id+'__'+dataset+'__20261025-legacy-v1',file='securities/'+id+'/'+dataset+'/2026-10-25__legacy-v1.json';
  const snap=add(file,{schemaVersion:'1.0',snapshotId,securityId:id,dataset,asOf:'2026-10-25',collectedAt:'2026-10-25',acceptance:'accepted',createdBy:'codex/legacy-archive',supersedes:null,notes:'仅接受归档结构及可追溯性；所有观测仍unreviewed。period是归档观察日而非财务期；原期间见dimensions，未经原件复核不得称新事实。',observations});
  // 不以迁入旧报告覆盖其他agent已入库的真实财报版本。
  if(!pointer.datasets[dataset])pointer.datasets[dataset]={snapshotId,file,sha256:snap.sha256};
 }
 update(currentFile,old,pointer);
}
console.log(patch+'*** End Patch');
