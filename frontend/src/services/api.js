/**
 * 前端与后端之间的唯一接口层。
 *
 * 这里原来是一个 REST 客户端（请求 Java 后端的 `/api/**`）。现在后端换成了 Supabase：
 * 账号用 Supabase Auth、数据用 Postgres、图片音乐用 Storage。
 *
 * **对外的函数签名完全没变**：仍然是 `request('/api/diaries', { token, method, body })`，
 * 所以 App.vue、perfApi.js 那些调用点一行都不用改。内部改成了「把这个路径翻译成
 * 对 Supabase 的一次操作」，等于在前端内置了一个小小的后端模拟器。
 *
 * 访问控制不在这里做，而是在数据库的 RLS 策略里（见 supabase/schema.sql）：
 * 前端即使被改坏，也读不到别人的私密数据。
 */
import { createClient } from '@supabase/supabase-js'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {}
const SUPABASE_URL = env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || ''

/** 对象存储桶名，和 supabase/schema.sql 里的存储策略对应。 */
export const MEDIA_BUCKET = 'weiwei-media'
/** 签名链接有效期（秒），和原来后端的 1 小时一致。 */
const LINK_TTL = 3600
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg',
  'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/flac', 'audio/x-flac',
])
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const AUDIO_EXTENSIONS = {
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm',
  'audio/flac': 'flac', 'audio/x-flac': 'flac',
}

/** 没配置 Supabase 时整个接口层不可用，页面会自动退回「本机预览」模式。 */
export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/**
 * 没配置时给一个哑对象而不是 null，避免每个调用点都要判空；
 * 所有操作会明确报「未配置后端」，而不是静默失败。
 */
export const supabase = backendConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'weiwei-blog-auth' },
    })
  : null

// ---------------------------------------------------------------- 工具

function fail(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

function notConfigured() {
  return fail('尚未配置后端：请在仓库变量里设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY', 503)
}

function parseBody(body) {
  if (body == null) return {}
  if (typeof body === 'string') {
    if (!body.trim()) return {}
    try { return JSON.parse(body) } catch { throw fail('请求内容不是合法 JSON') }
  }
  return body
}

/** Supabase 的错误对象转成前端熟悉的 Error（带 status）。 */
function unwrap(result, { notFoundMessage } = {}) {
  if (result.error) {
    const code = result.error.code || ''
    if (code === 'PGRST116') throw fail(notFoundMessage || '记录不存在', 404)
    if (code === '23505') throw fail('这条记录已存在', 409)
    if (code === '42501' || /row-level security/i.test(result.error.message || '')) {
      throw fail('没有权限操作这条数据（可能不是你的内容）', 403)
    }
    throw fail(result.error.message || '数据库操作失败', 400)
  }
  return result.data
}

async function requireUser() {
  if (!supabase) throw notConfigured()
  const { data } = await supabase.auth.getUser()
  if (!data?.user) throw fail('登录状态已失效，请重新登录', 401)
  return data.user
}

function nowIso() { return new Date().toISOString() }

// ---------------------------------------------------------------- 行 → 接口返回形状
// 前端各处（App.vue 的 mapDiary / mapArticle / mapMedia）期望的是驼峰字段，
// 数据库里是下划线命名，转换集中放在这里。

const diaryView = (row) => ({
  id: row.id, title: row.title, entryDate: row.entry_date, mood: row.mood, weather: row.weather,
  visibility: row.visibility, tags: row.tags, content: row.content,
  ownerId: row.owner_id, createdAt: row.created_at, updatedAt: row.updated_at,
})

const articleView = (row) => ({
  id: row.id, title: row.title, category: row.category, visibility: row.visibility, tags: row.tags,
  excerpt: row.excerpt, content: row.content, coverUrl: row.cover_url, articleDate: row.article_date,
  ownerId: row.owner_id, createdAt: row.created_at, updatedAt: row.updated_at,
})

const mediaView = (row, url) => ({
  id: row.id, kind: row.kind, title: row.title, objectKey: row.object_key, contentType: row.content_type,
  visibility: row.visibility, url: url || row.object_key, albumName: row.album_name,
  ownerId: row.owner_id, createdAt: row.created_at,
})

const queueView = (row) => ({ id: row.client_id, name: row.name, kpi: row.kpi })
const memberView = (row) => ({
  id: row.client_id, name: row.name, email: row.email, queue: row.queue_name,
  requiredHours: row.required_hours, transferHours: row.transfer_hours,
  overtimeHours: row.overtime_hours, tripleHours: row.triple_hours,
})
const entryView = (row) => ({
  id: row.client_id, memberId: row.member_client_id, queue: row.queue_name,
  actualAht: row.actual_aht, auditCount: row.audit_count, tripleCount: row.triple_count,
})

// ---------------------------------------------------------------- 媒体签名链接
// MUSIC_URL 是外部直链，原样返回；其余都在私有桶里，需要短期签名链接。

async function signMediaRows(rows) {
  const paths = rows.filter((row) => row.kind !== 'MUSIC_URL').map((row) => row.object_key)
  const signed = new Map()
  if (paths.length) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, LINK_TTL)
    for (const item of data || []) {
      if (item?.path && item?.signedUrl) signed.set(item.path, item.signedUrl)
    }
  }
  return rows.map((row) => mediaView(row, signed.get(row.object_key) || ''))
}

// ---------------------------------------------------------------- 账号

function authResponse(session, user) {
  return {
    accessToken: session?.access_token || '',
    tokenType: 'Bearer',
    expiresIn: session?.expires_in || LINK_TTL,
    id: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name || '',
  }
}

function translateAuthError(error, fallback) {
  const message = String(error?.message || '')
  if (/Invalid login credentials/i.test(message)) return '邮箱或密码不正确'
  if (/User already registered/i.test(message)) return '这个邮箱已经注册过了'
  if (/Password should be at least/i.test(message)) return '密码至少 6 位'
  if (/Email not confirmed/i.test(message)) return '邮箱还没验证：去邮箱点确认链接，或在 Supabase 控制台关闭邮箱验证'
  if (/rate limit|too many/i.test(message)) return '操作太频繁，请稍后再试'
  return message || fallback
}

async function loadProfile(user) {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, bio, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
  return {
    id: user.id,
    email: user.email,
    displayName: data?.display_name || user.user_metadata?.display_name || '',
    bio: data?.bio || '',
    avatarUrl: data?.avatar_url || null,
  }
}

// ---------------------------------------------------------------- 绩效

async function loadPerfWorkspace(ownerId) {
  const [queues, members, entries] = await Promise.all([
    supabase.from('perf_queues').select('*').eq('owner_id', ownerId).order('sort_order'),
    supabase.from('perf_members').select('*').eq('owner_id', ownerId).order('sort_order'),
    supabase.from('perf_entries').select('*').eq('owner_id', ownerId).order('id'),
  ])
  return {
    queues: (unwrap(queues) || []).map(queueView),
    members: (unwrap(members) || []).map(memberView),
    entries: (unwrap(entries) || []).map(entryView),
  }
}

// ---------------------------------------------------------------- 路由表

const routes = [
  // ---- 认证 ----
  ['POST', /^\/api\/auth\/register$/, async ({ body }) => {
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const displayName = String(body.displayName || '').trim()
    if (!email || !password) throw fail('邮箱和密码都要填')
    if (password.length < 10) throw fail('密码至少 10 位')
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { display_name: displayName } },
    })
    if (error) throw fail(translateAuthError(error, '注册失败'), 400)
    // 邮箱已存在时 Supabase 不报错，只返回一个没有 identities 的假用户
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw fail('这个邮箱已经注册过了', 409)
    }
    if (!data.session) {
      throw fail('注册成功，但 Supabase 要求先验证邮箱。请到 Authentication → Sign In / Providers → Email 关掉 "Confirm email"，再重新注册。', 400)
    }
    return authResponse(data.session, data.user)
  }],

  ['POST', /^\/api\/auth\/login$/, async ({ body }) => {
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw fail(translateAuthError(error, '登录失败'), 401)
    return authResponse(data.session, data.user)
  }],

  // ---- 账号资料 ----
  ['GET', /^\/api\/account\/me$/, async () => loadProfile(await requireUser())],

  ['PUT', /^\/api\/account\/me$/, async ({ body }) => {
    const user = await requireUser()
    const row = {
      id: user.id,
      display_name: String(body.displayName ?? '').trim(),
      bio: String(body.bio ?? ''),
      avatar_url: body.avatarUrl ?? null,
    }
    unwrap(await supabase.from('profiles').upsert(row, { onConflict: 'id' }))
    return loadProfile(user)
  }],

  // ---- 日记 ----
  ['GET', /^\/api\/diaries$/, async () => {
    const user = await requireUser()
    const rows = unwrap(await supabase.from('diary_entries').select('*')
      .eq('owner_id', user.id).order('entry_date', { ascending: false }).order('id', { ascending: false }))
    return (rows || []).map(diaryView)
  }],

  ['POST', /^\/api\/diaries$/, async ({ body }) => {
    const user = await requireUser()
    const row = {
      owner_id: user.id,
      title: String(body.title || '').trim(),
      entry_date: body.entryDate,
      mood: String(body.mood || ''),
      weather: String(body.weather || ''),
      visibility: body.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
      tags: String(body.tags || ''),
      content: String(body.content || ''),
    }
    const saved = unwrap(await supabase.from('diary_entries').insert(row).select().single())
    return diaryView(saved)
  }],

  ['GET', /^\/api\/diaries\/([^/]+)$/, async ({ params }) => {
    const user = await requireUser()
    const row = unwrap(await supabase.from('diary_entries').select('*')
      .eq('id', params[0]).eq('owner_id', user.id).maybeSingle(), { notFoundMessage: '日记不存在' })
    if (!row) throw fail('日记不存在', 404)
    return diaryView(row)
  }],

  ['PUT', /^\/api\/diaries\/([^/]+)$/, async ({ params, body }) => {
    const user = await requireUser()
    const patch = {
      title: String(body.title || '').trim(),
      entry_date: body.entryDate,
      mood: String(body.mood || ''),
      weather: String(body.weather || ''),
      visibility: body.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
      tags: String(body.tags || ''),
      content: String(body.content || ''),
      updated_at: nowIso(),
    }
    const row = unwrap(await supabase.from('diary_entries').update(patch)
      .eq('id', params[0]).eq('owner_id', user.id).select().maybeSingle(), { notFoundMessage: '日记不存在' })
    if (!row) throw fail('日记不存在', 404)
    return diaryView(row)
  }],

  ['DELETE', /^\/api\/diaries\/([^/]+)$/, async ({ params }) => {
    const user = await requireUser()
    unwrap(await supabase.from('diary_entries').delete().eq('id', params[0]).eq('owner_id', user.id))
    return undefined
  }],

  // ---- 文章 ----
  ['GET', /^\/api\/articles$/, async () => {
    const user = await requireUser()
    const rows = unwrap(await supabase.from('blog_articles').select('*')
      .eq('owner_id', user.id).order('article_date', { ascending: false }).order('id', { ascending: false }))
    return (rows || []).map(articleView)
  }],

  ['POST', /^\/api\/articles$/, async ({ body }) => {
    const user = await requireUser()
    const row = {
      owner_id: user.id,
      title: String(body.title || '').trim(),
      category: String(body.category || ''),
      visibility: body.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
      tags: String(body.tags || ''),
      excerpt: String(body.excerpt || ''),
      content: String(body.content || ''),
      cover_url: body.coverUrl || null,
      article_date: body.articleDate,
    }
    const saved = unwrap(await supabase.from('blog_articles').insert(row).select().single())
    return articleView(saved)
  }],

  ['GET', /^\/api\/articles\/([^/]+)$/, async ({ params }) => {
    const user = await requireUser()
    const row = unwrap(await supabase.from('blog_articles').select('*')
      .eq('id', params[0]).eq('owner_id', user.id).maybeSingle(), { notFoundMessage: '文章不存在' })
    if (!row) throw fail('文章不存在', 404)
    return articleView(row)
  }],

  ['PUT', /^\/api\/articles\/([^/]+)$/, async ({ params, body }) => {
    const user = await requireUser()
    const patch = {
      title: String(body.title || '').trim(),
      category: String(body.category || ''),
      visibility: body.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
      tags: String(body.tags || ''),
      excerpt: String(body.excerpt || ''),
      content: String(body.content || ''),
      cover_url: body.coverUrl || null,
      article_date: body.articleDate,
      updated_at: nowIso(),
    }
    const row = unwrap(await supabase.from('blog_articles').update(patch)
      .eq('id', params[0]).eq('owner_id', user.id).select().maybeSingle(), { notFoundMessage: '文章不存在' })
    if (!row) throw fail('文章不存在', 404)
    return articleView(row)
  }],

  ['DELETE', /^\/api\/articles\/([^/]+)$/, async ({ params }) => {
    const user = await requireUser()
    unwrap(await supabase.from('blog_articles').delete().eq('id', params[0]).eq('owner_id', user.id))
    return undefined
  }],

  // ---- 媒体 ----
  ['GET', /^\/api\/media$/, async () => {
    const user = await requireUser()
    const rows = unwrap(await supabase.from('media_assets').select('*')
      .eq('owner_id', user.id).order('created_at', { ascending: false }).order('id', { ascending: false }))
    return signMediaRows(rows || [])
  }],

  ['POST', /^\/api\/media$/, async ({ body }) => {
    const user = await requireUser()
    const row = {
      owner_id: user.id,
      kind: String(body.kind || 'IMAGE'),
      title: String(body.title || '').trim(),
      album_name: String(body.albumName || '日常').trim() || '日常',
      object_key: String(body.objectKey || ''),
      content_type: String(body.contentType || ''),
      visibility: body.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
    }
    if (!row.object_key) throw fail('缺少对象存储路径')
    const saved = unwrap(await supabase.from('media_assets').insert(row).select().single())
    return (await signMediaRows([saved]))[0]
  }],

  ['PUT', /^\/api\/media\/([^/]+)$/, async ({ params, body }) => {
    const user = await requireUser()
    const patch = { visibility: body.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE', updated_at: nowIso() }
    if (body.title != null) patch.title = String(body.title).trim()
    if (body.albumName != null) patch.album_name = String(body.albumName).trim() || '日常'
    const row = unwrap(await supabase.from('media_assets').update(patch)
      .eq('id', params[0]).eq('owner_id', user.id).select().maybeSingle(), { notFoundMessage: '媒体不存在' })
    if (!row) throw fail('媒体不存在', 404)
    return (await signMediaRows([row]))[0]
  }],

  ['DELETE', /^\/api\/media\/([^/]+)$/, async ({ params }) => {
    const user = await requireUser()
    const row = unwrap(await supabase.from('media_assets').select('object_key')
      .eq('id', params[0]).eq('owner_id', user.id).maybeSingle(), { notFoundMessage: '媒体不存在' })
    if (row?.object_key && !String(row.object_key).startsWith('http')) {
      // 对象删不掉不算失败：记录没了，页面就不该再显示它。
      await supabase.storage.from(MEDIA_BUCKET).remove([row.object_key])
    }
    unwrap(await supabase.from('media_assets').delete().eq('id', params[0]).eq('owner_id', user.id))
    return undefined
  }],

  // ---- 公开读取（不需要登录）----
  ['GET', /^\/api\/public\/diaries$/, async () => {
    const rows = unwrap(await supabase.from('diary_entries').select('*')
      .eq('visibility', 'PUBLIC').order('entry_date', { ascending: false }).order('id', { ascending: false }))
    return (rows || []).map(diaryView)
  }],

  ['GET', /^\/api\/public\/articles$/, async () => {
    const rows = unwrap(await supabase.from('blog_articles').select('*')
      .eq('visibility', 'PUBLIC').order('article_date', { ascending: false }).order('id', { ascending: false }))
    return (rows || []).map(articleView)
  }],

  ['GET', /^\/api\/public\/media$/, async () => {
    const rows = unwrap(await supabase.from('media_assets').select('*')
      .eq('kind', 'IMAGE').eq('visibility', 'PUBLIC').order('created_at', { ascending: false }))
    return signMediaRows(rows || [])
  }],

  ['GET', /^\/api\/public\/media\/music$/, async () => {
    const rows = unwrap(await supabase.from('media_assets').select('*')
      .in('kind', ['MUSIC', 'MUSIC_URL']).eq('visibility', 'PUBLIC').order('created_at', { ascending: false }))
    return signMediaRows(rows || [])
  }],

  // ---- 绩效 ----
  ['GET', /^\/api\/perf\/workspace$/, async () => {
    const user = await requireUser()
    return loadPerfWorkspace(user.id)
  }],

  ['PUT', /^\/api\/perf\/workspace$/, async ({ body }) => {
    const user = await requireUser()
    // 整份替换放到数据库函数里做，保证不会写一半（见 schema.sql 的 save_perf_workspace）。
    unwrap(await supabase.rpc('save_perf_workspace', {
      incoming_queues: body.queues || [],
      incoming_members: body.members || [],
      incoming_entries: body.entries || [],
    }))
    return loadPerfWorkspace(user.id)
  }],

  ['GET', /^\/api\/public\/perf\/workspaces$/, async () => {
    const [queues, members, entries, profiles] = await Promise.all([
      supabase.from('perf_queues').select('*').order('sort_order'),
      supabase.from('perf_members').select('*').order('sort_order'),
      supabase.from('perf_entries').select('*').order('id'),
      supabase.from('profiles').select('id, display_name'),
    ])
    const names = new Map((unwrap(profiles) || []).map((row) => [row.id, row.display_name]))
    const ownerIds = new Set()
    for (const list of [queues, members, entries]) {
      for (const row of unwrap(list) || []) ownerIds.add(row.owner_id)
    }
    return [...ownerIds].sort().map((ownerId) => ({
      ownerId,
      ownerName: names.get(ownerId) || '',
      queues: (unwrap(queues) || []).filter((r) => r.owner_id === ownerId).map(queueView),
      members: (unwrap(members) || []).filter((r) => r.owner_id === ownerId).map(memberView),
      entries: (unwrap(entries) || []).filter((r) => r.owner_id === ownerId).map(entryView),
    }))
  }],

  // ---- 对象存储 ----
  ['POST', /^\/api\/storage\/presign-download$/, async ({ body }) => {
    const key = String(body.key || '')
    if (!key) throw fail('缺少对象路径')
    if (String(key).startsWith('http')) return { url: key, expiresIn: LINK_TTL }
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(key, LINK_TTL)
    if (error) throw fail(error.message || '无法生成读取链接', 400)
    return { url: data?.signedUrl || '', expiresIn: LINK_TTL }
  }],
]

// ---------------------------------------------------------------- 对外入口

/**
 * 和改造前完全一样的调用方式：`request('/api/diaries', { token, method: 'POST', body })`。
 * `token` 参数为了兼容旧调用点保留，Supabase 客户端自己带着会话，不再需要显式传递。
 */
export async function request(path, { method = 'GET', body } = {}) {
  if (!supabase) throw notConfigured()
  const verb = String(method || 'GET').toUpperCase()
  const clean = String(path).split('?')[0].replace(/\/+$/, '') || '/'
  const payload = parseBody(body)

  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== verb) continue
    const match = pattern.exec(clean)
    if (!match) continue
    return handler({ params: match.slice(1), body: payload })
  }
  throw fail(`未实现的接口：${verb} ${clean}`, 501)
}

/**
 * 上传文件到对象存储，返回 `{ key, contentType }`。
 * 以前要先后端换签名链接再 PUT，现在前端拿着登录态直接传到自己的目录。
 */
export async function uploadMedia(file, token) {
  if (!supabase) throw notConfigured()
  const user = await requireUser()
  const contentType = String(file?.type || '').toLowerCase()
  if (!ALLOWED_TYPES.has(contentType)) throw fail('只支持常见图片与音频格式', 415)
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw fail('文件大小需在 30 MB 以内', 413)
  const extension = IMAGE_EXTENSIONS[contentType] || AUDIO_EXTENSIONS[contentType] || 'bin'
  const folder = contentType.startsWith('image/') ? 'images' : 'music'
  const unique = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const key = `users/${user.id}/${folder}/${unique}.${extension}`
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(key, file, { contentType, upsert: false })
  if (error) throw fail(error.message || '文件上传失败', 400)
  return { key, contentType }
}
