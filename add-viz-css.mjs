import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let src = fs.readFileSync(f, 'utf8')
const anchor = '/* 视图切换：按员工 / 按队列 */\n.perf-view-toggle'
if (!src.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }
const css = `/* 可视化：排名徽章与条形 */
.rank-col{width:44px;text-align:center}
.rank-badge{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:600;background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--muted)}
.rank-badge.top3{background:color-mix(in srgb,var(--accent) 22%,transparent);color:var(--accent)}
.rank-badge.top1{background:linear-gradient(140deg,#f0c060,#e0a13f);color:#3a2a08}
.bar-col{width:34%;min-width:120px}
.viz-bar{height:8px;border-radius:999px;background:color-mix(in srgb,var(--ink) 9%,transparent);overflow:hidden}
.viz-bar>div{height:100%;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 55%,transparent),var(--accent));transition:width .6s cubic-bezier(.22,.9,.24,1)}

`
src = src.replace(anchor, css + anchor)
fs.writeFileSync(f, src, 'utf8')
console.log('css added')
