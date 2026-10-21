// 学习计划结构化：把一份文档的纯文本交给模型，返回固定 schema 的 JSON。
//
// 为什么放在 Edge Function 而不是前端：模型 key 不能进浏览器。这里用环境变量读，
// 前端只调用 `supabase.functions.invoke('study-normalize')`。
//
// 兼容 OpenAI 格式（DeepSeek / OpenAI / 其它兼容网关都行）：
//   STUDY_AI_URL   默认 https://api.deepseek.com/v1
//   STUDY_AI_KEY   必填
//   STUDY_AI_MODEL 默认 deepseek-chat
//
// 部署：
//   supabase functions deploy study-normalize
//   supabase secrets set STUDY_AI_KEY=sk-xxx
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, 'Content-Type': 'application/json' },
})

/** 只保留 prompt 里要求的结构，多余字段删掉，防止模型自由发挥把页面弄坏。 */
function normalizePlan(raw) {
  const text = (value) => String(value ?? '').trim()
  const list = (value) => (Array.isArray(value) ? value : [])
  const plan = raw && typeof raw === 'object' ? raw : {}
  const stages = list(plan.stages).map((stage) => ({
    title: text(stage.title),
    goal: text(stage.goal),
    duration: text(stage.duration),
    courses: list(stage.courses).map((course) => ({
      name: text(course.name),
      importance: Math.min(5, Math.max(1, Number(course.importance) || 3)),
      hours: text(course.hours),
      prerequisite: text(course.prerequisite),
      concepts: list(course.concepts).map(text).filter(Boolean).slice(0, 8),
      criteria: list(course.criteria).map(text).filter(Boolean).slice(0, 6),
      resources: list(course.resources)
        .map((item) => ({ title: text(item.title), url: text(item.url) }))
        .filter((item) => item.title || item.url)
        .slice(0, 6),
    })).filter((course) => course.name),
  })).filter((stage) => stage.title || stage.courses.length)

  return {
    title: text(plan.title) || '未命名学习计划',
    subtitle: text(plan.subtitle),
    summary: text(plan.summary),
    tags: list(plan.tags).map(text).filter(Boolean).slice(0, 8),
    totalHours: {
      low: Number(plan.totalHours?.low) || 0,
      high: Number(plan.totalHours?.high) || 0,
    },
    stages,
  }
}

const SCHEMA_HINT = `只输出 JSON，不要解释、不要 Markdown 代码块。结构：
{
  "title": "计划标题",
  "subtitle": "一句话说明",
  "summary": "两三句话概述这份计划适合谁、学完能做什么",
  "tags": ["标签1", "标签2"],
  "totalHours": { "low": 200, "high": 300 },
  "stages": [
    {
      "title": "阶段名",
      "goal": "这一阶段的目标（一两句）",
      "duration": "例如 3–5 个月",
      "courses": [
        {
          "name": "课程 / 模块名",
          "importance": 5,
          "hours": "30 小时",
          "prerequisite": "前置课程或基础",
          "concepts": ["核心概念1", "核心概念2"],
          "criteria": ["完成标准1", "完成标准2"],
          "resources": [{ "title": "资源名", "url": "https://..." }]
        }
      ]
    }
  ]
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: '只支持 POST' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const auth = req.headers.get('Authorization') || ''
  if (!auth) return json({ error: '需要登录后再整理' }, 401)
  // 校验调用者：匿名 key 也能调用函数，但这里要求一个真实用户，避免被当成免费代理。
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await client.auth.getUser()
  if (!user) return json({ error: '登录已过期，请重新登录' }, 401)

  let payload
  try {
    payload = await req.json()
  } catch (error) {
    return json({ error: '请求体不是 JSON' }, 400)
  }
  const content = String(payload?.text || '').slice(0, 60000)
  if (content.trim().length < 40) return json({ error: '文档内容太短，读不出结构' }, 400)

  const key = Deno.env.get('STUDY_AI_KEY') || ''
  // 默认接 chatanywhere/GPT_API_free 的免费网关（OpenAI 兼容）。它只发 key、不发模型，
  // 所以模型名要显式指定；想换 DeepSeek 只改这两个 secret 即可。
  const base = (Deno.env.get('STUDY_AI_URL') || 'https://api.chatanywhere.tech/v1').replace(/\/$/, '')
  const model = Deno.env.get('STUDY_AI_MODEL') || 'gpt-4o-mini'
  if (!key) {
    return json({ error: '服务端还没配置 STUDY_AI_KEY（免费 key 要去 chatanywhere 项目页申请，随机会被拒）' }, 500)
  }

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: `你是把学习文档整理成结构化计划表的助手。${SCHEMA_HINT}` },
        { role: 'user', content: `文档名：${String(payload?.name || '').slice(0, 120)}\n\n文档正文：\n${content}` },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    const hint = response.status === 401 || response.status === 403
      ? 'key 无效或已过期：去 chatanywhere 项目页重新领一个（免费 key 会过期）'
      : response.status === 429
        ? '免费额度/频率限制：等一分钟再试，或换一个 key'
        : response.status === 404
          ? '模型名或网关地址不对：检查 STUDY_AI_URL / STUDY_AI_MODEL'
          : '模型调用失败'
    return json({ error: `${hint}（HTTP ${response.status}）`, detail: detail.slice(0, 500) }, 502)
  }

  const result = await response.json()
  const raw = result?.choices?.[0]?.message?.content || ''
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (error) {
    return json({ error: '模型没有返回合法 JSON，可以重试一次', detail: cleaned.slice(0, 300) }, 502)
  }

  return json({ plan: normalizePlan(parsed) })
})
