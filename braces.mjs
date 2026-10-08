import fs from 'node:fs'
const s = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8')
const start = s.indexOf('<script setup>')
const end = s.indexOf('</script>')
const script = s.slice(start, end)
// 粗略数括号（忽略字符串里的，够用）
let depth = 0, line = 1
const lines = script.split('\n')
for (let i = 0; i < lines.length; i += 1) {
  const l = lines[i].replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '').replace(/\/\/.*$/, '')
  for (const ch of l) { if (ch === '{') depth += 1; if (ch === '}') depth -= 1 }
}
console.log('script 里花括号净差:', depth, '(应为 0)')
// 逐行找第一次 depth 变负的位置
let d = 0
for (let i = 0; i < lines.length; i += 1) {
  const l = lines[i].replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '').replace(/\/\/.*$/, '')
  for (const ch of l) { if (ch === '{') d += 1; if (ch === '}') d -= 1 }
  if (d < 0) { console.log('第一次变负在第', i + 1, '行:', lines[i].trim().slice(0, 80)); break }
}
