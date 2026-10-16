/**
 * 数据库结构与代码是否对得上 —— **只读检查，不需要任何机密**。
 *
 * 为什么单独有一个脚本：前端手里那把 anon key 是设计上就要公开的（它会打进前端产物发给
 * 每个访客），所以它**能**证明"表存在不存在"，但**不能**建表。这就把两件事分开了：
 *   · 应用结构 → supabase/apply.mjs（需要管理令牌，走 GitHub Actions 或本地跑）
 *   · 检查结构 → 这个脚本（只要有公开的 anon key，随时能跑、本地也能跑）
 *
 * 判据：PostgREST 对"存在但你没有可见行"的表返回 `200 []`，对**不存在**的表返回
 * `404 PGRST205`，对**不存在的列**返回 `400`。所以"能不能读到行"在这里不影响判断，
 * 看的是状态码本身。
 *
 * 用法（在仓库根目录）：
 *   node supabase/verify-schema.mjs
 * 配置来源（按优先级）：环境变量 SUPABASE_URL / SUPABASE_ANON_KEY →
 *   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY → frontend/.env.local 里同名的那两条。
 * 本地直接跑不用设任何东西（.env.local 里已经有那两个公开值）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** 从 .env 风格的文本里取键值。够用就行：只认 KEY=VALUE，忽略注释和引号。 */
function readEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const fileEnv = readEnvFile(join(here, '..', 'frontend', '.env.local'))
const pick = (...names) => {
  for (const name of names) if (process.env[name]) return process.env[name]
  for (const name of names) if (fileEnv[name]) return fileEnv[name]
  return ''
}

const url = pick('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/+$/, '')
const anonKey = pick('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')

if (!url || !anonKey) {
  console.error('缺少 SUPABASE_URL / SUPABASE_ANON_KEY（也可以让 frontend/.env.local 里存在 VITE_ 那两个）')
  process.exit(2)
}

/** 代码跑起来需要的表。加表时这里也要加一行，否则"新表没建"不会被发现。 */
const TABLES = [
  'profiles',
  'diary_entries',
  'blog_articles',
  'media_assets',
  'photo_albums',
  'perf_queues',
  'perf_members',
  'perf_entries',
]

/**
 * 后加的列没法单独探测，只能连着表一起查一次：PostgREST 遇到不存在的列会回 400。
 * 加新列时在这里补一行，否则"列没加"同样不会被发现。
 */
const COLUMN_SETS = [
  { table: 'media_assets', columns: ['album_id', 'description'], why: '照片的所属相册与描述' },
  { table: 'media_assets', columns: ['lyrics', 'lyrics_source'], why: '歌词原文与来源' },
]

async function probe(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  })
  const body = await res.text()
  return { status: res.status, body: body.slice(0, 200) }
}

let failed = 0
const line = (ok, label, detail) => {
  if (!ok) failed += 1
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? `  ${detail}` : ''}`)
}

console.log(`数据库结构检查：${url}\n`)

console.log('表：')
for (const table of TABLES) {
  const { status, body } = await probe(`${table}?select=*&limit=1`)
  if (status === 200) line(true, table)
  else if (status === 404) line(false, table, '表不存在 —— 需要执行 supabase/schema.sql')
  else if (status === 401 || status === 403) line(false, table, `密钥被拒绝（${status}）`)
  else line(false, table, `HTTP ${status} ${body}`)
}

console.log('\n后加的列：')
for (const item of COLUMN_SETS) {
  const { status, body } = await probe(`${item.table}?select=${item.columns.join(',')}&limit=1`)
  const label = `${item.table}(${item.columns.join(', ')})`
  if (status === 200) line(true, label, item.why)
  else line(false, label, `HTTP ${status} ${body}`)
}

if (failed) {
  console.log(`\n${failed} 处对不上。执行结构变更：`)
  console.log('  · 本地（需要 SUPABASE_ACCESS_TOKEN）：$env:SUPABASE_ACCESS_TOKEN=\'sbp_...\'; node supabase/apply.mjs')
  console.log('  · 或推送 supabase/schema.sql —— GitHub Actions 的 "Apply database schema" 会自动执行')
  process.exit(1)
}
console.log('\n全部到位。')
