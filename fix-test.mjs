import fs from 'node:fs'
const f = 'verify-perf-e2e.mjs'
let s = fs.readFileSync(f, 'utf8')
const good = "check('第二次写入返回 200', secondRes.status === 200, String(secondRes.status) + ' ' + String(secondRes.text || '').slice(0, 140))"
// 把坏掉的那一行整行替换掉
s = s.split('\n').map((line) => line.includes('第二次写入返回 200') ? good : line).join('\n')
fs.writeFileSync(f, s, 'utf8')
console.log('已修复第 88 行')
const check = s.split('\n').filter((l) => l.includes('第二次写入返回 200'))
console.log(check.join('\n'))
