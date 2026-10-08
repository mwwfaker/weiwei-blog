import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) 小计里补上「标准总时长」，原来的 hours 是实际总时长
const oldCalc = `  return { auditCount, hours: actual / 3600, efficiency: actual > 0 ? standard / actual : 0, pay }`
const newCalc = `  return {
    auditCount,
    standardHours: standard / 3600,
    hours: actual / 3600,
    efficiency: actual > 0 ? standard / actual : 0,
    pay,
  }`
if (!s.includes(oldCalc)) { console.log('CALC ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldCalc, newCalc)

// 2) 小计行按表头的 10 列对齐：员工 | 实际AHT+审核量 | (三薪+计件) | 标准 | 实际 | 效率 | 审核工资 | 合计
const oldFoot = `                    <tr>
                      <td>小计 · {{ activeQueue }}</td>
                      <td colspan="2" class="num">{{ (queueTotals.auditCount || 0).toLocaleString('en-US') }} 条</td>
                      <td v-if="showTriple" colspan="2"></td>
                      <td class="num">{{ queueTotals.hours.toFixed(2) }} h</td>
                      <td class="num">{{ percent(queueTotals.efficiency) }}</td>
                      <td class="num">¥ {{ money(queueTotals.pay) }}</td>
                      <td class="num total">¥ {{ money(queueTotals.pay) }}</td>
                    </tr>`
const newFoot = `                    <tr>
                      <td>小计 · {{ activeQueue }}</td>
                      <td colspan="2" class="num">{{ (queueTotals.auditCount || 0).toLocaleString('en-US') }} 条</td>
                      <td v-if="showTriple" colspan="2"></td>
                      <td class="num">{{ queueTotals.standardHours.toFixed(2) }} h</td>
                      <td class="num">{{ queueTotals.hours.toFixed(2) }} h</td>
                      <td class="num">{{ percent(queueTotals.efficiency) }}</td>
                      <td class="num">¥ {{ money(queueTotals.pay) }}</td>
                      <td class="num total">¥ {{ money(queueTotals.pay) }}</td>
                    </tr>`
if (!s.includes(oldFoot)) { console.log('FOOT ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldFoot, newFoot)
fs.writeFileSync(f, s, 'utf8')
console.log('小计行已按 10 列对齐')
