// 绩效工作区接口的真实 HTTP 端到端检查：存取往返、跨账号隔离、孤儿明细丢弃、登录要求。
// 用法：先启动 API（run-api.ps1），再 node verify-perf-e2e.mjs
const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8080'

let pass = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`) }
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
  return { status: res.status, json, text }
}

const stamp = Date.now()
async function makeAccount(tag) {
  const email = `perfe2e-${tag}-${stamp}@example.com`
  const res = await call('/api/auth/register', { method: 'POST', body: { email, password: 'perf-e2e-password-2026', displayName: `绩效测试${tag}` } })
  if (res.status !== 200 && res.status !== 201) throw new Error(`注册失败 ${res.status}: ${res.text}`)
  return { email, token: res.json.accessToken }
}

console.log('[1] 未登录不能访问')
const anon = await call('/api/perf/workspace')
check('匿名请求被拒绝（401/403）', anon.status === 401 || anon.status === 403, `status ${anon.status}`)

const a = await makeAccount('a')
const b = await makeAccount('b')
console.log(`  两个测试账号已创建`)

console.log('\n[2] 空账号读到空工作区')
const empty = await call('/api/perf/workspace', { token: a.token })
check('读取成功', empty.status === 200, `${empty.status}`)
check('队列为空', Array.isArray(empty.json.queues) && empty.json.queues.length === 0)
check('员工为空', Array.isArray(empty.json.members) && empty.json.members.length === 0)
check('明细为空', Array.isArray(empty.json.entries) && empty.json.entries.length === 0)

console.log('\n[3] 写入后读回来要一致')
const payload = {
  queues: [
    { id: 'q1', name: '图片', kpi: 884 },
    { id: 'q2', name: '视频', kpi: 941 },
  ],
  members: [
    { id: 'm1', name: 'zhangwei', email: 'zhangwei.5406@example.com', queue: '图片', requiredHours: 132.94, transferHours: 6, overtimeHours: 8, tripleHours: 0 },
    { id: 'm2', name: 'liuyang', email: 'liuyang.5402@example.com', queue: '视频', requiredHours: 122.5, transferHours: 0, overtimeHours: 0, tripleHours: 0 },
  ],
  entries: [
    { id: 'e1', memberId: 'm1', queue: '图片', actualAht: 33.42, auditCount: 7167, tripleCount: 800 },
    { id: 'e2', memberId: 'm2', queue: '视频', actualAht: 26.05, auditCount: 5784, tripleCount: 0 },
  ],
}
const saved = await call('/api/perf/workspace', { method: 'PUT', token: a.token, body: payload })
check('写入成功', saved.status === 200, `${saved.status} ${saved.text?.slice(0, 120)}`)
check('返回的队列数正确', saved.json?.queues?.length === 2, `${saved.json?.queues?.length}`)
check('返回的员工数正确', saved.json?.members?.length === 2, `${saved.json?.members?.length}`)
check('返回的明细数正确', saved.json?.entries?.length === 2, `${saved.json?.entries?.length}`)

const readBack = await call('/api/perf/workspace', { token: a.token })
const q1 = readBack.json.queues.find((q) => q.id === 'q1')
const m1 = readBack.json.members.find((m) => m.id === 'm1')
const e1 = readBack.json.entries.find((e) => e.id === 'e1')
check('队列名与 KPI 保留', q1?.name === '图片' && q1?.kpi === 884, JSON.stringify(q1))
check('员工姓名/邮箱/队列保留', m1?.name === 'zhangwei' && m1?.email === 'zhangwei.5406@example.com' && m1?.queue === '图片', JSON.stringify(m1))
check('月要求工时与抽调保留', m1?.requiredHours === 132.94 && m1?.transferHours === 6, JSON.stringify(m1))
check('明细的 AHT / 审核量 / 三薪量保留', e1?.actualAht === 33.42 && e1?.auditCount === 7167 && e1?.tripleCount === 800, JSON.stringify(e1))
check('明细仍指向正确的员工', e1?.memberId === 'm1', e1?.memberId)

console.log('\n[4] 整体替换：第二次写入应当完全覆盖')
const second = {
  queues: [{ id: 'q1', name: '图片', kpi: 900 }],
  members: [{ id: 'm1', name: 'zhangwei', email: '', queue: '图片', requiredHours: 100, transferHours: 0, overtimeHours: 0, tripleHours: 0 }],
  entries: [{ id: 'e9', memberId: 'm1', queue: '图片', actualAht: 30, auditCount: 1000, tripleCount: 0 }],
}
const secondRes = await call('/api/perf/workspace', { method: 'PUT', token: a.token, body: second })
check('第二次写入返回 200', secondRes.status === 200, String(secondRes.status) + ' ' + String(secondRes.text || '').slice(0, 140))
const afterReplace = await call('/api/perf/workspace', { token: a.token })
check('队列被替换成 1 个', afterReplace.json.queues.length === 1, `${afterReplace.json.queues.length}`)
check('员工被替换成 1 个', afterReplace.json.members.length === 1, `${afterReplace.json.members.length}`)
check('明细被替换成 1 条', afterReplace.json.entries.length === 1, `${afterReplace.json.entries.length}`)
check('KPI 已更新为 900', afterReplace.json.queues[0].kpi === 900, `${afterReplace.json.queues[0].kpi}`)

console.log('\n[5] 指向不存在员工的明细会被丢弃，不会留下孤儿数据')
await call('/api/perf/workspace', {
  method: 'PUT', token: a.token,
  body: {
    queues: [{ id: 'q1', name: '图片', kpi: 900 }],
    members: [{ id: 'm1', name: 'x', email: '', queue: '图片', requiredHours: 100, transferHours: 0, overtimeHours: 0, tripleHours: 0 }],
    entries: [
      { id: 'ok', memberId: 'm1', queue: '图片', actualAht: 30, auditCount: 100, tripleCount: 0 },
      { id: 'orphan', memberId: 'm-does-not-exist', queue: '图片', actualAht: 30, auditCount: 999, tripleCount: 0 },
    ],
  },
})
const orphans = await call('/api/perf/workspace', { token: a.token })
check('只留下有效的那条明细', orphans.json.entries.length === 1 && orphans.json.entries[0].id === 'ok', JSON.stringify(orphans.json.entries))

console.log('\n[6] 账号之间互相看不到')
const bView = await call('/api/perf/workspace', { token: b.token })
check('b 账号仍然是空的', bView.json.members.length === 0 && bView.json.entries.length === 0, JSON.stringify(bView.json).slice(0, 120))
await call('/api/perf/workspace', {
  method: 'PUT', token: b.token,
  body: { queues: [{ id: 'qb', name: 'b的队列', kpi: 1 }], members: [], entries: [] },
})
const aView = await call('/api/perf/workspace', { token: a.token })
check('b 写入不会影响 a', aView.json.queues.length === 1 && aView.json.queues[0].name === '图片', JSON.stringify(aView.json.queues))

console.log('\n[7] 负数与超大值被收敛')
await call('/api/perf/workspace', {
  method: 'PUT', token: a.token,
  body: {
    queues: [{ id: 'q1', name: '图片', kpi: -5 }],
    members: [{ id: 'm1', name: 'x', email: '', queue: '图片', requiredHours: -100, transferHours: -1, overtimeHours: -1, tripleHours: -1 }],
    entries: [{ id: 'e1', memberId: 'm1', queue: '图片', actualAht: -3, auditCount: -9, tripleCount: -2 }],
  },
})
const clamped = await call('/api/perf/workspace', { token: a.token })
check('KPI 负数被收敛为 0', clamped.json.queues[0].kpi === 0, `${clamped.json.queues[0].kpi}`)
check('工时负数被收敛为 0', clamped.json.members[0].requiredHours === 0, `${clamped.json.members[0].requiredHours}`)
check('明细负数被收敛为 0', clamped.json.entries[0].auditCount === 0 && clamped.json.entries[0].actualAht === 0)

// 清理
console.log('\n[8] 测试账号不做删除（没有删除账号的接口），由外部 SQL 清理')
check('两个账号都建好了', Boolean(a.token) && Boolean(b.token))

console.log(failures.length ? `\n${failures.length} 项失败：${failures.join('; ')}` : `\n全部通过（${pass} 项）`)
process.exitCode = failures.length ? 1 : 0
