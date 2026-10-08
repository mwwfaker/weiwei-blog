import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const before = s
s = s.replace(
  'const availableSeconds = ((Number(daily.value.hours) + Number(daily.value.overtimeHours)) * constants.factor - Number(daily.value.transferHours)) * 3600',
  'const availableSeconds = ((Number(daily.value.hours) + Number(daily.value.overtimeHours)) * constants.value.factor - Number(daily.value.transferHours)) * 3600')
s = s.replace(
  'const overtimePay = Number(daily.value.overtimeHours) * constants.overtimeRate',
  'const overtimePay = Number(daily.value.overtimeHours) * constants.value.overtimeRate')
s = s.replace(
  'const triplePay = Number(daily.value.tripleHours) * constants.tripleRate',
  'const triplePay = Number(daily.value.tripleHours) * constants.value.tripleRate')
if (s === before) { console.log('NOTHING REPLACED'); process.exit(1) }
fs.writeFileSync(f, s, 'utf8')
console.log('fixed constants.value in dailyTotals')
