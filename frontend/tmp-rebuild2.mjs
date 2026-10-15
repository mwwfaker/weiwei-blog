/**
 * 临时脚本：按用户的尺子重做校对。
 *
 * 用户的尺子（2026-10-16 明确）：
 *   · 只改 OCR 造成的错：漏字、多字、同音字/形近字认错、重复字
 *   · 不改语义、不改措辞、不做润色、不补关联词
 *   · 「的 / 得 / 地」一律按原文，不动（那是书写习惯，不是识别错误）
 *
 * 用法：
 *   node tmp-rebuild2.mjs --dump    只导出编号清单（供人工筛选）
 *   node tmp-rebuild2.mjs --apply   按 skip.json 里列出的编号跳过并写入
 */
import fs from 'node:fs'
import path from 'node:path'

const bakDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-原始备份'
const outDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-拆分'
const resDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-校对结果'
const skipFile = path.join(resDir, 'skip.json')
const mode = process.argv.includes('--apply') ? 'apply' : 'dump'

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
    out += ((isCjk(prev) && isAlnum(next)) || (isAlnum(prev) && isCjk(next))) ? '' : text.slice(i, j)
    i = j - 1
  }
  return out
}
const despaceDoc = (t) => t.split('\r\n').map(despace).join('\r\n')

function loadJson(p) {
  let t = fs.readFileSync(p, 'utf8')
  t = t.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(t)
}

const sources = []
for (const f of fs.readdirSync(resDir)) if (/^batch[0-9a-z]*\.json$/i.test(f)) sources.push(path.join(resDir, f))
const appliedSub = path.join(resDir, 'applied')
if (fs.existsSync(appliedSub)) for (const f of fs.readdirSync(appliedSub)) if (f.endsWith('.json')) sources.push(path.join(appliedSub, f))

const perFile = new Map()
for (const src of sources) {
  let json
  try { json = loadJson(src) } catch { continue }
  for (const entry of json.files || []) {
    const list = perFile.get(entry.file) || []
    for (const e of entry.edits || []) if (e.before && e.after != null) list.push(e)
    perFile.set(entry.file, list)
  }
}

/** 只差「的/得/地」三个字的修改 —— 一律退回原文（用户明确要求）。 */
function onlyDeFix(before, after) {
  if (before.length !== after.length) return false
  let diff = 0
  for (let i = 0; i < before.length; i += 1) {
    if (before[i] === after[i]) continue
    if ('的得地'.includes(before[i]) && '的得地'.includes(after[i])) { diff += 1; continue }
    return false
  }
  return diff > 0
}

/** 落款补冒号 —— 是我去空格造成的，不是 OCR 错，退回。 */
const SIGNATURE_COLON = /^\s*\d{1,2}[:：]\d{2}\s*莫?唯?唯?\s*$/

const skip = fs.existsSync(skipFile) ? new Set(JSON.parse(fs.readFileSync(skipFile, 'utf8'))) : new Set()

// 用户在这次回答里给的「原句 / 正确写法」，逐条最小替换（在批次修改之后执行）。
const MANUAL = [
  ['2023-05-30.txt', '打开向她发了消息', '打开QQ向她发了消息'],
  ['2023-05-31.txt', '社会总生存那样的高效', '社会总却那样的高尖人才'],
  ['2023-06-02.txt', '这个事前面应该正在一段', '这个事前面应该还有一段'],
  ['2023-06-02.txt', '心里也想着不过一个星期，理智说了两天无奈分手。', '心里也想着不超过一个星期理论，犟了两天无奈分手。'],
  ['2023-06-02.txt', '我在那前不久她给了我个', '在那之前不久她给了我个'],
  ['2023-06-04.txt', '在报的唐梓材', '在班里的唐梓材'],
  ['2023-06-04.txt', '今天到就看这个', '今天就这个'],
  ['2023-06-04.txt', '我一次去马家找刘力时', '我上次去马家找刘力时'],
  ['2023-06-07.txt', '复读的同学成为。', '复读的同学成为选手。'],
  ['2023-06-07.txt', '不再留题目的难易度无关紧要', '不再留恋题目的难易度，无关紧要'],
  ['2023-06-10.txt', '但要上去后却显得从容', '但我上去后，却显得从容'],
  ['2023-09-20.txt', '霞山中央的我们走了大概也没啥好玩的', '霞山区中央的我们走了个大概也没啥好玩的'],
  ['2023-10-09.txt', '霞山中央的我们走了大概也没啥好玩的', '霞山区中央的我们走了个大概也没啥好玩的'],
  ['2024-02-03.txt', '且八村在进入这个道', '且八坊村在进入这个道'],
  ['2024-03-04.txt', '我果然一个人的外观', '果然一个人的外观'],
  ['2024-04-12.txt', '我们俩把。', '我们俩麻。'],
  ['2024-04-12.txt', '而用情更深的回忆没有的由是：', '而用情更深的李亿平没有的理由是：'],
  ['2024-04-28.txt', '怕我喝两天就喝了', '怕我喝两天就不喝了'],
  ['2024-04-28.txt', '喝的还没坏快', '喝得还没坏得快'],
  ['2024-05-28.txt', '我与她交流，很与她的学习不用功', '我与她交流很少，她的学习不用功'],
]
const manualByFile = new Map()
for (const [file, from, to] of MANUAL) {
  const list = manualByFile.get(file) || []
  list.push([from, to])
  manualByFile.set(file, list)
}
const manualMissed = []

const files = fs.readdirSync(bakDir).filter((f) => f.endsWith('.txt')).sort()

// 用户后来又明确：2024-05-28 之后的日记也不是扫描来的，一个字都不改，只做去空格。
const NO_EDIT = (file) => file.slice(0, 10) > '2024-05-28'

let index = 0
const rows = []
const indexMap = {}

for (const file of files) {
  let text = despaceDoc(fs.readFileSync(path.join(bakDir, file), 'utf8'))
  const seen = new Set()
  for (const e of perFile.get(file) || []) {
    const key = `${e.before}\u0000${e.after}`
    if (seen.has(key)) continue
    seen.add(key)
    if (e.before === e.after) continue
    if (text.includes(e.after)) continue
    if (text.split(e.before).length - 1 !== 1) continue

    index += 1
    const auto = onlyDeFix(e.before, e.after) || SIGNATURE_COLON.test(e.before) || NO_EDIT(file)
    indexMap[index] = { file, before: e.before, after: e.after, auto }
    rows.push({ index, file, before: e.before, after: e.after, auto, why: e.why || '' })

    if (!auto && !skip.has(index)) text = text.replace(e.before, e.after)
  }
  for (const [from, to] of manualByFile.get(file) || []) {
    const n = text.split(from).length - 1
    if (n === 1) text = text.replace(from, to)
    else manualMissed.push(`${file}  「${from.slice(0, 30)}」 ${n === 0 ? '找不到' : `出现${n}次`}`)
  }
  if (mode === 'apply') {
    const outPath = path.join(outDir, file)
    if (fs.readFileSync(outPath, 'utf8') !== text) fs.writeFileSync(outPath, text, 'utf8')
  }
}

fs.writeFileSync(path.join(resDir, 'edits-index.json'), JSON.stringify(indexMap, null, 1), 'utf8')

if (mode === 'dump') {
  const lines = rows.map((r) => `${String(r.index).padStart(3, '0')} ${r.file} | ${r.before} → ${r.after}${r.auto ? '  【已自动退回】' : ''}`)
  fs.writeFileSync(path.join(resDir, 'edits-index.txt'), lines.join('\r\n'), 'utf8')
  console.log(`共 ${rows.length} 条（其中自动退回 ${rows.filter((r) => r.auto).length} 条：只差的字、落款补冒号）`)
  console.log(`清单：${path.join(resDir, 'edits-index.txt')}`)
  console.log(`要保留原样的，把编号写进 ${skipFile}（JSON 数组，例如 [3,7,12]）`)
} else {
  console.log(`已按 skip.json（${skip.size} 条）重算并写入。自动退回 ${rows.filter((r) => r.auto).length} 条。`)
  if (manualMissed.length) {
    console.log(`\n按你的回答替换时没命中的 ${manualMissed.length} 条（需要我看一眼）：`)
    manualMissed.forEach((m) => console.log('  ' + m))
  } else {
    console.log('按你的回答做的替换：全部命中。')
  }
}
