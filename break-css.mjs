import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
fs.writeFileSync(f + '.bak', s, 'utf8')
fs.writeFileSync(f, s.replace('.perf-stat.accent{', '.perf-stat-accent-disabled{'), 'utf8')
