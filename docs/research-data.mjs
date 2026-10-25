// 无外部依赖、只读数据库存工具。不会采集网络数据、修改指针或发布网站。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../research-data');
const json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const date=s=>{assert(/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,'Invalid ISO date: '+s);return s;};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const safe=f=>{assert(typeof f==='string'&&!path.isAbsolute(f),'Relative path required');const p=path.resolve(root,f);assert(p.startsWith(root+path.sep),'Path escapes research-data');assert(!fs.lstatSync(p).isSymbolicLink()&&fs.realpathSync(p).startsWith(fs.realpathSync(root)+path.sep),'Symlink escapes data store: '+f);return p;};
const schema=json(path.join(root,'schema/snapshot.schema.json'));
// 校验本仓协议实际使用的JSON Schema关键字；不是任意JSON Schema解释器。
export function shape(value,r,label){
 if(r.$ref)return shape(value,r.$ref.split('/').slice(1).reduce((x,k)=>x[k],schema),label);
 if(r.enum)assert(r.enum.includes(value),label+': invalid enum');
 if(r.type){const types=[r.type].flat();assert(types.some(t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t),label+': invalid type');}
 if(typeof value==='string'){if(r.pattern)assert(new RegExp(r.pattern).test(value),label+': pattern');if(r.minLength)assert(value.length>=r.minLength,label+': empty');}
 if(Array.isArray(value)){if(r.minItems)assert(value.length>=r.minItems,label+': empty array');if(r.items)value.forEach((v,i)=>shape(v,r.items,label+'['+i+']'));}
 else if(value!==null&&typeof value==='object'){
  for(const key of r.required||[])assert(Object.hasOwn(value,key),label+': missing '+key);
  for(const [k,v]of Object.entries(value)){if(r.additionalProperties===false)assert(r.properties&&Object.hasOwn(r.properties,k),label+': unexpected '+k);if(r.properties?.[k])shape(v,r.properties[k],label+'.'+k);else if(r.additionalProperties&&typeof r.additionalProperties==='object')shape(v,r.additionalProperties,label+'.'+k);}
 }
}
export function readStore(){
 const registry=json(path.join(root,'registry.json'));
 assert.equal(registry.schemaVersion,'1.0');
 const securities=new Map();
 for(const s of registry.securities){assert(!securities.has(s.securityId),'Duplicate security');assert.equal(s.securityId,s.exchange+'.'+s.code);assert(typeof s.code==='string','Code must preserve leading zeros');securities.set(s.securityId,s);}
 const sources=new Map();
 for(const f of fs.readdirSync(path.join(root,'sources')).filter(f=>f.endsWith('.json'))){
  const s=json(path.join(root,'sources',f));assert(!sources.has(s.sourceId),'Duplicate source');date(s.collectedAt);if(s.publishedAt!==null)date(s.publishedAt);
  assert(s.evidence.file.startsWith('evidence/'),'Shared evidence must be in evidence/');
  assert.equal(hash(fs.readFileSync(safe(s.evidence.file))),s.evidence.sha256,'Evidence hash mismatch: '+f);sources.set(s.sourceId,s);
 }
 const snapshots=new Map(),currents=new Map();
 for(const item of fs.readdirSync(path.join(root,'securities'),{withFileTypes:true}))if(item.isDirectory())assert(securities.has(item.name),'Unregistered security directory: '+item.name);
 for(const id of securities.keys()){
  const folder=path.join(root,'securities',id);if(!fs.existsSync(folder))continue;
  for(const dataset of ['quotes','financials','dividends','operating','events']){
   const dir=path.join(folder,dataset);if(!fs.existsSync(dir))continue;
   for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
    const relative=path.relative(root,path.join(dir,f)).split(path.sep).join('/'),bytes=fs.readFileSync(safe(relative)),s=JSON.parse(bytes);
    shape(s,schema,relative);date(s.asOf);date(s.collectedAt);assert(s.collectedAt<=today,'Collection date cannot be in the future');assert(s.asOf<=s.collectedAt,'Observation cannot follow collection date');assert.equal(s.securityId,id);assert.equal(s.dataset,dataset);assert(!snapshots.has(s.snapshotId),'Duplicate snapshotId');
    const ids=new Set();
    for(const o of s.observations){
     assert(!ids.has(o.id),'Duplicate observation id');ids.add(o.id);date(o.period.end);assert(o.period.end<=s.asOf,'Period follows snapshot asOf');
     if(o.period.kind==='duration'){date(o.period.start);assert(o.period.start<=o.period.end,'Invalid duration');}
     else assert.equal(o.period.start,null,'Non-duration start must be null');
     if(o.value===null)assert(o.missingReason&&o.verification==='missing','Null requires explicit missing state');
     else {assert.equal(o.missingReason,null);assert(o.verification!=='missing','Missing state must have null value');}
     if(o.nature==='derived'){assert(o.derivation?.formula&&o.derivation.inputs.length,'Derived fact requires input lineage');assert.equal(o.precision,'derived');}
     if(o.verification==='cross_checked')assert(o.sourceRefs.length>=2,'Cross-check requires explicit corroboration');
     if(o.eventDetails)for(const key of ['announcedAt','approvedAt','exDate','paymentDate'])if(o.eventDetails[key]!==null)date(o.eventDetails[key]);
     if(o.metric==='dividend_per_share')assert(o.eventDetails,'Dividend must specify announcement/rights/payment status');
     for(const ref of o.sourceRefs){assert(sources.has(ref.sourceId),'Unknown source: '+ref.sourceId);assert(sources.get(ref.sourceId).collectedAt<=s.collectedAt,'Source obtained after snapshot collection');}
     if(dataset==='quotes'){
      assert.equal(o.period.kind,'instant');assert.equal(o.period.end,s.asOf);assert.equal(o.nature,'historical_fact');
      const units={close:'currency_per_share',pe_ttm:'times',pb:'times',market_cap:'currency',shares_outstanding:'shares'};
      assert(Object.hasOwn(units,o.metric),'Unknown quote metric; extend contract before using');assert.equal(o.unit,units[o.metric]);
      assert.equal(o.currency,['close','market_cap'].includes(o.metric)?securities.get(id).currency:null,'Quote currency mismatch');
      if(o.metric==='close'){assert(Number(o.value)>0||o.value===null,'Invalid close');assert.equal(o.basis.adjustment,'unadjusted');}
     }
    }
    if(dataset==='quotes'&&s.acceptance==='accepted')for(const key of ['close','pe_ttm','pb','market_cap','shares_outstanding'])assert(s.observations.some(o=>o.metric===key),'Incomplete accepted quote: '+key);
    snapshots.set(s.snapshotId,{...s,file:relative,sha256:hash(bytes)});
   }
  }
  const pointer=path.join(folder,'current.json');if(!fs.existsSync(pointer))continue;
  const p=json(pointer);assert.equal(p.securityId,id);assert.equal(p.schemaVersion,'1.0');currents.set(id,p);
 }
 for(const s of snapshots.values()){
  if(s.supersedes){const old=snapshots.get(s.supersedes);assert(old&&old.securityId===s.securityId&&old.dataset===s.dataset,'Invalid supersedes');assert(old.collectedAt<=s.collectedAt,'Correction predates old snapshot');assert.notEqual(old.snapshotId,s.snapshotId);}
  const chain=new Set([s.snapshotId]);let prior=s.supersedes;
  while(prior){assert(!chain.has(prior),'Correction cycle');chain.add(prior);prior=snapshots.get(prior)?.supersedes;}
  if(s.observations.some(o=>o.nature==='derived'))for(const o of s.observations.filter(o=>o.nature==='derived'))for(const input of o.derivation.inputs){const [sid,oid]=input.split('#');assert(snapshots.get(sid)?.observations.some(x=>x.id===oid),'Missing derived input '+input);}
 }
 for(const [id,p]of currents)for(const [dataset,ref]of Object.entries(p.datasets)){
  const s=snapshots.get(ref.snapshotId);assert(s&&s.securityId===id&&s.dataset===dataset,'Invalid current pointer');assert.equal(ref.file,s.file);assert.equal(ref.sha256,s.sha256,'Snapshot hash mismatch');assert.equal(s.acceptance,'accepted');assert(!s.observations.some(o=>['missing','conflicted'].includes(o.verification)),'Unresolved current snapshot');
 }
 return {registry,securities,sources,snapshots,currents};
}
export function selectSnapshot(store,id,dataset,asOf,knownOn){
 date(asOf);date(knownOn);assert(store.securities.has(id),'Unknown securityId');
 const all=[...store.snapshots.values()].filter(s=>s.securityId===id&&s.dataset===dataset&&s.acceptance==='accepted'&&s.asOf<=asOf&&s.collectedAt<=knownOn);
 const superseded=new Set(all.map(s=>s.supersedes).filter(Boolean));
 const choices=all.filter(s=>!superseded.has(s.snapshotId)&&!s.observations.some(o=>['missing','conflicted'].includes(o.verification))).sort((a,b)=>b.asOf.localeCompare(a.asOf)||b.collectedAt.localeCompare(a.collectedAt)||b.snapshotId.localeCompare(a.snapshotId));
 return choices[0]||null;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),command=args[0],store=readStore();
  if(command==='validate')console.log(`PASS: ${store.securities.size} securities, ${store.snapshots.size} snapshots, ${store.sources.size} sources; evidence/pointer hashes valid. Not a financial audit.`);
  else if(command==='inventory'){
   const coverage={};for(const d of ['quotes','financials','dividends','operating','events'])coverage[d]=[...store.currents.values()].filter(p=>p.datasets[d]).length;
   console.log(JSON.stringify({asOf:today,securities:store.securities.size,acceptedCurrentCoverage:coverage,missingCoverageIsNotZero:true},null,2));
  }else if(command==='show'){
   const option=(flag,fallback)=>{const i=args.indexOf(flag);return i<0?fallback:args[i+1];};
   const id=args[1],dataset=option('--dataset','quotes'),asOf=option('--as-of',today),knownOn=option('--known-on',today);
   const current=store.currents.get(id)?.datasets[dataset];
   const s=args.includes('--as-of')||args.includes('--known-on')?selectSnapshot(store,id,dataset,asOf,knownOn):current?store.snapshots.get(current.snapshotId):null;
   assert(s,'No usable snapshot for requested cutoff and knowledge date');
   const age=Math.round((Date.parse(today)-Date.parse(s.asOf))/86400000),ttl={quotes:30,financials:240,dividends:240,operating:60,events:7}[dataset];
   const stale=age>ttl;assert(!stale||args.includes('--allow-stale'),'Snapshot needs refresh; explicitly pass --allow-stale for historical use');
   console.log(JSON.stringify({cache:{ageDays:age,stale,latestAnnouncementChecked:false,warning:'缓存可读不等于最新；明确要求最新时须核对目标交易日及新公告。'},snapshot:s},null,2));
  }else throw Error('Usage: research-data.mjs validate | inventory | show EXCHANGE.CODE [--dataset quotes] [--as-of YYYY-MM-DD] [--known-on YYYY-MM-DD] [--allow-stale]');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
