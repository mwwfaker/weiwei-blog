// End-to-end check against a RUNNING API backed by real MySQL (production profile: Flyway enabled,
// ddl-auto=validate). Everything here is executed over HTTP, not reasoned about.
//
//   Start the API first, then:
//     node verify-backend-e2e.mjs
//     API_BASE_URL=http://127.0.0.1:8080 node verify-backend-e2e.mjs
//
// The database is not reset, so the assertions hold on a database that already contains rows from
// earlier runs.
const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080'
let passed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`) }
}

async function call(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
  return { status: res.status, json, text, res }
}

const email = `e2e-${Date.now()}@example.com`
const password = 'a-long-enough-password'
// Titles carry a per-run token so assertions hold even though the database is not reset between runs.
const run = `#${Date.now()}`
const PRIVATE_TITLE = `私密的一天 ${run}`
const PUBLIC_TITLE = `公开的一天 ${run}`
const ARTICLE_TITLE = `把生活调成喜欢的亮度 ${run}`

console.log('[live API] health and public surface')
{
  const health = await call('/actuator/health')
  check('GET /actuator/health is reachable anonymously', health.status === 200, `status=${health.status}`)
  check('health reports UP', health.json?.status === 'UP', health.text?.slice(0, 80))

  const anon = await call('/api/diaries')
  check('GET /api/diaries without a token is 401', anon.status === 401, `status=${anon.status}`)
}

console.log('\n[live API] register / login / JWT')
let token
let otherToken
{
  const reg = await call('/api/auth/register', { method: 'POST', body: { email, password, displayName: '唯唯' } })
  check('POST /api/auth/register returns 200', reg.status === 200, `status=${reg.status} ${reg.text?.slice(0, 120)}`)
  check('register returns a non-empty accessToken', typeof reg.json?.accessToken === 'string' && reg.json.accessToken.length > 20)
  check('register returns tokenType Bearer', reg.json?.tokenType === 'Bearer')
  token = reg.json?.accessToken

  const me = await call('/api/account/me', { token })
  check('GET /api/account/me accepts the issued token', me.status === 200, `status=${me.status}`)
  check('account email round-trips', me.json?.email === email)
  check('account displayName round-trips (non-ASCII)', me.json?.displayName === '唯唯')
  check('account exposes bio and avatarUrl fields', 'bio' in (me.json || {}) && 'avatarUrl' in (me.json || {}))

  const login = await call('/api/auth/login', { method: 'POST', body: { email, password } })
  check('POST /api/auth/login returns 200', login.status === 200, `status=${login.status}`)
  check('login returns a usable token', typeof login.json?.accessToken === 'string')

  const wrong = await call('/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password-here' } })
  check('wrong password is 401', wrong.status === 401, `status=${wrong.status}`)

  const dup = await call('/api/auth/register', { method: 'POST', body: { email, password, displayName: '唯唯' } })
  check('duplicate registration is 409', dup.status === 409, `status=${dup.status}`)

  const short = await call('/api/auth/register', { method: 'POST', body: { email: `x-${Date.now()}@e.com`, password: 'short', displayName: 'x' } })
  check('too-short password is 400', short.status === 400, `status=${short.status}`)
}

console.log('\n[live API] profile update keeps a media: reference')
{
  const put = await call('/api/account/me', { method: 'PUT', token, body: { displayName: '唯唯', bio: '喜欢记录日常', avatarUrl: 'media:1' } })
  check('PUT /api/account/me returns 200', put.status === 200, `status=${put.status} ${put.text?.slice(0, 120)}`)
  check('bio persisted', put.json?.bio === '喜欢记录日常')
  check('media: reference persisted verbatim', put.json?.avatarUrl === 'media:1')

  const reread = await call('/api/account/me', { token })
  check('bio survives a re-read', reread.json?.bio === '喜欢记录日常')
}

console.log('\n[live API] diaries, visibility and ownership')
{
  const priv = await call('/api/diaries', { method: 'POST', token, body: { title: PRIVATE_TITLE, entryDate: '2026-09-30', mood: '平静', weather: '☀️', visibility: 'PRIVATE', tags: '日常', content: '只有我能看到。' } })
  check('POST /api/diaries returns 201', priv.status === 201, `status=${priv.status} ${priv.text?.slice(0, 120)}`)
  check('4-byte emoji weather stored and returned', priv.json?.weather === '☀️', JSON.stringify(priv.json?.weather))
  check('entryDate round-trips as ISO', priv.json?.entryDate === '2026-09-30')

  const pub = await call('/api/diaries', { method: 'POST', token, body: { title: PUBLIC_TITLE, entryDate: '2026-09-29', mood: '开心', weather: '☀️', visibility: 'PUBLIC', tags: '旅行,海边', content: '给访客看。' } })
  check('second diary created', pub.status === 201)

  const mine = await call('/api/diaries', { token })
  const titles = (mine.json || []).map((d) => d.title)
  check("owner sees this run's diaries", titles.includes(PRIVATE_TITLE) && titles.includes(PUBLIC_TITLE), `count=${titles.length}`)

  const feed = await call('/api/public/diaries')
  const feedTitles = (feed.json || []).map((d) => d.title)
  check('public feed is reachable anonymously', feed.status === 200)
  check('public feed contains the PUBLIC diary', feedTitles.includes(PUBLIC_TITLE))
  check('public feed excludes the PRIVATE diary', !feedTitles.includes(PRIVATE_TITLE))
  check('public feed exposes nothing but PUBLIC rows', (feed.json || []).every((d) => d.visibility === 'PUBLIC'))

  // A second account must not reach the first account's rows.
  const otherEmail = `e2e-other-${Date.now()}@example.com`
  const otherReg = await call('/api/auth/register', { method: 'POST', body: { email: otherEmail, password, displayName: '别人' } })
  otherToken = otherReg.json?.accessToken
  check('second account registered', otherReg.status === 200)

  const otherList = await call('/api/diaries', { token: otherToken })
  check('second account sees an empty library', otherList.json?.length === 0, `length=${otherList.json?.length}`)

  const targetId = priv.json?.id
  const steal = await call(`/api/diaries/${targetId}`, { token: otherToken })
  check("second account cannot GET the first account's diary (404)", steal.status === 404, `status=${steal.status}`)
  const stealDelete = await call(`/api/diaries/${targetId}`, { method: 'DELETE', token: otherToken })
  check("second account cannot DELETE it (404)", stealDelete.status === 404, `status=${stealDelete.status}`)

  // The owner can still update and delete their own row.
  const ownUpdate = await call(`/api/diaries/${targetId}`, { method: 'PUT', token, body: { title: PRIVATE_TITLE, entryDate: '2026-09-30', mood: '期待', weather: '☀️', visibility: 'PRIVATE', tags: '日常', content: '改过了。' } })
  check('owner can update their own diary', ownUpdate.status === 200 && ownUpdate.json?.mood === '期待', `status=${ownUpdate.status}`)
  const ownDelete = await call(`/api/diaries/${targetId}`, { method: 'DELETE', token })
  check('owner can delete their own diary (204)', ownDelete.status === 204, `status=${ownDelete.status}`)
  const gone = await call(`/api/diaries/${targetId}`, { token })
  check('deleted diary is really gone (404)', gone.status === 404, `status=${gone.status}`)
}

console.log('\n[live API] articles and validation')
{
  const ok = await call('/api/articles', { method: 'POST', token, body: { title: ARTICLE_TITLE, category: '慢生活', visibility: 'PUBLIC', tags: '日常,慢生活', excerpt: '留白也是答案。', content: '正文内容。', coverUrl: '', articleDate: '2026-09-18' } })
  check('POST /api/articles returns 201', ok.status === 201, `status=${ok.status} ${ok.text?.slice(0, 120)}`)
  check('articleDate round-trips', ok.json?.articleDate === '2026-09-18')
  check('tags round-trip as a comma-joined string', ok.json?.tags === '日常,慢生活', JSON.stringify(ok.json?.tags))

  const feed = await call('/api/public/articles')
  check('public article feed is reachable anonymously', feed.status === 200)
  check('public feed contains the article', (feed.json || []).some((a) => a.title === ARTICLE_TITLE))

  const bad = await call('/api/articles', { method: 'POST', token, body: { title: '坏日期', category: '日常', visibility: 'PUBLIC', tags: '日常', excerpt: '', content: '正文', coverUrl: '', articleDate: '2026/09/18' } })
  check('malformed articleDate is rejected with 400', bad.status === 400, `status=${bad.status}`)

  const articleId = ok.json?.id
  const del = await call(`/api/articles/${articleId}`, { method: 'DELETE', token })
  check('owner can delete their own article (204)', del.status === 204, `status=${del.status}`)
}

console.log('\n[live API] 绩效工作区：公开可读、写入仍需登录、账号之间互不影响')
{
  const memberId = `m-${Date.now()}`
  const workspace = {
    queues: [{ id: '图片', name: '图片', kpi: 884 }],
    members: [{ id: memberId, name: '甲', email: 'jia@example.com', queue: '图片', requiredHours: 132.94, transferHours: 0, overtimeHours: 0, tripleHours: 0 }],
    entries: [{ id: `e-${Date.now()}`, memberId, queue: '图片', actualAht: 27.7, auditCount: 7167, tripleCount: 0 }],
  }

  const anonWrite = await call('/api/perf/workspace', { method: 'PUT', body: workspace })
  check('anonymous PUT /api/perf/workspace is 401 (写仍要登录)', anonWrite.status === 401, `status=${anonWrite.status}`)

  const anonRead = await call('/api/perf/workspace')
  check('anonymous GET /api/perf/workspace is still 401 (个人读写接口不变)', anonRead.status === 401, `status=${anonRead.status}`)

  const save = await call('/api/perf/workspace', { method: 'PUT', token, body: workspace })
  check('owner can save the workspace', save.status === 200, `status=${save.status} ${save.text?.slice(0, 120)}`)

  const publicRead = await call('/api/public/perf/workspaces')
  check('GET /api/public/perf/workspaces 匿名可达', publicRead.status === 200, `status=${publicRead.status}`)
  check('公开列表是数组', Array.isArray(publicRead.json), typeof publicRead.json)
  const mine = (publicRead.json || []).find((w) => w.ownerName === '唯唯' || (w.members || []).some((m) => m.id === memberId))
  check('公开列表里能找到刚保存的那份工作区', Boolean(mine), JSON.stringify(publicRead.json)?.slice(0, 160))
  check('公开列表带上了 ownerId 与 ownerName', Number.isInteger(mine?.ownerId) && typeof mine?.ownerName === 'string', JSON.stringify({ ownerId: mine?.ownerId, ownerName: mine?.ownerName }))
  check('队列字段完整', (mine?.queues || []).some((q) => q.name === '图片' && q.kpi === 884), JSON.stringify(mine?.queues))
  check('明细字段完整', (mine?.entries || []).some((e) => e.memberId === memberId && e.auditCount === 7167), JSON.stringify(mine?.entries))

  // 第二个账号保存自己的那一份，不应该动到第一个账号的数据。
  const other = await call('/api/perf/workspace', { method: 'PUT', token: otherToken, body: {
    queues: [{ id: '文本', name: '文本', kpi: 500 }],
    members: [{ id: 'm-other', name: '乙', email: 'yi@example.com', queue: '文本', requiredHours: 100, transferHours: 0, overtimeHours: 0, tripleHours: 0 }],
    entries: [],
  } })
  check('second account can save its own workspace', other.status === 200, `status=${other.status}`)

  const after = await call('/api/public/perf/workspaces')
  const stillMine = (after.json || []).find((w) => (w.members || []).some((m) => m.id === memberId))
  check('另一个账号写入后，第一份工作区原样还在（互不干扰）', Boolean(stillMine), JSON.stringify(after.json)?.slice(0, 200))
  check('两个账号的工作区都在公开列表里', (after.json || []).length >= 2, `count=${(after.json || []).length}`)
}

console.log('\n[live API] CORS on a preflight from the frontend origin')
{
  const preflight = await fetch(BASE + '/api/diaries', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  })
  const allowOrigin = preflight.headers.get('access-control-allow-origin')
  check('preflight succeeds', preflight.status === 200 || preflight.status === 204, `status=${preflight.status}`)
  check('exactly one Access-Control-Allow-Origin value', !!allowOrigin && !allowOrigin.includes(','), `value=${JSON.stringify(allowOrigin)}`)
  check('origin is allowed', allowOrigin === 'http://localhost:5173', `value=${JSON.stringify(allowOrigin)}`)
  check('Authorization header is permitted', (preflight.headers.get('access-control-allow-headers') || '').toLowerCase().includes('authorization'))
  check('PUT and DELETE are permitted', /put/i.test(preflight.headers.get('access-control-allow-methods') || '') && /delete/i.test(preflight.headers.get('access-control-allow-methods') || ''), preflight.headers.get('access-control-allow-methods'))
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { console.log('failed: ' + failures.join('; ')); process.exitCode = 1 }
