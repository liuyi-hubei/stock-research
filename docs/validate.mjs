import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dataFiles = ['data/stocks.js', 'data/additional-stocks.js', 'data/industries.js'];
const app = read('assets/app.js');
function context(pathname, search = '') {
  const body = { innerHTML: '', className: '' };
  const summary = { append(link) { body.innerHTML += `<a href="${link.href}">${link.textContent}</a>`; } };
  const scope = { window: {}, document: { body, title: '', querySelector: selector => selector === '#summary' ? summary : null, createElement: () => ({}) }, location: { pathname, search, hash: '' }, URLSearchParams, Intl };
  vm.createContext(scope);
  for (const file of dataFiles) vm.runInContext(read(file), scope, { filename: file });
  return scope;
}
function localLinks(html, filename) {
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (/^(?:https?:|mailto:|#|data:)/.test(url)) continue;
    const target = decodeURIComponent(url.split(/[?#]/)[0]);
    assert(fs.existsSync(path.resolve(root, path.dirname(filename), target)), `${filename}: missing ${target}`);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${filename}: duplicate element ID`);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(match[1]), `${filename}: missing anchor ${match[1]}`);
  assert(!/(?:NaN|undefined|Infinity)/.test(html), `${filename}: invalid rendered value`);
}
const initial = context('/index.html');
const stocks = initial.window.STOCK_RESEARCH.stocks;
const industries = Object.values(initial.window.INDUSTRY_REPORTS);
assert.equal(new Set(stocks.map(s => s.code)).size, stocks.length, 'Duplicate stock code');
assert.equal(new Set(stocks.map(s => s.slug)).size, stocks.length, 'Duplicate stock slug');
const routes = [['index.html', ''], ['reports.html', '?category=stocks'], ['reports.html', '?category=industries'],
  ...stocks.map(s => ['stock.html', `?code=${s.code}`]), ...industries.map(r => ['industry.html', `?id=${r.id}`]),
  ['stock.html', '?code=missing'], ['industry.html', '?id=missing']];
for (const [file, search] of routes) {
  const scope = context(`/${file}`, search);
  vm.runInContext(app, scope, { filename: 'assets/app.js' });
  assert(scope.document.body.innerHTML.length > 100, `Empty route: ${file}${search}`);
  localLinks(scope.document.body.innerHTML, file);
}
for (const file of ['index.html', 'reports.html', 'stock.html', 'industry.html']) {
  const html = read(file);
  localLinks(html, file);
  const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
  for (const required of [...dataFiles.slice(0, 2), 'assets/app.js']) assert(scripts.includes(required), `${file}: missing script ${required}`);
  assert(scripts.indexOf(dataFiles[0]) < scripts.indexOf(dataFiles[1]) && scripts.indexOf(dataFiles[1]) < scripts.indexOf('assets/app.js'), `${file}: invalid script order`);
}
localLinks(read('report-600863-20260921.html'), 'report-600863-20260921.html');
// Regression: negative returns extend left from zero, positive returns right.
const graph = context('/stock.html', `?code=${stocks[0].code}`);
graph.window.STOCK_RESEARCH.stocks[0].model.scenarios.forEach((s, i) => { s.cagr = ['-5%', '0%', '10%'][i]; });
vm.runInContext(app, graph);
const bars = [...graph.document.body.innerHTML.matchAll(/<g class="chart-row[^>]+>(.*?)<\/g>/g)].map(m => m[1]);
const zero = Number(bars[0].match(/<line x1="([^"]+)"/)[1]);
const rect = bars.map(b => b.match(/<rect x="([^"]+)"[^>]+width="([^"]+)"/));
assert(Number(rect[0][1]) < zero && Math.abs(Number(rect[0][1]) + Number(rect[0][2]) - zero) < 0.001);
assert.equal(Number(rect[1][2]), 0);
assert.equal(Number(rect[2][1]), zero);
const archived = fs.readdirSync(path.join(root, 'reports/stocks'));
const missing = stocks.filter(s => !archived.some(file => file.includes(s.code)));
console.log(`PASS: ${stocks.length} stocks, ${industries.length} industries, ${routes.length} routes, local links and negative-return chart.`);
if (missing.length) console.log(`Archive coverage warning (web reports remain available): ${missing.map(s => `${s.name} ${s.code}`).join(', ')}`);
