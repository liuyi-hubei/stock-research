import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dataFiles = ['data/stocks.js', 'data/additional-stocks.js', 'data/industries.js'];
const modelFile = 'assets/shareholder-model.js';
const app = read('assets/app.js');
function context(pathname, search = '') {
  const body = { innerHTML: '', className: '' };
  const summary = { append(link) { body.innerHTML += `<a href="${link.href}">${link.textContent}</a>`; } };
  const scope = { window: {}, document: { body, title: '', querySelector: selector => selector === '#summary' ? summary : null, createElement: () => ({}) }, location: { pathname, search, hash: '' }, URLSearchParams, Intl };
  vm.createContext(scope);
  for (const file of dataFiles) vm.runInContext(read(file), scope, { filename: file });
  vm.runInContext(read(modelFile), scope, { filename: modelFile });
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
assert(stocks.every(s => s.model && s.model.version === 'shareholder-irr-v1'), 'Found a stock outside the unified shareholder-IRR caliber');
assert(stocks.every(s => !('baseReturn' in s)), 'Found a stock retaining the retired baseReturn field');
assert(stocks.every(s => !('scenarios' in s.model) && !('baseRows' in s.model)), 'Found a stock retaining retired reinvestment model fields');
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
  for (const required of [...dataFiles.slice(0, 2), modelFile, 'assets/app.js']) assert(scripts.includes(required), `${file}: missing script ${required}`);
  assert(scripts.indexOf(dataFiles[0]) < scripts.indexOf(dataFiles[1]) && scripts.indexOf(dataFiles[1]) < scripts.indexOf(modelFile) && scripts.indexOf(modelFile) < scripts.indexOf('assets/app.js'), `${file}: invalid script order`);
}
localLinks(read('report-600863-20260921.html'), 'report-600863-20260921.html');
// Regression: a negative pessimistic IRR must render as a negative value, never truncated to zero.
const sample = stocks.find(s => s.model.version === 'shareholder-irr-v1');
const negative = context('/stock.html', `?code=${sample.code}`);
const target = negative.window.STOCK_RESEARCH.stocks.find(s => s.code === sample.code);
target.model.assumptions[0].early = -0.6;
target.model.assumptions[0].late = -0.6;
vm.runInContext(app, negative);
const negativeHtml = negative.document.body.innerHTML;
const bearRow = negativeHtml.match(/悲观<\/th>([\s\S]{0,600}?)<\/tr>/);
assert(bearRow && /-\d+(?:\.\d+)?%/.test(bearRow[1]), 'Negative pessimistic IRR was truncated to zero');
// Home ranking must be non-empty and use the unified IRR caliber.
const home = context('/index.html');
vm.runInContext(app, home);
const homeHtml = home.document.body.innerHTML;
assert(/ranking-row/.test(homeHtml), 'Home ranking list is empty');
assert(!/分红复投/.test(homeHtml), 'Home still references the retired reinvestment caliber');
assert(!/baseReturn|undefined/.test(homeHtml), 'Home leaked a retired field or undefined value');
const archived = fs.readdirSync(path.join(root, 'reports/stocks'));
const missing = stocks.filter(s => !archived.some(file => file.includes(s.code)));
console.log(`PASS: ${stocks.length} stocks, ${industries.length} industries, ${routes.length} routes, local links and negative-return chart.`);
if (missing.length) console.log(`Archive coverage warning (web reports remain available): ${missing.map(s => `${s.name} ${s.code}`).join(', ')}`);
