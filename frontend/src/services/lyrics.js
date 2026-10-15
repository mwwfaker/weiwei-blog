/**
 * 歌词：从「只有一个音频文件」到「页面上有一条跟着唱的歌词」的全部手段。
 *
 * 按可靠性从高到低一共四层，前一层的歌词能拿到就不会再往下找：
 *   1. 数据库里已经存好的歌词（media_assets.lyrics）—— 你手动确认过的那一份，永远优先；
 *   2. 音频文件里内嵌的歌词标签（ID3v2 的 USLT / SYLT）—— 文件自带就零操作拿到；
 *   3. 在线自动匹配 LRCLIB（免费、开源、支持浏览器跨域）—— 按「曲名 + 歌手 + 时长」查；
 *   4. 中文源（网易云）—— 需要配一个中转地址绕开跨域限制，没配就跳过。
 *
 * 都拿不到时不是报错，而是把控制权交回给你：音乐页的歌词栏会变成「粘贴 LRC / 上传 .lrc」。
 *
 * 输出统一是 LRC 原文（字符串）。数据库里存的、页面渲染的、手动粘贴的都是同一种东西，
 * 这样自动匹配到的那一份可以直接被你手动改掉再存回来。
 */

/** 在线匹配的网络超时；卡住时宁可退到「手动粘贴」，也不要让歌词栏一直转圈。 */
const NETWORK_TIMEOUT = 6000

// ==================================================================== LRC 解析

/**
 * 解析 LRC。返回 `{ lines, synced, offset, meta, raw }`：
 *   lines  —— [{ time: 秒 | null, text }]，synced 为 false 时 time 全是 null；
 *   offset —— [offset:] 标签里的毫秒数，正数表示歌词要整体推迟；
 *   meta   —— [ti:] [ar:] [al:] [by:] 这些头部信息。
 *
 * 特意容忍了几种常见的不规范写法：一行多个时间标签、`[mm:ss:xx]`（用冒号而不是点）、
 * 时间标签后面直接跟正文、以及完全没有时间标签的纯文本歌词。
 */
export function parseLrc(raw) {
  const text = String(raw || '').replace(/\r\n?/g, '\n')
  const lines = []
  const meta = {}
  let offset = 0
  let synced = false

  for (const source of text.split('\n')) {
    const line = source.trim()
    if (!line) continue

    // 收集这一行开头的所有时间标签；后面的部分才是正文。
    const stamps = []
    let consumedTags = false
    const tagPattern = /^\[([a-zA-Z#]+):(.*)\]/
    const timePattern = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/
    let rest = line
    for (;;) {
      const time = rest.match(timePattern)
      if (time) {
        const minutes = Number(time[1])
        const seconds = Number(time[2])
        // 两位毫秒是「百分之一秒」，三位才是毫秒；一位按十分之一秒算。
        const fractionText = time[3] || '0'
        const fraction = fractionText.length === 3
          ? Number(fractionText) / 1000
          : fractionText.length === 2
            ? Number(fractionText) / 100
            : Number(fractionText) / 10
        stamps.push(minutes * 60 + seconds + fraction)
        rest = rest.slice(time[0].length)
        continue
      }
      const tag = rest.match(tagPattern)
      if (tag && !stamps.length) {
        const key = tag[1].toLowerCase()
        const value = tag[2].trim()
        if (key === 'offset') {
          const parsed = Number(value)
          if (Number.isFinite(parsed)) offset = parsed
        } else if (['ti', 'ar', 'al', 'by', 'au', 'length'].includes(key)) {
          meta[key] = value
        }
        rest = rest.slice(tag[0].length)
        consumedTags = true
        continue
      }
      break
    }

    const content = rest.trim()

    if (stamps.length) {
      synced = true
      for (const time of stamps) lines.push({ time, text: content })
    } else if (!consumedTags) {
      // 完全没有标签的行：当作纯文本歌词。
      lines.push({ time: null, text: line })
    }
    // 只有标签没有时间轴的行（[ti:]、[ar:] 这些）不产生歌词行。
  }

  // 有时间轴时把没有时间的杂行剔掉，否则二分查找的下标会和渲染的下标对不上。
  const timed = synced ? lines.filter((line) => line.time !== null) : lines
  if (synced) timed.sort((a, b) => a.time - b.time)
  return { lines: timed, synced, offset, meta, raw: text }
}

/** 歌词是否值得展示（全空、只有标签都算没有）。 */
export function hasLyrics(parsed) {
  return Boolean(parsed && parsed.lines.some((line) => line.text))
}

/** 秒 → `m:ss`，和播放器上的时间显示保持一致。 */
export function formatClock(value) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * 按当前播放时间找到该高亮的那一行。
 * 返回下标；歌词没有时间轴、或者还没到第一句时返回 -1（这时高亮交给界面自己决定）。
 */
export function activeLineIndex(parsed, currentTime) {
  if (!parsed?.synced || !parsed.lines.length) return -1
  const time = currentTime - (parsed.offset || 0) / 1000
  let low = 0
  let high = parsed.lines.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    const lineTime = parsed.lines[mid].time
    if (lineTime == null) { low = mid + 1; continue }
    if (lineTime <= time) { found = mid; low = mid + 1 } else high = mid - 1
  }
  return found
}

// ==================================================================== 曲名拆分

/** 去掉首尾成对包裹的符号。必须成对——只去掉左书名号会留下一个孤零零的 `》`。 */
function stripWrapping(value) {
  const pairs = [['《', '》'], ['【', '】'], ['「', '」'], ['『', '』'], ['（', '）'], ['(', ')'], ['“', '”'], ['"', '"'], ["'", "'"]]
  let result = String(value || '').trim()
  let changed = true
  while (changed) {
    changed = false
    for (const [open, close] of pairs) {
      if (result.length > open.length + close.length - 1 && result.startsWith(open) && result.endsWith(close)) {
        result = result.slice(open.length, result.length - close.length).trim()
        changed = true
      }
    }
  }
  return result
}

/** 去掉扩展名，并把「歌手 - 歌名」「歌名 (feat. xxx)」这类常见命名拆成能拿去搜索的两段。 */
export function guessTrackInfo(name) {
  const base = String(name || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_]+/g, ' ')
    .trim()
  // 先按「歌手 - 歌名」拆；分隔符两侧都可能是歌手，约定前面那段算歌手。
  const dashed = base.split(/\s+[-–—－]\s+/)
  let artist = ''
  let title = base
  if (dashed.length >= 2) {
    artist = dashed[0].trim()
    title = dashed.slice(1).join(' - ').trim()
  }
  // 《歌名》/ “歌名” 这类包裹符号不该带进搜索词。
  title = stripWrapping(title) || base
  // 括号里的 feat./live/remaster 对匹配是噪声，但对 LRCLIB 的时长匹配有利，所以只从搜索词里去掉。
  const searchTitle = title.replace(/[（(][^）)]*[）)]/g, '').trim() || title
  return { artist, title, searchTitle }
}

// ==================================================================== 内嵌歌词（ID3v2）

const ID3_ENCODINGS = { 0: 'iso-8859-1', 1: 'utf-16', 2: 'utf-16be', 3: 'utf-8' }

/** ID3v2 的尺寸是「同步安全整数」：每个字节只用低 7 位。 */
function syncSafe(bytes, offset) {
  return ((bytes[offset] & 0x7f) << 21)
    | ((bytes[offset + 1] & 0x7f) << 14)
    | ((bytes[offset + 2] & 0x7f) << 7)
    | (bytes[offset + 3] & 0x7f)
}

function readUint32(bytes, offset) {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
}

/** 去掉 ID3v2 的不确定同步化填充：0xFF 00 还原成 0xFF。 */
function deUnsynchronise(bytes) {
  const out = new Uint8Array(bytes.length)
  let written = 0
  for (let i = 0; i < bytes.length; i += 1) {
    out[written++] = bytes[i]
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i += 1
  }
  return out.subarray(0, written)
}

function decodeBytes(bytes, encoding) {
  if (!bytes.length) return ''
  let charset = ID3_ENCODINGS[encoding] || 'utf-8'
  let view = bytes
  // 带 BOM 的 UTF-16 要用 BOM 判断大小端。
  if (encoding === 1 && bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) { charset = 'utf-16le'; view = bytes.subarray(2) }
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) { charset = 'utf-16be'; view = bytes.subarray(2) }
    else charset = 'utf-16le'
  }
  try {
    return new TextDecoder(charset).decode(view).replace(/\u0000+$/, '')
  } catch {
    return new TextDecoder('utf-8').decode(view).replace(/\u0000+$/, '')
  }
}

/**
 * 在一个编码下的字符串结束位置。
 * 单字节编码找 0x00；UTF-16 找对齐位置上的 0x00 0x00。
 */
function findTerminator(bytes, start, encoding) {
  const wide = encoding === 1 || encoding === 2
  if (!wide) {
    for (let i = start; i < bytes.length; i += 1) if (bytes[i] === 0x00) return i
    return bytes.length
  }
  for (let i = start; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === 0x00 && bytes[i + 1] === 0x00) return i
  }
  return bytes.length
}

/** USLT：编码(1) + 语言(3) + 内容描述(以编码结尾) + 歌词正文。 */
function parseUslt(frame) {
  if (frame.length < 5) return ''
  const encoding = frame[0]
  const start = 4
  const descriptorEnd = findTerminator(frame, start, encoding)
  const textStart = Math.min(frame.length, descriptorEnd + ((encoding === 1 || encoding === 2) ? 2 : 1))
  return decodeBytes(frame.subarray(textStart), encoding)
}

/**
 * SYLT：编码(1) + 语言(3) + 时间戳格式(1) + 内容类型(1) + 描述 + 若干「文本\0 + 四字节时间」。
 * 时间戳通常是毫秒，正好能还原成 LRC。
 */
function parseSylt(frame) {
  if (frame.length < 7) return ''
  const encoding = frame[0]
  const timestampFormat = frame[4]
  const descriptorEnd = findTerminator(frame, 6, encoding)
  let cursor = Math.min(frame.length, descriptorEnd + ((encoding === 1 || encoding === 2) ? 2 : 1))
  const out = []
  while (cursor < frame.length) {
    const textEnd = findTerminator(frame, cursor, encoding)
    const text = decodeBytes(frame.subarray(cursor, textEnd), encoding)
    cursor = textEnd + ((encoding === 1 || encoding === 2) ? 2 : 1)
    if (cursor + 4 > frame.length) break
    const stamp = readUint32(frame, cursor)
    cursor += 4
    // timestampFormat 1 是 MPEG 帧数，换算成秒要乘帧长；没有帧率信息时不猜，直接跳过。
    if (timestampFormat !== 2) continue
    const seconds = stamp / 1000
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds - minutes * 60
    out.push(`[${String(minutes).padStart(2, '0')}:${remainder.toFixed(2).padStart(5, '0')}]${text}`)
  }
  return out.join('\n')
}

/** TXXX 里 description 为 lyrics / LYRICS 的那一条，有些转码工具把歌词放在这里。 */
function parseTxxx(frame) {
  if (frame.length < 2) return ''
  const encoding = frame[0]
  const descriptorEnd = findTerminator(frame, 1, encoding)
  const descriptor = decodeBytes(frame.subarray(1, descriptorEnd), encoding).toLowerCase()
  if (!descriptor.includes('lyric')) return ''
  const textStart = Math.min(frame.length, descriptorEnd + ((encoding === 1 || encoding === 2) ? 2 : 1))
  return decodeBytes(frame.subarray(textStart), encoding)
}

/**
 * 从本机选择的音频文件里读内嵌歌词。
 *
 * 目前只处理 MP3 的 ID3v2（USLT / SYLT / TXXX）。FLAC 的 VORBIS_COMMENT 和 M4A 的
 * ©lyr 是另一套容器结构，等你确实有这类带歌词的文件再加，这里明说一声而不是悄悄失败。
 * 读不出来返回 null，调用方接着去走在线匹配。
 */
export async function readEmbeddedLyrics(file) {
  if (!file) return null
  try {
    // 歌词帧一般在标签头部；读前 2MB 足够覆盖绝大多数文件，又不会把大文件整个读进内存。
    const head = new Uint8Array(await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer())
    if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null
    const major = head[3]
    const flags = head[5]
    const tagSize = syncSafe(head, 6)
    let body = head.subarray(10, Math.min(head.length, 10 + tagSize))
    if (flags & 0x80) body = deUnsynchronise(body)

    const wide = major >= 3
    let cursor = 0
    let uslt = ''
    let sylt = ''
    let txxx = ''
    while (cursor + (wide ? 10 : 6) <= body.length) {
      const idLength = wide ? 4 : 3
      const id = String.fromCharCode(...body.subarray(cursor, cursor + idLength))
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break
      let size
      let headerSize
      if (wide) {
        headerSize = 10
        // v2.4 的帧长是同步安全整数，v2.3 是普通大端。
        size = major >= 4
          ? syncSafe(body, cursor + 4)
          : (body[cursor + 4] << 24) | (body[cursor + 5] << 16) | (body[cursor + 6] << 8) | body[cursor + 7]
      } else {
        headerSize = 6
        size = (body[cursor + 3] << 16) | (body[cursor + 4] << 8) | body[cursor + 5]
      }
      if (size <= 0 || cursor + headerSize + size > body.length) break
      const frame = body.subarray(cursor + headerSize, cursor + headerSize + size)
      // v2.3 的压缩/加密帧没法直接读，跳过而不是解析出乱码。
      const frameFlags = wide ? (body[cursor + 8] << 8) | body[cursor + 9] : 0
      if (!(frameFlags & 0x00c0)) {
        if (id === 'USLT') uslt = uslt || parseUslt(frame)
        else if (id === 'SYLT') sylt = sylt || parseSylt(frame)
        else if (id === 'TXXX') txxx = txxx || parseTxxx(frame)
      }
      cursor += headerSize + size
      if (uslt && sylt) break
    }
    // SYLT 有时间轴，优先；没有的话 USLT 的纯文本也能显示。
    const found = sylt || uslt || txxx
    return found.trim() ? found.trim() : null
  } catch {
    return null
  }
}

// ==================================================================== 在线匹配

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * LRCLIB：免费开源歌词库，接口直接允许浏览器跨域调用，不需要 key、不需要后端。
 * 先按「曲名 + 歌手 + 时长」做精确查询（命中率高且不会拿错歌），失败再退回模糊搜索。
 */
export async function fetchFromLrclib({ title, artist, album, duration }) {
  const trackName = String(title || '').trim()
  if (!trackName) return null

  const exact = new URLSearchParams({ track_name: trackName })
  if (artist) exact.set('artist_name', artist)
  if (album) exact.set('album_name', album)
  if (Number.isFinite(duration) && duration > 0) exact.set('duration', String(Math.round(duration)))
  try {
    const response = await fetchWithTimeout(`https://lrclib.net/api/get?${exact}`)
    if (response.ok) {
      const data = await response.json()
      const lrc = data?.syncedLyrics || data?.plainLyrics
      if (lrc && lrc.trim()) return { lrc: lrc.trim(), source: 'lrclib' }
    }
  } catch { /* 精确查询没有就走搜索，网络问题也一样。 */ }

  try {
    const query = [artist, trackName].filter(Boolean).join(' ')
    const response = await fetchWithTimeout(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) return null
    const list = await response.json()
    if (!Array.isArray(list) || !list.length) return null
    // 有时长信息时优先挑时长最接近的，避免同名不同版本串台。
    const ranked = [...list].sort((a, b) => {
      const score = (item) => {
        let value = item?.syncedLyrics ? 0 : 1000
        if (Number.isFinite(duration) && duration > 0 && Number.isFinite(item?.duration)) {
          value += Math.abs(item.duration - duration)
        }
        return value
      }
      return score(a) - score(b)
    })
    for (const item of ranked) {
      const lrc = item?.syncedLyrics || item?.plainLyrics
      if (lrc && lrc.trim()) return { lrc: lrc.trim(), source: 'lrclib' }
    }
  } catch { /* 网络不可用就当这条源没命中。 */ }
  return null
}

/**
 * 中文源（网易云）。它的接口不带跨域响应头，浏览器直连一定被拦，所以必须经一个中转。
 * 中转地址放在 VITE_LYRICS_PROXY 里（仓库里附了一个 Supabase Edge Function 实现，
 * 也可以指向任何你自己的转发服务）。没配就整条源跳过。
 *
 * 中转的约定：`GET <proxy>?title=歌名&artist=歌手`，返回 `{ lrc, source }` 或直接返回 LRC 文本。
 */
export async function fetchFromChineseSource({ title, artist }, proxyUrl) {
  if (!proxyUrl) return null
  const trackName = String(title || '').trim()
  if (!trackName) return null
  const url = new URL(proxyUrl, window.location.href)
  url.searchParams.set('title', trackName)
  if (artist) url.searchParams.set('artist', artist)
  try {
    const response = await fetchWithTimeout(url.toString())
    if (!response.ok) return null
    const type = response.headers.get('content-type') || ''
    if (type.includes('application/json')) {
      const data = await response.json()
      const lrc = data?.lrc || data?.lyric
      if (lrc && String(lrc).trim()) return { lrc: String(lrc).trim(), source: data.source || 'netease' }
      return null
    }
    const text = await response.text()
    return text.trim() ? { lrc: text.trim(), source: 'netease' } : null
  } catch {
    return null
  }
}

// ==================================================================== 统一入口

/** 这个浏览器会不会自动去网上找歌词。访客的浏览器也一样会找，所以默认开着。 */
let networkEnabled = true
export function setLyricsNetworkEnabled(value) { networkEnabled = Boolean(value) }
export function lyricsNetworkEnabled() { return networkEnabled }

/**
 * 按四层顺序把一首歌的歌词找出来。
 *
 * track 需要能提供：`lyrics`（数据库已有）、`file`（本机选择的文件）、`name`（曲名）。
 * 返回 `{ lrc, source, parsed }`，全都没找到时返回 `{ lrc: '', source: '', parsed: null }`。
 *
 * 注意这里不写数据库：自动匹配的结果由调用方决定要不要存（登录用户存，访客只放本机）。
 */
export async function resolveLyrics(track, { proxyUrl = '', duration = 0, allowNetwork = true } = {}) {
  // 1. 数据库里已经存好的
  if (track?.lyrics && String(track.lyrics).trim()) {
    const lrc = String(track.lyrics).trim()
    return { lrc, source: track.lyricsSource || 'saved', parsed: parseLrc(lrc) }
  }
  // 2. 音频文件内嵌的歌词
  if (track?.file) {
    const embedded = await readEmbeddedLyrics(track.file)
    if (embedded) return { lrc: embedded, source: 'embedded', parsed: parseLrc(embedded) }
  }
  // 3./4. 在线匹配
  if (allowNetwork && networkEnabled) {
    const info = guessTrackInfo(track?.name || track?.title || '')
    const artist = track?.artist || info.artist
    const title = track?.title || info.searchTitle
    const online = await fetchFromLrclib({ title, artist, album: track?.albumName, duration })
      || await fetchFromChineseSource({ title, artist }, proxyUrl)
    if (online?.lrc) return { ...online, parsed: parseLrc(online.lrc) }
  }
  return { lrc: '', source: '', parsed: null }
}

/** 来源 → 界面上显示的那行小字。 */
export const LYRICS_SOURCE_LABELS = {
  saved: '已保存的歌词',
  manual: '手动粘贴',
  embedded: '来自音频文件内嵌歌词',
  lrclib: '来自 LRCLIB 自动匹配',
  netease: '来自中文歌词源自动匹配',
}
