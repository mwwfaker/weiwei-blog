import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const old = `.perf-panel{display:flex;flex-direction:column;gap:12px}
.perf-panel>*{flex:none}`
const neu = `.perf-panel{display:flex;flex-direction:column;gap:12px}
/* 面板里的东西不参与压缩（否则会被固定高度的父容器压扁后裁掉），
   但两栏容器要例外——它必须撑满剩余高度，两栏才能各自滚动。 */
.perf-panel>*{flex:none}
.perf-panel>.perf-split{flex:1;min-height:0}`
if (!s.includes(old)) { console.log('ANCHOR MISSING'); process.exit(1) }
fs.writeFileSync(f, s.replace(old, neu), 'utf8')
console.log('已让两栏容器重新撑满')
