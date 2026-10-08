/**
 * 把 supabase/schema.sql 逐条语句执行到 Supabase 项目上。
 *
 * 用法（在仓库根目录执行）：
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'; node supabase/apply.mjs
 *
 * 为什么要逐条：官方 Management API 在整份脚本一起提交时可能只回一个空的 400，
 * 逐条执行才能确切知道是哪一句失败、失败原因是什么。
 * 语句切分认得 $$ ... $$ 这种 dollar-quoted 函数体和单引号字符串，不会在中间断开。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF || 'ossnacjetutqihbbvoau'
if (!token) {
  console.error('缺少 SUPABASE_ACCESS_TOKEN')
  process.exit(2)
}

/** 按分号切分 SQL，跳过 $$ 函数体、单引号字符串和注释。 */
function splitStatements(sql) {
  const out = []
  let current = ''
  let i = 0
  let inSingle = false
  let inDollar = false
  let inLineComment = false
  let inBlockComment = false

  while (i < sql.length) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      current += ch
      if (ch === '\n') inLineComment = false
      i++
      continue
    }
    if (inBlockComment) {
      current += ch
      if (ch === '*' && next === '/') { current += next; i += 2; inBlockComment = false; continue }
      i++
      continue
    }
    if (!inSingle && !inDollar && ch === '-' && next === '-') { current += ch + next; i += 2; inLineComment = true; continue }
    if (!inSingle && !inDollar && ch === '/' && next === '*') { current += ch + next; i += 2; inBlockComment = true; continue }
    if (!inDollar && ch === "'") { inSingle = !inSingle; current += ch; i++; continue }
    if (!inSingle && ch === '$' && next === '$') { inDollar = !inDollar; current += '$$'; i += 2; continue }
    if (!inSingle && !inDollar && ch === ';') {
      if (current.trim()) out.push(current.trim())
      current = ''
      i++
      continue
    }
    current += ch
    i++
  }
  if (current.trim()) out.push(current.trim())
  return out
}

const sql = readFileSync(join(here, 'schema.sql'), 'utf8')
const statements = splitStatements(sql)
console.log(`共切分出 ${statements.length} 条语句\n`)

let ok = 0
let failed = 0
for (const [index, statement] of statements.entries()) {
  const label = statement.replace(/\s+/g, ' ').slice(0, 72)
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: statement }),
    })
    const text = await response.text()
    if (!response.ok) {
      failed++
      console.log(`❌ [${index + 1}/${statements.length}] ${label}`)
      console.log(`   HTTP ${response.status} ${text}\n`)
    } else {
      ok++
      console.log(`✅ [${index + 1}/${statements.length}] ${label}`)
    }
  } catch (error) {
    failed++
    console.log(`❌ [${index + 1}/${statements.length}] ${label}`)
    console.log(`   请求异常：${error.message}\n`)
  }
}

console.log(`\n完成：成功 ${ok} 条，失败 ${failed} 条`)
process.exit(failed === 0 ? 0 : 1)
