import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) 标签位置：靠近顶部就放到点下方，否则放上方，避免跑出绘图区
s = s.replace(`      show: share >= 0.4,`,
`      show: share >= 0.4,
      // 靠近上边界时标签改放到点下面，否则会被裁掉
      labelAbove: py(row.result.completion) - (5 + share * 9) - 6 > T + 10,`)
s = s.replace(`                <text v-if="p.show" :x="p.x" :y="p.y - p.r - 5" class="dotlabel" text-anchor="middle">{{ p.short }}</text>`,
`                <text
                  v-if="p.show"
                  :x="p.x"
                  :y="p.labelAbove ? p.y - p.r - 6 : p.y + p.r + 13"
                  class="dotlabel"
                  text-anchor="middle"
                >{{ p.short }}</text>`)

// 2) 象限说明避开坐标轴文字
s = s.replace(`      { x: L + 8, y: T + 14, text: '慢但完成得多', anchor: 'start' },`,
              `      { x: L + 12, y: T + 26, text: '慢但完成得多', anchor: 'start' },`)
s = s.replace(`      { x: W - R - 6, y: T + 14, text: '又快又完成得多', anchor: 'end' },`,
              `      { x: W - R - 10, y: T + 26, text: '又快又完成得多', anchor: 'end' },`)

// 3) 图表给足高度并保持比例（不拉伸），文字才不变形
s = s.replace('.viz-scatter{width:100%;height:auto;max-height:360px;display:block}',
              '.viz-scatter{width:100%;height:auto;aspect-ratio:2/1;max-height:420px;display:block}')

fs.writeFileSync(f, s, 'utf8')
console.log('散点标签与象限说明已修')
