// 本地只读发布范围检查；不连接服务器、不同步文件、不改变部署配置。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['index.html','reports.html','stock.html','industry.html','assets/research-freshness.js','assets/report-query.js','assets/app.js','assets/shareholder-model.js','assets/site.css','assets/brand-mark-ly-serif.png','data/stocks.js','data/additional-stocks.js','data/industries.js']) assert(fs.existsSync(path.join(root,file)), `Missing publication dependency: ${file}`);
let count=0;
function scan(dir) {
  for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
    const file=`${dir}/${item.name}`;
    assert(!item.isSymbolicLink(),`Unexpected symlink: ${file}`);
    if(item.isDirectory())scan(file);
    else { assert(/\.(?:css|js|svg|png|jpg|jpeg|webp|md|pdf)$/.test(file),`Unexpected publication file: ${file}`); count++; }
  }
}
for(const dir of ['assets','data','reports'])scan(dir);
console.log(`PASS: runtime dependencies and ${count} assets/data/report files; local check only.`);
