// 导入的学习文档：**以数据库为准**，本机只做缓存 / 离线兜底。
//
// 表在 supabase/schema.sql 末尾（study_docs，RLS 只允许本人读写），
// 请求走 services/api.js 的 `/api/study-docs`，前端不直接碰 supabase 客户端。
//
// 为什么还留着 localStorage：没登录、没配置 Supabase、或离线时，学习库不该是空的；
// 登录后再打开会自动以数据库里的那份覆盖本机缓存。
import { request } from './api'
import { readStoredJson, writeStoredJson } from './storage'

const KEY = 'weiwei-blog-study-docs-v1'

export function readLocalStudyDocs() {
  const list = readStoredJson(KEY, [])
  return Array.isArray(list) ? list : []
}

function cache(list) {
  writeStoredJson(KEY, list)
  return list
}

/** 读：优先数据库，失败（未登录 / 未配置 / 离线）就用本机缓存。 */
export async function loadStudyDocs() {
  try {
    const list = await request('/api/study-docs')
    if (Array.isArray(list)) return cache(list)
  } catch (error) {
    // 未登录时 API 会抛错，这是正常路径，不当成失败提示
  }
  return readLocalStudyDocs()
}

/** 存：先写本机（保证刷新不丢），再写数据库；写库失败只影响跨设备同步。 */
export async function saveStudyDoc(doc) {
  const list = cache([doc, ...readLocalStudyDocs().filter((item) => item.id !== doc.id)])
  try {
    await request('/api/study-docs', { method: 'POST', body: { id: doc.id, doc } })
  } catch (error) {
    // 离线 / 未登录：本机已有副本
  }
  return list
}

/** 删：本机与数据库各删一次，数据库失败时下次登录会被服务端那份补回来。 */
export async function removeStudyDoc(id) {
  const list = cache(readLocalStudyDocs().filter((item) => item.id !== id))
  try {
    await request(`/api/study-docs/${id}`, { method: 'DELETE' })
  } catch (error) {
    // 同上
  }
  return list
}

/** id 用时间戳 + 随机尾巴：同一份文档导入两次也不会互相覆盖。 */
export function newStudyDocId() {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}
