/**
 * 临时脚本：把 C:\Users\ASUS\Documents\唯唯日记-拆分\ 里 51 篇（当前最新版）合成一份整合文档。
 *   node tmp-merge-doc.mjs
 * 带往返自检：合成出来的文档再用拆分器拆一遍，必须还是 51 篇、且正文逐字一致。
 */
import fs from 'node:fs'
import path from 'node:path'
import { splitDiaryText } from './src/services/diaryImport.js'

const dir = 'C:\\Users\\ASUS\\Documents\\唯唯日记-拆分'
const out = 'C:\\Users\\ASUS\\Documents\\唯唯的整合日记-校对版.txt'
// 用户要的就是「每篇最终版 → 再合成一份整合日记，并把原来那份整合日记也更新掉」。
// 原文件先原样备份，之后每次重新生成都会同步写这一份。
const desktop = 'C:\\Users\\ASUS\\Desktop\\唯唯的整合日记.txt'
const desktopBak = 'C:\\Users\\ASUS\\Documents\\唯唯的整合日记-原始.txt'

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()
const blocks = []
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8')
  const lines = raw.split(/\r\n/)
  const title = lines[0].trim()
  const content = lines.slice(1).join('\r\n').trim()
  blocks.push({ file, title, content })
}

const doc = blocks.map((b) => `${b.title}\r\n\r\n${b.content}`).join('\r\n\r\n\r\n') + '\r\n'
fs.writeFileSync(out, doc, 'utf8')

// 桌面那份原整合日记：第一次生成前先原样备份，之后覆盖成最新版。
if (fs.existsSync(desktop) && !fs.existsSync(desktopBak)) {
  fs.copyFileSync(desktop, desktopBak)
  console.log(`原整合日记已备份：${desktopBak}`)
}
if (fs.existsSync(desktop)) {
  fs.writeFileSync(desktop, doc, 'utf8')
  console.log(`已更新桌面那份整合日记：${desktop}`)
}

// ---- 往返自检 -----------------------------------------------------------------
const again = splitDiaryText(doc)
console.log(`合成文档：${out}`)
console.log(`篇数：${blocks.length}　字符数：${doc.length}`)
console.log(again.length === blocks.length ? `✅ 再拆一遍还是 ${again.length} 篇` : `❌ 再拆得到 ${again.length} 篇，应为 ${blocks.length}`)

let mismatch = 0
for (let i = 0; i < Math.min(again.length, blocks.length); i += 1) {
  if (again[i].title !== blocks[i].title) { mismatch += 1; console.log(`   标题不符 [${i}] ${again[i].title} vs ${blocks[i].title}`) }
  const a = again[i].content.replace(/\s+/g, '')
  const b = blocks[i].content.replace(/\s+/g, '')
  if (a !== b) { mismatch += 1; console.log(`   正文不符 [${i}] ${blocks[i].file}`) }
}
console.log(mismatch === 0 ? '✅ 每篇的标题与正文逐字一致（去空白后比对）' : `❌ ${mismatch} 处不一致`)

// 落款行必须都还在
const noSign = blocks.filter((b) => !/\d{1,2}[:：点]\d{1,2}/.test(b.content.split(/\r\n/).pop() || ''))
console.log(noSign.length === 0 ? '✅ 51 篇的结尾时间落款都在' : `⚠️ 这 ${noSign.length} 篇最后一行不像落款：${noSign.map((b) => b.file).join(', ')}`)
process.exit(again.length === blocks.length && mismatch === 0 ? 0 : 1)
