// 一次性迁入已完成的2026-10-24行情核验；只输出apply_patch，不联网、不改已有文件。
// 原始证据默认取总项目miaoxiang目录，可用 --evidence-root 改为另一台电脑上的实际目录。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.join(site,'research-data');
const args=process.argv.slice(2),ei=args.indexOf('--evidence-root');
const evidenceRoot=ei<0?path.resolve(site,'../../miaoxiang/mx_finance_data'):path.resolve(args[ei+1]);
const selected=args.filter((x,i)=>!x.startsWith('--')&&!(ei>=0&&i===ei+1));
const c=vm.createContext({window:{}});for(const f of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(site,f),'utf8'),c);
const stocks=c.window.STOCK_RESEARCH.stocks;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const security=s=>(s.market.includes('港股')?'XHKG':s.code.startsWith('6')?'XSHG':'XSHE')+'.'+s.code;
const exchange=s=>security(s).split('.')[0];
const currency=s=>s.model.currency==='港元'?'HKD':'CNY';
const sourceId=f=>'mx-20261024-'+f.match(/_([a-f0-9]+)\.md$/)[1];
const scaled=raw=>{const m=raw.match(/^(\d+(?:\.\d+)?)(万亿|亿股|亿)$/);assert(m,'Unsupported provider magnitude '+raw);const [whole,fraction='']=m[1].split('.'),digits=whole+fraction,scale=(m[2]==='万亿'?12:8)-fraction.length;assert(scale>=0);return (BigInt(digits)*10n**BigInt(scale)).toString();};
const pending=[];
const add=(file,content)=>{const p=path.join(root,file);assert(!fs.existsSync(p),'Refuse to overwrite existing data: '+file);pending.push([p,typeof content==='string'?content:JSON.stringify(content,null,2)+'\n']);};
if(args.includes('--metadata')){
 add('registry.json',{schemaVersion:'1.0',createdAt:'2026-10-25',securities:stocks.map(s=>({securityId:security(s),code:s.code,name:s.name,exchange:exchange(s),currency:currency(s),reportCode:s.code}))});
 for(const file of [...new Set(stocks.map(s=>s.quoteReview.rawFile))]){
  const bytes=fs.readFileSync(path.join(evidenceRoot,file)),text=bytes.toString('utf8').replace(/\r\n/g,'\n').trimEnd()+'\n';
  assert(!/authorization|cookie|access_token|api_key|bearer\s/i.test(text),'Potential credential; inspect before sharing');
  add('evidence/'+file,text);
  add('sources/'+sourceId(file)+'.json',{schemaVersion:'1.0',sourceId:sourceId(file),provider:'妙想金融数据（东方财富数据链）',type:'provider_query_result',publishedAt:null,collectedAt:'2026-10-24',originalFilename:file,originalSha256:hash(bytes),evidence:{file:'evidence/'+file,sha256:hash(text)},notes:'2026-10-23不复权收盘、PE(TTM)、PB、市值、近似股数定向返回；取数日2026-10-24。证据仅标准化换行，非交易所原始公告；重复查询不构成独立核验。'});
 }
}else{
 assert(selected.length,'Pass --metadata or explicit stock codes');
 assert(selected.every(code=>stocks.some(s=>s.code===code)),'Unknown stock code');
 for(const s of stocks.filter(s=>selected.includes(s.code))){
  const q=s.quoteReview,id=security(s),cur=currency(s);assert(q?.date==='2026-10-23'&&q.reviewedAt==='2026-10-24','Unexpected migration source');
  const snapshotId=id+'__quotes__20261023__20261024-mx-v1';
  const basis={scope:'provider_defined_issuer',accountingStandard:'provider_defined',adjustment:'not_applicable',shareBasis:'provider_defined'};
  const specs=[['close',String(q.close),'currency_per_share',cur,'as_reported','不复权收盘；保留原始小数位。'],['pe_ttm',String(q.pe),'times',null,'as_reported','服务商TTM分母；不替代正常化或退出PE。'],['pb',String(q.pb),'times',null,'as_reported','服务商净资产分母；不能按价格比例更新。'],['market_cap',scaled(q.marketCap),'currency',cur,'vendor_rounded','按供应商显示量级转基本单位，不代表两地股份实际市值之和。'],['shares_outstanding',scaled(q.shares),'shares',null,'vendor_rounded','服务商近似股数，不能替换模型精确股本或加权/稀释分母。']];
  const observations=specs.map(([metric,value,unit,currency,precision,notes])=>({id:metric,metric,value,rawValue:metric==='market_cap'?q.marketCap:metric==='shares_outstanding'?q.shares:value,unit,currency,period:{kind:'instant',start:null,end:q.date},basis:{...basis,adjustment:metric==='close'?'unadjusted':'not_applicable'},nature:'historical_fact',verification:'provider_reported',precision,missingReason:null,sourceRefs:[{sourceId:sourceId(q.rawFile),locator:s.name+'('+s.code+')；2026-10-23；'+({close:'收盘价(不前推)',pe_ttm:'市盈率PE(TTM)',pb:'市净率PB',market_cap:'总市值',shares_outstanding:'总股本'}[metric])}],notes}));
  const snapshot={schemaVersion:'1.0',snapshotId,securityId:id,dataset:'quotes',asOf:q.date,collectedAt:q.reviewedAt,acceptance:'accepted',createdBy:'codex/data-migration-20261025',supersedes:null,notes:'迁入已完成的全池行情核验；accepted表示允许复用，不表示独立财务审计；本次迁入不修改网站投影或模型。',observations};
  const file='securities/'+id+'/quotes/2026-10-23__2026-10-24__mx-v1.json',text=JSON.stringify(snapshot,null,2)+'\n';
  add(file,text);
  add('securities/'+id+'/current.json',{schemaVersion:'1.0',securityId:id,datasets:{quotes:{snapshotId,file,sha256:hash(text)}}});
 }
}
console.log('*** Begin Patch\n'+pending.map(([p,t])=>'*** Add File: '+p+'\n'+t.trimEnd().split('\n').map(l=>'+'+l).join('\n')).join('\n')+'\n*** End Patch');
