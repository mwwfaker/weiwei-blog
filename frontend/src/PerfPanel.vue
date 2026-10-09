<script setup>
// 绩效计算器：独立的全屏工具，不是博客的一个页面。
//
// 录入方式（按用户的工作方式设计）：
//   选一个队列 → 下面列出全部员工 → 直接在格子里填「实际AHT」和「审核量」。
//   填入的数据按「员工 × 队列」存，所以一个人做多个队列也不会乱。
//   月实际工时是算出来的（实际AHT × 审核量 ÷ 3600），不用填。
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { readStoredJson, writeStoredJson } from './services/storage'
import {
  DEFAULT_REQUIRED_HOURS, PERF_CONSTANTS, PERF_QUEUES,
  ahtOf, computeAll, emptyEntry, emptyMember, entryNumbers, nameFromEmail, normalizeQueues, priceCheck,
} from './services/perf'
import { matchMember, mergeRows, parseRows, recognizeImage } from './services/ocr'
import { fromServer, loadPublicWorkspaces, saveWorkspace } from './services/perfApi'
import { useAuthStore } from './stores/auth'

const router = useRouter()
const auth = useAuthStore()

const MIGRATED_KEY = 'weiwei-blog-perf-migrated-v3'
const MEMBERS_KEY = 'weiwei-blog-perf-members-v3'
const ENTRIES_KEY = 'weiwei-blog-perf-entries-v3'
const QUEUES_KEY = 'weiwei-blog-perf-queues-v2'
const CONSTANTS_KEY = 'weiwei-blog-perf-constants-v1'
const MONTH_KEY = 'weiwei-blog-perf-month-v1'

// 从上一版（一个员工一行、带队列）迁移过来
function loadInitial() {
  const v3 = readStoredJson(MEMBERS_KEY, null)
  if (Array.isArray(v3)) {
    return { members: v3, entries: readStoredJson(ENTRIES_KEY, []) }
  }
  const legacy = readStoredJson('weiwei-blog-perf-members-v2', [])
  const members = []
  const entries = []
  for (const old of Array.isArray(legacy) ? legacy : []) {
    const member = {
      ...emptyMember(Number(old.requiredHours) || DEFAULT_REQUIRED_HOURS),
      id: old.id || emptyMember().id,
      name: old.name || nameFromEmail(old.email),
      email: old.email || '',
      transferHours: Number(old.transferHours) || 0,
      overtimeHours: Number(old.overtimeHours) || 0,
      tripleHours: Number(old.tripleHours) || 0,
    }
    members.push(member)
    if (old.queue && (Number(old.auditCount) || Number(old.actualAht))) {
      entries.push({ ...emptyEntry(member.id, old.queue), actualAht: Number(old.actualAht) || 0, auditCount: Number(old.auditCount) || 0 })
    }
  }
  return { members, entries }
}

const initial = loadInitial()
const members = ref(initial.members)
const entries = ref(initial.entries)
const queues = ref(normalizeQueues(readStoredJson(QUEUES_KEY, [])))
const constants = ref({ ...PERF_CONSTANTS, ...readStoredJson(CONSTANTS_KEY, {}) })
const month = ref(readStoredJson(MONTH_KEY, new Date().toISOString().slice(0, 7)))
try { writeStoredJson(MIGRATED_KEY, true) } catch { /* 存储不可用时不阻塞使用 */ }

watch(members, (v) => writeStoredJson(MEMBERS_KEY, v), { deep: true })
watch(entries, (v) => writeStoredJson(ENTRIES_KEY, v), { deep: true })
watch(queues, (v) => writeStoredJson(QUEUES_KEY, v), { deep: true })
watch(constants, (v) => writeStoredJson(CONSTANTS_KEY, v), { deep: true })
watch(month, (v) => writeStoredJson(MONTH_KEY, v))

// ---- 云端同步 --------------------------------------------------------------
// 看：绩效数据是公开的，登录与否都从同一个公开接口读，访客看到的和账号里存的是同一份。
// 改：只有登录以后、并且正在看自己那一份的时候才允许写；写入做 800ms 防抖。
const workspaces = ref([])
const activeOwnerId = ref(null)
const syncState = ref(auth.isLoggedIn ? 'idle' : 'readonly')
const syncMessage = ref('')

/**
 * 正在看的是不是自己那一份。只要不是自己的一律只读——否则切换查看别人数据时，
 * 防抖保存会把别人的名单写进自己的账号。
 */
const readOnly = computed(() => !auth.isLoggedIn || String(activeOwnerId.value ?? '') !== String(auth.user?.id ?? ''))

const activeOwnerName = computed(() => {
  const found = workspaces.value.find((item) => String(item.ownerId) === String(activeOwnerId.value))
  if (found?.ownerName) return found.ownerName
  // 自己那一份还没建立时（公开列表里查不到自己），显示自己的昵称而不是「未命名账号」。
  if (auth.isLoggedIn && String(activeOwnerId.value) === String(auth.user?.id)) return auth.user?.displayName || '我'
  return '未命名账号'
})

/** 顶栏右侧那行状态字：只有没有具体消息时才退回这个默认文案。 */
const syncLabel = computed(() => ({
  idle: '', loading: '正在读取云端数据…', saving: '正在保存到账号…', saved: '已保存到账号',
  readonly: '公开只读', error: '云端同步失败',
}[syncState.value] ?? ''))

let syncTimer
let skipNextSync = false

/**
 * 把某一份工作区套用到编辑区。
 * `adoptLocal` 为真且云端这一份还是空的、本机已经有名单时返回 false，
 * 交给调用方决定「把本机数据推上去」，而不是直接清空。
 */
function applyWorkspace(workspace, { adoptLocal = false } = {}) {
  const parsed = fromServer(workspace, checkHours.value)
  if (adoptLocal && !parsed.members.length && members.value.length) return false
  skipNextSync = true
  if (parsed.queues.length) queues.value = parsed.queues
  members.value = parsed.members
  entries.value = parsed.entries
  return true
}

async function pullWorkspace() {
  syncState.value = 'loading'
  try {
    // 直接刷新在 /perf 上时会话可能还没恢复，先确认登录状态再决定读哪一份。
    if (!auth.user) await auth.restoreSession()
    workspaces.value = await loadPublicWorkspaces()
  } catch (error) {
    syncState.value = 'error'
    syncMessage.value = `云端读取失败，当前用的是本机数据：${error.message}`
    return
  }

  if (auth.isLoggedIn) {
    const mine = workspaces.value.find((item) => String(item.ownerId) === String(auth.user?.id))
    // 自己云端还没有这一份时，也要把「正在看的就是我自己」这个身份定下来。
    // 早先这里是 `?? null`：新账号在公开列表里找不到自己 → activeOwnerId 为 null →
    // readOnly 判定成「在看别人的数据」→ 整页只读（CSS 给按钮加了 pointer-events:none），
    // 于是新账号永远没法录入第一份绩效——而页面提示偏偏写着「先在员工名单里把人加进来」。
    // 未登录依然是只读，这一点没变。
    activeOwnerId.value = mine?.ownerId ?? auth.user?.id ?? null
    if (!applyWorkspace(mine, { adoptLocal: true })) {
      // 自己的云端还没有数据：把本机已有的内容推上去，而不是清空
      skipNextSync = true
      syncState.value = 'saving'
      try {
        await saveWorkspace(auth.token, { queues: queues.value, members: members.value, entries: entries.value })
        syncState.value = 'saved'
        syncMessage.value = '已把本机数据同步到账号'
      } catch (error) {
        syncState.value = 'error'
        syncMessage.value = `同步到账号失败：${error.message}`
      }
      return
    }
    syncState.value = 'saved'
    syncMessage.value = ''
    return
  }

  const first = workspaces.value[0]
  activeOwnerId.value = first?.ownerId ?? null
  applyWorkspace(first)
  syncState.value = 'readonly'
  syncMessage.value = workspaces.value.length ? `正在查看 ${activeOwnerName.value} 的数据` : '账号里还没有绩效数据。'
}

/** 顶部选择器切换查看对象：切到别人的那一份会自动变成只读。 */
function selectWorkspace(ownerId) {
  const target = workspaces.value.find((item) => String(item.ownerId) === String(ownerId))
  if (!target || String(target.ownerId) === String(activeOwnerId.value)) return
  activeOwnerId.value = target.ownerId
  applyWorkspace(target)
  syncState.value = readOnly.value ? 'readonly' : 'saved'
  syncMessage.value = `正在查看 ${activeOwnerName.value} 的数据${readOnly.value ? '（只读）' : ''}`
}

async function pushWorkspace() {
  if (readOnly.value) return
  syncState.value = 'saving'
  try {
    await saveWorkspace(auth.token, { queues: queues.value, members: members.value, entries: entries.value })
    syncState.value = 'saved'
    syncMessage.value = ''
  } catch (error) {
    syncState.value = 'error'
    syncMessage.value = `保存到云端失败：${error.message}`
  }
}

watch([members, entries, queues], () => {
  // 无论是否要跳过，先把标记消费掉，免得它留到下一次真正的编辑上。
  const skipping = skipNextSync
  skipNextSync = false
  if (skipping || readOnly.value) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(pushWorkspace, 800)
}, { deep: true })

// 粘贴只在导入页生效，切走就摘掉监听，免得在别处 Ctrl+V 被吃掉
// 这里在 tab 声明之前，连 watch(tab, …) 都不能写（传引用就会撞上暂时性死区）。
// 所以只注册一次监听，在回调里判断当前是不是「导入截图」页。
onMounted(() => {
  pullWorkspace()
  if (typeof document !== 'undefined') document.addEventListener('paste', handlePaste)
})
onUnmounted(() => {
  clearTimeout(syncTimer)
  if (typeof document !== 'undefined') document.removeEventListener('paste', handlePaste)
})


const tab = ref('entry')
const tabs = [
  { id: 'entry', label: '数据总览' },
  { id: 'viz', label: '数据可视化' },
  { id: 'daily', label: '单日计算' },
  { id: 'roster', label: '员工名单' },
  { id: 'queues', label: '队列 KPI' },
  { id: 'import', label: '导入截图' },
  { id: 'about', label: '计算说明' },
]

// ---- 数据可视化：按不同指标排名 --------------------------------------------
const rankBy = ref('total')
const rankOptions = [
  { id: 'total', label: '按合计' },
  { id: 'auditPay', label: '按审核工资' },
  { id: 'auditCount', label: '按审核量' },
  { id: 'efficiency', label: '按审核效率' },
  { id: 'completion', label: '按完成度' },
]
const ranked = computed(() => {
  const key = rankBy.value
  const rows = [...computedAll.value.rows]
  rows.sort((a, b) => (b.result[key] || 0) - (a.result[key] || 0))
  const max = rows.reduce((m, row) => Math.max(m, row.result[key] || 0), 0)
  return rows.map((row) => ({
    ...row,
    barPercent: max > 0 ? Math.max(2, ((row.result[key] || 0) / max) * 100) : 0,
  }))
})

// ---- 数据可视化的几组统计 ---------------------------------------------------
const numeric = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

const vizStats = computed(() => {
  const totals = computedAll.value.rows.map((row) => row.result.total).sort((a, b) => a - b)
  const sum = totals.reduce((s, v) => s + v, 0)
  const middle = totals.length ? (totals.length % 2
    ? totals[(totals.length - 1) / 2]
    : (totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2) : 0
  const withTotal = computedAll.value.rows.filter((row) => row.result.total > 0)
  const comps = computedAll.value.rows.map((row) => row.result.completion).filter((v) => v > 0)
  const top = withTotal.reduce((best, row) => (!best || row.result.total > best.result.total ? row : best), null)
  const bottom = withTotal.reduce((worst, row) => (!worst || row.result.total < worst.result.total ? row : worst), null)
  return {
    total: sum,
    average: totals.length ? sum / totals.length : 0,
    median: middle,
    max: totals.length ? totals[totals.length - 1] : 0,
    min: totals.length ? totals[0] : 0,
    maxName: top?.member.name || '',
    minName: bottom?.member.name || '',
    averageCompletion: comps.length ? comps.reduce((s, v) => s + v, 0) / comps.length : 0,
  }
})

/** 每个人的薪资构成：四段堆叠条。 */
const payStacks = computed(() => {
  const max = computedAll.value.rows.reduce((m, row) => Math.max(m, row.result.total), 0)
  return computedAll.value.rows
    .filter((row) => row.result.total > 0)
    .sort((a, b) => b.result.total - a.result.total)
    .map((row) => {
      const base = row.result.total || 1
      const parts = [
        { key: 'audit', label: '审核', value: row.result.auditPay, color: '#8b6ce0' },
        { key: 'subsidy', label: '补时', value: row.result.subsidyPay, color: '#4aa8c0' },
        { key: 'overtime', label: '加班', value: row.result.overtimePay, color: '#46b06a' },
        { key: 'triple', label: '三薪', value: row.result.triplePay, color: '#e0a13f' },
      ]
      // 每一段先算占本人在总额里的比例，再按「全组最高者」缩放整条长度
      const scale = max > 0 ? (row.result.total / max) * 100 : 0
      return {
        id: row.member.id,
        name: row.member.name || '（未命名）',
        total: row.result.total,
        segments: parts.map((p) => ({ ...p, width: (p.value / base) * scale })),
      }
    })
})

/** 队列分布：按审核量排序,取前几名。 */
const queueStats = computed(() => {
  const list = []
  for (const [name, bucket] of queueTotalsAll.value) {
    if (!bucket.auditCount) continue
    list.push({ name, auditCount: bucket.auditCount, pay: bucket.pay, people: bucket.people, efficiency: bucket.efficiency })
  }
  list.sort((a, b) => b.auditCount - a.auditCount)
  const max = list.length ? list[0].auditCount : 0
  return list.map((q) => ({ ...q, barPercent: max > 0 ? Math.max(3, (q.auditCount / max) * 100) : 0 }))
})

/** 效率 × 完成度 散点。
 *  要点：轴上限用 90 分位而不是最大值——否则一个离群点会把其它点全压到角落。
 *  超出上限的点钳在边缘并标出来，刻度带上真实数值，平均值画成十字虚线分出四个象限。 */
const vizScatter = computed(() => {
  const rows = computedAll.value.rows.filter((row) => row.result.actualSeconds > 0)
  const W = 640
  const H = 320
  const L = 58
  const R = 18
  const T = 16
  const B = 38
  if (!rows.length) return { points: [], xTicks: [], yTicks: [], quadrants: [], W, H, empty: true }

  const effs = rows.map((row) => row.result.efficiency).sort((a, b) => a - b)
  const comps = rows.map((row) => row.result.completion).sort((a, b) => a - b)
  const percentile = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0)
  // 取一个整齐的上限：1 / 2 / 2.5 / 5 的整倍数
  const niceMax = (value) => {
    if (!(value > 0)) return 1
    const power = Math.pow(10, Math.floor(Math.log10(value)))
    for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
      if (value <= step * power) return step * power
    }
    return 10 * power
  }
  // 用四分位距定范围（箱线图那套）：离群点会被钳到边缘并描虚线，
  // 不再把其它点全压到角落里。纯粹的「取最大值」或「取 90 分位」都扛不住离群点。
  const robustMax = (sorted, floor) => {
    const median = percentile(sorted, 0.5)
    const q1 = percentile(sorted, 0.25)
    const q3 = percentile(sorted, 0.75)
    const spread = Math.max(q3 - q1, median * 0.22)
    return niceMax(Math.max(median + spread * 1.7, floor))
  }
  const maxEff = robustMax(effs, 1)
  const maxComp = robustMax(comps, 0.1)
  const avgEff = effs.reduce((sum, v) => sum + v, 0) / effs.length
  const avgComp = comps.reduce((sum, v) => sum + v, 0) / comps.length
  const maxTotal = rows.reduce((m, row) => Math.max(m, row.result.total), 1)

  const px = (v) => L + Math.min(1, Math.max(0, v / maxEff)) * (W - L - R)
  const py = (v) => H - B - Math.min(1, Math.max(0, v / maxComp)) * (H - T - B)

  const points = rows.map((row) => {
    const share = row.result.total / maxTotal
    return {
      id: row.member.id,
      x: px(row.result.efficiency),
      y: py(row.result.completion),
      r: 5 + share * 9,
      short: (row.member.name || '').split(/[.\s]/)[0].slice(0, 8),
      show: share >= 0.4,
      // 靠近上边界时标签改放到点下面，否则会被裁掉
      labelAbove: py(row.result.completion) - (5 + share * 9) - 6 > T + 10,
      overX: row.result.efficiency > maxEff,
      overY: row.result.completion > maxComp,
      tip: `${row.member.name || ''}｜效率 ${percent(row.result.efficiency)}｜完成度 ${percent(row.result.completion)}｜审核 ${(row.result.auditCount || 0).toLocaleString('en-US')} 条｜¥${money(row.result.total)}`,
    }
  })

  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const value = (maxEff / 4) * i
    return { v: value, x: px(value), label: percent(value) }
  })
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = (maxComp / 4) * i
    return { v: value, y: py(value), label: percent(value) }
  })

  return {
    points,
    xTicks,
    yTicks,
    W,
    H,
    L,
    R,
    T,
    B,
    avgX: px(avgEff),
    avgY: py(avgComp),
    // 四个象限的说明文字放在各自的角落
    quadrants: [
      { x: W - R - 10, y: H - B - 10, text: '又快又完成得多', anchor: 'end' },
      { x: L + 10, y: T + 16, text: '慢但完成得多', anchor: 'start' },
      { x: W - R - 10, y: T + 16, text: '快但完成得少', anchor: 'end' },
      { x: L + 10, y: H - B - 10, text: '又慢又完成得少', anchor: 'start' },
    ],
    empty: false,
  }
})

/** 相对团队均值的偏差。 */
const deviations = computed(() => {
  const rows = computedAll.value.rows
  const avg = vizStats.value.average || 0
  const maxDelta = rows.reduce((m, row) => Math.max(m, Math.abs(row.result.total - avg)), 1)
  return [...rows]
    .sort((a, b) => b.result.total - a.result.total)
    .map((row) => {
      const delta = row.result.total - avg
      return {
        id: row.member.id,
        name: row.member.name || '（未命名）',
        delta,
        width: (Math.abs(delta) / maxDelta) * 50,
      }
    })
})

/** 员工 × 队列 矩阵：一格里是某人在某队列的审核量。系统就这两部分,这张图直接表达它。 */
const vizMatrix = computed(() => {
  const membersWithData = computedAll.value.rows.filter((row) => row.result.auditCount > 0)
  if (!membersWithData.length) return { cols: [], rows: [], max: 0 }
  const usedQueues = [...new Set(membersWithData.flatMap((row) => row.result.lines.filter((l) => l.numbers.auditCount).map((l) => l.entry.queue)))]
  const queueOrder = queues.value.map((q) => q.name).filter((name) => usedQueues.includes(name))
  let max = 0
  const rows = queueOrder.map((queueName) => {
    const cells = membersWithData.map((row) => {
      const line = row.result.lines.find((l) => l.entry.queue === queueName)
      const count = line ? line.numbers.auditCount : 0
      if (count > max) max = count
      return { count, pay: line ? line.numbers.auditPay : 0, name: row.member.name || '' }
    })
    const total = cells.reduce((sum, c) => sum + c.count, 0)
    return { queue: queueName, cells, total }
  })
  return { cols: membersWithData.map((row) => row.member.name || ''), rows, max }
})

// ---- 单日计算：对应文档里的表一，独立于月度数据，只存本机 --------------------
const DAILY_KEY = 'weiwei-blog-perf-daily-v1'
const daily = ref({
  date: new Date().toISOString().slice(0, 10),
  hours: 8,
  overtimeHours: 0,
  transferHours: 0,
  tripleHours: 0,
  requiredHours: DEFAULT_REQUIRED_HOURS,
  entries: {},
  ...readStoredJson(DAILY_KEY, {}),
})
watch(daily, (v) => writeStoredJson(DAILY_KEY, v), { deep: true })

function resetDaily() {
  daily.value = {
    date: new Date().toISOString().slice(0, 10),
    hours: 8, overtimeHours: 0, transferHours: 0, tripleHours: 0,
    requiredHours: daily.value.requiredHours, entries: {},
  }
}
function setDaily(queueName, field, raw) {
  const value = raw === '' || raw == null ? 0 : Number(raw)
  if (!daily.value.entries) daily.value.entries = {}
  const bucket = daily.value.entries[queueName] || { actualAht: 0, auditCount: 0 }
  bucket[field] = Number.isFinite(value) ? value : 0
  daily.value.entries[queueName] = bucket
}
/** 把当天的输入套用同一套公式算一遍：只是把「月要求工时」换成当天的口径。 */
const dailyRows = computed(() => queues.value.map((queue) => {
  const bucket = daily.value.entries?.[queue.name] || { actualAht: 0, auditCount: 0 }
  const numbers = entryNumbers(bucket, { requiredHours: daily.value.requiredHours }, queue, constants.value)
  return { queue, entry: bucket, numbers }
}))
const dailyTotals = computed(() => {
  let auditCount = 0
  let auditPay = 0
  let standardSeconds = 0
  let actualSeconds = 0
  for (const row of dailyRows.value) {
    auditCount += row.numbers.auditCount
    auditPay += row.numbers.auditPay
    standardSeconds += row.numbers.standardSeconds
    actualSeconds += row.numbers.actualSeconds
  }
  const availableSeconds = ((Number(daily.value.hours) + Number(daily.value.overtimeHours)) * constants.value.factor - Number(daily.value.transferHours)) * 3600
  const overtimePay = Number(daily.value.overtimeHours) * constants.value.overtimeRate
  const triplePay = Number(daily.value.tripleHours) * constants.value.tripleRate
  return {
    auditCount,
    auditPay,
    standardSeconds,
    actualSeconds,
    efficiency: actualSeconds > 0 ? standardSeconds / actualSeconds : 0,
    completion: availableSeconds > 0 ? standardSeconds / availableSeconds : 0,
    overtimePay,
    triplePay,
    total: auditPay + overtimePay + triplePay,
  }
})

// ---- 计算 ------------------------------------------------------------------
const computedAll = computed(() => computeAll(members.value, entries.value, queues.value, constants.value))
const summary = computed(() => computedAll.value.summary)
const rowByMember = computed(() => new Map(computedAll.value.rows.map((r) => [r.member.id, r])))

const checkHours = computed(() => {
  const values = members.value.map((m) => Number(m.requiredHours)).filter((v) => v > 0)
  if (!values.length) return DEFAULT_REQUIRED_HOURS
  return values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
})
const checks = computed(() => priceCheck(queues.value, checkHours.value, constants.value))
const checksBad = computed(() => checks.value.filter((c) => !c.ok).length)

// ---- 录入：两种视图 --------------------------------------------------------
// 「按员工」是用户画的草图：一行一个员工，后面跟 队列 / 实际AHT / 审核量。
// 「按队列」是选一个队列看全员，配合「截一个队列的图」的导入流程更顺。
const entryView = ref('byMember')
// 三薪日一个月就那么几天，所以这一列默认收起来，需要时再打开，免得日常录入被打扰。
const showTriple = ref(readStoredJson('weiwei-blog-perf-show-triple-v1', false))
watch(showTriple, (v) => writeStoredJson('weiwei-blog-perf-show-triple-v1', v))

const activeQueue = ref(queues.value[0]?.name || '')
const activeQueueConfig = computed(() => queues.value.find((q) => q.name === activeQueue.value) || null)
const activePrice = computed(() => entryNumbers({ auditCount: 0, actualAht: 0 }, { requiredHours: checkHours.value }, activeQueueConfig.value, constants.value))

/** 一位员工在某个队列上的明细（没有就返回 null）。 */
function findEntry(memberId, queue) {
  return entries.value.find((e) => e.memberId === memberId && e.queue === queue) || null
}

/** 按员工视图里，这位员工要显示/编辑的那条明细：优先他负责的队列，否则取第一条。 */
function primaryEntry(member) {
  if (member.queue) {
    const hit = findEntry(member.id, member.queue)
    if (hit) return hit
  }
  return entries.value.find((e) => e.memberId === member.id) || null
}

/** 直接改格子：没有这条记录就按需创建，所以可以像表格一样随手填。 */
function setCell(memberId, field, raw, queue) {
  const target = queue || activeQueue.value
  let entry = findEntry(memberId, target)
  const value = raw === '' || raw == null ? 0 : Number(raw)
  if (!entry) {
    if (!value) return
    entry = { ...emptyEntry(memberId, target), [field]: value }
    entries.value.push(entry)
    return
  }
  entry[field] = Number.isFinite(value) ? value : 0
}

/** 按员工视图里改队列：把已有明细一起挪过去，避免留下一条空的旧记录。 */
function setMemberQueue(member, next) {
  const previous = member.queue
  member.queue = next
  if (!next) return
  const existing = previous ? findEntry(member.id, previous) : entries.value.find((e) => e.memberId === member.id)
  if (!existing) return
  if (findEntry(member.id, next)) {
    entries.value = entries.value.filter((e) => e.id !== existing.id)
    return
  }
  existing.queue = next
}

// 「按员工」= 针对某一个人的全部队列逐个录入。和「按队列」正好互补：
//   按队列：一次填一个队列里的所有人（配合整段文本/截图导入）
//   按员工：一次填一个人的所有队列
const activeMemberId = ref('')
const activeMember = computed(() => members.value.find((m) => m.id === activeMemberId.value) || members.value[0] || null)
watch(members, (list) => {
  if (list.length && !list.some((m) => m.id === activeMemberId.value)) activeMemberId.value = list[0].id
}, { immediate: true })

const memberQueueRows = computed(() => {
  const member = activeMember.value
  if (!member) return []
  return queues.value.map((queue) => {
    const entry = findEntry(member.id, queue.name)
    const numbers = entry ? entryNumbers(entry, member, queue, constants.value) : null
    return { queue, entry, numbers }
  })
})
const memberSummary = computed(() => {
  const member = activeMember.value
  if (!member) return null
  return rowByMember.value.get(member.id)?.result || null
})
const memberFilled = computed(() => memberQueueRows.value.filter((r) => r.numbers && (r.numbers.auditCount || r.numbers.actualAht)).length)

// ---- 两栏布局用的列表与筛选 -------------------------------------------------
const pickerQuery = ref('')
const filteredMembers = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  if (!q) return members.value
  return members.value.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q))
})
const filteredQueues = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  if (!q) return queues.value
  return queues.value.filter((item) => item.name.toLowerCase().includes(q))
})

/** 每个队列的当月小计，用于左侧队列列表上显示金额。 */
const queueTotalsAll = computed(() => {
  const out = new Map()
  for (const queue of queues.value) out.set(queue.name, { pay: 0, auditCount: 0, people: 0, standard: 0, actual: 0 })
  for (const row of computedAll.value.rows) {
    for (const line of row.result.lines) {
      const bucket = out.get(line.entry.queue)
      if (!bucket) continue
      bucket.pay += line.numbers.auditPay
      bucket.auditCount += line.numbers.auditCount
      bucket.standard += line.numbers.standardSeconds
      bucket.actual += line.numbers.actualSeconds
      if (line.numbers.auditCount) bucket.people += 1
    }
  }
  for (const bucket of out.values()) bucket.efficiency = bucket.actual > 0 ? bucket.standard / bucket.actual : 0
  return out
})

// ---- 队列管理：名字 + KPI，其余全由 KPI 派生 --------------------------------
// 新增队列用行内表单，不再用 window.prompt（两个弹框太糙，而且没法校验）
const queueForm = ref({ open: false, name: '', kpi: '', error: '' })
const highlightedQueue = ref('')
let highlightTimer
function openQueueForm() {
  queueForm.value = { open: true, name: '', kpi: '', error: '' }
}
function cancelQueueForm() {
  queueForm.value = { open: false, name: '', kpi: '', error: '' }
}
function submitQueue() {
  const name = String(queueForm.value.name || '').trim()
  if (!name) { queueForm.value.error = '请填队列名称'; return }
  if (queues.value.some((q) => q.name === name)) { queueForm.value.error = '已经有同名队列了'; return }
  const kpi = Math.max(0, Math.round(Number(queueForm.value.kpi) || 0))
  queues.value.push({ name, kpi })
  highlightedQueue.value = name
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { highlightedQueue.value = '' }, 2200)
  cancelQueueForm()
}

function removeQueue(name) {
  const used = entries.value.filter((e) => e.queue === name).length
  const message = used ? `「${name}」上还有 ${used} 条数据，删掉队列会一起删掉，确定吗？` : `删除队列「${name}」？`
  if (typeof window !== 'undefined' && !window.confirm(message)) return
  queues.value = queues.value.filter((q) => q.name !== name)
  entries.value = entries.value.filter((e) => e.queue !== name)
  if (activeQueue.value === name) activeQueue.value = queues.value[0]?.name || ''
}

const queueRows = computed(() => {
  const name = activeQueue.value
  return members.value.map((member) => {
    const entry = findEntry(member.id, name)
    const numbers = entry ? entryNumbers(entry, member, activeQueueConfig.value, constants.value) : null
    return { member, entry, numbers }
  })
})
const queueTotals = computed(() => {
  let auditCount = 0
  let standard = 0
  let actual = 0
  let pay = 0
  for (const row of queueRows.value) {
    if (!row.numbers) continue
    auditCount += row.numbers.auditCount
    standard += row.numbers.standardSeconds
    actual += row.numbers.actualSeconds
    pay += row.numbers.auditPay
  }
  return {
    auditCount,
    standardHours: standard / 3600,
    hours: actual / 3600,
    efficiency: actual > 0 ? standard / actual : 0,
    pay,
  }
})

/** 直接改格子：没有这条记录就按需创建，所以可以像表格一样随手填。 */
function clearQueue() {
  if (typeof window !== 'undefined' && !window.confirm(`清空「${activeQueue.value}」这个队列里所有人的数据？`)) return
  entries.value = entries.value.filter((e) => e.queue !== activeQueue.value)
}

// ---- 员工名单 --------------------------------------------------------------
const bulkOpen = ref(false)
const bulkText = ref('')
const bulkMessage = ref('')
function addMember() {
  const fresh = emptyMember(checkHours.value)
  members.value.push(fresh)
  tab.value = 'roster'
}
function removeMember(id) {
  const member = members.value.find((m) => m.id === id)
  const name = member?.name || '这个人'
  if (typeof window !== 'undefined' && !window.confirm(`删除「${name}」以及他在所有队列里的数据？`)) return
  members.value = members.value.filter((m) => m.id !== id)
  entries.value = entries.value.filter((e) => e.memberId !== id)
}
function bulkAdd() {
  const lines = bulkText.value.split(/[\n,;，；]+/).map((s) => s.trim()).filter(Boolean)
  let added = 0
  let skipped = 0
  for (const line of lines) {
    const email = line.includes('@') ? line.toLowerCase() : ''
    if (email && members.value.some((m) => (m.email || '').toLowerCase() === email)) { skipped += 1; continue }
    const member = emptyMember(checkHours.value)
    member.email = email
    member.name = email ? nameFromEmail(email) : line
    // 同一个工号不要重复加
    const no = email.split('@')[0].match(/(\d{3,})$/)
    if (no && members.value.some((m) => (m.email || '').includes(no[1]))) { skipped += 1; continue }
    members.value.push(member)
    added += 1
  }
  bulkMessage.value = `新增 ${added} 人${skipped ? `，跳过 ${skipped} 个重复的` : ''}。`
  bulkText.value = ''
  if (added) bulkOpen.value = false
}
function applyHoursToAll() {
  const value = Number(promptRef.value)
  if (!Number.isFinite(value) || value <= 0) return
  for (const member of members.value) member.requiredHours = value
}
const promptRef = ref(String(DEFAULT_REQUIRED_HOURS))

// ---- 格式化 ----------------------------------------------------------------
const money = (v) => (Number.isFinite(v) ? v.toFixed(2) : '0.00')
const price = (v) => (Number.isFinite(v) ? v.toFixed(7) : '0.0000000')
const percent = (v) => (Number.isFinite(v) && v > 0 ? `${(v * 100).toFixed(1)}%` : '—')
const hoursText = (seconds) => (Number.isFinite(seconds) ? (seconds / 3600).toFixed(2) : '0.00')
const compact = (v) => (v >= 10000 ? `${(v / 10000).toFixed(1)} 万` : String(Math.round(v || 0)))

/** 导出 Excel：每个员工一张明细表，外加一张全组总表。CSV 放不下多张表，所以用 xlsx。 */
async function exportWorkbook() {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const safe = (name) => String(name || '未命名').replace(/[\\/?*\[\]:]/g, '_').slice(0, 28) || '未命名'

  // ---- 总表：一行一个员工 ----
  const summaryHead = ['姓名', '邮箱', '队列', '审核量', '其中三薪日', '计件量', '队列数',
    '审核效率', '完成度', '月要求工时', '月实际工时', '抽调时长', '加班时长', '三薪时长',
    '审核工资', '补时工资', '加班工资', '三薪工资', '本月合计']
  const summaryRows = [summaryHead]
  for (const row of computedAll.value.rows) {
    const m = row.member
    const r = row.result
    summaryRows.push([
      m.name || '', m.email || '', queueListOf(row).join('、'), r.auditCount, r.tripleCount, r.pieceCount,
      r.lines.length,
      r.efficiency, r.completion, Number(m.requiredHours) || 0, r.actualHours,
      Number(m.transferHours) || 0, Number(m.overtimeHours) || 0, Number(m.tripleHours) || 0,
      r.auditPay, r.subsidyPay, r.overtimePay, r.triplePay, r.total,
    ])
  }
  // 把效率/完成度写成百分数
  for (let i = 1; i < summaryRows.length; i += 1) {
    summaryRows[i][8] = pctText(summaryRows[i][8])
    summaryRows[i][9] = pctText(summaryRows[i][9])
  }
  summaryRows.push([])
  summaryRows.push(['全组合计', '', summary.value.headcount, summary.value.auditCount, summary.value.tripleCount, summary.value.pieceCount,
    '', '', pctText(summary.value.efficiency), '', '', summary.value.hours, '', '', '',
    summary.value.auditTotal, '', '', '', summary.value.total])
  const ws = XLSX.utils.aoa_to_sheet(summaryRows)
  ws['!cols'] = summaryHead.map((h, i) => ({ wch: i === 1 ? 30 : Math.max(9, String(h).length * 2) }))
  XLSX.utils.book_append_sheet(wb, ws, '全组总表')

  // ---- 每个员工一张表：他的每个队列一行 ----
  for (const row of computedAll.value.rows) {
    const m = row.member
    const head = ['队列', 'KPI', '标准AHT', '单价', '实际AHT', '审核量', '其中三薪日', '计件量',
      '标准时长(h)', '实际时长(h)', '审核效率', '审核工资']
    const rows = [head]
    for (const line of row.result.lines) {
      const n = line.numbers
      rows.push([line.entry.queue, n.kpi, n.standardAht, n.unitPrice, n.actualAht, n.auditCount, n.tripleCount,
        n.pieceCount, Number((n.standardSeconds / 3600).toFixed(2)), Number((n.actualSeconds / 3600).toFixed(2)),
        pctText(n.actualSeconds > 0 ? n.standardSeconds / n.actualSeconds : 0), n.auditPay])
    }
    const r = row.result
    rows.push([])
    rows.push(['本月合计', '', '', '', '', r.auditCount, r.tripleCount, r.pieceCount, '', '',
      pctText(r.efficiency), r.auditPay])
    rows.push(['审核工资', r.auditPay])
    rows.push(['补时工资', r.subsidyPay])
    rows.push(['加班工资', r.overtimePay])
    rows.push(['三薪工资', r.triplePay])
    rows.push(['总计', r.total])
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = head.map((h) => ({ wch: Math.max(10, String(h).length * 2) }))
    XLSX.utils.book_append_sheet(wb, sheet, safe(m.name || m.email))
  }

  XLSX.writeFile(wb, `绩效_${month.value || 'export'}.xlsx`)
}

// ---- 导入 ------------------------------------------------------------------
// 说明：这一段曾在改导出函数时被误删（替换范围跨过了它），导致「导入截图」标签页
// 一点就抛 TypeError、页面切不过去。现在补回来。
const importQueue = ref('')
const importRows = ref([])
const importText = ref('')
const importBusy = ref(false)
const importMessage = ref('')
const screenshotInput = ref(null)

function setParsed(text, confidence = null) {
  const parsed = mergeRows(parseRows(text)).map((row) => {
    const hit = matchMember(row, members.value)
    return {
      ...row,
      matchedId: hit.member?.id || '',
      matchedName: hit.member?.name || '',
      matchReason: hit.reason,
    }
  })
  importRows.value = parsed
  if (!parsed.length) {
    importMessage.value = '没有识别到数据行。可以直接从页面复制文本粘贴到上面。'
    return
  }
  const matched = parsed.filter((row) => row.matchedId).length
  importMessage.value = `识别出 ${parsed.length} 行，其中 ${matched} 行匹配到了名单里的人。`
  if (confidence != null) importMessage.value += `（识别置信度 ${Math.round(confidence)}%）`
  const inferred = parsed.filter((row) => row.inferredDecimal).length
  if (inferred) importMessage.value += ` 有 ${inferred} 行的小数点是推断出来的，请核对。`
}
function parsePasted() { setParsed(importText.value) }

/** 写入前的预览：会更新谁、会新建谁。 */
const importPlan = computed(() => {
  let update = 0
  let create = 0
  for (const row of importRows.value) {
    if (row.matchedId) update += 1
    else create += 1
  }
  return { update, create, total: importRows.value.length }
})

/** 拿到一张截图就开始识别（本地选择、Ctrl+V 粘贴、拖拽都走这里）。 */
async function processImageFile(file) {
  if (!file || !String(file.type).startsWith('image/')) return
  importBusy.value = true
  importMessage.value = '正在识别图片…首次会下载中英文识别模型（约 20 MB）。'
  importRows.value = []
  try {
    const { text, confidence } = await recognizeImage(file, (p) => {
      if (p.progress) importMessage.value = `正在识别图片… ${Math.round(p.progress * 100)}%`
    })
    importText.value = text
    setParsed(text, confidence)
  } catch (error) {
    importMessage.value = `识别失败：${error.message}。可以直接从页面复制文本粘贴。`
  } finally {
    importBusy.value = false
  }
}

async function handleScreenshot(event) {
  const file = event.target.files?.[0]
  if (screenshotInput.value) screenshotInput.value.value = ''
  await processImageFile(file)
}

/** Ctrl+V：剪贴板里是图片就识别，是文本就直接当粘贴内容解析。 */
function handlePaste(event) {
  // 只在「导入截图」页生效，免得在别处 Ctrl+V 被吃掉
  if (tab.value !== 'import') return
  const data = event.clipboardData
  if (!data) return
  const items = data.items ? [...data.items] : []
  for (const item of items) {
    if (item.kind === 'file' && String(item.type).startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        event.preventDefault()
        processImageFile(file)
        return
      }
    }
  }
  const text = data.getData ? data.getData('text') : ''
  if (text && text.includes('@')) {
    event.preventDefault()
    importText.value = text
    setParsed(text)
  }
}

/** 拖一张图片进来。 */
function handleDrop(event) {
  event.preventDefault()
  dropActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) processImageFile(file)
}
const dropActive = ref(false)

function applyImport() {
  const queueName = activeQueue.value
  if (!importRows.value.length || !queueName) return
  let updated = 0
  let created = 0
  let lastMemberId = ''
  for (const row of importRows.value) {
    if (row.auditCount == null && row.actualAht == null) continue
    let member = members.value.find((m) => m.id === row.matchedId)
    if (!member) {
      member = emptyMember(checkHours.value)
      member.name = row.nameGuess || row.name || `工号${row.employeeNo || ''}`
      member.email = row.email || (row.employeeNo ? `no${row.employeeNo}@imported` : '')
      members.value.push(member)
      created += 1
    }
    let entry = entries.value.find((e) => e.memberId === member.id && e.queue === queueName)
    if (!entry) { entry = emptyEntry(member.id, queueName); entries.value.push(entry) }
    if (row.actualAht != null) entry.actualAht = row.actualAht
    if (row.auditCount != null) entry.auditCount = row.auditCount
    updated += 1
    lastMemberId = member.id
  }
  importMessage.value = `已把 ${updated} 行写入「${queueName}」${created ? `，并新增 ${created} 人` : ''}。`
  importRows.value = []
  importText.value = ''
  tab.value = 'entry'
  if (lastMemberId) activeMemberId.value = lastMemberId
}

/** 一个人做过的队列，按审核量从多到少。跨队列平均 AHT 没有意义（各队列标准 AHT 差上百倍），
 *  所以界面上展示「他做了哪些队列」而不是一个平均出来的 AHT。 */
function queueListOf(row) {
  return row.result.lines
    .filter((line) => line.numbers.auditCount > 0)
    .sort((a, b) => b.numbers.auditCount - a.numbers.auditCount)
    .map((line) => line.entry.queue)
}

/** 一个人跨队列时的加权平均 AHT（给总表用）。 */
function rowAvgAht(row, key) {
  let weighted = 0
  let total = 0
  for (const line of row.result.lines) {
    weighted += (line.numbers[key] || 0) * (line.numbers.auditCount || 0)
    total += line.numbers.auditCount || 0
  }
  return total > 0 ? Number((weighted / total).toFixed(2)) : 0
}
const pctText = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : '')

function backToBlog() { router.push({ name: 'home' }) }
</script>

<template>
  <div class="perf-tool" :class="{ 'is-readonly': readOnly }">
    <header class="perf-bar">
      <div class="perf-bar-left">
        <span class="perf-mark">¥</span>
        <div><strong>绩效计算器</strong><small>审核小组月度绩效</small></div>
        <input class="perf-month" type="month" v-model="month" aria-label="月份" />
        <label v-if="workspaces.length > 1" class="perf-owner-pick">
          <span>数据来源</span>
          <select :value="activeOwnerId" aria-label="选择要查看的账号数据" @change="selectWorkspace($event.target.value)">
            <option v-for="item in workspaces" :key="item.ownerId" :value="item.ownerId">{{ item.ownerName || `账号 ${item.ownerId}` }}</option>
          </select>
        </label>
      </div>
      <div class="perf-bar-right">
        <span class="perf-sync" :class="syncState">{{ syncMessage || syncLabel }}</span>
        <button class="perf-btn" :disabled="!members.length" @click="exportWorkbook">导出 Excel</button>
        <button class="perf-btn primary" @click="backToBlog">← 返回博客</button>
      </div>
    </header>

    <p v-if="readOnly" class="perf-readonly-note">
      <strong>公开只读</strong>
      绩效数据对所有人开放，登录不登录都看得到；当前显示的是「{{ activeOwnerName }}」的那一份。<template v-if="!auth.isLoggedIn">登录后可以编辑自己账号的数据。</template><template v-else>这不是你自己的数据，所以只能查看。</template>
    </p>

    <main class="perf-body">
      <nav class="perf-tabs">
        <button v-for="t in tabs" :key="t.id" :class="{ active: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
      </nav>

      <!-- 录数据：选队列 -> 填每个人的 AHT 与审核量 -->
      <section v-if="tab === 'entry'" class="perf-panel split-panel">
        <div v-if="!members.length" class="perf-empty">
          <h3>先在「员工名单」里把人加进来</h3>
          <p>名单建好以后，回到这里就能左边点人、右边填数据。</p>
          <div class="perf-empty-actions"><button class="perf-btn primary" @click="tab = 'roster'">去员工名单</button></div>
        </div>

        <template v-else>
          <div class="perf-view-toggle">
            <button :class="{ active: entryView === 'byMember' }" @click="entryView = 'byMember'">按员工</button>
            <button :class="{ active: entryView === 'byQueue' }" @click="entryView = 'byQueue'">按队列</button>
            <span class="perf-hint">
              {{ entryView === 'byMember'
                ? '左边点一个人，右边填他在各个队列的数据。'
                : '左边点一个队列，右边填这个队列里所有人的数据。' }}
            </span>
            <button class="perf-btn" :class="{ on: showTriple }" @click="showTriple = !showTriple">
              {{ showTriple ? '隐藏三薪列' : '显示三薪列' }}
            </button>
          </div>

          <div class="perf-split">
            <!-- 左：清单 -->
            <aside class="perf-picker">
              <input v-model="pickerQuery" class="perf-picker-search" type="search" :placeholder="entryView === 'byMember' ? '搜索员工' : '搜索队列'" />
              <div class="perf-picker-list">
                <template v-if="entryView === 'byMember'">
                  <button
                    v-for="member in filteredMembers" :key="member.id"
                    :class="{ active: member.id === activeMemberId }"
                    @click="activeMemberId = member.id"
                  >
                    <span class="pk-name">{{ member.name || member.email || '（未命名）' }}</span>
                    <span class="pk-meta">{{ (rowByMember.get(member.id)?.result.auditCount || 0).toLocaleString('en-US') }} 条</span>
                    <span class="pk-money">¥ {{ money(rowByMember.get(member.id)?.result.total || 0) }}</span>
                  </button>
                </template>
                <template v-else>
                  <button
                    v-for="queue in filteredQueues" :key="queue.name"
                    :class="{ active: queue.name === activeQueue }"
                    @click="activeQueue = queue.name"
                  >
                    <span class="pk-name">{{ queue.name }}</span>
                    <span class="pk-meta">KPI {{ queue.kpi || '—' }}</span>
                    <span class="pk-money">¥ {{ money(queueTotalsAll.get(queue.name)?.pay || 0) }}</span>
                  </button>
                </template>
              </div>
            </aside>

            <!-- 右：数据 -->
            <div class="perf-split-body">
              <!-- 按员工 -->
              <template v-if="entryView === 'byMember'">
                <div class="perf-summary-line">
                  <strong>{{ activeMember?.name || '—' }}</strong>
                  <span>审核量 <b>{{ (memberSummary?.auditCount || 0).toLocaleString('en-US') }}</b></span>
                  <span>审核效率 <b>{{ percent(memberSummary?.efficiency) }}</b></span>
                  <span>完成度 <b>{{ percent(memberSummary?.completion) }}</b></span>
                  <span>月实际工时 <b>{{ (memberSummary?.actualHours || 0).toFixed(2) }} h</b></span>
                  <span>合计 <b class="hl">¥ {{ money(memberSummary?.total || 0) }}</b></span>
                </div>
                <div class="perf-list">
                  <table class="perf-grid">
                    <thead>
                      <tr>
                        <th>队列</th>
                        <th class="num">标准AHT</th>
                        <th class="num">单价</th>
                        <th class="num input-col">实际 AHT</th>
                        <th class="num input-col">审核量</th>
                        <th v-if="showTriple" class="num input-col triple-col">其中三薪日</th>
                        <th v-if="showTriple" class="num">计件量</th>
                        <th class="num">标准时长</th>
                        <th class="num">实际时长</th>
                        <th class="num">审核效率</th>
                        <th class="num">完成度</th>
                        <th class="num">审核工资</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in memberQueueRows" :key="row.queue.name" :class="{ done: row.numbers && row.numbers.auditCount }">
                        <td class="name">{{ row.queue.name }}</td>
                        <td class="num muted">{{ row.numbers ? row.numbers.standardAht : ahtOf(row.queue.kpi, constants) }}</td>
                        <td class="num muted">{{ price(row.numbers ? row.numbers.unitPrice : entryNumbers({ auditCount: 0 }, activeMember, row.queue, constants).unitPrice) }}</td>
                        <td class="num input-col">
                          <small class="cell-label">实际 AHT</small>
                          <input type="number" step="0.01" class="perf-cell" :value="row.entry?.actualAht || ''" placeholder="—"
                            @input="setCell(activeMember.id, 'actualAht', $event.target.value, row.queue.name)" />
                        </td>
                        <td class="num input-col">
                          <small class="cell-label">审核量</small>
                          <input type="number" step="1" class="perf-cell" :value="row.entry?.auditCount || ''" placeholder="—"
                            @input="setCell(activeMember.id, 'auditCount', $event.target.value, row.queue.name)" />
                        </td>
                        <td v-if="showTriple" class="num input-col triple-col">
                          <small class="cell-label">其中三薪日</small>
                          <input type="number" step="1" class="perf-cell" :value="row.entry?.tripleCount || ''" placeholder="0"
                            @input="setCell(activeMember.id, 'tripleCount', $event.target.value, row.queue.name)" />
                        </td>
                        <td v-if="showTriple" class="num">{{ row.numbers ? row.numbers.pieceCount.toLocaleString('en-US') : '—' }}</td>
                        <td class="num muted">{{ row.numbers ? hoursText(row.numbers.standardSeconds) + ' h' : '—' }}</td>
                        <td class="num muted">{{ row.numbers ? hoursText(row.numbers.actualSeconds) + ' h' : '—' }}</td>
                        <td class="num" :class="{ good: row.numbers && row.numbers.actualSeconds > 0 && row.numbers.standardSeconds / row.numbers.actualSeconds >= 1 }">
                          {{ row.numbers && row.numbers.actualSeconds > 0 ? percent(row.numbers.standardSeconds / row.numbers.actualSeconds) : '—' }}
                        </td>
                        <td class="num">{{ row.numbers && row.numbers.actualSeconds > 0 && memberSummary?.actualHours ? percent(row.numbers.standardSeconds / (((Number(activeMember.requiredHours) + Number(activeMember.overtimeHours)) * constants.factor - Number(activeMember.transferHours)) * 3600)) : '—' }}</td>
                        <td class="num total">{{ row.numbers ? '¥ ' + money(row.numbers.auditPay) : '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="perf-breakdown">
                  <div><small>审核工资</small><strong>¥ {{ money(memberSummary?.auditPay || 0) }}</strong></div>
                  <div><small>补时工资</small><strong>¥ {{ money(memberSummary?.subsidyPay || 0) }}</strong></div>
                  <div><small>加班工资</small><strong>¥ {{ money(memberSummary?.overtimePay || 0) }}</strong></div>
                  <div><small>三薪工资</small><strong>¥ {{ money(memberSummary?.triplePay || 0) }}</strong></div>
                  <div class="grand"><small>本月合计</small><strong>¥ {{ money(memberSummary?.total || 0) }}</strong></div>
                </div>
              </template>

              <!-- 按队列 -->
              <template v-else>
                <div class="perf-summary-line">
                  <strong>{{ activeQueue }}</strong>
                  <span>KPI <b>{{ activeQueueConfig?.kpi || '—' }}</b></span>
                  <span>标准 AHT <b>{{ activePrice.standardAht || '—' }}</b></span>
                  <span>单价 <b>{{ price(activePrice.unitPrice) }}</b></span>
                  <span>审核效率 <b>{{ percent(queueTotals.efficiency) }}</b></span>
                  <span>已填 <b>{{ filledCount }}</b> / {{ members.length }}</span>
                  <span>合计 <b class="hl">¥ {{ money(queueTotals.pay) }}</b></span>
                </div>
                <div class="perf-list">
                  <table class="perf-grid">
                    <thead>
                      <tr>
                        <th>员工</th>
                        <th class="num input-col">实际 AHT</th>
                        <th class="num input-col">审核量</th>
                        <th v-if="showTriple" class="num input-col triple-col">其中三薪日</th>
                        <th v-if="showTriple" class="num">计件量</th>
                        <th class="num">标准时长</th>
                        <th class="num">实际时长</th>
                        <th class="num">审核效率</th>
                        <th class="num">审核工资</th>
                        <th class="num">本月合计</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in queueRows" :key="row.member.id" :class="{ done: row.numbers && row.numbers.auditCount }">
                        <td class="name">{{ row.member.name || '（未命名）' }}</td>
                        <td class="num input-col">
                          <small class="cell-label">实际 AHT</small>
                          <input type="number" step="0.01" class="perf-cell" :value="row.entry?.actualAht || ''" placeholder="—"
                            @input="setCell(row.member.id, 'actualAht', $event.target.value)" />
                        </td>
                        <td class="num input-col">
                          <small class="cell-label">审核量</small>
                          <input type="number" step="1" class="perf-cell" :value="row.entry?.auditCount || ''" placeholder="—"
                            @input="setCell(row.member.id, 'auditCount', $event.target.value)" />
                        </td>
                        <td v-if="showTriple" class="num input-col triple-col">
                          <small class="cell-label">其中三薪日</small>
                          <input type="number" step="1" class="perf-cell" :value="row.entry?.tripleCount || ''" placeholder="0"
                            @input="setCell(row.member.id, 'tripleCount', $event.target.value)" />
                        </td>
                        <td v-if="showTriple" class="num">{{ row.numbers ? row.numbers.pieceCount.toLocaleString('en-US') : '—' }}</td>
                        <td class="num muted">{{ row.numbers ? hoursText(row.numbers.standardSeconds) + ' h' : '—' }}</td>
                        <td class="num muted">{{ row.numbers ? hoursText(row.numbers.actualSeconds) + ' h' : '—' }}</td>
                        <td class="num" :class="{ good: row.numbers && row.numbers.actualSeconds > 0 && row.numbers.standardSeconds / row.numbers.actualSeconds >= 1 }">
                          {{ row.numbers && row.numbers.actualSeconds > 0 ? percent(row.numbers.standardSeconds / row.numbers.actualSeconds) : '—' }}
                        </td>
                        <td class="num total">{{ row.numbers ? '¥ ' + money(row.numbers.auditPay) : '—' }}</td>
                        <td class="num">¥ {{ money(rowByMember.get(row.member.id)?.result.total || 0) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>小计 · {{ activeQueue }}</td>
                        <td colspan="2" class="num">{{ (queueTotals.auditCount || 0).toLocaleString('en-US') }} 条</td>
                        <td v-if="showTriple" colspan="2"></td>
                        <td class="num">{{ queueTotals.standardHours.toFixed(2) }} h</td>
                        <td class="num">{{ queueTotals.hours.toFixed(2) }} h</td>
                        <td class="num">{{ percent(queueTotals.efficiency) }}</td>
                        <td class="num">¥ {{ money(queueTotals.pay) }}</td>
                        <td class="num total">¥ {{ money(queueTotals.pay) }}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </template>
            </div>
          </div>
        </template>
      </section>

      <!-- 员工名单：一个月只填一次的固定项 -->
      <section v-else-if="tab === 'roster'" class="perf-panel">
        <div class="perf-overview-bar">
          <button class="perf-btn primary" @click="addMember">＋ 添加一人</button>
          <button class="perf-btn" @click="bulkOpen = !bulkOpen">批量粘贴邮箱</button>
          <span class="perf-hint">这里的四项每人只需填一次，之后每月只改队列里的 AHT 与审核量。</span>
        </div>

        <div v-if="bulkOpen" class="perf-card">
          <h3>批量添加：每行一个邮箱（姓名自动取邮箱前缀）</h3>
          <textarea v-model="bulkText" rows="5" placeholder="zhangsan.1001@example.com&#10;lisi.1002@example.com"></textarea>
          <div class="perf-overview-bar">
            <button class="perf-btn primary" :disabled="!bulkText.trim()" @click="bulkAdd">添加</button>
            <span v-if="bulkMessage" class="perf-hint">{{ bulkMessage }}</span>
          </div>
        </div>

        <div v-if="!members.length" class="perf-empty">
          <h3>还没有人</h3>
          <p>点「批量粘贴邮箱」一次把小组的人贴进来，或点「添加一人」逐个加。</p>
        </div>

        <div v-else class="perf-list">
          <table class="perf-grid roster">
            <thead>
              <tr>
                <th>姓名</th><th>邮箱</th>
                <th class="num">月要求工时</th><th class="num">抽调时长</th><th class="num">加班时长</th><th class="num">三薪时长</th>
                <th class="num">月实际工时</th><th class="num">合计</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in members" :key="member.id">
                <td><input v-model="member.name" class="perf-cell" /></td>
                <td><input v-model="member.email" class="perf-cell wide" /></td>
                <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.requiredHours" /></td>
                <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.transferHours" /></td>
                <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.overtimeHours" /></td>
                <td class="num"><input type="number" step="0.01" class="perf-cell" v-model.number="member.tripleHours" /></td>
                <td class="num muted">{{ rowByMember.get(member.id)?.result.actualHours.toFixed(2) || '0.00' }} h</td>
                <td class="num total">¥ {{ money(rowByMember.get(member.id)?.result.total || 0) }}</td>
                <td class="act"><button class="perf-del" :aria-label="`删除 ${member.name || '这个人'}`" @click="removeMember(member.id)">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="perf-overview-bar">
          <label class="perf-inline-label">把所有人的月要求工时统一设为
            <input type="number" step="0.01" class="perf-cell inline" v-model="promptRef" />
          </label>
          <button class="perf-btn" @click="applyHoursToAll">应用</button>
        </div>
      </section>

      <!-- 队列 KPI -->
      <section v-else-if="tab === 'queues'" class="perf-panel">
        <div class="perf-overview-bar">
          <button class="perf-btn primary" @click="openQueueForm">＋ 添加队列</button>
          <button class="perf-btn" @click="resetQueues">恢复默认</button>
          <span class="perf-hint">
            这里就是队列管理：给每个队列一个名字和一个 KPI。标准 AHT 和单价都由 KPI 算出来，
            改了 KPI 所有用到它的地方立刻跟着变。
          </span>
        </div>

        <!-- 新增队列：行内表单，带校验，不用弹窗 -->
        <div v-if="queueForm.open" class="queue-add">
          <span class="queue-add-title">新队列</span>
          <label>名称
            <input v-model="queueForm.name" class="perf-cell" placeholder="比如 图片" @keyup.enter="submitQueue" />
          </label>
          <label>KPI
            <input v-model="queueForm.kpi" type="number" class="perf-cell" placeholder="比如 884" @keyup.enter="submitQueue" />
          </label>
          <button class="perf-btn primary" @click="submitQueue">添加</button>
          <button class="perf-btn" @click="cancelQueueForm">取消</button>
          <span v-if="queueForm.error" class="queue-add-error">{{ queueForm.error }}</span>
          <span v-else class="perf-hint">填好 KPI 后，标准 AHT 和单价会自动算出来</span>
        </div>

        <div class="perf-list">
          <table class="perf-grid queues">
            <thead>
              <tr>
                <th>队列名称</th>
                <th class="num">KPI（每月手改）</th>
                <th class="num">标准 AHT（算出）</th>
                <th class="num">单价（算出）</th>
                <th class="num">本月审核量</th>
                <th class="num">本月人数</th>
                <th class="num">本月工资</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(queue, index) in queues" :key="queue.name + index" :class="{ fresh: queue.name === highlightedQueue }">
                <td><input v-model="queue.name" class="perf-cell" /></td>
                <td class="num"><input type="number" class="perf-cell" v-model.number="queue.kpi" /></td>
                <td class="num muted">{{ ahtOf(queue.kpi, constants) || '—' }}</td>
                <td class="num muted">{{ price(entryNumbers({ auditCount: 0 }, { requiredHours: checkHours }, queue, constants).unitPrice) }}</td>
                <td class="num">{{ (queueTotalsAll.get(queue.name)?.auditCount || 0).toLocaleString('en-US') }}</td>
                <td class="num muted">{{ queueTotalsAll.get(queue.name)?.people || 0 }}</td>
                <td class="num total">¥ {{ money(queueTotalsAll.get(queue.name)?.pay || 0) }}</td>
                <td class="act"><button class="perf-del" :aria-label="`删除队列 ${queue.name}`" @click="removeQueue(queue.name)">×</button></td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>{{ queues.length }} 个队列</td>
                <td colspan="3"></td>
                <td class="num">{{ (summary.auditCount || 0).toLocaleString('en-US') }}</td>
                <td class="num">{{ summary.headcount }}</td>
                <td class="num total">¥ {{ money(summary.auditTotal) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p class="perf-hint">
          单价按 <code>1800 × 标准AHT ÷ 月要求工时 ÷ 3600 × 0.85</code> 计算，所以它会随每个人的月要求工时不同而不同，
          表里显示的是按 {{ checkHours }} 小时算出来的参考值；实际计算时用的是每个人自己的月要求工时。
        </p>
      </section>

      <!-- 数据可视化：多角度看全组 -->
      <section v-else-if="tab === 'viz'" class="perf-panel viz-panel">
        <!-- 一、关键指标 -->
        <div class="viz-stats">
          <div class="viz-stat"><small>总支出</small><strong>¥ {{ money(vizStats.total) }}</strong></div>
          <div class="viz-stat"><small>人均</small><strong>¥ {{ money(vizStats.average) }}</strong></div>
          <div class="viz-stat"><small>中位数</small><strong>¥ {{ money(vizStats.median) }}</strong></div>
          <div class="viz-stat up"><small>最高</small><strong>¥ {{ money(vizStats.max) }}</strong><span>{{ vizStats.maxName }}</span></div>
          <div class="viz-stat down"><small>最低</small><strong>¥ {{ money(vizStats.min) }}</strong><span>{{ vizStats.minName }}</span></div>
          <div class="viz-stat"><small>审核总量</small><strong>{{ (summary.auditCount || 0).toLocaleString('en-US') }}</strong></div>
          <div class="viz-stat"><small>加权效率</small><strong>{{ percent(summary.efficiency) }}</strong></div>
          <div class="viz-stat"><small>平均完成度</small><strong>{{ percent(vizStats.averageCompletion) }}</strong></div>
        </div>

        <div class="viz-grid">
          <!-- 二、薪资构成堆叠条 -->
          <article class="viz-card">
            <h4>薪资构成 <em>每人一段,四部分叠起来</em></h4>
            <div class="viz-legend">
              <span><i style="background:#8b6ce0"></i>审核</span>
              <span><i style="background:#4aa8c0"></i>补时</span>
              <span><i style="background:#46b06a"></i>加班</span>
              <span><i style="background:#e0a13f"></i>三薪</span>
            </div>
            <div class="viz-rows">
              <div v-for="row in payStacks" :key="row.id" class="viz-row">
                <span class="viz-name">{{ row.name }}</span>
                <div class="viz-track">
                  <div v-for="seg in row.segments" :key="seg.key" class="viz-seg" :style="{ width: seg.width + '%', background: seg.color }" :title="seg.label + ' ¥' + money(seg.value)"></div>
                </div>
                <span class="viz-val">¥ {{ money(row.total) }}</span>
              </div>
            </div>
          </article>

          <!-- 三、队列分布 -->
          <article class="viz-card">
            <h4>队列分布 <em>哪些队列在产钱</em></h4>
            <div v-if="!queueStats.length" class="viz-empty">还没有队列数据</div>
            <div v-else class="viz-rows">
              <div v-for="q in queueStats.slice(0, 10)" :key="q.name" class="viz-row">
                <span class="viz-name">{{ q.name }}</span>
                <div class="viz-track">
                  <div class="viz-seg" :style="{ width: q.barPercent + '%', background: 'linear-gradient(90deg,#7a52d8,#a97cf0)' }" :title="q.auditCount + ' 条'"></div>
                </div>
                <span class="viz-val">{{ q.auditCount.toLocaleString('en-US') }} · ¥{{ money(q.pay) }}</span>
              </div>
            </div>
          </article>

          <!-- 四、员工 × 队列 矩阵 -->
          <article class="viz-card wide">
            <h4>员工 × 队列 矩阵 <em>颜色越深审核量越大,一眼看出谁在哪个队列上</em></h4>
            <div v-if="!vizMatrix.rows.length" class="viz-empty">还没有数据</div>
            <div v-else class="matrix-wrap">
              <table class="matrix">
                <thead>
                  <tr>
                    <th class="matrix-corner">队列 \ 员工</th>
                    <th v-for="(name, i) in vizMatrix.cols" :key="i" class="matrix-col">{{ name.split(/[.\s]/)[0] }}</th>
                    <th class="matrix-total">合计</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in vizMatrix.rows" :key="row.queue">
                    <th class="matrix-row">{{ row.queue }}</th>
                    <td v-for="(cell, i) in row.cells" :key="i" class="matrix-cell">
                      <span
                        v-if="cell.count"
                        class="matrix-chip"
                        :style="{ background: 'color-mix(in srgb, var(--accent) ' + Math.round(18 + (cell.count / vizMatrix.max) * 72) + '%, transparent)' }"
                        :title="cell.name + ' · ' + cell.count + ' 条 · ¥' + money(cell.pay)"
                      >{{ cell.count.toLocaleString('en-US') }}</span>
                      <span v-else class="matrix-empty">·</span>
                    </td>
                    <td class="matrix-total">{{ row.total.toLocaleString('en-US') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <!-- 四、效率 × 完成度 散点 -->
          <article class="viz-card wide">
            <h4>效率 × 完成度 <em>气泡越大工资越高,虚线是平均值,右上角最好</em></h4>
            <div v-if="vizScatter.empty" class="viz-empty">还没有可比较的数据</div>
            <svg v-else class="viz-scatter" :viewBox="`0 0 ${vizScatter.W} ${vizScatter.H}`" preserveAspectRatio="xMidYMid meet">
              <!-- 四象限底色 -->
              <rect :x="vizScatter.avgX" :y="vizScatter.T" :width="vizScatter.W - vizScatter.R - vizScatter.avgX" :height="vizScatter.avgY - vizScatter.T" class="quad best" />
              <rect :x="vizScatter.L" :y="vizScatter.T" :width="vizScatter.avgX - vizScatter.L" :height="vizScatter.avgY - vizScatter.T" class="quad" />
              <rect :x="vizScatter.avgX" :y="vizScatter.avgY" :width="vizScatter.W - vizScatter.R - vizScatter.avgX" :height="vizScatter.H - vizScatter.B - vizScatter.avgY" class="quad" />
              <rect :x="vizScatter.L" :y="vizScatter.avgY" :width="vizScatter.avgX - vizScatter.L" :height="vizScatter.H - vizScatter.B - vizScatter.avgY" class="quad" />

              <!-- 网格与刻度 -->
              <g v-for="t in vizScatter.xTicks" :key="'xt' + t.v">
                <line :x1="t.x" :y1="vizScatter.T" :x2="t.x" :y2="vizScatter.H - vizScatter.B" class="grid" />
                <text :x="t.x" :y="vizScatter.H - vizScatter.B + 14" class="tick" text-anchor="middle">{{ t.label }}</text>
              </g>
              <g v-for="t in vizScatter.yTicks" :key="'yt' + t.v">
                <line :x1="vizScatter.L" :y1="t.y" :x2="vizScatter.W - vizScatter.R" :y2="t.y" class="grid" />
                <text :x="vizScatter.L - 8" :y="t.y + 3" class="tick" text-anchor="end">{{ t.label }}</text>
              </g>

              <!-- 坐标轴 -->
              <line :x1="vizScatter.L" :y1="vizScatter.H - vizScatter.B" :x2="vizScatter.W - vizScatter.R" :y2="vizScatter.H - vizScatter.B" class="axis" />
              <line :x1="vizScatter.L" :y1="vizScatter.T" :x2="vizScatter.L" :y2="vizScatter.H - vizScatter.B" class="axis" />
              <text :x="(vizScatter.W + vizScatter.L) / 2" :y="vizScatter.H - 6" class="axislabel" text-anchor="middle">审核效率（标准AHT ÷ 实际AHT）</text>
              <text :x="14" :y="vizScatter.H / 2" class="axislabel" text-anchor="middle" :transform="`rotate(-90 14 ${vizScatter.H / 2})`">完成度</text>

              <!-- 平均值十字 -->
              <line :x1="vizScatter.avgX" :y1="vizScatter.T" :x2="vizScatter.avgX" :y2="vizScatter.H - vizScatter.B" class="avgline" />
              <line :x1="vizScatter.L" :y1="vizScatter.avgY" :x2="vizScatter.W - vizScatter.R" :y2="vizScatter.avgY" class="avgline" />

              <!-- 象限说明 -->
              <text v-for="(q, i) in vizScatter.quadrants" :key="'q' + i" :x="q.x" :y="q.y" class="quadlabel" :text-anchor="q.anchor">{{ q.text }}</text>

              <!-- 数据点 -->
              <g v-for="p in vizScatter.points" :key="p.id" class="dotgroup">
                <title>{{ p.tip }}</title>
                <circle :cx="p.x" :cy="p.y" :r="p.r" class="dot" :class="{ over: p.overX || p.overY }" />
                <text
                  v-if="p.show"
                  :x="p.x"
                  :y="p.labelAbove ? p.y - p.r - 6 : p.y + p.r + 13"
                  class="dotlabel"
                  text-anchor="middle"
                >{{ p.short }}</text>
              </g>
            </svg>
          </article>

          <!-- 五、相对团队均值 -->
          <article class="viz-card wide">
            <h4>相对团队均值 <em>越往右越高,竖线是人均</em></h4>
            <div class="viz-rows">
              <div v-for="row in deviations" :key="row.id" class="viz-row dev">
                <span class="viz-name">{{ row.name }}</span>
                <div class="viz-dev-track">
                  <div class="viz-dev-mid"></div>
                  <div
                    class="viz-dev-bar"
                    :class="{ neg: row.delta < 0 }"
                    :style="row.delta >= 0 ? { left: '50%', width: row.width + '%' } : { right: '50%', width: row.width + '%' }"
                  ></div>
                </div>
                <span class="viz-val" :class="{ neg: row.delta < 0 }">{{ row.delta >= 0 ? '+' : '−' }}¥{{ money(Math.abs(row.delta)) }}</span>
              </div>
            </div>
          </article>
        </div>

        <!-- 六、可排序明细 -->
        <div class="perf-view-toggle">
          <span class="perf-hint">明细按</span>
          <button v-for="opt in rankOptions" :key="opt.id" :class="{ active: rankBy === opt.id }" @click="rankBy = opt.id">{{ opt.label }}</button>
        </div>
        <div class="perf-list">
          <table class="perf-grid">
            <thead>
              <tr>
                <th class="rank-col">#</th>
                <th>员工</th>
                <th class="bar-col">对比</th>
                <th class="num">审核量</th>
                <th>队列</th>
                <th class="num">审核效率</th>
                <th class="num">完成度</th>
                <th class="num">月实际工时</th>
                <th class="num">审核工资</th>
                <th class="num">合计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in ranked" :key="row.member.id">
                <td class="rank-col"><span class="rank-badge" :class="{ top1: index === 0, top3: index < 3 }">{{ index + 1 }}</span></td>
                <td class="name">{{ row.member.name || '（未命名）' }}</td>
                <td class="bar-col"><div class="viz-bar"><div :style="{ width: row.barPercent + '%' }"></div></div></td>
                <td class="num">{{ (row.result.auditCount || 0).toLocaleString('en-US') }}</td>
                <td class="viz-queues">
                  <span v-for="q in queueListOf(row)" :key="q" class="queue-pill">{{ q }}</span>
                  <span v-if="!queueListOf(row).length" class="muted">—</span>
                </td>
                <td class="num" :class="{ good: row.result.efficiency >= 1 }">{{ percent(row.result.efficiency) }}</td>
                <td class="num">{{ percent(row.result.completion) }}</td>
                <td class="num muted">{{ (row.result.actualHours || 0).toFixed(2) }} h</td>
                <td class="num muted">¥ {{ money(row.result.auditPay) }}</td>
                <td class="num total">¥ {{ money(row.result.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 单日计算：对应文档里的表一，独立于月度数据，只存浏览器 -->
      <section v-else-if="tab === 'daily'" class="perf-panel">
        <div class="perf-overview-bar">
          <label class="perf-inline-label">日期
            <input type="date" class="perf-cell inline" v-model="daily.date" />
          </label>
          <label class="perf-inline-label">工作时长(h)
            <input type="number" step="0.01" class="perf-cell inline" v-model.number="daily.hours" />
          </label>
          <label class="perf-inline-label">加班(h)
            <input type="number" step="0.01" class="perf-cell inline" v-model.number="daily.overtimeHours" />
          </label>
          <label class="perf-inline-label">抽调(h)
            <input type="number" step="0.01" class="perf-cell inline" v-model.number="daily.transferHours" />
          </label>
          <label class="perf-inline-label">三薪(h)
            <input type="number" step="0.01" class="perf-cell inline" v-model.number="daily.tripleHours" />
          </label>
          <label class="perf-inline-label">月要求工时
            <input type="number" step="0.01" class="perf-cell inline" v-model.number="daily.requiredHours" />
          </label>
          <button class="perf-btn" @click="resetDaily">清零</button>
        </div>
        <p class="perf-hint">
          这一天做了哪些队列就在下面填哪些。单价按上方的月要求工时计算，所以和月度数据口径一致；
          但这些数字**不会进月度合计**，只存在本机浏览器。
        </p>

        <div class="perf-list">
          <table class="perf-grid">
            <thead>
              <tr>
                <th>队列</th>
                <th class="num">标准AHT</th>
                <th class="num">单价</th>
                <th class="num input-col">实际 AHT</th>
                <th class="num input-col">审核量</th>
                <th class="num">标准时长</th>
                <th class="num">实际时长</th>
                <th class="num">队列效率</th>
                <th class="num">赚的</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in dailyRows" :key="row.queue.name" :class="{ done: row.numbers && row.numbers.auditCount }">
                <td class="name">{{ row.queue.name }}</td>
                <td class="num muted">{{ row.numbers.standardAht }}</td>
                <td class="num muted">{{ price(row.numbers.unitPrice) }}</td>
                <td class="num input-col">
                  <small class="cell-label">实际 AHT</small>
                  <input type="number" step="0.01" class="perf-cell" :value="row.entry.actualAht || ''" placeholder="—"
                    @input="setDaily(row.queue.name, 'actualAht', $event.target.value)" />
                </td>
                <td class="num input-col">
                  <small class="cell-label">审核量</small>
                  <input type="number" step="1" class="perf-cell" :value="row.entry.auditCount || ''" placeholder="—"
                    @input="setDaily(row.queue.name, 'auditCount', $event.target.value)" />
                </td>
                <td class="num muted">{{ hoursText(row.numbers.standardSeconds) }} h</td>
                <td class="num muted">{{ hoursText(row.numbers.actualSeconds) }} h</td>
                <td class="num" :class="{ good: row.numbers.actualSeconds > 0 && row.numbers.standardSeconds / row.numbers.actualSeconds >= 1 }">
                  {{ row.numbers.actualSeconds > 0 ? percent(row.numbers.standardSeconds / row.numbers.actualSeconds) : '—' }}
                </td>
                <td class="num total">¥ {{ money(row.numbers.auditPay) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="perf-breakdown">
          <div><small>总审核量</small><strong>{{ (dailyTotals.auditCount || 0).toLocaleString('en-US') }}</strong></div>
          <div><small>总标准时长</small><strong>{{ hoursText(dailyTotals.standardSeconds) }} h</strong></div>
          <div><small>总实际时长</small><strong>{{ hoursText(dailyTotals.actualSeconds) }} h</strong></div>
          <div><small>当日审核效率</small><strong>{{ percent(dailyTotals.efficiency) }}</strong></div>
          <div><small>当日完成度</small><strong>{{ percent(dailyTotals.completion) }}</strong></div>
          <div><small>审核工资</small><strong>¥ {{ money(dailyTotals.auditPay) }}</strong></div>
          <div><small>加班 / 三薪</small><strong>¥ {{ money(dailyTotals.overtimePay) }} / ¥ {{ money(dailyTotals.triplePay) }}</strong></div>
          <div class="grand"><small>当日合计</small><strong>¥ {{ money(dailyTotals.total) }}</strong></div>
        </div>
      </section>

      <!-- 导入 -->
      <section v-else-if="tab === 'import'" class="perf-import">
        <div class="perf-card">
          <h3>1. 这批数据属于哪个队列</h3>
          <select v-model="activeQueue" class="perf-wide">
            <option v-for="q in queues" :key="q.name" :value="q.name">{{ q.name }}</option>
          </select>
          <p class="perf-hint">导入会把每个人的数字写进「{{ activeQueue }}」这一列，也就是「录数据」页面选中的那个队列。</p>

          <h3>2. 上传这个队列的截图</h3>
          <div
            class="shot-zone"
            :class="{ busy: importBusy, drag: dropActive }"
            role="button"
            tabindex="0"
            @click="screenshotInput?.click()"
            @keydown.enter="screenshotInput?.click()"
            @dragover.prevent="dropActive = true"
            @dragleave="dropActive = false"
            @drop="handleDrop"
          >
            <span class="shot-icon" aria-hidden="true">⇪</span>
            <strong>{{ importBusy ? '识别中…' : '点击选择截图' }}</strong>
            <span class="shot-tip">也可以直接 <b>Ctrl + V</b> 粘贴，或把图片拖进来</span>
            <input ref="screenshotInput" type="file" accept="image/*" hidden @change="handleScreenshot" />
          </div>

          <h3>3. 或者从飞书复制文本粘贴</h3>
          <textarea v-model="importText" rows="4" placeholder="把三列连表头一起复制，粘贴到这里"></textarea>
          <button class="perf-btn" :disabled="!importText.trim()" @click="parsePasted">解析文本</button>
          <p class="perf-hint">
            名字认错不影响：匹配靠的是邮箱里的<b>工号</b>。实测你那张截图里 12 个人的工号和审核量都能正确识别，
            只有邮箱文字会被认错（域名里的 tech 会变成 fech）。
          </p>
        </div>

        <div class="perf-card">
          <h3>4. 核对并写入「{{ activeQueue }}」</h3>
          <p v-if="importMessage" class="perf-hint">{{ importMessage }}</p>
          <div v-if="importRows.length" class="perf-review">
            <table class="perf-grid">
              <thead><tr><th>工号</th><th>识别到的名字</th><th>匹配到</th><th class="num">已审数</th><th class="num">平均审核时长</th></tr></thead>
              <tbody>
                <tr v-for="(row, index) in importRows" :key="index" :class="{ unmatched: !row.matchedId }">
                  <td>{{ row.employeeNo || '—' }}</td>
                  <td><input v-model="row.nameGuess" class="perf-cell" /></td>
                  <td>
                    <select v-model="row.matchedId" class="perf-cell">
                      <option value="">（按工号新建）</option>
                      <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                    <small class="perf-sub">{{ row.matchedId ? row.matchReason : '会新建一个人' }}</small>
                  </td>
                  <td class="num"><input type="number" class="perf-cell" v-model.number="row.auditCount" /></td>
                  <td class="num">
                    <input type="number" step="0.01" class="perf-cell" v-model.number="row.actualAht" />
                    <small v-if="row.inferredDecimal" class="perf-sub warn">小数点是推断的</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="perf-hint">识别结果会显示在这里，确认无误再写入。</p>

          <!-- 二次确认：写进去之前先让人过一遍 -->
          <div v-if="importRows.length" class="perf-confirm">
            <div class="perf-confirm-text">
              将写入队列 <strong>{{ activeQueue }}</strong>：
              <strong>{{ importPlan.update }}</strong> 人更新数据<template v-if="importPlan.create">，<strong>{{ importPlan.create }}</strong> 人是新面孔（会同时加进员工名单）</template>。
            </div>
            <div class="perf-confirm-actions">
              <button class="perf-btn primary" @click="applyImport">✓ 确认写入 {{ importPlan.total }} 行</button>
              <button class="perf-btn" @click="importRows = []">取消</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 说明 -->
      <section v-else class="perf-panel">
        <div class="perf-card">
          <h3>计算公式</h3>
          <ul class="perf-formulas">
            <li><code>标准 AHT = ROUND(24480 ÷ KPI, 2)</code><span>KPI 是每月手改的输入值（「队列 KPI」里改）。</span></li>
            <li><code>单价 = 1800 × 标准AHT ÷ 月要求工时 ÷ 3600 × 0.85</code><span>用的是四舍五入到两位小数之后的 AHT；月要求工时是每人各自的。</span></li>
            <li><code>审核工资 = (审核量 − 三薪日审核量) × 单价</code><span>三薪那天按时长固定给钱，那天的审核量要从计件里剔除，否则同一批活会被付两次。三薪列默认收起来，需要时点「显示三薪列」。效率与完成度仍按全部审核量算，因为它们衡量的是实际干了多少活。</span></li>
            <li><code>标准总时长 = 标准AHT × 审核量</code>　<code>实际总时长 = 实际AHT × 审核量</code></li>
            <li><code>月实际工时 = 实际总时长 ÷ 3600</code><span>算出来的，不用填。</span></li>
            <li><code>月度审核效率 = 标准总时长 ÷ 实际总时长</code><span>小组汇总用加权（Σ标准 ÷ Σ实际）。</span></li>
            <li><code>完成度 = Σ(审核量 × 标准AHT) ÷ (((月要求工时 + 加班时长) × 0.85 − 抽调时长) × 3600)</code><span>分子就是标准总时长。抽调会从可用时间里扣掉，所以被抽调得多反而显得完成度高。</span></li>
            <li><code>补时工资 = 审核工资 × 抽调时长 × 0.85 ÷ 月实际工时</code></li>
            <li><code>加班工资 = 加班时长 × 加班单价</code>　<code>三薪工资 = 三薪时长 × 三薪单价</code></li>
            <li><code>合计 = 审核工资 + 补时工资 + 加班工资 + 三薪工资</code></li>
          </ul>
        </div>
        <div class="perf-card">
          <h3>可调常数</h3>
          <div class="perf-constants">
            <label>金额基准<input type="number" v-model.number="constants.baseAmount" /></label>
            <label>系数<input type="number" step="0.01" v-model.number="constants.factor" /></label>
            <label>KPI 常数<input type="number" v-model.number="constants.kpiBase" /></label>
            <label>加班单价 / 工时<input type="number" v-model.number="constants.overtimeRate" /></label>
            <label>三薪单价 / 工时<input type="number" v-model.number="constants.tripleRate" /></label>
            <button class="perf-btn" @click="resetConstants">恢复默认</button>
          </div>
        </div>
        <div class="perf-card">
          <h3>数据存放</h3>
          <p class="perf-hint">存在本机浏览器（键名前缀 <code>weiwei-blog-perf-</code>）。数据不敏感，需要的话可以再搬到服务器。</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* 固定高度的应用外壳：工具栏与左栏都不动，滚动只发生在各自的内容区里。
   之前整页一起滚、两个 sticky 各粘各的，滑动时好几块同时动，很难受。 */
.perf-tool{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--paper);color:var(--ink)}

/* 内容区自己不滚：汇总与标签固定，下面的板块占满剩余高度并各自处理滚动 */
.perf-body{
  flex:1;min-height:0;overflow:hidden;overscroll-behavior:contain;
  display:flex;flex-direction:column;gap:13px;
  padding:14px clamp(14px,3vw,34px) 16px;
}
/* 汇总条与标签只占自身高度；只有各个标签页的面板才撑满剩余高度并自己滚动。
   注意不能直接写 .perf-body>section —— 汇总条也是 section，会被一起撑高。 */
.perf-summary,.perf-tabs{flex:none}
.perf-body>nav{width:100%;max-width:1560px;margin:0 auto;flex:none}
.perf-body>section:is(.perf-panel,.perf-import){
  width:100%;max-width:1560px;margin:0 auto;flex:1;min-height:0;
  overflow-y:auto;overflow-x:hidden;padding-bottom:6px;overscroll-behavior:contain;
}

/* 数据总览：外面不滚，左栏和右栏各自滚 */
.perf-body>section.split-panel{overflow:hidden;display:flex;flex-direction:column}
.perf-split{flex:1;min-height:0;display:grid;grid-template-columns:minmax(180px,236px) minmax(0,1fr);gap:12px;align-items:stretch}

.perf-picker{
  display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;min-height:0;overflow:hidden;
  border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 82%,transparent);
}
.perf-picker-search{width:100%;flex:none;padding:7px 11px;border-radius:9px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 5%,transparent);color:var(--ink);font-size:12px}
.perf-picker-search:focus{outline:none;border-color:var(--accent)}
.perf-picker-list{display:grid;gap:3px;align-content:start;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.perf-picker-list button{
  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;align-items:baseline;
  padding:8px 10px;border:1px solid transparent;border-radius:10px;cursor:pointer;text-align:left;
  background:transparent;color:var(--ink);transition:background-color .22s ease,border-color .22s ease;
}
.perf-picker-list button:hover{background:color-mix(in srgb,var(--accent) 8%,transparent)}
.perf-picker-list button.active{background:color-mix(in srgb,var(--accent) 16%,transparent);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.pk-name{font-family:var(--serif);font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pk-meta{grid-column:1;font-size:10px;color:var(--muted)}
.pk-money{grid-column:2;grid-row:1/3;align-self:center;font-size:11.5px;font-weight:600;color:var(--accent);font-variant-numeric:tabular-nums}

/* 右侧：汇总条固定，表格自己滚 */
.perf-split-body{display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;overflow:hidden}
.perf-split-body>.perf-list{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}
.perf-split-body>.perf-summary-line,.perf-split-body>.perf-breakdown{flex:none}

/* 窄屏：两栏改成上下，左栏限高，右表拿到整个宽度——否则表格会被压扁、列互相遮挡 */
@media (max-width:900px){
  .perf-split{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(120px,auto) minmax(0,1fr)}
  .perf-picker{max-height:200px}
}

/* 滚动条：默认几乎看不见，悬停才亮出来，细圆角 */
.perf-body>section:is(.perf-panel,.perf-import),.perf-picker-list,.perf-split-body>.perf-list,.perf-review{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--ink) 16%,transparent) transparent}
.perf-body>section:is(.perf-panel,.perf-import)::-webkit-scrollbar,
.perf-picker-list::-webkit-scrollbar,
.perf-split-body>.perf-list::-webkit-scrollbar,
.perf-review::-webkit-scrollbar{width:9px;height:9px}
.perf-body>section:is(.perf-panel,.perf-import)::-webkit-scrollbar-track,
.perf-picker-list::-webkit-scrollbar-track,
.perf-split-body>.perf-list::-webkit-scrollbar-track,
.perf-review::-webkit-scrollbar-track{background:transparent}
.perf-body>section:is(.perf-panel,.perf-import)::-webkit-scrollbar-thumb,
.perf-picker-list::-webkit-scrollbar-thumb,
.perf-split-body>.perf-list::-webkit-scrollbar-thumb,
.perf-review::-webkit-scrollbar-thumb{
  border:3px solid transparent;border-radius:999px;background-clip:padding-box;
  background-color:color-mix(in srgb,var(--ink) 14%,transparent);
  transition:background-color .3s ease;
}
.perf-body>section:hover::-webkit-scrollbar-thumb,
.perf-picker-list:hover::-webkit-scrollbar-thumb,
.perf-split-body>.perf-list:hover::-webkit-scrollbar-thumb,
.perf-review:hover::-webkit-scrollbar-thumb{background-color:color-mix(in srgb,var(--accent) 42%,transparent)}
.perf-body>section:is(.perf-panel,.perf-import)::-webkit-scrollbar-corner,
.perf-split-body>.perf-list::-webkit-scrollbar-corner{background:transparent}

/* ---- 把纵向空间尽量留给数据表 -------------------------------------------
   用户反馈「可视化的面积太少」。汇总卡和工资构成卡原来各占一百多像素，
   压扁之后表格能多显示好几行。 */
.perf-summary{gap:8px;margin-bottom:-2px}
.perf-stat{padding:9px 12px;border-radius:12px}
.perf-stat strong{margin:2px 0 1px;font-size:clamp(14px,1.4vw,18px)}
.perf-stat small{font-size:9.5px}
.perf-stat span{font-size:9.5px}

.perf-body{gap:10px;padding-top:11px}
.perf-tabs{padding:3px}
.perf-tabs button{padding:6px 14px}

.perf-breakdown{gap:8px}
.perf-breakdown>div{padding:8px 12px;border-radius:11px}
.perf-breakdown small{font-size:9.5px}
.perf-breakdown strong{margin-top:2px;font-size:14px}
.perf-breakdown .grand strong{font-size:16px}

.perf-summary-line{padding:8px 13px}
.perf-queue-bar{padding:9px 13px}

/* 表格行更紧凑，一屏能多放几行 */
.perf-grid th,.perf-grid td{padding:6px 11px}
.perf-cell{padding:5px 9px}

/* 员工名单：邮箱列要够宽才看得全 */
.perf-grid.roster td:nth-child(2) .perf-cell{min-width:190px}

/* ---- 顶栏（同样是上轮误删的）---- */
.perf-bar{
  position:relative;z-index:20;flex:none;display:flex;align-items:center;justify-content:space-between;
  gap:16px;flex-wrap:wrap;padding:11px clamp(14px,3vw,34px);border-bottom:1px solid var(--line);
  background:color-mix(in srgb,var(--panel) 90%,transparent);backdrop-filter:blur(14px);
}
.perf-bar-left{display:flex;align-items:center;gap:11px;min-width:0;flex:1}
.perf-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:11px;flex:none;color:#fff;font-size:15px;background:linear-gradient(140deg,#a97cf0,#7a52d8)}
.perf-bar-left strong{display:block;font-family:var(--serif);font-size:15px;line-height:1.3}
.perf-bar-left small{display:block;font-size:10px;color:var(--muted)}
.perf-month{padding:6px 9px;border-radius:9px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);color:var(--ink);font-size:12px}
.perf-bar-right{display:flex;gap:8px;flex-wrap:wrap}

.perf-btn{
  padding:7px 14px;border-radius:10px;border:1px solid var(--line);cursor:pointer;
  background:color-mix(in srgb,var(--ink) 5%,transparent);color:var(--ink);font-size:12px;
  transition:background-color .3s ease,border-color .3s ease,transform .3s ease,color .3s ease;
}
.perf-btn:hover:not(:disabled){transform:translateY(-1px);border-color:color-mix(in srgb,var(--accent) 45%,transparent)}
.perf-btn:disabled{opacity:.45;cursor:not-allowed}
.perf-btn.primary{border-color:transparent;color:#fff;background:linear-gradient(140deg,#a97cf0,#7a52d8)}

.perf-stat{padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);transition:border-color .35s ease}
.perf-stat.accent{background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 14%,var(--panel)),var(--panel));border-color:color-mix(in srgb,var(--accent) 32%,transparent)}
.perf-stat small{display:block;font-size:10px;letter-spacing:.08em;color:var(--muted)}
.perf-stat strong{display:block;margin:4px 0 2px;font-family:var(--serif);font-size:clamp(15px,1.6vw,20px);font-weight:600;font-variant-numeric:tabular-nums}
.perf-stat.accent strong{color:var(--accent)}
.perf-stat span{font-size:10px;color:var(--muted)}

.perf-tabs{display:flex;gap:4px;padding:4px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink) 5%,transparent);width:fit-content;max-width:100%;overflow-x:auto}
.perf-tabs button{padding:7px 15px;border:0;border-radius:999px;cursor:pointer;background:transparent;color:var(--muted);font-size:12px;white-space:nowrap;transition:color .3s ease,background-color .3s ease}
.perf-tabs button:hover{color:var(--ink)}
.perf-tabs button.active{color:#fff;background:linear-gradient(140deg,#a97cf0,#7a52d8)}

.perf-panel{display:flex;flex-direction:column;gap:12px}
/* 面板里的东西不参与压缩（否则会被固定高度的父容器压扁后裁掉），
   但两栏容器要例外——它必须撑满剩余高度，两栏才能各自滚动。 */
.perf-panel>*{flex:none}
.perf-panel>.perf-split{flex:1;min-height:0}
.perf-import{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}
.perf-card{display:grid;gap:9px;padding:14px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);align-content:start}
.perf-overview-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.perf-hint{font-size:11px;line-height:1.7;color:var(--muted);margin:0}
.perf-good{color:#46b06a}
.perf-bad{color:#e0716f}
.perf-assume{color:#d99a3c}

/* 选中对象的汇总条 */
.perf-summary-line{
  display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;padding:10px 14px;border-radius:12px;
  border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);
  background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 10%,var(--panel)),var(--panel));
}
.perf-summary-line>strong{font-family:var(--serif);font-size:15px}
.perf-summary-line>span{font-size:11px;color:var(--muted)}
.perf-summary-line b{color:var(--ink);font-variant-numeric:tabular-nums}
.perf-summary-line b.hl{color:var(--accent);font-size:13px}

/* 工资构成 */
.perf-breakdown{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px}
.perf-breakdown>div{padding:11px 13px;border-radius:12px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 78%,transparent)}
.perf-breakdown small{display:block;font-size:10px;color:var(--muted)}
.perf-breakdown strong{display:block;margin-top:3px;font-size:15px;font-variant-numeric:tabular-nums}
.perf-breakdown .grand{border-color:color-mix(in srgb,var(--accent) 40%,transparent);background:linear-gradient(140deg,color-mix(in srgb,var(--accent) 14%,var(--panel)),var(--panel))}
.perf-breakdown .grand strong{color:var(--accent);font-size:18px}

/* 可视化：排名徽章与条形 */
.rank-col{width:44px;text-align:center}
.rank-badge{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:600;background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--muted)}
.rank-badge.top3{background:color-mix(in srgb,var(--accent) 22%,transparent);color:var(--accent)}
.rank-badge.top1{background:linear-gradient(140deg,#f0c060,#e0a13f);color:#3a2a08}
.bar-col{width:34%;min-width:120px}
.viz-bar{height:8px;border-radius:999px;background:color-mix(in srgb,var(--ink) 9%,transparent);overflow:hidden}
.viz-bar>div{height:100%;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 55%,transparent),var(--accent));transition:width .6s cubic-bezier(.22,.9,.24,1)}

/* 视图切换：按员工 / 按队列 */
.perf-view-toggle{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.perf-view-toggle button{padding:6px 14px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:12px;cursor:pointer;transition:color .3s ease,background-color .3s ease,border-color .3s ease}
.perf-view-toggle button:hover{color:var(--ink)}
.perf-view-toggle button.active{color:#fff;border-color:transparent;background:linear-gradient(140deg,#a97cf0,#7a52d8)}

.perf-queue-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 14px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 10%,var(--panel)),var(--panel))}
.perf-queue-bar label{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--muted)}
.perf-queue-bar select{padding:7px 12px;border-radius:10px;border:1px solid var(--line);background:var(--panel-raised);color:var(--ink);font-size:13px;font-family:var(--serif);font-weight:600}
.perf-queue-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
.perf-queue-meta strong{color:var(--accent);font-variant-numeric:tabular-nums}

.perf-list{border:1px solid var(--line);border-radius:14px;overflow:auto;background:color-mix(in srgb,var(--panel) 76%,transparent)}
.perf-grid{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px}
.perf-grid th,.perf-grid td{padding:7px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
.perf-grid thead th{background:color-mix(in srgb,var(--panel-raised) 96%,transparent);font-size:10px;letter-spacing:.06em;color:var(--muted);font-weight:600}
.perf-grid tbody tr:last-child td{border-bottom:0}
.perf-grid tbody tr.done{background:color-mix(in srgb,var(--accent) 7%,transparent)}
.perf-grid tbody tr.unmatched{background:color-mix(in srgb,#e0716f 10%,transparent)}
.perf-grid tfoot td{background:color-mix(in srgb,var(--accent) 9%,transparent);font-weight:600;border-top:1px solid color-mix(in srgb,var(--accent) 28%,transparent)}
.perf-grid .num{text-align:right;font-variant-numeric:tabular-nums}
.perf-grid .name{font-weight:600;font-family:var(--serif)}
.perf-grid .total{color:var(--accent);font-weight:700}
.perf-grid .muted{color:var(--muted)}
.perf-grid .act{width:34px;text-align:center}
.perf-grid .phone-meta{display:none}
/* 要填的两列给个底色，一眼就知道该点哪里 */
.perf-grid .input-col{background:color-mix(in srgb,var(--accent) 8%,transparent)}
.perf-grid thead .input-col{background:color-mix(in srgb,var(--accent) 18%,var(--panel-raised))}
/* 两个输入列不需要铺那么宽，收窄后数字更靠近表头，眼睛不用来回跑 */
.perf-grid.entry th:nth-child(2),.perf-grid.entry td:nth-child(2),
.perf-grid.entry th:nth-child(3),.perf-grid.entry td:nth-child(3){width:168px;max-width:168px}
.perf-grid.entry th:first-child,.perf-grid.entry td:first-child{width:auto}
/* 按员工视图：队列列窄一点，两个输入列固定宽度，其余自适应 */
.perf-grid.bymember th:nth-child(2),.perf-grid.bymember td:nth-child(2){width:132px;max-width:132px}
.perf-grid.bymember th:nth-child(3),.perf-grid.bymember td:nth-child(3),
.perf-grid.bymember th:nth-child(4),.perf-grid.bymember td:nth-child(4){width:160px;max-width:160px}
.perf-grid.bymember td:nth-child(2) .perf-cell{font-family:var(--serif);font-weight:600}

/* 直接编辑的格子 */
.perf-cell{width:100%;padding:6px 10px;border-radius:9px;border:1px solid transparent;background:color-mix(in srgb,var(--panel-raised) 70%,transparent);color:var(--ink);font-size:12.5px;font-variant-numeric:tabular-nums}
.perf-cell:focus{outline:none;border-color:var(--accent);background:var(--panel-raised)}
.perf-cell.wide{min-width:200px}
.perf-cell.inline{width:110px;display:inline-block}
.perf-inline-label{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--muted)}
/* 三薪列：只在打开时出现 */
.perf-grid .triple-col{background:color-mix(in srgb,#e0a13f 12%,transparent)}
.perf-grid thead .triple-col{background:color-mix(in srgb,#e0a13f 22%,var(--panel-raised))}
.perf-btn.on{border-color:color-mix(in srgb,#e0a13f 55%,transparent);color:#e0a13f}

.perf-sub{display:block;margin-top:2px;font-size:9.5px;color:var(--muted)}
.perf-sub.warn{color:#d99a3c}
/* 手机上表头会藏起来，所以每格自带一个小标签 */
.cell-label{display:none;font-size:10px;color:var(--muted);font-weight:400;text-align:left}
.perf-del{width:22px;height:22px;border:0;border-radius:50%;cursor:pointer;background:color-mix(in srgb,var(--ink) 7%,transparent);color:var(--muted);font-size:13px;line-height:1}
.perf-del:hover{background:color-mix(in srgb,#e0716f 20%,transparent);color:#e0716f}

.perf-grid.queues td:nth-child(1) .perf-cell{max-width:200px}
.perf-grid.queues td:nth-child(2) .perf-cell{display:block;max-width:110px;margin-left:auto}

.perf-wide,.perf-card textarea{width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);color:var(--ink);font-size:12px;resize:vertical}
.perf-wide:focus,.perf-card textarea:focus{outline:none;border-color:var(--accent)}
.perf-upload{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.perf-review{max-height:380px;overflow-y:auto;border:1px solid var(--line);border-radius:12px}
/* 写入前的二次确认条 */
.perf-confirm{display:grid;gap:9px;padding:12px 14px;border-radius:12px;border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 12%,var(--panel)),var(--panel))}
.perf-confirm-text{font-size:12px;line-height:1.7;color:var(--muted)}
.perf-confirm-text strong{color:var(--accent);font-variant-numeric:tabular-nums}
.perf-confirm-actions{display:flex;gap:8px;flex-wrap:wrap}
.perf-formulas{margin:0;padding-left:17px;display:grid;gap:8px}
.perf-formulas li{font-size:12px;line-height:1.75}
.perf-formulas code{padding:2px 6px;border-radius:6px;font-size:11.5px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}
.perf-formulas span{display:block;font-size:10.5px;color:var(--muted)}
.perf-constants{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;align-items:end}
.perf-constants label{display:grid;gap:4px;font-size:10.5px;color:var(--muted)}
.perf-constants input{padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);color:var(--ink);font-size:12px}

.perf-empty{display:grid;place-items:center;gap:7px;padding:34px 18px;text-align:center;border-radius:14px;border:1px dashed var(--line)}
.perf-empty h3{margin:0;font-family:var(--serif);font-size:16px}
.perf-empty p{margin:0;font-size:11.5px;color:var(--muted);max-width:48ch}
.perf-empty-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:5px}

@media (max-width:720px){
  .perf-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
  .perf-grid th,.perf-grid td{padding:7px 8px;font-size:12px}
  .perf-cell{padding:6px 7px}
  .perf-cell.wide{min-width:140px}
}

/* 手机上把「录数据」的每一行变成一张小卡片：名字一行，两个输入框并排且留足宽度，
   合计单独一行。表格在 390px 下横着塞 6 列会把输入框挤到看不清数字。 */
@media (max-width:560px){
  .perf-grid.entry thead{display:none}
  .perf-grid.entry,.perf-grid.entry tbody,.perf-grid.entry tfoot{display:block}
  .perf-grid.entry tr{
    display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;
    padding:12px 13px 15px;border-bottom:1px solid var(--line);
  }
  .perf-grid.entry td{border:0;padding:0;white-space:normal;max-width:none!important;width:auto!important}
  .perf-grid.entry td:first-child{grid-column:1/-1;grid-row:1;font-size:13.5px}
  .perf-grid.entry td:nth-child(2){grid-column:1;grid-row:2}
  .perf-grid.entry td:nth-child(3){grid-column:2;grid-row:2}
  .perf-grid.entry td:nth-child(4),
  .perf-grid.entry td:nth-child(5){display:none}
  .perf-grid.entry td:nth-child(6){grid-column:1/-1;grid-row:3;text-align:right;font-size:12.5px}
  .cell-label{display:block;margin-bottom:3px}
  .perf-grid.entry .input-col{background:transparent}
  .perf-cell{font-size:13px;padding:8px 10px}
  .perf-grid.entry tfoot tr{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
  .perf-grid.entry tfoot td{text-align:left}

  /* 按员工视图在手机上也是卡片：姓名 + 队列一行，两个输入框并排，合计一行 */
  .perf-grid.bymember thead{display:none}
  .perf-grid.bymember,.perf-grid.bymember tbody,.perf-grid.bymember tfoot{display:block}
  .perf-grid.bymember tr{
    display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;
    padding:12px 13px 15px;border-bottom:1px solid var(--line);
  }
  .perf-grid.bymember td{border:0;padding:0;white-space:normal;max-width:none!important;width:auto!important}
  .perf-grid.bymember td:first-child{grid-column:1/-1;grid-row:1;font-size:13.5px}
  .perf-grid.bymember td:nth-child(2){grid-column:1/-1;grid-row:2}
  .perf-grid.bymember td:nth-child(3){grid-column:1;grid-row:3}
  .perf-grid.bymember td:nth-child(4){grid-column:2;grid-row:3}
  .perf-grid.bymember td.col-hours{display:none}
  .perf-grid.bymember td:nth-child(7){grid-column:1/-1;grid-row:4;text-align:right;font-size:12.5px}
  .perf-grid.bymember .input-col{background:transparent}
  .perf-grid.bymember tfoot tr{display:flex;flex-wrap:wrap;gap:6px 14px}
  .perf-grid.bymember tfoot td{text-align:left}
}
/* ---- 数据可视化 ---------------------------------------------------------- */
.viz-panel{gap:12px}
.viz-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(124px,1fr));gap:8px}
.viz-stat{padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent)}
.viz-stat small{display:block;font-size:9.5px;letter-spacing:.06em;color:var(--muted)}
.viz-stat strong{display:block;margin-top:2px;font-family:var(--serif);font-size:clamp(14px,1.4vw,18px);font-weight:600;font-variant-numeric:tabular-nums}
.viz-stat span{display:block;font-size:9.5px;color:var(--muted)}
.viz-stat.up strong{color:#46b06a}
.viz-stat.down strong{color:#e0716f}

.viz-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px}
.viz-card{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 78%,transparent)}
.viz-card.wide{grid-column:1/-1}
.viz-card h4{margin:0;font-family:var(--serif);font-size:13.5px;font-weight:600;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.viz-card h4 em{font-style:normal;font-size:10px;color:var(--muted)}
.viz-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--muted)}
.viz-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.viz-empty{padding:14px;text-align:center;font-size:11px;color:var(--muted)}

.viz-rows{display:grid;gap:5px}
.viz-row{display:grid;grid-template-columns:minmax(60px,96px) minmax(0,1fr) auto;align-items:center;gap:9px}
.viz-name{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.viz-track{position:relative;display:flex;height:14px;border-radius:7px;background:color-mix(in srgb,var(--ink) 7%,transparent);overflow:hidden}
.viz-seg{height:100%;transition:width .5s cubic-bezier(.22,.9,.24,1)}
.viz-val{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}

/* 散点图 */
.viz-scatter{width:100%;height:260px;display:block}
.viz-scatter .grid{stroke:color-mix(in srgb,var(--ink) 9%,transparent);stroke-width:1}
.viz-scatter .axis{stroke:color-mix(in srgb,var(--ink) 22%,transparent);stroke-width:1.2}
.viz-scatter .avgline{stroke:color-mix(in srgb,var(--accent) 45%,transparent);stroke-width:1;stroke-dasharray:4 4}
.viz-scatter .dot{fill:color-mix(in srgb,var(--accent) 72%,transparent);stroke:var(--accent);stroke-width:1.2}
.viz-scatter .dotlabel{fill:var(--muted);font-size:9px;text-anchor:middle}
.viz-scatter .axislabel{fill:var(--muted);font-size:9.5px}

/* 相对均值：中间一条竖线,向左右发散 */
.viz-row.dev{grid-template-columns:minmax(60px,96px) minmax(0,1fr) auto}
.viz-dev-track{position:relative;height:13px;border-radius:7px;background:color-mix(in srgb,var(--ink) 6%,transparent)}
.viz-dev-mid{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:color-mix(in srgb,var(--ink) 30%,transparent)}
.viz-dev-bar{position:absolute;top:2px;bottom:2px;border-radius:5px;background:linear-gradient(90deg,#7a52d8,#a97cf0)}
.viz-dev-bar.neg{background:linear-gradient(90deg,#e0716f,#f0a0a0)}
.viz-val.neg{color:#e0716f}

/* 新增队列的行内表单 */
.queue-add{
  display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;
  padding:12px 14px;border-radius:13px;
  border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);
  background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 12%,var(--panel)),var(--panel));
  animation:queueAddIn .28s cubic-bezier(.22,.9,.24,1) both;
}
@keyframes queueAddIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.queue-add-title{font-family:var(--serif);font-size:13.5px;font-weight:600;align-self:center}
.queue-add label{display:grid;gap:4px;font-size:10px;color:var(--muted)}
.queue-add input{width:150px}
.queue-add-error{font-size:11.5px;color:#e0716f}

/* 刚新增的队列高亮两秒 */
.perf-grid.queues tbody tr.fresh{background:color-mix(in srgb,var(--accent) 16%,transparent);animation:queueAddIn .3s cubic-bezier(.22,.9,.24,1) both}
/* 方形上传区：点击 / Ctrl+V / 拖拽 */
.shot-zone{
  display:grid;place-items:center;gap:4px;align-content:center;
  width:100%;max-width:260px;aspect-ratio:1/1;padding:16px;text-align:center;
  border-radius:16px;border:2px dashed color-mix(in srgb,var(--accent) 38%,transparent);
  background:color-mix(in srgb,var(--accent) 6%,transparent);
  cursor:pointer;transition:border-color .3s ease,background-color .3s ease,transform .3s ease;
}
.shot-zone:hover,.shot-zone:focus-visible{outline:none;border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);transform:translateY(-2px)}
.shot-zone.drag{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 20%,transparent)}
.shot-zone.busy{cursor:progress;opacity:.75}
.shot-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;color:#fff;background:linear-gradient(140deg,#a97cf0,#7a52d8)}
.shot-zone strong{font-family:var(--serif);font-size:14px}
.shot-tip{font-size:10.5px;line-height:1.6;color:var(--muted)}
.shot-tip b{color:var(--accent)}

/* 员工 × 队列 矩阵热力图 */
.matrix-wrap{overflow-x:auto;padding-bottom:4px}
.matrix{border-collapse:separate;border-spacing:3px;font-size:11px}
.matrix th{font-weight:600;color:var(--muted);font-size:10px;white-space:nowrap;padding:0 6px;text-align:center}
.matrix-corner{text-align:left!important;font-weight:400!important}
.matrix-row{text-align:right!important;color:var(--ink)!important;font-family:var(--serif);font-size:11.5px!important}
.matrix-col{white-space:nowrap}
.matrix-cell{padding:0}
.matrix-chip{display:block;min-width:52px;padding:5px 7px;border-radius:7px;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums;cursor:default;transition:transform .2s ease}
.matrix-chip:hover{transform:scale(1.06)}
.matrix-empty{display:block;min-width:52px;text-align:center;color:color-mix(in srgb,var(--ink) 22%,transparent)}
.matrix-total{text-align:right!important;color:var(--accent)!important;font-variant-numeric:tabular-nums}

/* 明细表里的队列小药丸 */
.viz-queues{display:flex;gap:4px;flex-wrap:wrap}
.queue-pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent)}
.perf-grid .muted{color:var(--muted)}

/* 散点图：象限底色 + 刻度 + 悬浮提示 */
.viz-scatter{width:100%;height:auto;aspect-ratio:2/1;max-height:420px;display:block}
.viz-scatter .quad{fill:transparent}
.viz-scatter .quad.best{fill:color-mix(in srgb,var(--accent) 7%,transparent)}
.viz-scatter .grid{stroke:color-mix(in srgb,var(--ink) 8%,transparent);stroke-width:1}
.viz-scatter .axis{stroke:color-mix(in srgb,var(--ink) 26%,transparent);stroke-width:1.2}
.viz-scatter .avgline{stroke:color-mix(in srgb,var(--accent) 50%,transparent);stroke-width:1;stroke-dasharray:5 4}
.viz-scatter .tick{fill:var(--muted);font-size:9.5px}
.viz-scatter .axislabel{fill:var(--muted);font-size:10px}
.viz-scatter .quadlabel{fill:color-mix(in srgb,var(--ink) 22%,transparent);font-size:9.5px;pointer-events:none}
.viz-scatter .dotgroup{cursor:default}
.viz-scatter .dot{fill:color-mix(in srgb,var(--accent) 62%,transparent);stroke:var(--accent);stroke-width:1.4;transition:fill .25s ease}
.viz-scatter .dot.over{stroke:#e0a13f;stroke-dasharray:3 2}
.viz-scatter .dotgroup:hover .dot{fill:color-mix(in srgb,var(--accent) 92%,transparent)}
.viz-scatter .dotlabel{fill:var(--ink);font-size:9.5px}

/* 公开只读：数据照常展示，但所有能改数据的地方都不接受操作。
   只加 pointer-events，不改结构——切回自己那一份时一切都还是原样。 */
.perf-owner-pick{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);min-width:0}
.perf-owner-pick select{max-width:170px;padding:4px 8px;border-radius:8px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);color:var(--ink);font:inherit;font-size:11px}
.perf-sync{font-size:10px;color:var(--muted);align-self:center;max-width:220px}
.perf-sync.error{color:#e06a6a}
.perf-readonly-note{margin:0;padding:8px 20px;font-size:11.5px;line-height:1.6;color:var(--muted);background:color-mix(in srgb,var(--accent) 10%,transparent);border-bottom:1px solid color-mix(in srgb,var(--ink) 8%,transparent)}
.perf-readonly-note strong{margin-right:6px;color:var(--ink)}
/* 公开只读：默认把面板里所有可操作控件都挡住，再单独放行"只是看"的几个。
   早先这里是逐个列容器名（.perf-panel / .perf-picker / .perf-bar-left），
   结果「导入截图」里的下拉框和粘贴文本框落在名单之外，访客照样能操作它们。
   反过来写之后，以后新增任何编辑控件都会被自动挡住。 */
.perf-tool.is-readonly input,
.perf-tool.is-readonly select,
.perf-tool.is-readonly textarea,
.perf-tool.is-readonly button{pointer-events:none;opacity:.72}
/* 只读时仍然该能用的：标签导航、导出与返回、切换月份、切换要查看的账号。 */
.perf-tool.is-readonly .perf-tabs button,
.perf-tool.is-readonly .perf-bar-right button,
.perf-tool.is-readonly .perf-bar-left input,
.perf-tool.is-readonly .perf-bar-left select{pointer-events:auto;opacity:1}

</style>
