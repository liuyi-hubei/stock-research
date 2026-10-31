// 按代码逐行替换 data/research-facts.js 的投影条目，保留他人在飞的其它代码改动。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStore } from '../docs/research-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codes = process.argv.slice(2);
if (!codes.length) { console.error('usage: node outputs/_patch-facts.mjs CODE...'); process.exit(1); }

const store = readStore();
const publication = JSON.parse(fs.readFileSync(path.join(root, 'research-data/publication.json'), 'utf8'));

function project(code) {
  const config = publication.reports[code];
  const quote = store.snapshots.get(store.currents.get(config.securityId).datasets.quotes.snapshotId);
  const records = {}, rows = [];
  for (const snapshotId of config.statementSnapshotIds) {
    const s = store.snapshots.get(snapshotId);
    if (!s || s.securityId !== config.securityId || s.acceptance !== 'accepted') throw new Error('Invalid report fact version ' + snapshotId);
    for (const o of s.observations) {
      if (o.dimensions?.kind !== 'fact_row' || config.excludedFactIds?.includes(o.id)) continue;
      if (records[o.id]) throw new Error('Duplicate fact id ' + o.id);
      records[o.id] = { value: o.value, unit: o.unit, currency: o.currency, verification: o.verification, periodLabel: o.dimensions.periodLabel, label: o.dimensions.label, snapshotId, sourceRefs: o.sourceRefs };
      const row = JSON.parse(o.dimensions.originalRow);
      if (o.value !== null && o.dimensions.scale !== undefined) {
        const first = row[1].match(/[-−]?\d[\d,]*(?:\.\d+)?/), decimals = first?.[0].split('.')[1]?.length || 0;
        if (first) { const n = Number(o.value) / 10 ** Number(o.dimensions.scale); let display = first[0].includes(',') ? new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n) : n.toFixed(decimals); if (first[0].startsWith('−')) display = display.replace(/^-/, '−'); row[1] = row[1].replace(first[0], display); }
      }
      rows.push([Number(o.dimensions.originalIndex), row]);
    }
  }
  return {
    securityId: config.securityId,
    financialPeriod: config.financialPeriod,
    statementSnapshotIds: config.statementSnapshotIds,
    quote: { snapshotId: quote.snapshotId, asOf: quote.asOf, values: Object.fromEntries(quote.observations.map((o) => [o.metric, o.value])) },
    records,
    rows: rows.sort((a, b) => a[0] - b[0]).map((x) => x[1]),
  };
}

const file = path.join(root, 'data/research-facts.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');
for (const code of codes) {
  const projected = project(code);
  const idx = lines.findIndex((l) => l.startsWith(`  ${JSON.stringify(code)}: `));
  if (idx < 0) throw new Error('code line not found: ' + code);
  const comma = lines[idx].trimEnd().endsWith(',') ? ',' : '';
  lines[idx] = `  ${JSON.stringify(code)}: ${JSON.stringify(projected)}${comma}`;
  console.log(code, 'rows', projected.rows.length, '| period', projected.financialPeriod);
}
fs.writeFileSync(file, lines.join('\n'));
console.log('patched', codes.join(','));
