/**
 * 临时脚本：从「原始备份」重算校对结果。
 *
 * 为什么不直接在当前文件上继续改：apply 脚本有个漏洞——当 after 里包含 before 时
 * （纯插入类修改，例如「得上次理发」→「记得上次理发」），重复运行会把那个字插进去两次。
 * 实际已经插了三次（记记记得 / 显示清晰晰晰 / 中途弃了了了 / 无无无疑是）。
 *
 * 所以改成：原始备份 → 去掉中英文间空格 → 应用所有批次的修改（每条只应用一次，可重复执行）。
 * 幂等：再跑一次结果完全相同。
 */
import fs from 'node:fs'
import path from 'node:path'

const bakDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-原始备份'
const outDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-拆分'
const resDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-校对结果'
const apply = process.argv.includes('--apply')

// ---- 去空格（和目标格式同一套规则）------------------------------------------
const isCjk = (ch) => /[\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)
const isAlnum = (ch) => /[0-9A-Za-z]/.test(ch)
const isSpace = (ch) => ch === ' ' || ch === '\u3000'
function despace(text) {
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (!isSpace(ch)) { out += ch; continue }
    let j = i
    while (j < text.length && isSpace(text[j])) j += 1
    const prev = out[out.length - 1] || ''
    const next = text[j] || ''
    const between = (isCjk(prev) && isAlnum(next)) || (isAlnum(prev) && isCjk(next))
    out += between ? '' : text.slice(i, j)
    i = j - 1
  }
  return out
}
const despaceDoc = (text) => text.split('\r\n').map(despace).join('\r\n')

// ---- 收集所有编辑（当前批次 + 已归档批次），按 file 分组并去重 -----------------
function loadJson(p) {
  let t = fs.readFileSync(p, 'utf8')
  t = t.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(t)
}
const sources = []
for (const f of fs.readdirSync(resDir)) if (/^batch[0-9a-z]*\.json$/i.test(f)) sources.push(path.join(resDir, f))
const appliedSub = path.join(resDir, 'applied')
if (fs.existsSync(appliedSub)) for (const f of fs.readdirSync(appliedSub)) if (f.endsWith('.json')) sources.push(path.join(appliedSub, f))

const perFile = new Map()   // file -> [{before, after, why}]
const conflicts = []
for (const src of sources) {
  let json
  try { json = loadJson(src) } catch { console.log(`跳过（JSON 坏了）：${path.basename(src)}`); continue }
  for (const entry of json.files || []) {
    const list = perFile.get(entry.file) || []
    for (const e of entry.edits || []) {
      if (!e.before || e.after == null) continue
      list.push({ before: e.before, after: e.after, why: e.why || '' })
    }
    perFile.set(entry.file, list)
  }
}

// 不该采纳的修改：落款 `00:22莫唯唯` 补全角冒号。那是我自己去空格造成的，不是 OCR 错的，
// 补冒号属于替作者改格式，一律剔除。
const SIGNATURE_COLON = /^\s*\d{1,2}[:：]\d{2}\s*莫?唯?唯?\s*$/

let totalApplied = 0
let totalSkipped = 0
let totalFailed = 0
const dropped = []
const failed = []
const report = []
const triplesLeft = []

for (const file of fs.readdirSync(bakDir).filter((f) => f.endsWith('.txt')).sort()) {
  let text = despaceDoc(fs.readFileSync(path.join(bakDir, file), 'utf8'))
  const edits = perFile.get(file) || []
  const seen = new Set()
  let applied = 0
  let skipped = 0

  for (const edit of edits) {
    const key = `${edit.before}\u0000${edit.after}`
    if (seen.has(key)) continue          // 同一批次重复交回来的，只算一次
    seen.add(key)
    if (edit.before === edit.after) { skipped += 1; continue }
    if (SIGNATURE_COLON.test(edit.before)) { dropped.push({ file, before: edit.before, after: edit.after }); continue }
    // 已经改过（改后片段已在文里）就跳过——这条是幂等的关键
    if (text.includes(edit.after)) { skipped += 1; continue }
    const n = text.split(edit.before).length - 1
    if (n !== 1) { failed.push({ file, before: edit.before, why: n === 0 ? '原文里没有' : `出现 ${n} 次` }); continue }
    text = text.replace(edit.before, edit.after)
    applied += 1
  }
  totalApplied += applied
  totalSkipped += skipped
  if (applied) report.push(`${file}  ${applied} 处`)

  // 自检要查重算后的文本（而不是磁盘上的旧文件，否则试运行时会误报）
  for (const m of text.matchAll(/(.)\1\1/g)) if (/[\u4e00-\u9fff]/.test(m[1])) triplesLeft.push(`${file} ${m[0]}`)

  const outPath = path.join(outDir, file)
  const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : ''
  if (current !== text && apply) fs.writeFileSync(outPath, text, 'utf8')
}

console.log(`编辑来源：${sources.map((s) => path.basename(s)).join(', ')}`)
console.log(`本轮应用 ${totalApplied} 处，跳过（已改过/重复）${totalSkipped} 处，无法命中 ${failed.length} 处，剔除 ${dropped.length} 处　${apply ? '（已写入）' : '（试运行）'}`)
console.log('\n有改动的文件：')
report.forEach((r) => console.log('  ' + r))
if (failed.length) {
  console.log(`\n无法命中（需要人工看）：${failed.length}`)
  failed.slice(0, 25).forEach((f) => console.log(`  ${f.file}  [${f.why}]  ${String(f.before).slice(0, 60)}`))
}
if (dropped.length) {
  console.log(`\n剔除的（落款补冒号，不该改）：${dropped.length}`)
  dropped.slice(0, 8).forEach((d) => console.log(`  ${d.file}  ${d.before} → ${d.after}`))
}
console.log(triplesLeft.length ? `\n⚠️ 重算后仍有 ${triplesLeft.length} 处三连字（需确认是不是原文）：\n  ${triplesLeft.join('\n  ')}` : '\n✅ 重算后没有三连字')

