import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let lines = fs.readFileSync(f, 'utf8').split('\n')
// 找到被截断的那三行（243..245，1-based）
const i = lines.findIndex((l) => l.includes('expr.matchAll(/(?<![.\\w'))
if (i < 0) { console.log('NOT FOUND'); process.exit(1) }
const replacement = [
  "    const cleaned = expr.replace(/'[^']*'/g, \"''\").replace(/\"[^\"]*\"/g, '\"\"')",
  '    for (const m of cleaned.matchAll(/(?<![.\\w$])([A-Za-z_$][\\w$]*)/g)) {',
]
lines.splice(i, 3, ...replacement)
// 把误插到中间的 process.exitCode 行收拢到文件末尾
const stray = lines.map((l, n) => (l.trim().startsWith('process.exitCode') ? n : -1)).filter((n) => n >= 0)
for (const n of stray.reverse()) lines.splice(n, 1)
lines = lines.filter((l, n) => !(n > 0 && lines[n - 1].trim() === '' && l.trim() === ''))
lines.push('process.exitCode = failures ? 1 : 0', '')
fs.writeFileSync(f, lines.join('\n'), 'utf8')
console.log('已修复，文件行数:', lines.length)
