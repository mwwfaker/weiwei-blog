// 文章导入拆分器的对拍：「块 → 文章草稿」的规则钉在这里。
// 运行：cd frontend && npm run verify:article
//
// 为什么需要它：拆错了在浏览器里只表现成「少了几篇 / 多了一篇很长的」，
// 而导入是写进数据库的——发现的代价是回后台一篇篇删。
// 这里只测纯函数；docx → 块那一步要用 DOMParser，只能在浏览器里，归 store 管。
import {
  DEFAULT_IMPORT_TAGS,
  blocksFromText,
  detectDocumentFormat,
  importProblem,
  looksLikeProtectedStub,
  makeExcerpt,
  normalizeText,
  sniffProtectedStub,
  splitArticleBlocks,
} from '../src/services/articleImport.js'

let pass = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`) }
}

// ---------------------------------------------------------------------------
console.log('[1] normalizeText：清掉 Word / 网页带进来的不可见字符')
check('CRLF 归一成 LF', normalizeText('a\r\nb\rc').split('\n').length === 3)
// Word 里的 Shift+Enter 是垂直制表符，不换掉两段会粘成一行
check('垂直制表符当换行', normalizeText('上一行\u000b下一行') === '上一行\n下一行', JSON.stringify(normalizeText('上一行\u000b下一行')))
check('不换行空格换成普通空格', normalizeText('莫唯\u00a0唯') === '莫唯 唯', normalizeText('莫唯\u00a0唯'))
check('零宽字符与 BOM 清掉', normalizeText('唯\u200b唯\ufeff唯\u00ad') === '唯唯唯', normalizeText('唯\u200b唯\ufeff唯\u00ad'))
check('行尾空白去掉', normalizeText('正文   \n下一行\t') === '正文\n下一行', JSON.stringify(normalizeText('正文   \n下一行\t')))
check('连续空行压成两个换行', normalizeText('一\n\n\n\n二') === '一\n\n二', JSON.stringify(normalizeText('一\n\n\n\n二')))
check('空输入不炸', normalizeText(null) === '' && normalizeText(undefined) === '')

// ---------------------------------------------------------------------------
console.log('\n[2] blocksFromText：Markdown 标题要被认出来')
const markdown = blocksFromText('# 第一篇\n正文一\n\n## 小标题\n正文二\n\n# 第二篇\n正文三')
check('认出两级标题', markdown.filter((b) => b.type === 'heading').length === 3, JSON.stringify(markdown.map((b) => b.type)))
check('标题层级正确', markdown[0].level === 1 && markdown[2].level === 2, JSON.stringify(markdown.map((b) => b.level)))
check('标题文本去掉了井号', markdown[0].text === '第一篇', markdown[0].text)
check('段落内的单换行保留（诗/清单靠它断行）', blocksFromText('上句\n下句').length === 1 && blocksFromText('上句\n下句')[0].text === '上句\n下句')
check('空文本得到空数组', blocksFromText('   \n\n  ').length === 0)

// ---------------------------------------------------------------------------
console.log('\n[3] splitArticleBlocks：一份文档装多篇')
const multi = [
  { type: 'heading', level: 1, text: '第一篇文章' },
  { type: 'paragraph', text: '第一篇的正文，够长一点点。' },
  { type: 'heading', level: 1, text: '第二篇文章' },
  { type: 'paragraph', text: '第二篇的正文。' },
]
const two = splitArticleBlocks(multi, '文件名的兜底标题')
check('按一级标题拆成 2 篇', two.length === 2, `got ${two.length}`)
check('标题取标题行', two[0].title === '第一篇文章' && two[1].title === '第二篇文章', two.map((a) => a.title).join(' / '))
check('正文归到各自的篇里', two[0].content === '第一篇的正文，够长一点点。' && two[1].content === '第二篇的正文。', JSON.stringify(two.map((a) => a.content)))
check('摘要用正文字段补齐', two[0].excerpt.startsWith('第一篇的正文'), two[0].excerpt)

console.log('\n[4] 子标题留在正文里，不另起一篇')
const nested = [
  { type: 'heading', level: 1, text: '大标题' },
  { type: 'paragraph', text: '开头。' },
  { type: 'heading', level: 2, text: '小标题' },
  { type: 'paragraph', text: '小标题下的正文。' },
]
const one = splitArticleBlocks(nested, '兜底')
check('只拆出 1 篇', one.length === 1, `got ${one.length}`)
check('二级标题变成正文里的一行', one[0].content.includes('小标题') && one[0].content.includes('小标题下的正文。'), JSON.stringify(one[0].content))
check('段与段之间用空行隔开', one[0].content.split('\n\n').length === 3, JSON.stringify(one[0].content))

console.log('\n[5] 用最浅那一级标题当分界（整份文档只有二级标题也一样）')
const h2only = [
  { type: 'heading', level: 2, text: '上篇' },
  { type: 'paragraph', text: '正文甲。' },
  { type: 'heading', level: 2, text: '下篇' },
  { type: 'paragraph', text: '正文乙。' },
]
const byH2 = splitArticleBlocks(h2only, '兜底')
check('只有二级标题时按二级拆', byH2.length === 2, `got ${byH2.length}`)
check('标题正确', byH2[0].title === '上篇' && byH2[1].title === '下篇', byH2.map((a) => a.title).join(' / '))

console.log('\n[6] 没有任何标题：整份就是一篇，哪怕很短')
const plain = splitArticleBlocks([{ type: 'paragraph', text: '就一句话。' }], '我的随笔')
check('短文章不会被当成文档头吞掉', plain.length === 1, `got ${plain.length}`)
check('标题用文件名兜底', plain[0].title === '我的随笔', plain[0].title)
check('正文原样保留', plain[0].content === '就一句话。', plain[0].content)

console.log('\n[7] 标题之前那一段：短的丢掉，长的单独成篇')
const withShortPreamble = splitArticleBlocks([
  { type: 'paragraph', text: '莫唯唯 · 2026' },
  { type: 'heading', level: 1, text: '正文标题' },
  { type: 'paragraph', text: '正文。' },
], '兜底名')
check('短的文档头丢掉', withShortPreamble.length === 1 && withShortPreamble[0].title === '正文标题', JSON.stringify(withShortPreamble.map((a) => a.title)))
const longPreamble = '这是一段足够长的开场白，'.repeat(12)
const withLongPreamble = splitArticleBlocks([
  { type: 'paragraph', text: longPreamble },
  { type: 'heading', level: 1, text: '后面的标题' },
  { type: 'paragraph', text: '正文。' },
], '兜底名')
check('长的开场白单独成篇', withLongPreamble.length === 2, `got ${withLongPreamble.length}`)
check('它的标题用文件名兜底', withLongPreamble[0].title === '兜底名', withLongPreamble[0].title)

console.log('\n[8] 边角：空段落、只有标题、空输入')
const empty = splitArticleBlocks([
  { type: 'heading', level: 1, text: '只有标题没有正文' },
  { type: 'paragraph', text: '   ' },
], '兜底')
check('正文为空丢掉（目录里的一行标题）', empty.length === 0, `got ${empty.length}`)
check('空输入得到空数组', splitArticleBlocks([], '兜底').length === 0 && splitArticleBlocks(null).length === 0)
check('非法块不炸（type/level 乱填）', splitArticleBlocks([{ type: 'x', level: 'y', text: '正文。' }], '兜底').length === 1)
check('标题行前后空白被去掉', splitArticleBlocks([{ type: 'heading', level: 1, text: '  标题  ' }, { type: 'paragraph', text: '正文。' }], '兜底')[0].title === '标题')

// ---------------------------------------------------------------------------
console.log('\n[9] makeExcerpt')
check('换行压成空格', makeExcerpt('第一行\n第二行') === '第一行 第二行', makeExcerpt('第一行\n第二行'))
check('超长截断并加省略号', makeExcerpt('字'.repeat(200)).endsWith('…') && makeExcerpt('字'.repeat(200)).length === 87, String(makeExcerpt('字'.repeat(200)).length))
check('短文本不截断', makeExcerpt('短短一句。') === '短短一句。')
check('空传入不炸', makeExcerpt(null) === '')

console.log('\n[10] 导出与真实形态')
check('默认标签是「导入」', Array.isArray(DEFAULT_IMPORT_TAGS) && DEFAULT_IMPORT_TAGS[0] === '导入', JSON.stringify(DEFAULT_IMPORT_TAGS))
// 模拟一份典型的 Word 文档：标题 + 三级结构 + 一段落款
const wordLike = splitArticleBlocks([
  { type: 'heading', level: 1, text: '秋天的第一杯奶茶' },
  { type: 'paragraph', text: '今天路过那家店，排了很长的队。' },
  { type: 'heading', level: 2, text: '排队的时候' },
  { type: 'paragraph', text: '旁边有个小孩一直在数数。' },
  { type: 'paragraph', text: '数到一百的时候终于轮到我了。' },
  { type: 'heading', level: 1, text: '冬天来了' },
  { type: 'paragraph', text: '风很大，帽子差点飞走。' },
], '随笔集')
check('拆出 2 篇', wordLike.length === 2, `got ${wordLike.length}`)
check('第二篇的正文归位', wordLike[1].content === '风很大，帽子差点飞走。', wordLike[1].content)
check('第一篇含子标题段落（1 个标题 + 3 段正文）', wordLike[0].content.split('\n\n').length === 4, String(wordLike[0].content.split('\n\n').length))
check('每篇都有非空摘要', wordLike.every((a) => a.excerpt.length > 0))

console.log('\n[11] 文件头认格式（扩展名不可信）')
const stamp = (...bytes) => new Uint8Array(bytes)
check('PK 开头 = 真正的 docx', detectDocumentFormat(stamp(0x50, 0x4b, 0x03, 0x04)) === 'docx')
check('空 zip 也算 docx', detectDocumentFormat(stamp(0x50, 0x4b, 0x05, 0x06)) === 'docx')
check('OLE 开头 = 老式 .doc（改名的重灾区）',
  detectDocumentFormat(stamp(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) === 'legacy-doc')
check('RTF 认出来', detectDocumentFormat(stamp(0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31)) === 'rtf')
check('别的一律 unknown', detectDocumentFormat(stamp(0x00, 0x01, 0x02)) === 'unknown')
check('空数组不炸', detectDocumentFormat(new Uint8Array()) === 'unknown' && detectDocumentFormat(null) === 'unknown')
check('传普通数组也认（内部会包成 Uint8Array）', detectDocumentFormat([0x50, 0x4b, 0x03, 0x04]) === 'docx')


console.log('\n[13] WPS 私密文档：必须先认出来，否则会给出有害的建议')
// 真实的保护提示原文（用户那份「论如何找到女朋友.docx」里就是这样）
const stubText = '此文件仅WPS能打开，操作当前文件会造成文件损坏 • 此文件为私密文档，请使用WPS Office打开 '
  + '个人用户：访问WPS官方网站下载 http://www.wps.cn 企业用户：请联系企业管理员获取最新版本 '
  + '请勿对文件进行任何操作 对文件进行编辑或另存为操作，会导致数据丢失，无法恢复'
check('认出保护壳', looksLikeProtectedStub(stubText) === true)
check('普通文章不会被误判', looksLikeProtectedStub('今天天气很好，我去公园散步了。') === false)
check('空文本不误判', looksLikeProtectedStub('') === false && looksLikeProtectedStub(null) === false)
check('只命中一个词不算（避免误伤正文里提到 WPS 的文章）',
  looksLikeProtectedStub('我平时用 WPS Office 写东西。') === false)
// .doc 的正文是 UTF-16LE，所以要在字节层面认出来
const utf16bytes = new Uint8Array(Buffer.from(stubText, 'utf16le'))
check('能从原始字节里认出来（UTF-16LE，老式 .doc 就是这样）', sniffProtectedStub(utf16bytes) === true)
check('能从原始字节里认出来（UTF-8，docx 解压前后都可能是这样）',
  sniffProtectedStub(new Uint8Array(Buffer.from(stubText, 'utf8'))) === true)
check('普通字节不误判', sniffProtectedStub(new Uint8Array([0x50, 0x4b, 0x03, 0x04])) === false)
check('空字节不炸', sniffProtectedStub(new Uint8Array()) === false && sniffProtectedStub(null) === false)

console.log('\n[12] 提示窗的内容：要说清「为什么 + 别做什么 + 该做什么」')
const stub = importProblem('protected-stub', '论如何找到女朋友.docx')
check('有标题', typeof stub.title === 'string' && stub.title.length > 0, stub.title)
check('标题点明是 WPS 私密文档', stub.title.includes('WPS') && stub.title.includes('私密'), stub.title)
check('说明里点名了文件', stub.message.includes('论如何找到女朋友.docx'), stub.message)
check('说明里澄清「不是导入坏了」', stub.message.includes('不是导入功能坏了'), stub.message)
check('第一步就是「不要另存为」（这是最会出事的一句）',
  stub.steps[0].includes('不要') && stub.steps[0].includes('另存为'), stub.steps[0])
check('给出了正确的出路（WPS 里打开 + 复制 + 存 txt）',
  stub.steps.some((s) => s.includes('WPS Office')) && stub.steps.some((s) => s.includes('复制')) && stub.steps.some((s) => s.includes('.txt')),
  JSON.stringify(stub.steps))
check('步骤是数组（弹窗要按序号排）', Array.isArray(stub.steps) && stub.steps.length === 3, String(stub.steps.length))

const legacy = importProblem('legacy-doc', 'a.docx')
check('老式 doc：标题说清是 .doc 不是 .docx', legacy.title.includes('.doc'), legacy.title)
check('老式 doc：步骤里带 WPS 的警告（两种情况常同时出现）',
  legacy.steps.some((s) => s.includes('WPS') && s.includes('私密')), JSON.stringify(legacy.steps))
const rtf = importProblem('rtf', 'a.docx')
check('RTF 有标题与步骤', rtf.title.includes('RTF') && rtf.steps.length === 2, rtf.title)
const unknown = importProblem('unknown', 'a.docx')
check('认不出的也有出路（可以导 txt/md）', unknown.steps.some((s) => s.includes('.txt')), JSON.stringify(unknown.steps))
const busy = importProblem('unreadable', 'a.docx', { name: 'NotReadableError' })
check('被占用：标题说「被占用」', busy.title.includes('占用'), busy.title)
check('被占用：办法是关掉 Word/WPS', busy.steps[0].includes('关掉'), busy.steps[0])
const broken = importProblem('unreadable', 'a.docx', { message: '磁盘损坏' })
check('其它读失败：回显原始信息', broken.message.includes('磁盘损坏'), broken.message)
check('任何情况都不会返回空步骤', [stub, legacy, rtf, unknown, busy, broken].every((p) => p.steps.length > 0))

// ---------------------------------------------------------------------------
console.log(`\n${pass} 项通过${failures.length ? `，${failures.length} 项失败` : ''}`)
if (failures.length) {
  console.log('失败清单：')
  for (const name of failures) console.log(`  - ${name}`)
  process.exit(1)
}
