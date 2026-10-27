// 发布事实投影；只读数据仓库。--patch输出补丁，默认/--check只检查；不联网、不改原始快照。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readStore} from './research-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),store=readStore();
const publication=JSON.parse(fs.readFileSync(path.join(root,'research-data/publication.json'),'utf8')),result={};
for(const [code,config]of Object.entries(publication.reports)){
 const quote=store.snapshots.get(store.currents.get(config.securityId).datasets.quotes.snapshotId);
 const records={},rows=[];
 for(const snapshotId of config.statementSnapshotIds){
  const s=store.snapshots.get(snapshotId);assert(s&&s.securityId===config.securityId&&s.acceptance==='accepted','Invalid report fact version');
  for(const o of s.observations){
   if(o.dimensions?.kind!=='fact_row'||config.excludedFactIds?.includes(o.id))continue;
   assert(!records[o.id],'Duplicate fact id '+o.id);
   records[o.id]={value:o.value,unit:o.unit,currency:o.currency,verification:o.verification,periodLabel:o.dimensions.periodLabel,label:o.dimensions.label,snapshotId,sourceRefs:o.sourceRefs};
   const row=JSON.parse(o.dimensions.originalRow);
   if(o.value!==null&&o.dimensions.scale!==undefined){
    const first=row[1].match(/[-−]?\d[\d,]*(?:\.\d+)?/),decimals=first?.[0].split('.')[1]?.length||0;
    if(first){const n=Number(o.value)/10**Number(o.dimensions.scale);let display=first[0].includes(',')?new Intl.NumberFormat('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(n):n.toFixed(decimals);if(first[0].startsWith('−'))display=display.replace(/^-/,'−');row[1]=row[1].replace(first[0],display);}
   }
   rows.push([Number(o.dimensions.originalIndex),row]);
  }
 }
 result[code]={securityId:config.securityId,financialPeriod:config.financialPeriod,statementSnapshotIds:config.statementSnapshotIds,quote:{snapshotId:quote.snapshotId,asOf:quote.asOf,values:Object.fromEntries(quote.observations.map(o=>[o.metric,o.value]))},records,rows:rows.sort((a,b)=>a[0]-b[0]).map(x=>x[1])};
}
const file=path.join(root,'data/research-facts.js'),content='// GENERATED from research-data/publication.json. Edit canonical snapshots, not this file.\nwindow.RESEARCH_FACTS = {\n'+Object.entries(result).map(([code,value])=>'  '+JSON.stringify(code)+': '+JSON.stringify(value)).join(',\n')+'\n};\n';
const old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
if(process.argv.includes('--patch')){
 let patch='*** Begin Patch\n';const a=old.trimEnd().split('\n'),b=content.trimEnd().split('\n');
 if(old&&a.length===b.length){patch+='*** Update File: '+file+'\n';for(let i=0;i<a.length;i++)if(a[i]!==b[i])patch+='@@\n-'+a[i]+'\n+'+b[i]+'\n';}
 else patch+=(old?'*** Update File: '+file+'\n@@\n'+a.map(l=>'-'+l).join('\n')+'\n':'*** Add File: '+file+'\n')+b.map(l=>'+'+l).join('\n')+'\n';
 console.log(patch+'*** End Patch');
}else {assert.equal(old,content,'Publication facts out of sync; review build-research-facts.mjs --patch');console.log('PASS: '+Object.keys(result).length+' report fact projections match pinned store snapshots.');}
