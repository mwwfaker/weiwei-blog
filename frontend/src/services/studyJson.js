// 学习计划的 JSON 导入：模型在站外生成这个结构，粘进来或选文件，学习库直接渲染。
//
// 不依赖任何 key 或后端：只做「宽容解析 + 归一化 + 存在本机」。
// 计划存在浏览器本机；以后要跨设备再进数据库（supabase/schema.sql 加一张表即可）。
import { readStoredJson, writeStoredJson } from './storage'

const KEY = 'weiwei-blog-study-json-v1'

export function readJsonPlans() {
  const list = readStoredJson(KEY, [])
  return Array.isArray(list) ? list : []
}

export function writeJsonPlans(list) {
  writeStoredJson(KEY, list)
}

export function newPlanId() {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 给「载入示例」用：让人一眼看到 JSON 到底该长什么样。 */
export const SAMPLE_PLAN = JSON.stringify({
  title: '示例：三个月入门摄影',
  subtitle: '从器材到构图，每周一个主题',
  summary: '适合刚买相机、想把自动档换掉的人。学完能独立完成一次外拍并做基础后期。',
  tags: ['摄影', '入门'],
  totalHours: { low: 60, high: 90 },
  stages: [
    {
      title: '阶段一 · 看懂光',
      goal: '理解曝光三要素，能用 M 档拍出想要的效果。',
      duration: '4 周',
      courses: [
        {
          name: '曝光三要素',
          importance: 5,
          hours: '6 小时',
          prerequisite: '无',
          concepts: ['光圈', '快门', 'ISO'],
          criteria: ['手动模式拍 50 张', '能解释每张的参数选择'],
          resources: [{ title: '摄影基础（示例链接，可删）', url: 'https://example.com' }],
        },
      ],
    },
  ],
}, null, 2)

const text = (value) => String(value ?? '').trim()
const list = (value) => (Array.isArray(value) ? value : [])
const pick = (source, keys) => {
  if (!source || typeof source !== 'object') return undefined
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return undefined
}

/**
 * 只保留页面认识的字段；同时容忍常见别名（模型经常把 stages 写成 phases、courses 写成 modules）。
 * 一层层挑，挑不到就给空值，页面自己省略。
 */
export function normalizePlan(raw) {
  let plan = raw && typeof raw === 'object' ? raw : {}
  if (Array.isArray(plan)) plan = { stages: plan }

  const stages = list(pick(plan, ['stages', 'phases', '阶段', 'steps'])).map((stage) => {
    const courses = list(pick(stage, ['courses', 'modules', 'items', 'lessons', '课程', '条目']))
    return {
      title: text(pick(stage, ['title', 'name', 'stage', '阶段', '阶段名'])),
      goal: text(pick(stage, ['goal', 'summary', 'objective', '目标'])),
      duration: text(pick(stage, ['duration', 'time', '时长'])),
      courses: courses.map((course) => ({
        name: text(pick(course, ['name', 'title', 'course', '课程', '课程名'])),
        importance: Math.min(5, Math.max(1, Number(pick(course, ['importance', 'level', '优先级', '重要性'])) || 3)),
        hours: text(pick(course, ['hours', 'duration', '时长'])),
        prerequisite: text(pick(course, ['prerequisite', 'prereq', '前置', '前置课程'])),
        concepts: list(pick(course, ['concepts', 'concept', 'points', '概念', '核心概念'])).map(text).filter(Boolean).slice(0, 8),
        criteria: list(pick(course, ['criteria', 'outcomes', 'standard', '完成标准', '标准'])).map(text).filter(Boolean).slice(0, 6),
        resources: list(pick(course, ['resources', 'links', '资源', '资料']))
          .map((item) => (typeof item === 'string'
            ? { title: item, url: /^https?:\/\//.test(item) ? item : '' }
            : { title: text(pick(item, ['title', 'name', '资源名'])), url: text(pick(item, ['url', 'link', '链接'])) }))
          .filter((item) => item.url || item.title)
          .slice(0, 6),
      })).filter((course) => course.name),
    }
  }).filter((stage) => stage.title || stage.courses.length)

  return {
    title: text(pick(plan, ['title', 'name', '标题', '计划'])) || '未命名学习计划',
    subtitle: text(pick(plan, ['subtitle', 'description', '副标题', '说明'])),
    summary: text(pick(plan, ['summary', 'overview', '概述', '简介'])),
    tags: list(pick(plan, ['tags', 'labels', '标签'])).map(text).filter(Boolean).slice(0, 8),
    totalHours: {
      low: Number(pick(pick(plan, ['totalHours', 'hours', '总课时']), ['low', 'min']) ?? 0) || 0,
      high: Number(pick(pick(plan, ['totalHours', 'hours', '总课时']), ['high', 'max']) ?? 0) || 0,
    },
    stages,
  }
}

/** 去掉 BOM、代码围栏、// 注释、尾逗号、中文引号——这些都是“格式不对”的常见来源。 */
function cleanSource(source) {
  let s = String(source || '').replace(/^\uFEFF/, '').trim()
  s = s.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  s = s.replace(/,\s*([}\]])/g, '$1')
  return s
}

/** 从一段文本里抠出最外层 JSON（前后有说明文字也能救）。 */
function extractJson(source) {
  const s = cleanSource(source)
  try {
    return { value: JSON.parse(s), source: s }
  } catch (error) {
    const start = s.search(/[{[]/)
    const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
    if (start < 0 || end <= start) {
      throw new Error('这段内容里没有 JSON 结构（找不到 { … }）。如果你贴的是文档正文，需要先让 AI 按 schema 整理成 JSON；找不准的话点「载入示例」看格式。')
    }
    const sliced = s.slice(start, end + 1)
    try {
      return { value: JSON.parse(sliced), source: sliced }
    } catch (inner) {
      const around = inner.message.match(/position (\d+)/)
      const pos = around ? Number(around[1]) : 0
      const snippet = sliced.slice(Math.max(0, pos - 40), pos + 40).replace(/\s+/g, ' ')
      throw new Error(`JSON 语法错误：${inner.message}${snippet ? `（附近：…${snippet}…）` : ''}`)
    }
  }
}

/** 粘贴/文件内容 → plan，失败时抛一句能照着改的中文。 */
export function parsePlanText(source) {
  if (!String(source || '').trim()) throw new Error('内容是空的')
  const { value } = extractJson(source)
  const plan = normalizePlan(value)
  if (!plan.stages.length) {
    throw new Error('JSON 能解析，但里面没有 stages（阶段）。检查是否用了别的字段名，或把课程直接放在了顶层。')
  }
  const courses = plan.stages.reduce((sum, stage) => sum + stage.courses.length, 0)
  if (!courses) {
    throw new Error('阶段有了，但里面没有课程：每个 stage 需要 courses: [{ name: … }]。')
  }
  return plan
}
