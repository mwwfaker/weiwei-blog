import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let lines = fs.readFileSync(f, 'utf8').split('\n')
const i = lines.findIndex((l) => l.includes('standardHours: standard / 3600'))
// 从这一行往后找到那个多余的 "})" 并删掉
let removed = 0
for (let k = i; k < i + 8 && k < lines.length; k += 1) {
  if (lines[k].trim() === '})') { lines.splice(k, 1); removed += 1; break }
}
fs.writeFileSync(f, lines.join('\n'), 'utf8')
console.log('删除了', removed, '行多余的 })')
