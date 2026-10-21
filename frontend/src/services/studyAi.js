// 调用 Edge Function 把学习文档整理成结构化计划。
//
// 前端只发文本，模型的 key 在 Supabase 的环境变量里（见 supabase/functions/study-normalize）。
// 没配置后端 / 未登录 / 函数报错时抛一个可读的中文错误，调用方保留「按文档排版」的兜底。
import { backendConfigured, supabase } from './api'

export async function normalizeStudyText(text, name = '') {
  if (!backendConfigured || !supabase) throw new Error('还没连接后端，先把 Supabase 配好')
  const { data, error } = await supabase.functions.invoke('study-normalize', {
    body: { name, text: String(text || '').slice(0, 60000) },
  })
  if (error) throw new Error(error.message || '整理失败')
  if (data?.error) throw new Error(data.error)
  if (!data?.plan?.stages?.length) throw new Error('没有读到阶段，换一份结构清楚一点的文档试试')
  return data.plan
}
