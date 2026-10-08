import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

const oldTool = '.perf-tool{min-height:100vh;background:var(--paper);color:var(--ink)}'
const newTool = `/* 固定高度的应用外壳：工具栏和左栏都不动，只有右边的数据区滚动。
   之前整页一起滚，工具栏和左栏各自 sticky，滚起来是两三块同时在动，很别扭。 */
.perf-tool{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--paper);color:var(--ink)}`
if (!s.includes(oldTool)) { console.log('TOOL ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldTool, newTool)

const oldBar = `  position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;`
const newBar = `  position:relative;z-index:20;flex:none;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;`
if (!s.includes(oldBar)) { console.log('BAR ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldBar, newBar)

const oldBody = '.perf-body{display:grid;gap:14px;padding:16px clamp(14px,3vw,34px) 40px;max-width:1500px;margin:0 auto}'
const newBody = `/* 唯一可滚动的区域 */
.perf-body{
  flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;scroll-behavior:auto;
  display:grid;gap:14px;padding:16px clamp(14px,3vw,34px) 40px;align-content:start;
}
.perf-body>section,.perf-body>nav{max-width:1500px;width:100%;margin:0 auto}`
if (!s.includes(oldBody)) { console.log('BODY ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldBody, newBody)

// 左栏在滚动容器内吸顶，不再需要给工具栏留偏移
const oldPicker = `  position:sticky;top:74px;display:grid;gap:8px;padding:10px;border-radius:14px;
  border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 82%,transparent);
  max-height:calc(100vh - 100px);`
const newPicker = `  position:sticky;top:0;display:grid;gap:8px;padding:10px;border-radius:14px;
  border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 82%,transparent);
  max-height:min(70vh,560px);`
if (!s.includes(oldPicker)) { console.log('PICKER ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldPicker, newPicker)

fs.writeFileSync(f, s, 'utf8')
console.log('已改成固定外壳 + 单一滚动区')
