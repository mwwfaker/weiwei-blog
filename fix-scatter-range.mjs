import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 用四分位距定轴范围：一个离群点不再把整张图压扁
const old = `  const maxEff = niceMax(Math.max(percentile(effs, 0.9), 1))
  const maxComp = niceMax(Math.max(percentile(comps, 0.9), 0.1))`
const neu = `  // 用四分位距定范围（箱线图那套）：离群点会被钳到边缘并描虚线，
  // 不再把其它点全压到角落里。纯粹的「取最大值」或「取 90 分位」都扛不住离群点。
  const robustMax = (sorted, floor) => {
    const median = percentile(sorted, 0.5)
    const q1 = percentile(sorted, 0.25)
    const q3 = percentile(sorted, 0.75)
    const spread = Math.max(q3 - q1, median * 0.22)
    return niceMax(Math.max(median + spread * 1.7, floor))
  }
  const maxEff = robustMax(effs, 1)
  const maxComp = robustMax(comps, 0.1)`
if (!s.includes(old)) { console.log('RANGE ANCHOR MISSING'); process.exit(1) }
s = s.replace(old, neu)

// 象限文字挪到更靠角落，并降一档存在感
s = s.replace("{ x: W - R - 10, y: T + 26, text: '又快又完成得多', anchor: 'end' },",
              "{ x: W - R - 10, y: H - B - 10, text: '又快又完成得多', anchor: 'end' },")
s = s.replace("{ x: L + 12, y: T + 26, text: '慢但完成得多', anchor: 'start' },",
              "{ x: L + 10, y: T + 16, text: '慢但完成得多', anchor: 'start' },")
s = s.replace("{ x: W - R - 6, y: H - B - 8, text: '快但完成得少', anchor: 'end' },",
              "{ x: W - R - 10, y: T + 16, text: '快但完成得少', anchor: 'end' },")
s = s.replace("{ x: L + 8, y: H - B - 8, text: '又慢又完成得少', anchor: 'start' },",
              "{ x: L + 10, y: H - B - 10, text: '又慢又完成得少', anchor: 'start' },")
s = s.replace('.viz-scatter .quadlabel{fill:color-mix(in srgb,var(--ink) 30%,transparent);font-size:9.5px}',
              '.viz-scatter .quadlabel{fill:color-mix(in srgb,var(--ink) 22%,transparent);font-size:9.5px;pointer-events:none}')

fs.writeFileSync(f, s, 'utf8')
console.log('轴范围改稳健 + 象限文字挪角落')
