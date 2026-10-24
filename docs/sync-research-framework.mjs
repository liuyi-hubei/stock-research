import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadFramework} from './research-framework-files.mjs';
import {researchMarkdown} from './research-framework-markdown.mjs';
import {generatedFile} from './generated-file.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),c=vm.createContext({window:{}});
for(const file of ['assets/shareholder-model.js','data/stocks.js','data/additional-stocks.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
loadFramework(root,c);
const requested=process.argv.slice(2).filter(x=>!x.startsWith('--'));
const plans=Object.values(c.window.RESEARCH_FRAMEWORK || {}).filter(p=>!requested.length||requested.includes(p.code));
assert(plans.length && requested.every(code=>plans.some(p=>p.code===code)),'Unknown or absent research plan');
const patchMode=process.argv.includes('--patch');let patch='*** Begin Patch\n';
for(const plan of plans){
  const stock=c.window.STOCK_RESEARCH.stocks.find(s=>s.code===plan.code);
  c.window.ResearchFramework.validate(plan,stock);
  const target=path.join(root,`reports/stocks/${stock.name}-${stock.code}.md`),original=fs.readFileSync(target,'utf8');
  assert(patchMode || /<!-- RESEARCH_FRAMEWORK: (?:evidence-first-v1|company-study-v2) -->/.test(original),'Refuse to replace manual report: first back it up and review --patch CODE');
  const review=original.match(/<!-- MODEL_REVIEW_START -->[\s\S]*?<!-- MODEL_REVIEW_END -->/)?.[0] || '';
  const updated=researchMarkdown(stock,plan,c.window.ShareholderModel,review);
  if(patchMode){patch+='*** Update File: '+target.replaceAll('\\','/')+'\n@@\n'+original.trimEnd().split(/\r?\n/).map(l=>'-'+l).join('\n')+'\n'+updated.trimEnd().split('\n').map(l=>'+'+l).join('\n')+'\n';}
  else generatedFile(target,updated);
}
if(patchMode)console.log(patch+'*** End Patch');
else console.log(`${process.exitCode?'OUT OF DATE':'PASS'}: ${plans.length} six-section archives${process.argv.includes('--check')?' checked read-only':' synchronized'}.`);
