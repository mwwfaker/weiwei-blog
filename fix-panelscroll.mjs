import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) .perf-panel 从 grid 改成 flex：grid 的自动行会被固定高度的父容器压扁，
//    子元素一旦配合 overflow:hidden 就变成「裁掉且滚不动」。
const oldPanel = '.perf-panel,.perf-import{display:grid;gap:12px}'
const newPanel = `.perf-panel{display:flex;flex-direction:column;gap:12px}
.perf-panel>*{flex:none}
.perf-import{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}`
if (!s.includes(oldPanel)) { console.log('PANEL ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldPanel, newPanel)
s = s.replace('.perf-import{grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}\n', '')

// 2) 表格容器允许滚动，圆角仍然保留
s = s.replace('.perf-list{border:1px solid var(--line);border-radius:14px;overflow:hidden;', '.perf-list{border:1px solid var(--line);border-radius:14px;overflow:auto;')

fs.writeFileSync(f, s, 'utf8')
console.log('已改为不压缩 + 可滚动')
