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

/** 拆出来的草稿要有个标题，取开头一行当标题时最多留这么长。 */
const STRAY_TITLE_MAX = 24

/** 这一行是不是日期头；是就返回归一化后的日期与标题，不是就返回 null。 */
export function matchDiaryDateLine(line) {
  const matched = DATE_LINE.exec(String(line ?? ''))
  if (!matched) return null
  const [, year, month, day] = matched
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  // 2023 年 13 月 45 日 这种也要挡住，否则会写进数据库里一个不存在的日期。
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return {
    iso: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    // 标题统一成「2023年5月29日」：原文里老日记写「2023 年 5 月 29 日 周一」、
    // 新日记写「2026年9月21日」，混在一张列表里很难看，归一化后 50 篇是同一个样子。
    title: `${y}年${m}月${d}日`,
  }
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
 * - 一个日期头都没有时返回 `[]`：那不是整合日记，调用方按「一个文件一篇」的老办法处理。
 */
export function splitDiaryText(text) {
  const groups = []
  const preamble = []
  let current = null

  for (const line of String(text ?? '').split(/\r?\n/)) {
    const header = matchDiaryDateLine(line)
    if (header) {
      current = { title: header.title, date: header.iso, content: [] }
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
