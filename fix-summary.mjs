import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const old = `.perf-body>section,.perf-body>nav{width:100%;max-width:1560px;margin:0 auto;flex:none}
.perf-body>section{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:6px;overscroll-behavior:contain}

/* 数据总览：外面不滚，左栏和右栏各自滚 */
.perf-body>section.split-panel{overflow:hidden;display:flex;flex-direction:column}`
const neu = `/* 汇总条与标签只占自身高度；只有各个标签页的面板才撑满剩余高度并自己滚动。
   注意不能直接写 .perf-body>section —— 汇总条也是 section，会被一起撑高。 */
.perf-summary,.perf-tabs{flex:none}
.perf-body>nav{width:100%;max-width:1560px;margin:0 auto;flex:none}
.perf-body>section:is(.perf-panel,.perf-import){
  width:100%;max-width:1560px;margin:0 auto;flex:1;min-height:0;
  overflow-y:auto;overflow-x:hidden;padding-bottom:6px;overscroll-behavior:contain;
}

/* 数据总览：外面不滚，左栏和右栏各自滚 */
.perf-body>section.split-panel{overflow:hidden;display:flex;flex-direction:column}`
if (!s.includes(old)) { console.log('ANCHOR MISSING'); process.exit(1) }
s = s.replace(old, neu)
// 滚动条选择器也要跟着换
s = s.replace(/\.perf-body>section,/g, '.perf-body>section:is(.perf-panel,.perf-import),')
s = s.replace(/\.perf-body>section::/g, '.perf-body>section:is(.perf-panel,.perf-import)::')
fs.writeFileSync(f, s, 'utf8')
console.log('汇总条不再被撑高')
