import fs from 'node:fs'
const lines = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8').split('\n')
console.log(lines.slice(855, 885).map((l, n) => (856 + n) + ': ' + l).join('\n'))
