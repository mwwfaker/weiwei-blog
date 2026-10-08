import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const anchor = '/* ---- 顶栏（同样是上轮误删的）---- */'
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }
// .roster 之前只是个没有样式的钩子；顺便给邮箱列定个够用的宽度
s = s.replace(anchor, '/* 员工名单：邮箱列要够宽才看得全 */\n.perf-grid.roster td:nth-child(2) .perf-cell{min-width:190px}\n\n' + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('.roster 有了实际规则')
