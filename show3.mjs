import fs from 'node:fs'
const lines = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8').split('\n')
const i = lines.findIndex((l) => l.trim() === 'return {')
console.log(lines.slice(i - 2, i + 10).map((l, n) => (i - 1 + n) + ': ' + l).join('\n'))
