import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let lines = fs.readFileSync(f, 'utf8').split('\n')
const i = lines.findIndex((l) => l.includes('queueTotals.pay) }}</td>') && l.includes('total'))
if (i < 0) { console.log('NOT FOUND'); process.exit(1) }
if (lines[i + 1] && lines[i + 1].includes('</tr>')) { console.log('已经有 </tr>'); process.exit(0) }
const indent = lines[i].match(/^\s*/)[0]
lines.splice(i + 1, 0, indent + '</tr>')
fs.writeFileSync(f, lines.join('\n'), 'utf8')
console.log('已补回 </tr>')
