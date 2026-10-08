import fs from 'node:fs'
const css = fs.readFileSync('frontend/src/style.css', 'utf8')
const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
let d = 0
const lines = clean.split('\n')
for (let i = 0; i < lines.length; i += 1) {
  for (const ch of lines[i]) { if (ch === '{') d += 1; if (ch === '}') d -= 1 }
  if (d < 0) { console.log('花括号第一次变负: 第', i + 1, '行 ->', lines[i].trim().slice(0, 90)); break }
}
console.log('结尾净差:', d, '(应为 0)')
// 找出「深度回到 0 之后又出现选择器」的可疑处，以及从未闭合的块
let dd = 0
const bad = []
for (let i = 0; i < lines.length; i += 1) {
  const before = dd
  for (const ch of lines[i]) { if (ch === '{') dd += 1; if (ch === '}') dd -= 1 }
  if (before > 0 && dd === 0 && lines[i].trim() !== '}' && lines[i].trim() !== '') {
    bad.push(`第 ${i + 1} 行 depth 归零但行尾不是 }: ${lines[i].trim().slice(0, 70)}`)
  }
}
bad.slice(0, 4).forEach((b) => console.log(b))
