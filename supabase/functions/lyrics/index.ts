// 歌词中转：给浏览器一个能跨域调用的歌词接口。
//
// 为什么需要它：中文歌词覆盖最好的那个源（网易云）不返回 CORS 头，浏览器直连一定被拦；
// 而且它的接口需要带 Referer / Cookie，这些在浏览器里也设不了。放到服务端转发就都没问题。
//
// 部署：
//   supabase functions deploy lyrics --no-verify-jwt
// 然后把这个地址填进前端环境变量（.env.local 或仓库变量）：
//   VITE_LYRICS_PROXY=https://<你的项目 ref>.supabase.co/functions/v1/lyrics
// 没配的话前端会跳过这条源，只用 LRCLIB + 手动粘贴，不会报错。
//
// 调用约定（前端的 services/lyrics.js 就是按这个来的）：
//   GET  ?title=晴天&artist=周杰伦
//   200  { "lrc": "[00:12.34]…", "source": "netease" }
//   404  { "error": "没有匹配到歌词" }
//
// 先说清楚：网易云的接口不是公开 API，随时可能改。所以这里把 LRCLIB 也放在后面兜底——
// 万一哪天中文源挂了，这个中转至少还能返回一份能用的歌词，而不是整个失效。

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 装成浏览器访问，否则网易云会返回空结果。
const NETEASE_HEADERS = {
  'Referer': 'https://music.163.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
  'Cookie': 'appver=2.0.2',
  'Accept': 'application/json, text/plain, */*',
}

const TIMEOUT = 8000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 网易云搜索 → 取第一个结果的 id。 */
async function searchNetease(keyword) {
  const url = `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=5`
  const response = await fetchWithTimeout(url, { headers: NETEASE_HEADERS })
  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  const song = data?.result?.songs?.[0]
  return song?.id ? { id: song.id, name: song.name, artists: (song.artists || []).map((a) => a.name).join(' / ') } : null
}

/** 按 song id 取歌词，优先带时间轴的 lrc。 */
async function lyricNetease(id) {
  const url = `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`
  const response = await fetchWithTimeout(url, { headers: NETEASE_HEADERS })
  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  const lrc = data?.lrc?.lyric || ''
  // 纯占位（"纯音乐，请欣赏"）不如不给，交给后面的源。
  if (!lrc.trim() || /^\[00:00(\.0+)?\]\s*(纯音乐|此歌曲为没有填词的纯音乐)/.test(lrc.trim())) return null
  return lrc.trim()
}

/** 兜底：LRCLIB，免费且不需要 key，中文歌覆盖一般但胜在稳定。 */
async function lyricLrclib(title, artist) {
  const exact = new URLSearchParams({ track_name: title })
  if (artist) exact.set('artist_name', artist)
  const attempts = [
    `https://lrclib.net/api/get?${exact}`,
    `https://lrclib.net/api/search?q=${encodeURIComponent([artist, title].filter(Boolean).join(' '))}`,
  ]
  for (const url of attempts) {
    try {
      const response = await fetchWithTimeout(url)
      if (!response.ok) continue
      const data = await response.json()
      const list = Array.isArray(data) ? data : [data]
      for (const item of list) {
        const lrc = item?.syncedLyrics || item?.plainLyrics
        if (lrc && lrc.trim()) return lrc.trim()
      }
    } catch { /* 换下一个地址 */ }
  }
  return null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(request.url)
  let title = url.searchParams.get('title') || ''
  let artist = url.searchParams.get('artist') || ''

  // 也接受 POST，方便以后传更多字段（专辑、时长）而不改地址格式。
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}))
    title = String(body.title || title)
    artist = String(body.artist || artist)
  }

  title = title.trim()
  artist = artist.trim()
  if (!title) return json({ error: '缺少 title' }, 400)

  const keyword = [title, artist].filter(Boolean).join(' ')

  try {
    const found = await searchNetease(keyword)
    if (found) {
      const lrc = await lyricNetease(found.id)
      if (lrc) return json({ lrc, source: 'netease', matched: found.name })
    }
  } catch { /* 中文源不可用就走兜底 */ }

  try {
    const lrc = await lyricLrclib(title, artist)
    if (lrc) return json({ lrc, source: 'lrclib', via: 'proxy' })
  } catch { /* 两条源都没命中 */ }

  return json({ error: '没有匹配到歌词' }, 404)
})
