/**
 * 「整合日记」纯文本的拆分器。
 *
 * 场景：很多人的日记是攒在一个 txt 里的，一篇接一篇，中间隔几个空行；
 * 上一篇从日期开头、以「时间 名字」结尾。原来的导入只认「一个文件 = 一篇」，
 * 于是这种文件会被整份塞进一篇日记里。
 *
 * 这里只做一件事：**文本进、草稿数组出**。所以它放在 services（纯函数、不碰响应式状态、
 * 不碰后端），`scripts/verify-diary-import.mjs` 能直接 import 它对拍——
 * 拆分错了在浏览器里只会表现成「多了几篇很长的、少了几篇」，肉眼几乎看不出来。
 */

/**
 * 一行是不是日记的日期头。整行锚定，所以正文里出现的日期不会被误判成新的一篇。
 *
 * 认这些写法（都是这个博客里真实出现过的）：
 *   `2023 年 5 月 29 日 周一`、`2023年6月1日`、`2026年9月21日`
 *   `2024年11月28日。`（结尾多个句号）、`2024-05-05` / `2024.05.05` / `2024/05/05`
 */
const DATE_LINE = /^\s*(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*日?\s*(?:周[一二三四五六日天])?\s*[。.．]?\s*$/

/**
 * 有些篇**根本没有独立的日期行**——直接在正文里起头：
 *   `今天是2025年2月7号，也是农历正月初十。……`
 * 这种篇以前会被并进上一篇里（实测漏过一篇）。认这一句就能把它单独切出来，
 * 而且这一行本身留在正文里（它是原文的一部分，不是元信息）。
 *
 * 只在行首认，且要求 `今天` 紧跟日期，免得正文中间提到日期就被切开。
 */
const INLINE_START = /^\s*今天是?\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/

/** 拆出来的草稿要有个标题，取开头一行当标题时最多留这么长。 */
const STRAY_TITLE_MAX = 24

function isoOf(year, month, day) {
  const m = Number(month)
  const d = Number(day)
  // 2023 年 13 月 45 日 这种也要挡住，否则会写进数据库里一个不存在的日期。
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return {
    iso: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    // 标题统一成「2023年5月29日」：原文里老日记写「2023 年 5 月 29 日 周一」、
    // 新日记写「2026年9月21日」，混在一张列表里很难看，归一化后 51 篇是同一个样子。
    title: `${Number(year)}年${m}月${d}日`,
  }
}

/** 这一行是不是日期头；是就返回归一化后的日期与标题，不是就返回 null。 */
export function matchDiaryDateLine(line) {
  const matched = DATE_LINE.exec(String(line ?? ''))
  if (!matched) return null
  return isoOf(matched[1], matched[2], matched[3])
}

/** 这一行是不是「今天是 XXXX 年 X 月 X 号」这种自带日期的开头；是就返回日期与标题。 */
export function matchInlineDiaryStart(line) {
  const matched = INLINE_START.exec(String(line ?? ''))
  if (!matched) return null
  return isoOf(matched[1], matched[2], matched[3])
}

/** 去掉每行首尾空白，再掐掉整段开头和结尾的空行。 */
function cleanLines(lines) {
  const trimmed = lines.map((line) => String(line ?? '').trim())
  let start = 0
  let end = trimmed.length
  while (start < end && !trimmed[start]) start += 1
  while (end > start && !trimmed[end - 1]) end -= 1
  return trimmed.slice(start, end)
}

function shortTitle(line) {
  const text = String(line ?? '').trim()
  return text.length > STRAY_TITLE_MAX ? `${text.slice(0, STRAY_TITLE_MAX)}…` : text
}

/**
 * 把一份整合日记拆成 `[{ title, date, content }]`。
 *
 * - 每个日期头开一篇；日期头之前、不属于任何一篇的段落（例如文件顶部的总标题）
 *   会单独留成第一篇，`date` 为 null，由调用方补今天的日期——**宁可多一篇让人删，也不要悄悄吞掉**。
 * - 正文里自带日期的开头（`今天是2025年2月7号…`）也开一篇，那一行留在正文里。
 *   但如果上一篇除了日期头之外一个字都还没有（一个文件一篇时就是这样），就**不切**——
 *   否则会多出一个空篇。
 * - 一个日期头都没有时返回 `[]`：那不是整合日记，调用方按「一个文件一篇」的老办法处理。
 */
export function splitDiaryText(text) {
  const groups = []
  const preamble = []
  let current = null

  /** 这一篇除了日期头还什么都没写？ */
  const blank = (group) => !group.content.some((line) => line.trim())

  for (const line of String(text ?? '').split(/\r?\n/)) {
    const header = matchDiaryDateLine(line)
    if (header) {
      current = { title: header.title, date: header.iso, content: [] }
      groups.push(current)
      continue
    }
    const inline = current && !blank(current) ? matchInlineDiaryStart(line) : null
    if (inline) {
      current = { title: inline.title, date: inline.iso, content: [line] }
      groups.push(current)
      continue
    }
    if (current) current.content.push(line)
    else preamble.push(line)
  }

  if (!groups.length) return []

  const cleaned = groups.map((group) => ({ ...group, content: cleanLines(group.content).join('\n') }))
  const head = cleanLines(preamble)
  if (head.length) {
    const [titleLine, ...rest] = head
    cleaned.unshift({ title: shortTitle(titleLine), date: null, content: rest.join('\n'), stray: true })
  }
  return cleaned
}
