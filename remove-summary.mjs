import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const start = s.indexOf('      <section class="perf-summary">')
const end = s.indexOf('      <nav class="perf-tabs">')
if (start < 0 || end < 0 || end < start) { console.log('SUMMARY ANCHOR MISSING'); process.exit(1) }
s = s.slice(0, start) + s.slice(end)
// 顺手把只给汇总卡用的样式也去掉
s = s.replace(/\/\* ---- 上一轮替换标记时误删的规则，这里补回来 ---- \*\/\n\.perf-summary\{[^}]*\}\n/, '')
fs.writeFileSync(f, s, 'utf8')
console.log('汇总卡已移除')
