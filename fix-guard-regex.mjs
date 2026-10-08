import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let s = fs.readFileSync(f, 'utf8')
// 只扫静态 class="..."，跳过 :class / v-bind:class 里的表达式
const before = s.split('/class="([^"]*)"/g').length - 1
s = s.split('/class="([^"]*)"/g').join('/(?<!:)class="([^"]*)"/g')
fs.writeFileSync(f, s, 'utf8')
console.log('替换了', before, '处 class 匹配，改为只匹配静态 class')
