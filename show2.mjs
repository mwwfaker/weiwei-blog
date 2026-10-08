import fs from 'node:fs'
const lines = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8').split('\n')
console.log('=== 小计附近 ===')
const i = lines.findIndex((l) => l.includes('小计 · {{ activeQueue }}'))
console.log(lines.slice(i - 4, i + 14).map((l, n) => (i - 4 + n + 1) + ': ' + l).join('\n'))
