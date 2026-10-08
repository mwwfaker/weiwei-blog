import fs from 'node:fs'
const s = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8')
const styleStart = s.indexOf('<style scoped>')
const css = s.slice(styleStart)
const want = ['.perf-tool{','.perf-bar{','.perf-bar-left{','.perf-mark{','.perf-bar-left strong{',
  '.perf-bar-left small{','.perf-month{','.perf-bar-right{','.perf-btn{','.perf-btn.primary{',
  '.perf-btn.on{','.perf-cell{','.perf-grid{','.perf-list{','.perf-search','.perf-inline-label{',
  '.perf-wide,.perf-card textarea{','.perf-upload{','.perf-review{','.perf-formulas{','.perf-constants{']
console.log('检查各类样式是否存在：')
for (const w of want) console.log((css.includes(w) ? '  有  ' : '★缺★ ') + w)
