import fs from 'node:fs'
const lines = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8').split('\n')
const i = lines.findIndex((l) => l.includes('standardHours: standard / 3600'))
console.log('=== queueTotals 附近 ===')
console.log(lines.slice(i - 10, i + 10).map((l, n) => (i - 9 + n) + ': ' + l).join('\n'))
