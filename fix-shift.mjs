import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const bad = `    const pcts = []
    summaryRows.push([
      m.name || '', m.email || '', r.lines.length, r.auditCount, r.tripleCount, r.pieceCount,
      pcts.length ? '' : '', rowAvgAht(row, 'standardAht'), rowAvgAht(row, 'actualAht'),
      r.efficiency, r.completion, Number(m.requiredHours) || 0, r.actualHours,
      Number(m.transferHours) || 0, Number(m.overtimeHours) || 0, Number(m.tripleHours) || 0,
      r.auditPay, r.subsidyPay, r.overtimePay, r.triplePay, r.total,
    ])
    const last = summaryRows[summaryRows.length - 1]
    last[8] = last[8]
  }`
const good = `    summaryRows.push([
      m.name || '', m.email || '', r.lines.length, r.auditCount, r.tripleCount, r.pieceCount,
      rowAvgAht(row, 'standardAht'), rowAvgAht(row, 'actualAht'),
      r.efficiency, r.completion, Number(m.requiredHours) || 0, r.actualHours,
      Number(m.transferHours) || 0, Number(m.overtimeHours) || 0, Number(m.tripleHours) || 0,
      r.auditPay, r.subsidyPay, r.overtimePay, r.triplePay, r.total,
    ])
  }`
if (!s.includes(bad)) { console.log('ANCHOR MISSING'); process.exit(1) }
s = s.replace(bad, good)
// 效率与完成度在总表里是第 8、9 列（从 0 数）
s = s.replace(`    summaryRows[i][8] = pctText(summaryRows[i][8])`, `    summaryRows[i][8] = pctText(summaryRows[i][8])`)
fs.writeFileSync(f, s, 'utf8')
console.log('去掉了多余的空列')
