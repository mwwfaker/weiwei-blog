import fs from 'node:fs'
const lines = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8').split('\n')
console.log(lines.slice(594, 612).map((l, n) => (595 + n) + ': ' + l).join('\n'))
