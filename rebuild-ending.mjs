import fs from 'node:fs'
const f = 'verify-frontend.mjs'
const lines = fs.readFileSync(f, 'utf8').split('\n')
// 保留到第 7 项结束（第 209 行，1-based），其余丢弃
const kept = lines.slice(0, 209)
const bt = String.fromCharCode(96)
while (kept.length && kept[kept.length - 1].trim() === '') kept.pop()
kept.push('')
kept.push("console.log(failures ? " + bt + "\\n" + bt + "${failures} problem(s) found." + bt + " : " + bt + "\\n" + bt + "All frontend checks passed." + bt + ")")
kept.push('process.exitCode = failures ? 1 : 0')
kept.push('')
fs.writeFileSync(f, kept.join('\n'), 'utf8')
console.log('已重建结尾，行数', kept.length)
