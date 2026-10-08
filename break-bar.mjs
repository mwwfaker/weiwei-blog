import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
const s = fs.readFileSync(f, 'utf8')
fs.writeFileSync(f + '.bak', s, 'utf8')
fs.writeFileSync(f, s.replace('.perf-bar{', '.perf-bar-disabled{'), 'utf8')
