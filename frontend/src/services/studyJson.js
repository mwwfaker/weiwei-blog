// 学习计划的 JSON 导入：模型在站外生成这个结构，粘进来或选文件，学习库直接渲染。
//
// 不依赖任何 key 或后端：只做「校验 + 归一化 + 存在本机」。
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

const text = (value) => String(value ?? '').trim()
const list = (value) => (Array.isArray(value) ? value : [])

/** 只保留页面认识的字段；模型多给的、缺的都收敛到同一份结构。 */
export function normalizePlan(raw) {
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
        .filter((item) => item.url || item.title)
        .slice(0, 6),
    })).filter((course) => course.name),
  })).filter((stage) => stage.title || stage.courses.length)

  return {
    title: text(plan.title) || '未命名学习计划',
    subtitle: text(plan.subtitle),
    summary: text(plan.summary),
    tags: list(plan.tags).map(text).filter(Boolean).slice(0, 8),
    totalHours: { low: Number(plan.totalHours?.low) || 0, high: Number(plan.totalHours?.high) || 0 },
    stages,
  }
}

/**
 * 粘贴/文件内容 → plan。允许外面裹 ```json 代码块（模型很爱加），
 * 也允许整段里只有一段 JSON 对象（前后有说明文字）。
 */
export function parsePlanText(source) {
  const raw = String(source || '').trim()
  if (!raw) throw new Error('内容是空的')
  const unfenced = raw.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  let json = unfenced
  if (!json.startsWith('{')) {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('没找到 JSON 对象，检查是不是把说明文字也贴进来了')
    json = unfenced.slice(start, end + 1)
  }
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new Error(`JSON 格式不对：${error.message}`)
  }
  const plan = normalizePlan(parsed)
  if (!plan.stages.length) throw new Error('没有 stages（阶段），这份 JSON 不像学习计划')
  const courses = plan.stages.reduce((sum, stage) => sum + stage.courses.length, 0)
  if (!courses) throw new Error('一个课程都没有，检查 stages[].courses 是不是写成了别的字段')
  return plan
}
