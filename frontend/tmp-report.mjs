/**
 * 临时脚本：统计 51 篇的校对覆盖情况，并生成两份交付文件：
 *   · 改动清单.txt    —— 改了什么、为什么改（按文件分组）
 *   · 待确认问题.txt  —— 只有你能回答的问题（分「需要你拍板」「需要你知道原意」「只是问要不要保留」三类）
 * 只读日记文件，不做任何修改。
 */
import fs from 'node:fs'
import path from 'node:path'

const bakDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-原始备份'
const outDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-拆分'
const resDir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-校对结果'
const SKIP = '2026-07-04.txt'   // 用户说这篇不用管

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
const uncertain = new Map()
for (const src of sources) {
  let json
  try { json = loadJson(src) } catch { continue }
  for (const entry of json.files || []) {
    const list = perFile.get(entry.file) || []
    for (const e of entry.edits || []) if (e.before && e.after != null) list.push(e)
    perFile.set(entry.file, list)
    const us = uncertain.get(entry.file) || []
    for (const u of entry.uncertain || []) us.push(u)
    uncertain.set(entry.file, us)
  }
}

const SIGNATURE_COLON = /^\s*\d{1,2}[:：]\d{2}\s*莫?唯?唯?\s*$/
const KIND = { typo: '错别字/同音字', repeat: '重复字', missing: '漏字', extra: '多字', garbled: '语句错乱', wordy: '啰嗦重复', spacing: '空格' }
const skipPath = path.join(resDir, 'skip.json')
const SKIPPED = fs.existsSync(skipPath) ? new Set(JSON.parse(fs.readFileSync(skipPath, 'utf8'))) : new Set()
/** 只差「的/得/地」或落款补冒号的，一律按原文 —— 与 tmp-rebuild2.mjs 保持一致。 */
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

const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.txt')).sort()
const coverage = []
const log = []
const dropLog = []
const reverted = []
let index = 0

for (const file of files) {
  const edits = perFile.get(file) || []
  const seen = new Set()
  const applied = []
  let text = despaceDoc(fs.readFileSync(path.join(bakDir, file), 'utf8'))
  for (const e of edits) {
    const key = `${e.before}\u0000${e.after}`
    if (seen.has(key)) continue
    seen.add(key)
    if (e.before === e.after) continue
    index += 1
    if (SIGNATURE_COLON.test(e.before) || onlyDeFix(e.before, e.after) || file.slice(0, 10) > '2024-05-28') { dropLog.push({ file, ...e }); continue }
    if (SKIPPED.has(index)) { reverted.push({ file, ...e }); continue }
    if (text.includes(e.after)) continue
    if (text.split(e.before).length - 1 !== 1) continue
    text = text.replace(e.before, e.after)
    applied.push(e)
  }
  coverage.push({ file, applied: applied.length, uncertain: (uncertain.get(file) || []).length })
  if (applied.length) {
    log.push('', `【${file}】 改了 ${applied.length} 处`, '')
    for (const e of applied) {
      log.push(`  · ${KIND[e.kind] || e.kind || '修改'}`)
      log.push(`      改前：${e.before}`)
      log.push(`      改后：${e.after}`)
      if (e.why) log.push(`      原因：${e.why}`)
    }
  }
}

// ---------------- 控制台：覆盖表 ----------------
console.log('文件'.padEnd(18) + '改动  待确认')
let zero = []
let total = 0
for (const c of coverage) {
  const mark = c.file === SKIP ? '（按你的要求跳过）' : ''
  console.log(`${c.file.padEnd(18)}${String(c.applied).padStart(3)}  ${String(c.uncertain).padStart(4)}   ${mark}`)
  if (c.file !== SKIP) { total += c.applied; if (!c.applied) zero.push(c.file) }
}
console.log(`\n合计改动 ${total} 处；一篇都没改的（除跳过的）：${zero.length ? zero.join(', ') : '无'}`)

// ---------------- 交付文件 1：改动清单 ----------------
fs.writeFileSync(path.join(resDir, '改动清单.txt'), [
  '唯唯的日记 —— 校对改动清单',
  `改动目录：${outDir}　　原始备份：${bakDir}`,
  `共 ${coverage.length} 篇，改动 ${total} 处（2026-07-04 按你的要求未校）`,
  '',
  '写法：每条都要求「原文片段在文件里逐字且只出现一次」，命中不了的一律不改。',
  '所有专有名词（人名/地名/店名/校名）一个字都没动，全部列在《待确认问题.txt》里。',
  ...log,
].join('\r\n'), 'utf8')

// ---------------- 交付文件 2：待确认问题 ----------------
const globalQ = [
  'Q1　「的 / 得 / 地」：校对员只改了明显误用（过得、长得、笑得、玩得、离得、猛地、惊奇地、间接地、看得出、忙得、开得好快、聊得来……），',
  '　　全文其余大量的「的」按你的书写习惯原样保留了。要不要把全文统一规范？（这会是几百处改动）',
  '',
  'Q2　落款：原来写作「00:26 莫唯唯」（时间和名字间一个空格）。我按你的要求去掉了中英文空格，现在是「00:26莫唯唯」。',
  '　　有校对员建议补成全角冒号「00:26：莫唯唯」，我没有采纳（那是我去空格造成的，不是 OCR 错）。要补冒号吗？',
  '',
  'Q3　引号 / 破折号旁边的空格：还剩 19 处，例如「对我说 “莫唯，生日快乐”」「做着同样的事 —— 也许」。要不要也去掉？',
  '',
  'Q4　人名：以下写法我一个都没改，请确认有没有 OCR 认错的——',
  '　　李佳容（另有一处写作「李住客」，疑似同一人被认错）',
  '　　莫杏霖、李亿平、段枚旭、唐奕超、郑梁丽、莫清华、曾尧、莫洁、赵艳、秦莹、石少波、赵梓谕、王梓瑜',
  '　　刘小芳、潘薪薪、福合、江钝、莫云翔、王健、王建波、杨梦文、匡宇、王勇、张子星、蒋文君、石金立',
  '　　莫健华、马金花、杨丽姣、马培军、赵佳越、柳昊岑、王粟宁、莫鸾英、李玉洁、唐梓材、李科、刘力、马家',
  '　　蒋重淋、赵利丹、唐宇旋、马义、俊海、王婷、刘慧、唐茂钧、刘看良、马宽、肖主任、词作家、李教练',
  '　　作品/机构名：北化工、哈利破特、功夫女足、洛克王国、奥拉星、赛尔号、小食侯香、煲金珠、伴拌面、巴二巷市井老火锅',
  '',
  'Q5　地名：大埠街、浦田、大合村、沈滩、车田、梅溪、瓜里、两水、河口、中峰镇、永兴、海棠村、园博园、吾悦广场',
  '　　　　　—— 有没有认错的？',
  '',
  '================================================================',
  '',
  '下面这些**必须由你知道原意**才能改。我按文件列出来，你可以只回答你在意的：',
  '',
]
const keepQ = ['', '================================================================', '', '下面这些校对员只是问「保持原样吗」，我一律按**保留原文**处理，不再单独问你（扫一眼即可）：', '']
const answerQ = []
for (const file of files) {
  if (file === SKIP || file.slice(0, 10) > '2024-05-28') continue
  for (const u of uncertain.get(file) || []) {
    const q = `${u.question || ''}`
    const line = [`  · ${u.quote || ''}`, `      疑点：${u.issue || ''}`, `      要问：${q}`]
    if (/保持原样|确认保留|是否保留|需要补空格|要不要补空格/.test(q) || /保持原样|确认保留/.test(u.issue || '')) {
      keepQ.push(`  [${file}] ${u.quote || ''}`, `      ${u.issue || ''}`)
    } else {
      answerQ.push({ file, u })
    }
  }
}
let last = ''
for (const { file, u } of answerQ) {
  if (file !== last) { globalQ.push('', `【${file}】`); last = file }
  globalQ.push(`  · ${u.quote || ''}`)
  if (u.issue) globalQ.push(`      疑点：${u.issue}`)
  if (u.question) globalQ.push(`      要问：${u.question}`)
}
fs.writeFileSync(path.join(resDir, '待确认问题.txt'), [...globalQ, ...keepQ].join('\r\n'), 'utf8')
console.log(`\n改动清单：${path.join(resDir, '改动清单.txt')}`)
console.log(`待确认问题：${path.join(resDir, '待确认问题.txt')}（需要你回答的 ${answerQ.length} 条，仅供参考的 ${keepQ.length > 6 ? keepQ.length : 0} 行）`)

