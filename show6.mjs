import fs from 'node:fs'
const lines = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8').split('\n')
console.log(lines.slice(596, 606).map((l, n) => (597 + n) + ': ' + l).join('\n'))
