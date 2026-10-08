// 绩效计算。所有公式集中在纯函数里，方便单独验证。
//
// 数据模型（按用户的工作方式）：
//   · 队列：KPI 是每月手改的输入值，标准 AHT 由它算出
//   · 员工：姓名 + 邮箱 + 一个月只填一次的固定项（月要求工时 / 抽调 / 加班 / 三薪）
//   · 明细：员工 × 队列 的每月数据，只有两个数字 —— 实际 AHT 与 审核量
//
// 公式来源：用户给定的飞书表格
//   AHT        = ROUND(24480 ÷ KPI, 2)          ← KPI 是输入，AHT 是算出来的
//   单价       = 1800 × 标准AHT ÷ 月要求工时 ÷ 3600 × 0.85
//   审核工资   = 审核量 × 单价
//   月实际工时 = 实际总时长 ÷ 3600 = 实际AHT × 审核量 ÷ 3600   ← 算出来的，不用填
//   月度审核效率 = Σ(标准AHT×审核量) ÷ Σ(实际AHT×审核量)
//   补时工资   = 审核工资 × 抽调时长 × 0.85 ÷ 月实际工时
//   加班工资   = 加班时长 × 31
//   三薪工资   = 三薪时长 × 62

export const PERF_CONSTANTS = {
  baseAmount: 1800,
  factor: 0.85,
  kpiBase: 24480,
  overtimeRate: 31,
  tripleRate: 62,
}

// kpi 是输入值（每月手改），referencePrice 是飞书表格里的单价，只用于自检核对。
export const PERF_QUEUES = [
  { name: '图片', kpi: 884, referencePrice: 0.0885230 },
  { name: '视频', kpi: 941, referencePrice: 0.0831522 },
  { name: '纠错', kpi: 968, referencePrice: 0.0808504 },
  { name: '生服', kpi: 685, referencePrice: 0.1142583 },
  { name: '假店', kpi: 727, referencePrice: 0.1076407 },
  { name: '水位', kpi: 1714, referencePrice: 0.0456522 },
  { name: '资质', kpi: 2377, referencePrice: 0.0329284 },
  { name: '加盟', kpi: 126, referencePrice: 0.6211317 },
  { name: '特色', kpi: 405, referencePrice: 0.1932225 },
  { name: '线索', kpi: 6245, referencePrice: 0.0125320 },
  { name: '医师', kpi: 65, referencePrice: 1.2040281 },
  { name: '标注', kpi: 343, referencePrice: 0.2281650 },
  { name: 'Q4', kpi: 457, referencePrice: 0.1712596 },
  { name: 'ocr', kpi: 436, referencePrice: 0.1795077 },
  { name: '查漏补缺', kpi: 1105, referencePrice: 0.0708120 },
  { name: '老poi', kpi: 764, referencePrice: 0.1024297 },
  { name: 'Q3', kpi: 629, referencePrice: 0.1244246 },
]

export const DEFAULT_REQUIRED_HOURS = 132.94

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
let seq = 0
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}-${Math.random().toString(36).slice(2, 6)}`

/** 标准 AHT 由 KPI 算出：ROUND(24480 ÷ KPI, 2)。 */
export function ahtOf(kpi, constants = PERF_CONSTANTS) {
  const value = num(kpi)
  if (value <= 0) return 0
  return Math.round((constants.kpiBase / value) * 100) / 100
}

export function unitPriceOf(standardAht, requiredHours, constants = PERF_CONSTANTS) {
  const aht = num(standardAht)
  const hours = num(requiredHours)
  if (aht <= 0 || hours <= 0) return 0
  return (constants.baseAmount * aht) / hours / 3600 * constants.factor
}

/** 邮箱前缀就是审核员姓名：去掉结尾的「.工号」后剩下的就是名字。 */
export function nameFromEmail(email) {
  const local = String(email || '').split('@')[0]
  return local.replace(/[._-]\d{3,}$/, '').trim()
}

export function emptyMember(requiredHours = DEFAULT_REQUIRED_HOURS) {
  return {
    id: uid('m'),
    name: '',
    email: '',
    // 这个员工主要负责的队列（按员工录入时用；按队列录入不看这个字段）
    queue: '',
    // 一个月只填一次的固定项
    requiredHours,
    transferHours: 0,
    overtimeHours: 0,
    tripleHours: 0,
  }
}

export function emptyEntry(memberId, queue = '') {
  return {
    id: uid('e'),
    memberId,
    queue,
    actualAht: 0,
    auditCount: 0,
    // 三薪日那天的审核量：那天的钱是按 62 元/工时固定给的，所以这部分要从计件里剔除，
    // 否则同一批工作量会被付两次（表格里那列叫「该队列赚的钱（扣除三薪审核里）」）。
    tripleCount: 0,
  }
}

/** 一条明细（员工 × 队列）的计算结果。 */
export function entryNumbers(entry, member, queue, constants = PERF_CONSTANTS) {
  const kpi = num(queue?.kpi)
  const standardAht = ahtOf(kpi, constants)
  const requiredHours = num(member?.requiredHours)
  const unitPrice = unitPriceOf(standardAht, requiredHours, constants)
  const auditCount = num(entry?.auditCount)
  // 三薪量不可能超过总量，超了按总量算
  const tripleCount = Math.min(Math.max(0, num(entry?.tripleCount)), auditCount)
  const pieceCount = Math.max(0, auditCount - tripleCount)
  const actualAht = num(entry?.actualAht)
  return {
    kpi,
    standardAht,
    unitPrice,
    auditCount,
    tripleCount,
    pieceCount,
    actualAht,
    // 计件工资只算剔除三薪之后的部分
    auditPay: pieceCount * unitPrice,
    // 效率与完成度看的是实际干了多少活，所以仍按全部审核量计算
    standardSeconds: standardAht * auditCount,
    actualSeconds: actualAht * auditCount,
  }
}

/**
 * 一位员工跨队列汇总。月实际工时是算出来的：Σ(实际AHT×审核量) ÷ 3600。
 * 只有手动指定了 overrideHours 时才用填的值。
 */
export function memberTotals(member, entries, queues, constants = PERF_CONSTANTS) {
  const queueMap = queues instanceof Map ? queues : new Map(queues.map((q) => [q.name, q]))
  let auditPay = 0
  let standardSeconds = 0
  let actualSeconds = 0
  let auditCount = 0
  let pieceCount = 0
  let tripleCount = 0
  const lines = []

  for (const entry of entries) {
    const queue = queueMap.get(entry.queue) || null
    const numbers = entryNumbers(entry, member, queue, constants)
    lines.push({ entry, queue, numbers })
    auditPay += numbers.auditPay
    standardSeconds += numbers.standardSeconds
    actualSeconds += numbers.actualSeconds
    auditCount += numbers.auditCount
    pieceCount += numbers.pieceCount
    tripleCount += numbers.tripleCount
  }

  // 月实际工时 = 实际总时长；用户明确说这一项是算出来的，不用填
  const derivedHours = actualSeconds / 3600
  const actualHours = num(member.actualHours) > 0 ? num(member.actualHours) : derivedHours

  const efficiency = actualSeconds > 0 ? standardSeconds / actualSeconds : 0

  // 完成度（用户给的公式）：
  //   =IFERROR(SUMPRODUCT(审核量, 标准AHT) / (((要求工时 + 加班时长) * 0.85 - 抽调时长) * 3600), "")
  // 分子就是标准总时长；分母是「有效可用秒数」。
  const availableSeconds = ((num(member.requiredHours) + num(member.overtimeHours)) * constants.factor - num(member.transferHours)) * 3600
  const completion = availableSeconds > 0 ? standardSeconds / availableSeconds : 0
  const subsidyPay = actualHours > 0
    ? (auditPay * num(member.transferHours) * constants.factor) / actualHours
    : 0
  const overtimePay = num(member.overtimeHours) * constants.overtimeRate
  const triplePay = num(member.tripleHours) * constants.tripleRate
  const total = auditPay + subsidyPay + overtimePay + triplePay

  return {
    lines,
    auditCount,
    pieceCount,
    tripleCount,
    auditPay,
    standardSeconds,
    actualSeconds,
    actualHours,
    derivedHours,
    efficiency,
    completion,
    subsidyPay,
    overtimePay,
    triplePay,
    total,
  }
}

/** 全部员工的计算结果 + 汇总。 */
export function computeAll(members, entries, queues, constants = PERF_CONSTANTS) {
  const queueMap = new Map(queues.map((q) => [q.name, q]))
  const entriesByMember = new Map()
  for (const entry of entries) {
    if (!entriesByMember.has(entry.memberId)) entriesByMember.set(entry.memberId, [])
    entriesByMember.get(entry.memberId).push(entry)
  }

  const rows = members.map((member) => ({
    member,
    entries: entriesByMember.get(member.id) || [],
    result: memberTotals(member, entriesByMember.get(member.id) || [], queueMap, constants),
  }))

  const total = rows.reduce((sum, row) => sum + row.result.total, 0)
  const auditTotal = rows.reduce((sum, row) => sum + row.result.auditPay, 0)
  const standardSeconds = rows.reduce((sum, row) => sum + row.result.standardSeconds, 0)
  const actualSeconds = rows.reduce((sum, row) => sum + row.result.actualSeconds, 0)
  const auditCount = rows.reduce((sum, row) => sum + row.result.auditCount, 0)
  const pieceCount = rows.reduce((sum, row) => sum + row.result.pieceCount, 0)
  const tripleCount = rows.reduce((sum, row) => sum + row.result.tripleCount, 0)
  const withWork = rows.filter((row) => row.result.actualSeconds > 0)

  return {
    rows,
    summary: {
      headcount: rows.length,
      total,
      auditTotal,
      auditCount,
      pieceCount,
      tripleCount,
      // 小组审核效率按加权汇总，而不是个人效率的简单平均
      efficiency: actualSeconds > 0 ? standardSeconds / actualSeconds : 0,
      hours: actualSeconds / 3600,
      highest: withWork.reduce((best, row) => (!best || row.result.total > best.result.total ? row : best), null),
      lowest: withWork.reduce((worst, row) => (!worst || row.result.total < worst.result.total ? row : worst), null),
    },
  }
}

/** 按队列分组，用于「对着队列名称录数据」的界面。 */
export function groupByQueue(queues, entries, members) {
  const memberMap = new Map(members.map((m) => [m.id, m]))
  const groups = queues.map((queue) => ({
    queue,
    rows: entries
      .filter((entry) => entry.queue === queue.name)
      .map((entry) => ({ entry, member: memberMap.get(entry.memberId) || null }))
      .filter((row) => row.member),
  }))
  const known = new Set(queues.map((q) => q.name))
  const orphans = entries
    .filter((entry) => !known.has(entry.queue))
    .map((entry) => ({ entry, member: memberMap.get(entry.memberId) || null }))
    .filter((row) => row.member)
  if (orphans.length) groups.push({ queue: { name: '（已删除的队列）', kpi: 0 }, rows: orphans })
  return groups
}

/** 单价自检：和飞书表格里的参考单价对比，能反过来验证 KPI 有没有抄错。 */
export function priceCheck(queues, requiredHours, constants = PERF_CONSTANTS) {
  const out = []
  for (const queue of queues) {
    if (queue.referencePrice == null || !requiredHours) continue
    const computed = unitPriceOf(ahtOf(queue.kpi, constants), requiredHours, constants)
    const delta = computed - queue.referencePrice
    out.push({
      name: queue.name,
      computed,
      reference: queue.referencePrice,
      ok: Math.abs(delta) <= Math.max(1e-7, queue.referencePrice * 0.001),
      delta,
    })
  }
  return out
}

/** 旧存档迁移。 */
export function normalizeQueues(stored, fallback = PERF_QUEUES) {
  if (!Array.isArray(stored) || !stored.length) return fallback.map((q) => ({ ...q }))
  return stored.map((queue) => {
    if (queue.kpi > 0) return { ...queue }
    if (queue.standardAht > 0) return { ...queue, kpi: Math.round(PERF_CONSTANTS.kpiBase / queue.standardAht) }
    return { ...queue, kpi: 0 }
  })
}

/**
 * 把上一版「一个员工一行、带队列与审核量」的存档，迁移成「员工 + 明细」两段式。
 */
export function migrateLegacy(storedMembers) {
  const members = []
  const entries = []
  for (const old of Array.isArray(storedMembers) ? storedMembers : []) {
    const member = {
      id: old.id || uid('m'),
      name: old.name || nameFromEmail(old.email),
      email: old.email || '',
      requiredHours: num(old.requiredHours) || DEFAULT_REQUIRED_HOURS,
      transferHours: num(old.transferHours),
      overtimeHours: num(old.overtimeHours),
      tripleHours: num(old.tripleHours),
    }
    members.push(member)
    if (old.queue || num(old.auditCount) || num(old.actualAht)) {
      entries.push({ id: uid('e'), memberId: member.id, queue: old.queue || '', actualAht: num(old.actualAht), auditCount: num(old.auditCount) })
    }
  }
  return { members, entries }
}
