// 学习文档的解析：把 Word 导出的 HTML 变成「可渲染的结构」。
//
// 这里**不需要任何模型 API**：Word 本身已经表达了层级（h1 计划名 / h2 阶段 / h3 课程 /
// 列表 / 链接 / 表格）。AI 负责写文档，这里只负责把它的结构读出来。
// 认不出的内容会退化成普通段落，不会丢。
//
// 纯函数，不 import Vue、不 import store（和 services/ 的其它文件同一条规矩），
// 方便以后像 verify-article-import 那样离线对拍。
const HEADINGS = new Set(['H1', 'H2', 'H3', 'H4'])

function textOf(node) {
  return (node.textContent || '').replace(/\s+/g, ' ').trim()
}

/** 把一个节点变成块。认不出的返回 null，由调用方决定要不要当段落处理。 */
function blockOf(node) {
  const tag = node.tagName
  if (tag === 'P') {
    const links = [...node.querySelectorAll('a[href]')].map((a) => ({ text: textOf(a), href: a.href }))
    const text = textOf(node)
    if (!text) return null
    return links.length && text === links.map((link) => link.text).join(' ') ? { type: 'links', items: links } : { type: 'p', text }
  }
  if (tag === 'UL' || tag === 'OL') {
    const items = [...node.querySelectorAll(':scope > li')].map((li) => {
      const links = [...li.querySelectorAll('a[href]')]
      return links.length
        ? { text: textOf(li), links: links.map((a) => ({ text: textOf(a), href: a.href })) }
        : { text: textOf(li) }
    }).filter((item) => item.text)
    return items.length ? { type: 'list', ordered: tag === 'OL', items } : null
  }
  if (tag === 'TABLE') {
    const rows = [...node.querySelectorAll('tr')]
      .map((tr) => [...tr.querySelectorAll('th,td')].map((cell) => textOf(cell)))
      .filter((cells) => cells.some(Boolean))
    return rows.length ? { type: 'table', rows } : null
  }
  if (tag === 'BLOCKQUOTE') {
    const text = textOf(node)
    return text ? { type: 'quote', text } : null
  }
  return null
}

/**
 * mammoth HTML → { title, subtitle, lead, sections: [{ title, blocks, items: [{ title, blocks }] }] }
 *
 * 分组规则：第一个 h1 是标题；下一个 h2 之前的段落是导语；h2 起每一段是一个「阶段」，
 * 阶段里的 h3 是「课程/条目」。没有 h2 的文档会整篇落到 lead/sections[0] 里，照样能看。
 */
export function parseStudyHtml(html, fallbackName = '未命名学习计划') {
  const container = new DOMParser().parseFromString(html || '', 'text/html').body
  const nodes = [...container.children]

  let title = ''
  let subtitle = ''
  const lead = []
  const sections = []
  let section = null
  let item = null

  const pushBlock = (block) => {
    if (!block) return
    if (item) item.blocks.push(block)
    else if (section) section.blocks.push(block)
    else lead.push(block)
  }

  // Word 里很多 AI 计划其实没有用「标题 2」，阶段名只是一行加粗短句。
  // 这三个判断就是在还它一个结构，认错了也只是把一行字变成小标题，不会丢内容。
  const STAGE_HINT = /^(第?[一二三四五六七八九十0-9]+[阶段篇章部]|阶段\s*[一二三四五六七八九十0-9]+|阶段[一二三四五六七八九十]|Part\s*[0-9IVX]+|Chapter\s*[0-9]+)/
  const nextIsList = (index) => {
    const next = nodes[index + 1]
    return next && (next.tagName === 'UL' || next.tagName === 'OL')
  }
  const strongOnly = (node) => node.children.length === 1 && node.children[0].tagName === 'STRONG'

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const tag = node.tagName
    if (HEADINGS.has(tag)) {
      const text = textOf(node)
      if (!text) continue
      if (tag === 'H1' && !title) { title = text; continue }
      if (tag === 'H2') {
        section = { title: text, blocks: [], items: [] }
        sections.push(section)
        item = null
        continue
      }
      if (tag === 'H3' || tag === 'H4') {
        if (!section) { section = { title: '', blocks: [], items: [] }; sections.push(section) }
        item = { title: text, blocks: [] }
        section.items.push(item)
        continue
      }
      // 更多级别的标题当作加粗段落
      pushBlock({ type: 'p', text })
      continue
    }
    const block = blockOf(node)
    if (!block) continue
    if (!section && !lead.length && !title) {
      // 没有 h1 时，第一段短文本当标题
      if (block.type === 'p' && block.text.length <= 60) { title = block.text; continue }
    }
    if (!section && block.type === 'p' && !subtitle && !lead.length) { subtitle = block.text; continue }

    // 没有用标题样式时：短句 + 号码开头、或整行只有加粗，就当阶段;短句 + 冒号 + 后面跟列表，就当条目
    if (block.type === 'p') {
      const text = block.text
      const short = text.length <= 28
      if (short && (STAGE_HINT.test(text) || strongOnly(node))) {
        section = { title: text, blocks: [], items: [] }
        sections.push(section)
        item = null
        continue
      }
      if (short && /[：:]$/.test(text) && nextIsList(index)) {
        if (!section) { section = { title: '', blocks: [], items: [] }; sections.push(section) }
        item = { title: text.replace(/[：:]$/, ''), blocks: [] }
        section.items.push(item)
        continue
      }
    }
    pushBlock(block)
  }

  return {
    title: title || fallbackName,
    subtitle,
    lead,
    sections: sections.filter((sec) => sec.title || sec.blocks.length || sec.items.length),
    importedAt: new Date().toISOString(),
    count: sections.reduce((sum, sec) => sum + sec.items.length, 0),
  }
}
