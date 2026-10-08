import fs from 'node:fs'
const f = 'verify-frontend.mjs'
const lines = fs.readFileSync(f, 'utf8').split('\n')
const start = lines.findIndex((l) => l.includes('[8] template bindings resolve'))
const end = lines.findIndex((l) => l.trim().startsWith('console.log(failures ?'))
if (start < 0 || end < 0 || end < start) { console.log('MARKERS', start, end); process.exit(1) }
const kept = [...lines.slice(0, Math.max(0, start - 1)), ...lines.slice(end)]
fs.writeFileSync(f, kept.join('\n'), 'utf8')
console.log('已删除第 8 项，剩余行数', kept.length)
