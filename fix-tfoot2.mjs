import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let lines = fs.readFileSync(f, 'utf8').split('\n')

// 1) 小计计算里补上标准总时长
const ci = lines.findIndex((l) => l.includes('return { auditCount, hours: actual / 3600'))
if (ci < 0) { console.log('CALC NOT FOUND'); process.exit(1) }
lines[ci] = '  return {'
lines.splice(ci + 1, 0,
  '    auditCount,',
  '    standardHours: standard / 3600,',
  '    hours: actual / 3600,')

// 2) 小计行按表头 10 列对齐
const ti = lines.findIndex((l) => l.includes('小计 · {{ activeQueue }}'))
if (ti < 0) { console.log('FOOT NOT FOUND'); process.exit(1) }
const indent = lines[ti].match(/^\s*/)[0]
const row = [
  indent + '<td>小计 · {{ activeQueue }}</td>',
  indent + '<td colspan="2" class="num">{{ (queueTotals.auditCount || 0).toLocaleString(\'en-US\') }} 条</td>',
  indent + '<td v-if="showTriple" colspan="2"></td>',
  indent + '<td class="num">{{ queueTotals.standardHours.toFixed(2) }} h</td>',
  indent + '<td class="num">{{ queueTotals.hours.toFixed(2) }} h</td>',
  indent + '<td class="num">{{ percent(queueTotals.efficiency) }}</td>',
  indent + '<td class="num">¥ {{ money(queueTotals.pay) }}</td>',
  indent + '<td class="num total">¥ {{ money(queueTotals.pay) }}</td>',
]
// 找到这一行的结束（下一个 </tr>）
let end = ti
while (end < lines.length && !lines[end].includes('</tr>')) end += 1
lines.splice(ti, end - ti + 1, ...row)
fs.writeFileSync(f, lines.join('\n'), 'utf8')
console.log('小计行已按 10 列对齐，并补上标准总时长')
