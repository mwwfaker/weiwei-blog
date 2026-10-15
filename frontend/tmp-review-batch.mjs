/** 临时脚本（跑完就删）：看一眼校对员交回来的结果结构，并列出全部「要问用户」的条目。 */
import fs from 'node:fs'
import path from 'node:path'

const resDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-校对结果'
const only = process.argv[2]

for (const name of fs.readdirSync(resDir).filter((f) => /^batch[0-9a-z]*\.json$/i.test(f)).sort()) {
  if (only && !name.includes(only)) continue
  let text = fs.readFileSync(path.join(resDir, name), 'utf8')
  text = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  let json
  try { json = JSON.parse(text) } catch (error) { console.log(`${name}: JSON 解析失败 ${error.message}`); continue }
  const files = json.files || []
  console.log(`\n########## ${name}　(${files.length} 篇) ##########`)
  let e = 0
  let u = 0
  for (const f of files) {
    const ne = (f.edits || []).length
    const nu = (f.uncertain || []).length
    e += ne; u += nu
    console.log(`  ${String(f.file).padEnd(18)} edits=${String(ne).padStart(3)}  uncertain=${nu}`)
  }
  console.log(`  合计 edits=${e}  uncertain=${u}`)

  console.log(`\n  ----- 要问用户的 -----`)
  for (const f of files) {
    for (const x of f.uncertain || []) {
      console.log(`  [${f.file}] ${String(x.quote || '').replace(/\s+/g, ' ').slice(0, 80)}`)
      console.log(`        疑点：${String(x.issue || '').replace(/\s+/g, ' ').slice(0, 100)}`)
      console.log(`        要问：${String(x.question || '').replace(/\s+/g, ' ').slice(0, 120)}`)
    }
  }
}
