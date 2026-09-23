// This archive uses a deliberately small Markdown subset. Unsupported chart types
// fail rather than silently dropping figures. No remote scripts or runtime parser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'reports/stocks/华能蒙电600863_全面体检报告.md';
const output = 'report-600863-20260921.html';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inline = value => escape(value.replace(/\\([\[\]~])/g, '$1'))
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');

function chart(option) {
  const labels = option.xAxis.data;
  const axes = Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis];
  // Separate panels preserve each series' units without a misleading dual axis.
  return `<figure class="chart-card"><figcaption class="chart-title">${escape(option.title.text)}</figcaption>${option.series.map(series => {
    if (!['bar', 'line'].includes(series.type) || series.data.length !== labels.length || !series.data.every(Number.isFinite)) throw Error('Unsupported chart series');
    const low = Math.min(0, ...series.data), high = Math.max(0, ...series.data);
    const x = i => 72 + (i + 0.5) * 610 / labels.length;
    const y = value => 210 - (value - low) / (high - low || 1) * 150;
    const width = Math.min(44, 360 / labels.length);
    const marks = series.data.map((value, i) => {
      const shape = series.type === 'bar'
        ? `<rect x="${x(i) - width / 2}" y="${Math.min(y(value), y(0))}" width="${width}" height="${Math.abs(y(value) - y(0))}" fill="var(--accent)"/>`
        : `<circle cx="${x(i)}" cy="${y(value)}" r="4" fill="var(--accent)"/>`;
      return `${shape}<text x="${x(i)}" y="${y(value) - 10}" text-anchor="middle" fill="var(--ink)" font-size="12">${value}</text><text x="${x(i)}" y="238" text-anchor="middle" fill="var(--muted)" font-size="11">${escape(labels[i])}</text>`;
    }).join('');
    const line = series.type === 'line' ? `<polyline points="${series.data.map((v,i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>` : '';
    const table = `<details class="projection"><summary>查看${escape(series.name)}图表数据</summary><div class="table-wrap"><table><thead><tr><th>期间</th><th>${escape(series.name)}</th></tr></thead><tbody>${labels.map((label, i) => `<tr><td>${escape(label)}</td><td>${series.data[i]}</td></tr>`).join('')}</tbody></table></div></details>`;
    return `<h3>${escape(series.name)} · ${escape(axes[series.yAxisIndex || 0].name)}</h3><svg viewBox="0 0 760 260" role="img" aria-label="${escape(series.name)}"><title>${escape(series.name)}</title><line x1="72" x2="682" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)"/>${line}${marks}</svg>${table}`;
  }).join('')}</figure>`;
}

const lines = fs.readFileSync(path.join(root, source), 'utf8').split(/\r?\n/);
const title = lines[0].replace(/^# /, '');
const body = [], nav = [];
let section = false;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || line === '---') continue;
  if (line.startsWith('```')) {
    if (line !== '```echarts') throw Error(`Unsupported code fence: ${line}`);
    const json = [];
    while (++i < lines.length && lines[i].trim() !== '```') json.push(lines[i]);
    if (i === lines.length) throw Error('Unclosed code fence');
    body.push(chart(JSON.parse(json.join('\n'))));
  } else if (line.startsWith('## ')) {
    if (section) body.push('</section>');
    const id = `section-${nav.length + 1}`, heading = line.slice(3);
    const shortLabels = ['结论', '基本面', '资金面', '估值', '风险', '技术面', '观察'];
    nav.push(`<a href="#${id}">${inline(shortLabels[nav.length] || heading)}</a>`);
    body.push(`<section class="section" id="${id}"><div class="section-head"><h2>${inline(heading)}</h2></div>`);
    section = true;
  } else if (line.startsWith('### ')) {
    body.push(`<h3 class="ind-h3">${inline(line.slice(4))}</h3>`);
  } else if (line.startsWith('|')) {
    const rows = [line];
    while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) rows.push(lines[++i].trim());
    if (!/^\|[\s:|\-]+\|$/.test(rows[1] || '')) throw Error('Table header missing');
    const cells = row => row.slice(1, -1).split('|').map(c => c.trim());
    body.push(`<div class="table-wrap"><table><thead><tr>${cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(2).map(row => `<tr>${cells(row).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  } else if (/^(?:- |\d+\. )/.test(line)) {
    const ordered = /^\d/.test(line), pattern = ordered ? /^\d+\. / : /^- /;
    const items = [line.replace(pattern, '')];
    while (i + 1 < lines.length) {
      if (!lines[i + 1].trim()) { i++; continue; }
      if (!pattern.test(lines[i + 1].trim())) break;
      items.push(lines[++i].trim().replace(pattern, ''));
    }
    const tag = ordered ? 'ol' : 'ul';
    body.push(`<${tag} class="bullet-list">${items.map(item => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
  } else {
    body.push(`<p class="ind-p">${inline(line.replace(/^> /, ''))}</p>`);
  }
}
if (section) body.push('</section>');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} | 长期主义研究室</title>
<link rel="icon" href="assets/brand-mark.svg"><link rel="stylesheet" href="assets/site.css?v=20260917-orange-3"></head>
<body class="industry-page"><header class="site-header"><div class="shell nav"><a class="brand" href="index.html"><img class="brand-mark" src="assets/brand-mark.svg" width="32" height="32" alt="">长期主义研究室</a><nav class="nav-links" aria-label="主导航"><a href="index.html">收益率排行</a><a href="reports.html?category=stocks" aria-current="page">个股研究</a><a href="reports.html?category=industries">行业研究</a></nav></div></header>
<main><section class="detail-cover"><div class="shell"><a class="back" href="stock.html?code=600863">← 返回华能蒙电个股研究</a><h1>${escape(title)}</h1><p class="ind-p">补充研究 · 报告日期 2026-09-21 · 行情及财务期间以原文各处标注为准</p><nav class="report-nav" aria-label="报告目录">${nav.join('')}</nav></div></section>
<article class="shell report-body"><p class="method-note">本页按原文归档展示，未重新核验数据，不覆盖原有估值模型。原文中的编号引用未附完整来源索引，须结合原始资料核对。</p><a class="text-link" href="${source}" download>下载 Markdown 原文 ↗</a>
${body.join('\n')}</article></main><footer class="site-footer"><div class="shell">研究记录，不构成投资建议。</div></footer></body></html>
`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(path.join(root, output)) || fs.readFileSync(path.join(root, output), 'utf8') !== html) throw Error('Archive page is stale: run node docs/render-archive.mjs');
  console.log('Archive page matches source.');
} else {
  fs.writeFileSync(path.join(root, output), html, 'utf8');
  console.log(`Generated ${output}`);
}
