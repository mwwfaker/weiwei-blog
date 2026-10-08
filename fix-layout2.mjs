import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) 给「数据总览」这一节单独一个类，好让它用两栏各自滚动的布局
const secOld = `<section v-if="tab === 'entry'" class="perf-panel">`
const secNew = `<section v-if="tab === 'entry'" class="perf-panel split-panel">`
if (!s.includes(secOld)) { console.log('SECTION ANCHOR MISSING'); process.exit(1) }
s = s.replace(secOld, secNew)

// 2) 替换外壳与两栏相关的一整段 CSS
const startMarker = '/* 固定高度的应用外壳'
const endMarker = '/* 选中对象的汇总条 */'
const start = s.indexOf(startMarker)
const end = s.indexOf(endMarker)
if (start < 0 || end < 0) { console.log('CSS MARKERS MISSING'); process.exit(1) }

const css = `/* 固定高度的应用外壳：工具栏与左栏都不动，滚动只发生在各自的内容区里。
   之前整页一起滚、两个 sticky 各粘各的，滑动时好几块同时动，很难受。 */
.perf-tool{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--paper);color:var(--ink)}

/* 内容区自己不滚：汇总与标签固定，下面的板块占满剩余高度并各自处理滚动 */
.perf-body{
  flex:1;min-height:0;overflow:hidden;overscroll-behavior:contain;
  display:flex;flex-direction:column;gap:13px;
  padding:14px clamp(14px,3vw,34px) 16px;
}
.perf-body>section,.perf-body>nav{width:100%;max-width:1560px;margin:0 auto;flex:none}
.perf-body>section{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:6px;overscroll-behavior:contain}

/* 数据总览：外面不滚，左栏和右栏各自滚 */
.perf-body>section.split-panel{overflow:hidden;display:flex;flex-direction:column}
.perf-split{flex:1;min-height:0;display:grid;grid-template-columns:minmax(180px,236px) minmax(0,1fr);gap:12px;align-items:stretch}

.perf-picker{
  display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;min-height:0;overflow:hidden;
  border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 82%,transparent);
}
.perf-picker-search{width:100%;flex:none;padding:7px 11px;border-radius:9px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 5%,transparent);color:var(--ink);font-size:12px}
.perf-picker-search:focus{outline:none;border-color:var(--accent)}
.perf-picker-list{display:grid;gap:3px;align-content:start;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.perf-picker-list button{
  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;align-items:baseline;
  padding:8px 10px;border:1px solid transparent;border-radius:10px;cursor:pointer;text-align:left;
  background:transparent;color:var(--ink);transition:background-color .22s ease,border-color .22s ease;
}
.perf-picker-list button:hover{background:color-mix(in srgb,var(--accent) 8%,transparent)}
.perf-picker-list button.active{background:color-mix(in srgb,var(--accent) 16%,transparent);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.pk-name{font-family:var(--serif);font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pk-meta{grid-column:1;font-size:10px;color:var(--muted)}
.pk-money{grid-column:2;grid-row:1/3;align-self:center;font-size:11.5px;font-weight:600;color:var(--accent);font-variant-numeric:tabular-nums}

/* 右侧：汇总条固定，表格自己滚 */
.perf-split-body{display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;overflow:hidden}
.perf-split-body>.perf-list{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
.perf-split-body>.perf-summary-line,.perf-split-body>.perf-breakdown{flex:none}

/* 窄屏：两栏改成上下，左栏限高，右表拿到整个宽度——否则表格会被压扁、列互相遮挡 */
@media (max-width:900px){
  .perf-split{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(120px,auto) minmax(0,1fr)}
  .perf-picker{max-height:200px}
}

/* 滚动条：默认几乎看不见，悬停才亮出来，细圆角 */
.perf-body>section,.perf-picker-list,.perf-split-body>.perf-list,.perf-review{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--ink) 16%,transparent) transparent}
.perf-body>section::-webkit-scrollbar,
.perf-picker-list::-webkit-scrollbar,
.perf-split-body>.perf-list::-webkit-scrollbar,
.perf-review::-webkit-scrollbar{width:9px;height:9px}
.perf-body>section::-webkit-scrollbar-track,
.perf-picker-list::-webkit-scrollbar-track,
.perf-split-body>.perf-list::-webkit-scrollbar-track,
.perf-review::-webkit-scrollbar-track{background:transparent}
.perf-body>section::-webkit-scrollbar-thumb,
.perf-picker-list::-webkit-scrollbar-thumb,
.perf-split-body>.perf-list::-webkit-scrollbar-thumb,
.perf-review::-webkit-scrollbar-thumb{
  border:3px solid transparent;border-radius:999px;background-clip:padding-box;
  background-color:color-mix(in srgb,var(--ink) 14%,transparent);
  transition:background-color .3s ease;
}
.perf-body>section:hover::-webkit-scrollbar-thumb,
.perf-picker-list:hover::-webkit-scrollbar-thumb,
.perf-split-body>.perf-list:hover::-webkit-scrollbar-thumb,
.perf-review:hover::-webkit-scrollbar-thumb{background-color:color-mix(in srgb,var(--accent) 42%,transparent)}
.perf-body>section::-webkit-scrollbar-corner,
.perf-split-body>.perf-list::-webkit-scrollbar-corner{background:transparent}

`
s = s.slice(0, start) + css + s.slice(end)
fs.writeFileSync(f, s, 'utf8')
console.log('外壳 / 两栏独立滚动 / 滚动条 已重写')
