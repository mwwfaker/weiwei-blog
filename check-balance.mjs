import fs from 'node:fs'
const src = fs.readFileSync('frontend/src/PerfPanel.vue','utf8')
const start = src.indexOf("      <section v-if=\"tab === 'entry'\"")
const end = src.indexOf('      <!-- 员工名单')
const region = src.slice(start, end)
// 数一下 template 标签是否配平
const opens = (region.match(/<template[ >]/g)||[]).length
const closes = (region.match(/<\/template>/g)||[]).length
console.log('entry 区块 <template> 开:', opens, ' 闭:', closes)
console.log('  有 perf-empty:', region.includes('perf-empty'))
console.log('  有 v-else:', region.includes('v-else'))
console.log('  有 perf-split:', region.includes('perf-split'))
console.log('  有 perf-view-toggle:', region.includes('perf-view-toggle'))
// 整份文件的配平
console.log('全文件 <template> 开:', (src.match(/<template[ >]/g)||[]).length, ' 闭:', (src.match(/<\/template>/g)||[]).length)
