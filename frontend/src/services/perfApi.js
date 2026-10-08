// 绩效工作区：整份读、整份写。后端在事务里整体替换，所以不会出现写了一半的状态。
import { request } from './api'

/** 后端存的是队列 / 员工 / 明细三段，前端直接用字符串 id 引用，中间不做映射。 */
export async function loadWorkspace(token) {
  return request('/api/perf/workspace', { token })
}

/**
 * 公开读取：不登录也能读到全部账号的绩效工作区（`{ ownerId, ownerName, queues, members, entries }[]`）。
 * 查看对所有人开放，写仍然要登录，并且只会覆盖自己的那一份。
 */
export async function loadPublicWorkspaces() {
  return request('/api/public/perf/workspaces')
}

export async function saveWorkspace(token, { queues, members, entries }) {
  return request('/api/perf/workspace', {
    token,
    method: 'PUT',
    body: {
      queues: (queues || []).map((q) => ({ id: q.id || q.name, name: q.name, kpi: Number(q.kpi) || 0 })),
      members: (members || []).map((m) => ({
        id: m.id,
        name: m.name || '',
        email: m.email || '',
        queue: m.queue || '',
        requiredHours: Number(m.requiredHours) || 0,
        transferHours: Number(m.transferHours) || 0,
        overtimeHours: Number(m.overtimeHours) || 0,
        tripleHours: Number(m.tripleHours) || 0,
      })),
      entries: (entries || []).map((e) => ({
        id: e.id,
        memberId: e.memberId,
        queue: e.queue || '',
        actualAht: Number(e.actualAht) || 0,
        auditCount: Number(e.auditCount) || 0,
        tripleCount: Number(e.tripleCount) || 0,
      })),
    },
  })
}

/** 后端的返回形状转回前端用的对象。 */
export function fromServer(payload, fallbackRequiredHours) {
  const queues = (payload?.queues || []).map((q) => ({ name: q.name || '', kpi: Number(q.kpi) || 0 }))
  const members = (payload?.members || []).map((m) => ({
    id: m.id,
    name: m.name || '',
    email: m.email || '',
    queue: m.queue || '',
    requiredHours: Number(m.requiredHours) || fallbackRequiredHours,
    transferHours: Number(m.transferHours) || 0,
    overtimeHours: Number(m.overtimeHours) || 0,
    tripleHours: Number(m.tripleHours) || 0,
  }))
  const entries = (payload?.entries || []).map((e) => ({
    id: e.id,
    memberId: e.memberId,
    queue: e.queue || '',
    actualAht: Number(e.actualAht) || 0,
    auditCount: Number(e.auditCount) || 0,
    tripleCount: Number(e.tripleCount) || 0,
  }))
  return { queues, members, entries }
}
