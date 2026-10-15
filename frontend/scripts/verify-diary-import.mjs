// 「整合日记」拆分器的对拍：把一份装了很多篇的 txt 拆成一篇篇草稿。
// 运行：cd frontend && npm run verify:diary
//
// 为什么需要它：拆分错了在浏览器里只表现成「多了几篇很长的、少了几篇」，
// 而导入是写进数据库的——发现的代价是去后台一篇篇删。所以规则在这里钉死。
import fs from 'node:fs'
import { matchDiaryDateLine, splitDiaryText } from '../src/services/diaryImport.js'

let pass = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`) }
}

// ---------------------------------------------------------------------------
console.log('[1] 真实形态：一个文件里装三篇（日期头 + 正文 + 「时间 名字」结尾 + 空行）')
const consolidated = [
  '2023 年 5 月 29 日 周一',
  '第一篇的内容，分两行写。',
  '第二行。',
  '',
  '00:26 莫唯唯',
  '',
  '',
  '2023 年 6 月 1 日',
  '第二篇的内容。',
  '23:56 莫唯唯',
  '',
  '',
  '2026年9月21日',
  '\t第三篇的内容（行首有制表符）。',
  '\t7：15莫唯唯',
  '',
].join('\n')
const three = splitDiaryText(consolidated)
check('拆出 3 篇', three.length === 3, `got ${three.length}`)
check('标题是归一化的日期', three[0].title === '2023年5月29日' && three[2].title === '2026年9月21日', three.map((g) => g.title).join(' / '))
check('日期归一化成 ISO', three[0].date === '2023-05-29' && three[1].date === '2023-06-01' && three[2].date === '2026-09-21', three.map((g) => g.date).join(' / '))
check('星期几不进标题', !three[0].title.includes('周一'), three[0].title)
check('正文不含日期行', !three[0].content.includes('2023 年 5 月 29 日'), three[0].content)
check('结尾的「时间 名字」留在正文里', three[0].content.endsWith('00:26 莫唯唯'), three[0].content)
check('正文中间的空行不会把一篇切断', three[0].content.split('\n').length === 4, three[0].content)
check('行首的制表符被去掉（否则阅读页每段都会缩进）', three[2].content.startsWith('第三篇的内容'), JSON.stringify(three[2].content))
check('每篇首尾的多余空行被掐掉', three[1].content === '第二篇的内容。\n23:56 莫唯唯', JSON.stringify(three[1].content))

// 行数守恒：源文件里所有非空、非日期头的行，必须一行不少地出现在某一篇里。
const sourceLines = consolidated.split('\n').filter((line) => line.trim())
const dateLines = sourceLines.filter((line) => matchDiaryDateLine(line)).length
const contentLines = three.reduce((sum, g) => sum + g.content.split('\n').filter((l) => l.trim()).length, 0)
check('内容行数守恒（没有行被吞掉）', contentLines === sourceLines.length - dateLines, `${contentLines} vs ${sourceLines.length - dateLines}`)

// ---------------------------------------------------------------------------
console.log('\n[2] 日期头的各种写法')
const variants = [
  ['2023 年 5 月 29 日 周一', '2023-05-29', '2023年5月29日'],
  ['2023年6月1日', '2023-06-01', '2023年6月1日'],
  ['2026年9月21日', '2026-09-21', '2026年9月21日'],
  ['2024年11月28日。', '2024-11-28', '2024年11月28日'],
  ['2024-05-05', '2024-05-05', '2024年5月5日'],
  ['2024.05.05', '2024-05-05', '2024年5月5日'],
  ['2024/5/5', '2024-05-05', '2024年5月5日'],
  ['  2026年2月9日  ', '2026-02-09', '2026年2月9日'],
]
for (const [line, iso, title] of variants) {
  const hit = matchDiaryDateLine(line)
  check(`认得「${line.trim()}」`, Boolean(hit), '没认出来')
  if (hit) {
    check(`  → ${iso}`, hit.iso === iso, hit.iso)
    check(`  → ${title}`, hit.title === title, hit.title)
  }
}

console.log('\n[3] 不该被当成日期头的东西')
for (const line of [
  '2023 年 5 月 29 日 出发去桂林',       // 日期后面还有正文
  '那天是 2023 年 5 月 29 日，我记得很清楚', // 日期不在行首
  '2023 年 13 月 45 日',                // 不存在的日期
  '2023 年 5 月',                       // 只有年月
  '   ',                                // 空行
  '第五章 2026 年 9 月 21 日 那天的雨',   // 正文里提到日期
]) {
  check(`不认「${line.trim() || '(空行)'}」`, matchDiaryDateLine(line) === null)
}

// ---------------------------------------------------------------------------
console.log('\n[4] 边界情况')
check('一个日期头都没有时返回空数组（调用方按「一篇」处理）',
  splitDiaryText('我的标题\n今天过得不错。').length === 0, JSON.stringify(splitDiaryText('我的标题\n今天过得不错。')))
check('空文本返回空数组', splitDiaryText('').length === 0)
check('null 也不炸', splitDiaryText(null).length === 0)
check('日期头后面一篇正文都没有时也留一篇', (() => {
  const groups = splitDiaryText('2023 年 5 月 29 日\n\n2023 年 5 月 30 日\n有内容')
  return groups.length === 2 && groups[0].content === ''
})(), JSON.stringify(splitDiaryText('2023 年 5 月 29 日\n\n2023 年 5 月 30 日\n有内容')))
check('文件顶部的总标题单独留一篇（宁多一篇让人删，也别悄悄吞掉）', (() => {
  const groups = splitDiaryText('唯唯的整合日记\n共 50 篇\n\n2023 年 5 月 29 日\n正文')
  return groups.length === 2 && groups[0].title === '唯唯的整合日记' && groups[0].date === null
})(), JSON.stringify(splitDiaryText('唯唯的整合日记\n共 50 篇\n\n2023 年 5 月 29 日\n正文').map((g) => g.title)))
check('过长的总标题会被截断成短标题', (() => {
  const groups = splitDiaryText(`${'很长的开头'.repeat(12)}\n\n2023 年 5 月 29 日\n正文`)
  return groups[0].title.length <= 25 && groups[0].title.endsWith('…')
})(), JSON.stringify(splitDiaryText(`${'很长的开头'.repeat(12)}\n\n2023 年 5 月 29 日\n正文`)[0].title))
check('CRLF 换行也能拆', splitDiaryText('2023 年 5 月 29 日\r\n正文\r\n\r\n2023 年 5 月 30 日\r\n正文二').length === 2)
check('同一份文本拆两次结果一致（纯函数）',
  JSON.stringify(splitDiaryText(consolidated)) === JSON.stringify(splitDiaryText(consolidated)))

// ---------------------------------------------------------------------------
// 真实文件回归（可选）：把整合日记的路径放进 DIARY_FILE 再跑，能对真实篇数。
// 不写死路径——它在某台机器的桌面上，不属于仓库。
if (process.env.DIARY_FILE) {
  console.log(`\n[5] 真实文件：${process.env.DIARY_FILE}`)
  const text = fs.readFileSync(process.env.DIARY_FILE, 'utf8')
  const groups = splitDiaryText(text)
  const lines = text.split(/\r?\n/)
  const expectContent = lines.filter((line) => line.trim()).length - lines.filter((line) => matchDiaryDateLine(line)).length
  const gotContent = groups.reduce((sum, g) => sum + g.content.split('\n').filter((l) => l.trim()).length, 0)
  check('拆出的篇数与日期头数量一致',
    groups.length === lines.filter((line) => matchDiaryDateLine(line)).length, `${groups.length} 篇`)
  check('内容行数守恒', gotContent === expectContent, `${gotContent} vs ${expectContent}`)
  check('没有空篇', groups.every((g) => g.content.trim().length > 0))
  console.log(`  篇数：${groups.length}　时间范围：${groups[0].date} → ${groups[groups.length - 1].date}`)
  console.log(`  正文合计 ${gotContent} 行 / ${groups.reduce((sum, g) => sum + g.content.length, 0)} 字`)
}

console.log(failures.length ? `\n${failures.length} 项未通过（共 ${pass + failures.length} 项）。` : `\n全部通过（${pass} 项）。`)
process.exitCode = failures.length ? 1 : 0
