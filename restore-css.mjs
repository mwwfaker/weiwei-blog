import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const anchor = '/* 选中对象的汇总条 */'
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }

const restored = `/* ---- 上一轮替换标记时误删的规则，这里补回来 ---- */
.perf-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px}
.perf-stat{padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);transition:border-color .35s ease}
.perf-stat.accent{background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 14%,var(--panel)),var(--panel));border-color:color-mix(in srgb,var(--accent) 32%,transparent)}
.perf-stat small{display:block;font-size:10px;letter-spacing:.08em;color:var(--muted)}
.perf-stat strong{display:block;margin:4px 0 2px;font-family:var(--serif);font-size:clamp(15px,1.6vw,20px);font-weight:600;font-variant-numeric:tabular-nums}
.perf-stat.accent strong{color:var(--accent)}
.perf-stat span{font-size:10px;color:var(--muted)}

.perf-tabs{display:flex;gap:4px;padding:4px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 5%,transparent);width:fit-content;max-width:100%;overflow-x:auto}
.perf-tabs button{padding:7px 15px;border:0;border-radius:999px;cursor:pointer;background:transparent;color:var(--muted);font-size:12px;white-space:nowrap;transition:color .3s ease,background-color .3s ease}
.perf-tabs button:hover{color:var(--ink)}
.perf-tabs button.active{color:#fff;background:linear-gradient(140deg,#a97cf0,#7a52d8)}

.perf-panel,.perf-import{display:grid;gap:12px}
.perf-import{grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}
.perf-card{display:grid;gap:9px;padding:14px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);align-content:start}
.perf-overview-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.perf-hint{font-size:11px;line-height:1.7;color:var(--muted);margin:0}
.perf-good{color:#46b06a}
.perf-bad{color:#e0716f}
.perf-assume{color:#d99a3c}

`
s = s.replace(anchor, restored + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('已补回 11 条规则')
