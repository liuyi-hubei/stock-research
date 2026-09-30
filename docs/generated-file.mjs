import fs from 'node:fs';
// 检查时只比较；生成时保持现有换行风格，避免整份人工报告改行尾。
export function generatedFile(target, content, check = process.argv.includes('--check')) {
  const original = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const normalize = text => text.replace(/\r\n/g, '\n');
  if (normalize(original) === normalize(content)) return false;
  if (check) { console.error(`OUT OF DATE: ${target}`); process.exitCode = 1; }
  else fs.writeFileSync(target, original.includes('\r\n') ? normalize(content).replace(/\n/g, '\r\n') : normalize(content));
  return true;
}
