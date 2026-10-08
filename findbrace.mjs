import fs from 'node:fs'
const s = fs.readFileSync('frontend/src/PerfPanel.vue', 'utf8')
const script = s.slice(s.indexOf('<script setup>'), s.indexOf('</script>'))
const lines = script.split('\n')
const clean = (l) => l.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '').replace(/\/\/.*$/, '')
let d = 0
const report = []
for (let i = 0; i < lines.length; i += 1) {
  const raw = lines[i]
  // 顶层声明应当出现在 depth 0
  if (/^(function |const |let |async function )/.test(raw) && d !== 0) {
    report.push(`第 ${i + 1} 行 depth=${d}: ${raw.trim().slice(0, 70)}`)
  }
  for (const ch of clean(raw)) { if (ch === '{') d += 1; if (ch === '}') d -= 1 }
}
if (!report.length) console.log('没有在深度不为 0 的地方发现顶层声明')
else report.slice(0, 6).forEach((r) => console.log(r))
console.log('结尾 depth:', d)
