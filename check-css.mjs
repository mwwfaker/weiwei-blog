import fs from 'node:fs'
const s = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8')
const want = ['.perf-summary{','.perf-stat{','.perf-stat.accent{','.perf-tabs{','.perf-tabs button.active{',
  '.perf-panel,.perf-import{','.perf-card{','.perf-overview-bar{','.perf-hint{','.perf-good{','.perf-empty{',
  '.perf-list{','.perf-grid{','.perf-cell{','.perf-breakdown{','.perf-view-toggle{','.perf-formulas{','.perf-constants{']
const missing = want.filter((w) => !s.includes(w))
console.log('缺失的规则:'); missing.forEach((m) => console.log('  ' + m))
console.log('总计缺失', missing.length, '条')
const styleStart = s.indexOf('<style scoped>')
console.log('style 块起始位置:', styleStart, ' 文件长度:', s.length)
