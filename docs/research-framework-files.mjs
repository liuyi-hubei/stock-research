import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
export function frameworkFiles(root){
  return fs.readdirSync(path.join(root,'data/research')).filter(f=>/^\d{5,6}\.js$/.test(f)).sort().map(f=>'data/research/'+f);
}
export function loadFramework(root,scope){
  for(const file of [...frameworkFiles(root),'assets/research-framework.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
}
