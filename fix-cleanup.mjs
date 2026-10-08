import fs from 'node:fs'
const f = 'verify-perf-e2e.mjs'
let lines = fs.readFileSync(f, 'utf8').split('\n')
const start = lines.findIndex((l) => l.includes('清理测试账号'))
if (start < 0) { console.log('NOT FOUND'); process.exit(1) }
// 从 [8] 标题行一直替换到最后的汇总打印之前
const summaryIdx = lines.findIndex((l) => l.includes('failures.length ?'))
const replacement = [
  "console.log('\\n[8] 测试账号不做删除（没有删除账号的接口），由外部 SQL 清理')",
  "check('两个账号都建好了', Boolean(a.token) && Boolean(b.token))",
  '',
]
lines = [...lines.slice(0, start), ...replacement, ...lines.slice(summaryIdx)]
fs.writeFileSync(f, lines.join('\n'), 'utf8')
console.log('已替换清理段落')
