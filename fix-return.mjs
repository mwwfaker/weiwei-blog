import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let lines = fs.readFileSync(f, 'utf8').split('\n')
const i = lines.findIndex((l) => l.includes('standardHours: standard / 3600'))
if (i < 0) { console.log('NOT FOUND'); process.exit(1) }
// 正确收尾：效率与工资，然后闭合对象
lines.splice(i + 3, 1,
  '    efficiency: actual > 0 ? standard / actual : 0,',
  '    pay,',
  '  }')
fs.writeFileSync(f, lines.join('\n'), 'utf8')
console.log('queueTotals 的收尾已修正')
