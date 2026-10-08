import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const section = fs.readFileSync('D:/a唯唯项目/.build-tools/scatter-section.html', 'utf8')
const script = fs.readFileSync('D:/a唯唯项目/.build-tools/scatter-script.js', 'utf8')

// 1) 换掉旧的散点计算
const sStart = s.indexOf('/** 效率 × 完成度 散点。 */')
const sEnd = s.indexOf('/** 相对团队均值的偏差。 */')
if (sStart < 0 || sEnd < 0) { console.log('SCRIPT MARKERS', sStart, sEnd); process.exit(1) }
s = s.slice(0, sStart) + script + '\n' + s.slice(sEnd)

// 2) 换掉旧的散点卡片
const tStart = s.indexOf('          <!-- 四、效率 × 完成度 散点 -->')
const tEnd = s.indexOf('          <!-- 五、相对团队均值 -->')
if (tStart < 0 || tEnd < 0) { console.log('TPL MARKERS', tStart, tEnd); process.exit(1) }
s = s.slice(0, tStart) + section + s.slice(tEnd)

// 3) 样式
const cssAt = s.lastIndexOf('</style>')
const css = `/* 散点图：象限底色 + 刻度 + 悬浮提示 */
.viz-scatter{width:100%;height:auto;max-height:360px;display:block}
.viz-scatter .quad{fill:transparent}
.viz-scatter .quad.best{fill:color-mix(in srgb,var(--accent) 7%,transparent)}
.viz-scatter .grid{stroke:color-mix(in srgb,var(--ink) 8%,transparent);stroke-width:1}
.viz-scatter .axis{stroke:color-mix(in srgb,var(--ink) 26%,transparent);stroke-width:1.2}
.viz-scatter .avgline{stroke:color-mix(in srgb,var(--accent) 50%,transparent);stroke-width:1;stroke-dasharray:5 4}
.viz-scatter .tick{fill:var(--muted);font-size:9.5px}
.viz-scatter .axislabel{fill:var(--muted);font-size:10px}
.viz-scatter .quadlabel{fill:color-mix(in srgb,var(--ink) 30%,transparent);font-size:9.5px}
.viz-scatter .dotgroup{cursor:default}
.viz-scatter .dot{fill:color-mix(in srgb,var(--accent) 62%,transparent);stroke:var(--accent);stroke-width:1.4;transition:fill .25s ease}
.viz-scatter .dot.over{stroke:#e0a13f;stroke-dasharray:3 2}
.viz-scatter .dotgroup:hover .dot{fill:color-mix(in srgb,var(--accent) 92%,transparent)}
.viz-scatter .dotlabel{fill:var(--ink);font-size:9.5px}

`
fs.writeFileSync(f, s.slice(0, cssAt) + css + s.slice(cssAt), 'utf8')
console.log('散点图已重做')
