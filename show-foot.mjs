import fs from 'node:fs'
const s = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8')
const i = s.indexOf('小计 · {{ activeQueue }}')
console.log('=== 小计行附近原文 ===')
console.log(s.slice(i - 200, i + 700))
