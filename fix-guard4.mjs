import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let s = fs.readFileSync(f, 'utf8')
const bad = `  for (const m of tpl.matchAll(/[:@]?[\\w-]+="([^"]*)"/g)) exprs.push(m[1])`
const good = `  // 只扫绑定属性（: / @ / v- 开头）；class="..." 里的词不是变量
  for (const m of tpl.matchAll(/(?:^|\\s)([:@][\\w.:-]+|v-[\\w:.-]+)="([^"]*)"/g)) exprs.push(m[2])`
if (!s.includes(bad)) { console.log('ANCHOR MISSING'); process.exit(1) }
fs.writeFileSync(f, s.replace(bad, good), 'utf8')
console.log('已只扫绑定属性')
