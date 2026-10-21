#!/usr/bin/env node
// 测一下模型网关和 key 还能不能用——免费 key 会过期，先用这个脚本确认，比在页面里反复导入快。
//
// 只读环境变量，不读仓库里的任何文件（key 不该落盘）：
//   STUDY_AI_KEY   必填
//   STUDY_AI_URL   可选，默认 https://api.chatanywhere.tech/v1
//   STUDY_AI_MODEL 可选，默认 gpt-4o-mini
//
// 用法（PowerShell）：
//   $env:STUDY_AI_KEY='sk-...'; node scripts/check-study-ai.mjs
// 用法（bash）：
//   STUDY_AI_KEY=sk-... node scripts/check-study-ai.mjs
//
// 只用 Node 内置能力（fetch / process），不加依赖——和其它自检脚本同一条规矩。

const key = process.env.STUDY_AI_KEY || ''
const base = (process.env.STUDY_AI_URL || 'https://api.chatanywhere.tech/v1').replace(/\/$/, '')
const model = process.env.STUDY_AI_MODEL || 'gpt-4o-mini'

if (!key) {
  console.error('缺少 STUDY_AI_KEY。先设置环境变量再跑：')
  console.error("  PowerShell: $env:STUDY_AI_KEY='sk-...'; node scripts/check-study-ai.mjs")
  process.exit(1)
}

const started = Date.now()
let response
try {
  response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 24,
      messages: [{ role: 'user', content: '只回复两个字：可用' }],
    }),
  })
} catch (error) {
  console.error(`连不上网关：${error.message}`)
  process.exit(1)
}

const elapsed = Date.now() - started
const body = await response.text()

if (!response.ok) {
  const hint = response.status === 401 || response.status === 403
    ? 'key 无效或已过期：去 chatanywhere/GPT_API_free 项目页重新领一个'
    : response.status === 429
      ? '免费额度/频率限制：等一分钟再试'
      : response.status === 404
        ? '网关地址或模型名不对：检查 STUDY_AI_URL / STUDY_AI_MODEL'
        : '网关返回错误'
  console.error(`✗ HTTP ${response.status} · ${hint}`)
  console.error(body.slice(0, 400))
  process.exit(1)
}

let text = ''
try {
  const data = JSON.parse(body)
  text = data?.choices?.[0]?.message?.content || ''
} catch (error) {
  console.error('响应不是 JSON，网关可能不是 OpenAI 兼容格式：')
  console.error(body.slice(0, 400))
  process.exit(1)
}

console.log(`✓ 可用 · ${model} · ${elapsed}ms`)
if (text) console.log(`  模型回复：${text.trim().slice(0, 60)}`)
console.log('  下一步：把同一个 key 写进 Supabase secrets（换 key 不需要重新部署函数）')
