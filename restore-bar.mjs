import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const anchor = '/* ---- 上一轮替换标记时误删的规则，这里补回来 ---- */'
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }

const bar = `/* ---- 顶栏（同样是上轮误删的）---- */
.perf-bar{
  position:relative;z-index:20;flex:none;display:flex;align-items:center;justify-content:space-between;
  gap:16px;flex-wrap:wrap;padding:11px clamp(14px,3vw,34px);border-bottom:1px solid var(--line);
  background:color-mix(in srgb,var(--panel) 90%,transparent);backdrop-filter:blur(14px);
}
.perf-bar-left{display:flex;align-items:center;gap:11px;min-width:0;flex:1}
.perf-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:11px;flex:none;color:#fff;font-size:15px;background:linear-gradient(140deg,#a97cf0,#7a52d8)}
.perf-bar-left strong{display:block;font-family:var(--serif);font-size:15px;line-height:1.3}
.perf-bar-left small{display:block;font-size:10px;color:var(--muted)}
.perf-month{padding:6px 9px;border-radius:9px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);color:var(--ink);font-size:12px}
.perf-bar-right{display:flex;gap:8px;flex-wrap:wrap}

.perf-btn{
  padding:7px 14px;border-radius:10px;border:1px solid var(--line);cursor:pointer;
  background:color-mix(in srgb,var(--ink) 5%,transparent);color:var(--ink);font-size:12px;
  transition:background-color .3s ease,border-color .3s ease,transform .3s ease,color .3s ease;
}
.perf-btn:hover:not(:disabled){transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.perf-btn:disabled{opacity:.45;cursor:not-allowed}
.perf-btn.primary{border-color:transparent;color:#fff;background:linear-gradient(140deg,#a97cf0,#7a52d8)}

`
s = s.replace(anchor, bar + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('顶栏 8 条规则已补回')
