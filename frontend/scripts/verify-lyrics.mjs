// 歌词解析的离线自检。运行：cd frontend && npm run verify:lyrics
//
// 这几段逻辑（LRC 时间轴、当前句定位、曲名拆分、ID3 内嵌歌词）靠截图看不出来，
// 而它们一旦算错，表现是「歌词整体错位一句」或「明明是 UTF-8 却读出乱码」这种很难查的问题。
import assert from 'node:assert/strict'
import {
  parseLrc, hasLyrics, activeLineIndex, guessTrackInfo, readEmbeddedLyrics,
} from '../src/services/lyrics.js'

// 用例先登记、最后按顺序跑完：这样同步用例不会插到异步用例前面，
// 异步用例一旦失败也会被 catch 住，而不是变成未处理的 promise rejection 把进程搞崩。
const cases = []
let passed = 0
function check(name, fn) { cases.push({ name, fn }) }
function section(title) { cases.push({ section: title }) }
async function runAll() {
  for (const item of cases) {
    if (item.section) { console.log(item.section); continue }
    try {
      await item.fn()
      passed += 1
      console.log(`  OK   ${item.name}`)
    } catch (error) {
      console.error(`  FAIL ${item.name}\n       ${error.message}`)
      process.exitCode = 1
    }
  }
}

// ------------------------------------------------------------------ LRC 解析
section('[LRC 解析]')

check('标准 [mm:ss.xx] 两行', () => {
  const r = parseLrc('[00:12.34]第一句\n[00:15.60]第二句')
  assert.equal(r.synced, true)
  assert.equal(r.lines.length, 2)
  assert.ok(Math.abs(r.lines[0].time - 12.34) < 1e-6)
  assert.equal(r.lines[1].text, '第二句')
})

check('三位毫秒按毫秒算', () => {
  assert.ok(Math.abs(parseLrc('[01:02.500]x').lines[0].time - 62.5) < 1e-6)
})

check('一位小数按十分之一秒算', () => {
  assert.ok(Math.abs(parseLrc('[00:01.5]x').lines[0].time - 1.5) < 1e-6)
})

check('兼容 [mm:ss:xx] 这种冒号写法', () => {
  assert.ok(Math.abs(parseLrc('[00:07:50]x').lines[0].time - 7.5) < 1e-6)
})

check('一行多个时间标签会展开成多行', () => {
  const r = parseLrc('[00:10.00][01:20.00]副歌')
  assert.equal(r.lines.length, 2)
  assert.equal(r.lines[0].text, '副歌')
  assert.equal(r.lines[1].text, '副歌')
})

check('时间标签乱序会被排序', () => {
  const r = parseLrc('[00:30.00]后\n[00:10.00]前')
  assert.equal(r.lines[0].text, '前')
  assert.equal(r.lines[1].text, '后')
})

check('[offset:] 被读出来', () => {
  assert.equal(parseLrc('[offset:-500]\n[00:01.00]x').offset, -500)
})

check('元信息标签不产生歌词行', () => {
  const r = parseLrc('[ti:歌名]\n[ar:歌手]\n[00:01.00]第一句')
  assert.equal(r.lines.length, 1)
  assert.equal(r.meta.ti, '歌名')
  assert.equal(r.meta.ar, '歌手')
})

check('纯文本歌词 synced=false 且全部保留', () => {
  const r = parseLrc('第一行\n\n第二行')
  assert.equal(r.synced, false)
  assert.equal(r.lines.length, 2)
  assert.equal(hasLyrics(r), true)
})

check('空歌词 hasLyrics=false', () => {
  assert.equal(hasLyrics(parseLrc('[ti:只有标签]')), false)
  assert.equal(hasLyrics(null), false)
})

// ------------------------------------------------------------ 当前句定位
section('[当前句定位]')

check('早于第一句返回 -1', () => {
  const r = parseLrc('[00:10.00]a\n[00:20.00]b')
  assert.equal(activeLineIndex(r, 5), -1)
})

check('取最后一个已开始的时间点', () => {
  const r = parseLrc('[00:10.00]a\n[00:20.00]b\n[00:30.00]c')
  assert.equal(activeLineIndex(r, 25), 1)
  assert.equal(activeLineIndex(r, 999), 2)
})

check('offset 生效（正数推迟歌词）', () => {
  const r = parseLrc('[offset:2000]\n[00:10.00]a\n[00:20.00]b')
  assert.equal(activeLineIndex(r, 11), -1)
  assert.equal(activeLineIndex(r, 12), 0)
})

check('没有时间轴时返回 -1，不会瞎高亮', () => {
  assert.equal(activeLineIndex(parseLrc('纯文本\n第二行'), 30), -1)
})

// -------------------------------------------------------------- 曲名拆分
section('[曲名拆分]')

check('歌手 - 歌名.mp3', () => {
  const g = guessTrackInfo('周杰伦 - 晴天.mp3')
  assert.equal(g.artist, '周杰伦')
  assert.equal(g.title, '晴天')
})

check('书名号与括号备注被清掉', () => {
  const g = guessTrackInfo('五月天 - 《温柔》(Live).flac')
  assert.equal(g.title, '《温柔》(Live)')
  assert.equal(g.searchTitle, '《温柔》')
  // 只去掉左边书名号会留下一个孤零零的 》——这正是这条用例要防的。
  assert.equal(guessTrackInfo('《温柔》.mp3').title, '温柔')
})

check('没有分隔符时整名当歌名', () => {
  const g = guessTrackInfo('晴天.mp3')
  assert.equal(g.artist, '')
  assert.equal(g.title, '晴天')
})

// ------------------------------------------------------------ ID3 内嵌歌词
section('[ID3 内嵌歌词]')

/** 按 ID3v2.3 拼一个只含指定帧的最小标签出来。 */
function buildId3(frameId, frameBody, { major = 3 } = {}) {
  const frame = new Uint8Array(10 + frameBody.length)
  for (let i = 0; i < 4; i += 1) frame[i] = frameId.charCodeAt(i)
  const size = frameBody.length
  frame[4] = (size >>> 24) & 0xff
  frame[5] = (size >>> 16) & 0xff
  frame[6] = (size >>> 8) & 0xff
  frame[7] = size & 0xff
  frame.set(frameBody, 10)
  const out = new Uint8Array(10 + frame.length)
  out[0] = 0x49; out[1] = 0x44; out[2] = 0x33
  out[3] = major; out[4] = 0; out[5] = 0
  // 同步安全尺寸：每个字节只用低 7 位
  const tagSize = frame.length
  out[6] = (tagSize >>> 21) & 0x7f
  out[7] = (tagSize >>> 14) & 0x7f
  out[8] = (tagSize >>> 7) & 0x7f
  out[9] = tagSize & 0x7f
  out.set(frame, 10)
  return out
}

/** 造一个带 slice().arrayBuffer() 的假 File。 */
const fakeFile = (bytes) => ({
  size: bytes.length,
  slice: (a, b) => ({ arrayBuffer: async () => bytes.slice(a, b).buffer }),
})

check('USLT（UTF-8）能读出来', async () => {
  const lyric = '[00:01.00]第一句'
  const text = new TextEncoder().encode(lyric)
  const body = new Uint8Array(1 + 3 + 1 + text.length)
  body[0] = 3                              // UTF-8
  body.set([0x65, 0x6e, 0x67], 1)          // 'eng'
  body[4] = 0                              // 空描述
  body.set(text, 5)
  assert.equal(await readEmbeddedLyrics(fakeFile(buildId3('USLT', body))), lyric)
})

check('USLT（Latin-1）能读出来', async () => {
  const body = new Uint8Array([0, 0x65, 0x6e, 0x67, 0, 0x41, 0x42]) // 'AB'
  assert.equal(await readEmbeddedLyrics(fakeFile(buildId3('USLT', body))), 'AB')
})

check('SYLT 会还原成带时间标签的 LRC', async () => {
  const text = new TextEncoder().encode('啊')
  // 编码(1) + 语言(3) + 时间戳格式(1) + 内容类型(1) + 描述结束符(1) + 文本 + 结束符(1) + 时间戳(4)
  const body = new Uint8Array(1 + 3 + 1 + 1 + 1 + text.length + 1 + 4)
  let p = 0
  body[p++] = 3                            // UTF-8
  body.set([0x65, 0x6e, 0x67], p); p += 3
  body[p++] = 2                            // 时间戳单位是毫秒
  body[p++] = 1                            // 内容类型
  body[p++] = 0                            // 空描述
  body.set(text, p); p += text.length
  body[p++] = 0                            // 文本结束符
  const ms = 61500
  body[p++] = (ms >>> 24) & 0xff; body[p++] = (ms >>> 16) & 0xff
  body[p++] = (ms >>> 8) & 0xff; body[p++] = ms & 0xff
  assert.equal(p, body.length)
  const result = await readEmbeddedLyrics(fakeFile(buildId3('SYLT', body)))
  assert.match(result, /^\[01:01\.50\]啊$/)
})

check('TXXX 里 description 含 lyric 时才采用', async () => {
  const text = new TextEncoder().encode('啦啦啦')
  const body = new Uint8Array(1 + 6 + 1 + text.length)
  body[0] = 3
  body.set(new TextEncoder().encode('LYRICS'), 1)
  body[7] = 0
  body.set(text, 8)
  assert.equal(await readEmbeddedLyrics(fakeFile(buildId3('TXXX', body))), '啦啦啦')

  const other = new Uint8Array(1 + 5 + 1 + 2)
  other[0] = 3
  other.set(new TextEncoder().encode('ALBUM'), 1)
  other[6] = 0
  other.set(new TextEncoder().encode('xx'), 7)
  assert.equal(await readEmbeddedLyrics(fakeFile(buildId3('TXXX', other))), null)
})

check('不是 ID3 的文件返回 null（不抛错）', async () => {
  assert.equal(await readEmbeddedLyrics(fakeFile(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))), null)
  assert.equal(await readEmbeddedLyrics(null), null)
})

check('没有歌词帧时返回 null', async () => {
  const body = new Uint8Array([0, 0x65, 0x6e, 0x67, 0, 0x41])
  assert.equal(await readEmbeddedLyrics(fakeFile(buildId3('TIT2', body))), null)
})

await runAll()
const total = cases.filter((item) => !item.section).length
console.log(`\n${passed}/${total} 项通过${process.exitCode ? '，存在失败项' : '，全部通过'}`)
