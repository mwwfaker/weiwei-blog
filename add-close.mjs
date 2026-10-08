import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let lines = fs.readFileSync(f, 'utf8').split('\n')
const i = lines.findIndex((l) => l.trim() === 'pay,' && lines.slice(0, lines.indexOf(l)).some((x) => x.includes('standardHours: standard / 3600')))
if (i < 0) { console.log('NOT FOUND'); process.exit(1) }
// pay, 后面应当是 }, 再补一个 })  闭合 computed
const next = lines[i + 1]
if (next && next.trim() === '}') {
  if (!(lines[i + 2] && lines[i + 2].trim() === '})')) lines.splice(i + 2, 0, '})')
  fs.writeFileSync(f, lines.join('\n'), 'utf8')
  console.log('已补回 computed 的收尾 })')
} else { console.log('下一行不是 }, 实际是:', JSON.stringify(next)) }
