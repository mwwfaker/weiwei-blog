import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const start = s.indexOf('async function exportWorkbook()')
const end = s.indexOf('function rowAvgAht(row, key)')
if (start < 0 || end < 0) { console.log('ANCHOR MISSING'); process.exit(1) }
let body = s.slice(start, end)
const before = body
// summary 是 computed ref，函数里必须 .value
body = body.replace(/summary\.(headcount|auditCount|tripleCount|pieceCount|efficiency|hours|auditTotal|total)\b/g, 'summary.value.$1')
if (body === before) { console.log('没有需要替换的'); } else { console.log('已补 .value') }
s = s.slice(0, start) + body + s.slice(end)
fs.writeFileSync(f, s, 'utf8')
