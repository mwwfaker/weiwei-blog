import fs from 'node:fs'
const s = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8')
const tplEnd = s.indexOf('<style scoped>')
const tpl = s.slice(0, tplEnd)
const lines = tpl.split('\n')
console.log('=== 模板里所有 .trim() 出现的位置 ===')
lines.forEach((l, i) => { if (l.includes('.trim()')) console.log(`  ${i + 1}: ${l.trim().slice(0, 130)}`) })
// 导入那一段用到了哪些变量
const start = tpl.indexOf("tab === 'import'")
const imp = tpl.slice(start, tpl.indexOf('<!-- 说明 -->') > 0 ? tpl.indexOf('<!-- 说明 -->') : tpl.length)
const used = new Set()
for (const m of imp.matchAll(/(?:v-model|:value|@\w+|v-if|v-for|:disabled|:class)="([^"]*)"/g)) {
  for (const id of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) used.add(id[0])
}
console.log('\n=== 导入段落引用到的标识符 ===')
console.log([...used].sort().join(' '))
