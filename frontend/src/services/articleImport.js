// 文章导入：把 Word / 纯文本的内容转成待确认的文章草稿。
//
// 为什么分成「块 → 文章」而不是直接吃一整段文本：
//   docx 的结构（标题层级）只有走 mammoth 的 HTML 才拿得到，而解析 HTML 要用浏览器的
//   DOMParser，在 Node 里跑不起来——自检脚本就废了。所以分工是：
//     **store 负责把文件变成块**（那里本来就在用 file.text()/mammoth，属于浏览器侧），
//     **这个文件只做「块 → 文章」的纯逻辑**，能在 Node 里直接对拍。
//
// 拆分规则（这是「看着办」那部分，写成规则是为了可预测、能测）：
//   · **文档里出现的最浅那一级标题就是文章的分界**。Word 里一份文档装几篇很常见，
//     一级标题切一篇是最自然的读法；文章页里一份文档只写一篇、压根没有标题的也同样支持。
//   · 标题之前若有较长的正文，它自己也算一篇（用文件名兜底当标题）；很短的那种
//     （封面署名、一行日期）就丢掉——那多半是文档头，不是文章。
//     **没有标题的文档不适用这条**：整份就是一篇，哪怕只有一句话。否则短文章会被吞掉。
//   · 一级标题下的子标题（二级、三级）留在正文里当普通行，不另起文章。
//   · 正文为空的段落丢掉（目录里的一行标题）。

/** 导出给 store 复用的默认标签，避免两边各写一份。 */
export const DEFAULT_IMPORT_TAGS = ['导入']

/**
 * 按**文件头**判断真实格式，不看扩展名。
 *
 * 为什么非这样不可：老式 `.doc` 被改名成 `.docx` 非常常见（Word 的「另存为」默认给 .docx，
 * 但很多老文件是 .doc 直接改的后缀）。mammoth 只认 OOXML（本质是 zip），
 * 喂给它 .doc 会抛出 JSZip 的内部错误：
 *   `Can't find end of central directory : is this a zip file ?`
 * 用户看不懂这句话，也不知道该干什么——所以宁可在这里先认出来，给一句能照着做的话。
 */
export function detectDocumentFormat(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  // OOXML（.docx/.xlsx/.pptx）都是 zip：PK\x03\x04（空包是 PK\x05\x06）
  if (b.length >= 2 && b[0] === 0x50 && b[1] === 0x4b) return 'docx'
  // OLE 复合文档：老式 .doc / .xls / .ppt
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'legacy-doc'
  // RTF：{\rtf
  if (b.length >= 5 && b[0] === 0x7b && b[1] === 0x5c && b[2] === 0x72 && b[3] === 0x74 && b[4] === 0x66) return 'rtf'
  return 'unknown'
}

/**
 * 认一下 WPS 的「私密文档」保护壳。
 *
 * 这种文件的正文是加密的，能读出来的只有一页提示：
 *   「此文件仅WPS能打开，操作当前文件会造成文件损坏 / • 此文件为私密文档，请使用WPS Office打开 / …」
 * 认出它的意义是**阻止用户去点「另存为」**——那页提示明确写着
 * 「对文件进行编辑或另存为操作，会导致数据丢失，无法恢复」。
 * 通用提示（「请另存为 .docx」）在这种文件上是有害的，所以必须先认出来。
 */
const PROTECTED_STUB_MARKERS = ['仅WPS能打开', '私密文档', '请勿对文件进行任何操作', 'WPS Office打开']

export function looksLikeProtectedStub(text) {
  const flat = String(text || '')
  if (!flat) return false
  return PROTECTED_STUB_MARKERS.filter((marker) => flat.includes(marker)).length >= 2
}

/**
 * 直接在原始字节里找那页提示。
 * 做到这一步是因为**光看文件头认不出 WPS 私密文档**——它同时也是个老式 .doc，
 * 只在头部判断的话会给出「另存为 .docx」的建议，而那个建议正好会毁掉这份文件。
 * .doc 的正文是 UTF-16LE，所以两种编码都试着解一段看看。
 */
export function sniffProtectedStub(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  if (!b.length || typeof TextDecoder === 'undefined') return false
  const sample = b.subarray(0, Math.min(b.length, 512 * 1024))
  for (const encoding of ['utf-16le', 'utf-8']) {
    try {
      if (looksLikeProtectedStub(new TextDecoder(encoding).decode(sample))) return true
    } catch { /* 环境不支持这个编码就跳过，不影响其它判断 */ }
  }
  return false
}

/**
 * 文件打不开时给用户的**结构化提示**：标题 + 说明 + 该怎么办。
 *
 * 为什么不是一句话：这些情况读者看不懂原始报错（`Can't find end of central directory…`），
 * 而且**照做可能更糟**（WPS 私密文档「另存为」会丢数据）。所以提示要分三段说清，
 * 并用弹窗展示——toast 一闪而过，用户来不及读也记不住。
 */
export function importProblem(kind, fileName, extra = {}) {
  const name = String(fileName || '这个文件')
  if (kind === 'protected-stub') {
    return {
      kind,
      title: '这是 WPS 的「私密文档」，正文读不出来',
      message: `${name} 的正文被加密了，能读到的只有一页保护提示。所以不是导入功能坏了，是文件本身不给读。`,
      steps: [
        '不要对它做「另存为」或编辑——那页提示写明会导致数据丢失且无法恢复。',
        '在 WPS Office 里打开它（需要当初加密它的那个账号）。',
        '把文字复制出来，另存成 .txt 再导入。',
      ],
    }
  }
  if (kind === 'legacy-doc') {
    return {
      kind,
      title: '这其实是老式 .doc 文件，不是 .docx',
      message: `${name} 的后缀虽然是 .docx，但文件头是 OLE 复合文档——老式 .doc 改了后缀。这种格式读不出来。`,
      steps: [
        '用 Word 打开它，「文件 → 另存为 → Word 文档 (*.docx)」存一份新的再导入。',
        '如果打开后只看到一页「此文件仅WPS能打开」的提示，那是 WPS 私密文档，不要另存为。',
      ],
    }
  }
  if (kind === 'rtf') {
    return {
      kind,
      title: '这是 RTF 格式，不是 Word 文档',
      message: `${name} 其实是 RTF（富文本），扩展名不对。`,
      steps: [
        '用 Word 打开它，另存为「Word 文档 (*.docx)」。',
        '或者直接存成纯文本 .txt 再导入——纯文本是最稳的。',
      ],
    }
  }
  if (kind === 'unreadable') {
    const occupied = extra?.name === 'NotReadableError' || extra?.name === 'NotAllowedError'
    return {
      kind,
      title: occupied ? '文件被占用了，读不出来' : '读不出这个文件',
      message: occupied
        ? `${name} 正被别的程序（多半是 Word 或 WPS）占用着，浏览器拿不到它。`
        : `${name} 读取失败：${extra?.message || '未知错误'}`,
      steps: occupied
        ? ['关掉打开它的 Word / WPS，再重新选一次这个文件。']
        : ['确认文件没有损坏，然后重新选一次。'],
    }
  }
  return {
    kind: 'unknown',
    title: '这不是有效的 Word 文档',
    message: `${name} 的文件头既不是 .docx 也不是老式 .doc，读不出来。`,
    steps: [
      '确认选的是 Word 文档（.docx）。',
      '也可以直接导入纯文本：在记事本里另存成 .txt，或 Markdown 的 .md。',
    ],
  }
}

/** 一段摘要取多长。文章列表里的一行，太长会撑坏卡片。 */
const EXCERPT_LENGTH = 86

/** 标题之前那段正文短于这个长度就当文档头丢掉。 */
const PREAMBLE_KEEP_LENGTH = 120

/**
 * 清掉 Word/网页复制粘贴带进来的一堆不可见字符。
 * 这些字符肉眼看不见，但会混进正文里，之后搜索、字数统计全都不对。
 */
export function normalizeText(input) {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    // Word 用垂直制表符当软换行（Shift+Enter），不换成 \n 会两段粘成一行
    .replace(/[\u000b\u2028\u2029]/g, '\n')
    // 零宽字符、BOM、软连字符：都是排版残留，不是内容
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, '')
    // 不换行空格：看着是空格，但会跟普通空格比不相等，判重和搜索都会漏
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    // 三个以上连续空行压成两个：段落间距是排版的事，不该由原文里敲了几个回车决定
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 纯文本 → 块。Markdown 的 `#` 标题会被认出来，于是 txt/md 也能一份文件拆多篇。
 */
export function blocksFromText(input) {
  const text = normalizeText(input)
  if (!text) return []
  const blocks = []
  for (const chunk of text.split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean)
    if (!lines.length) continue
    const heading = /^(#{1,6})\s+(.+)$/.exec(lines[0])
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      const rest = lines.slice(1)
      if (rest.length) blocks.push({ type: 'paragraph', text: rest.join('\n') })
    } else {
      // 段内单个换行保留（诗、清单靠它断行），所以这里不 join 成空格
      blocks.push({ type: 'paragraph', text: lines.join('\n') })
    }
  }
  return blocks
}

/** 块 → 标题文本列表，用来判断该拿哪一级标题当分界。 */
function shallowestHeadingLevel(blocks) {
  const levels = blocks.filter((block) => block.type === 'heading').map((block) => block.level)
  return levels.length ? Math.min(...levels) : 0
}

/** 从正文里截一段摘要：去掉换行、压掉多余空白，按长度截断。 */
export function makeExcerpt(content, max = EXCERPT_LENGTH) {
  const flat = String(content || '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/**
 * 块 → 文章草稿数组。`fallbackTitle` 一般是文件名（没有标题时用它）。
 * 返回的每一项只有 title / content / excerpt，其余字段（分类、标签、可见范围）由调用方补。
 * 正文为空的段落直接丢掉——那种多半是目录里的一行标题，不是文章。
 */
export function splitArticleBlocks(input, fallbackTitle = '') {
  const blocks = (Array.isArray(input) ? input : [])
    .map((block) => ({
      type: block?.type === 'heading' ? 'heading' : 'paragraph',
      level: Number(block?.level) || 1,
      text: normalizeText(block?.text ?? '').replace(/\n{2,}/g, '\n'),
    }))
    .filter((block) => block.text.trim())
  if (!blocks.length) return []

  const level = shallowestHeadingLevel(blocks)
  const drafts = []
  let current = null

  const flush = () => {
    if (!current) return
    const content = current.lines.join('\n\n').trim()
    // 「第一个标题之前」那一段：短的是文档头（署名、日期），不是文章，直接丢。
    // 这个判断必须放在 flush 里面——放在循环外面的话，遇到第一个标题时
    // 这段就已经被当成一篇推出来了（第一版就是这么错的，对拍脚本抓到的）。
    if (current.preamble && content.length < PREAMBLE_KEEP_LENGTH) { current = null; return }
    const title = current.title.trim() || fallbackTitle || '未命名文章'
    if (content) drafts.push({ title, content, excerpt: makeExcerpt(content) })
    current = null
  }

  for (const block of blocks) {
    if (level && block.type === 'heading' && block.level === level) {
      flush()
      current = { title: block.text, lines: [] }
      continue
    }
    if (!current) {
      // 有标题的文档：标题之前那一段先攒着（见 flush 里的 preamble 判定）
      // 没标题的文档：整份就是一篇，直接拿文件名当标题
      current = level
        ? { title: '', lines: [], preamble: true }
        : { title: fallbackTitle || '未命名文章', lines: [] }
    }
    current.lines.push(block.text)
  }
  flush()
  return drafts
}
