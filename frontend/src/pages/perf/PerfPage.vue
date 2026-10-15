<script setup>
// 绩效计算器：独立的全屏工具，不是博客的一个页面。
//
// 录入方式（按用户的工作方式设计）：
//   选一个队列 → 下面列出全部员工 → 直接在格子里填「实际AHT」和「审核量」。
//   填入的数据按「员工 × 队列」存，所以一个人做多个队列也不会乱。
//   月实际工时是算出来的（实际AHT × 审核量 ÷ 3600），不用填。
//
// 拆分后的分工：
//   · 这个文件只做接线与共享状态：谁改 members/entries/queues，谁负责存本机/云端。
//   · components/ 一个视觉板块一个组件，面板内部不直接改共享数组，一律 emit 回这里。
//   · composables/ 成组逻辑（云端同步、可视化统计、导入识别、导出、单日、氛围层、格式化）。
//   · 样式在 perf.css（全局，不是 scoped），所以新增元素不需要再挂 scoped 属性。
//
// perf.css 用「组件内 import」而不是挂到 styles/index.css 上：绩效页是按需加载的，
// 样式跟着这页一起进异步 chunk，首屏就不会白白多下载 36 kB CSS。
// 代价是这份样式不在 styles/ 的层叠顺序里 —— 它只作用于 .perf-tool 内部，不参与全局覆盖。
import './perf.css'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { readStoredJson, writeStoredJson } from '@/services/storage'
import {
  DEFAULT_REQUIRED_HOURS, PERF_CONSTANTS, PERF_QUEUES, computeAll,
  emptyEntry, emptyMember, entryNumbers, nameFromEmail, normalizeQueues, priceCheck,
} from '@/services/perf'
import { useAuthStore } from '@/stores/auth'
import { usePerfAura } from './composables/usePerfAura'
import { usePerfCloud } from './composables/usePerfCloud'
import { usePerfExport } from './composables/usePerfExport'
import { usePerfImport } from './composables/usePerfImport'
import { usePerfViz } from './composables/usePerfViz'
import PerfAboutPanel from './components/PerfAboutPanel.vue'
import PerfDailyPanel from './components/PerfDailyPanel.vue'
import PerfEntryPanel from './components/PerfEntryPanel.vue'
import PerfImportPanel from './components/PerfImportPanel.vue'
import PerfQueuesPanel from './components/PerfQueuesPanel.vue'
import PerfReadonlyNote from './components/PerfReadonlyNote.vue'
import PerfRosterPanel from './components/PerfRosterPanel.vue'
import PerfToolbar from './components/PerfToolbar.vue'
import PerfVizPanel from './components/PerfVizPanel.vue'

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

// ---- 计算 ------------------------------------------------------------------
// 放在云端同步之前：从云端套用一份数据时要先知道「月要求工时」的参考值。
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

// ---- 云端同步 --------------------------------------------------------------
// 逻辑整块在 composables/usePerfCloud.js：读公开数据、800ms 防抖写回、公开只读判定。
const {
  workspaces, activeOwnerId, syncState, syncMessage, readOnly, activeOwnerName, syncLabel,
  selectWorkspace,
} = usePerfCloud({ auth, members, entries, queues, checkHours })

// ---- 导出 ------------------------------------------------------------------
const { exportWorkbook } = usePerfExport({ computedAll, summary, month })

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

// ---- 数据可视化：统计口径都在 usePerfViz 里 --------------------------------
const {
  rankBy, rankOptions, ranked, vizStats, payStacks, queueStats, vizScatter, deviations, vizMatrix,
} = usePerfViz({ computedAll, queueTotalsAll, queues })

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

/**
 * 把队列表恢复成内置默认值。
 *
 * 这个动作是拆分时补上的：按钮「恢复默认」一直存在，但 `resetQueues` 从来没有定义过，
 * 点了没有任何反应（也不会报错，Vue 只当成一个 undefined 的模板引用）。
 *
 * 自己加的队列会被移除，它们的录入明细仍留在本机、不会删，只是没有队列可以显示它们，
 * 所以先确认一次并说清楚。
 */
function resetQueues() {
  const custom = queues.value.filter((q) => !PERF_QUEUES.some((d) => d.name === q.name)).length
  const message = custom
    ? `恢复成内置的 ${PERF_QUEUES.length} 个队列？你自己加的 ${custom} 个会被移除（录入的数据不会删，但不再显示）。`
    : `把 ${PERF_QUEUES.length} 个队列的 KPI 恢复成默认值？`
  if (typeof window !== 'undefined' && !window.confirm(message)) return
  // normalizeQueues([]) 会回退到内置列表的一份副本，而不是把 PERF_QUEUES 本身交出去。
  queues.value = normalizeQueues([])
  if (!queues.value.some((q) => q.name === activeQueue.value)) activeQueue.value = queues.value[0]?.name || ''
}

/**
 * 把计算常数恢复成内置默认值。
 *
 * 同样是拆分时补上的：`resetConstants` 从来没有定义过，「恢复默认」按钮一直是摆设。
 */
function resetConstants() {
  if (typeof window !== 'undefined' && !window.confirm('把计算常数恢复成默认值？')) return
  constants.value = { ...PERF_CONSTANTS }
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

/** 清空当前队列所有人当月的数据（目前界面上还没有入口，保留原有能力）。 */
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

// ---- 导入 ------------------------------------------------------------------
// 识别与写入整块在 composables/usePerfImport.js，粘贴监听也挂在那里。
const {
  importRows, importText, importBusy, importMessage, importPlan,
  parsePasted, processImageFile, applyImport,
} = usePerfImport({ members, entries, checkHours, activeQueue, tab, activeMemberId })

function backToBlog() { router.push({ name: 'home' }) }

// ---- 氛围层：跟着指针走的那团柔光 ------------------------------------------
const auraRef = ref(null)
const toolRef = ref(null)
const { trackCursor } = usePerfAura({ toolRef, auraRef })
</script>

<template>
  <section class="perf-page-slot">
    <!-- class 写成数组是有意的：拆分后 .perf-tool 不再是组件根元素，Vue 的 SSR
         编译器会把「静态 class + :class」重排成 [动态, 静态]，与拆分前不一致。
         合并成一个 :class 数组后输出仍是 "perf-tool is-readonly"，逐字节对得上。 -->
    <div ref="toolRef" :class="['perf-tool', { 'is-readonly': readOnly }]" @pointermove="trackCursor">
      <span ref="auraRef" class="perf-aura" aria-hidden="true"></span>

      <PerfToolbar
        :month="month"
        :workspaces="workspaces"
        :active-owner-id="activeOwnerId"
        :sync-state="syncState"
        :sync-message="syncMessage"
        :sync-label="syncLabel"
        :member-count="members.length"
        @update:month="month = $event"
        @select="selectWorkspace"
        @export="exportWorkbook"
        @back="backToBlog"
      />

      <PerfReadonlyNote v-if="readOnly" :owner-name="activeOwnerName" :logged-in="auth.isLoggedIn" />

      <main class="perf-body">
        <nav class="perf-tabs">
          <button v-for="t in tabs" :key="t.id" :class="{ active: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
        </nav>

        <!-- 录数据：选队列 -> 填每个人的 AHT 与审核量 -->
        <PerfEntryPanel
          v-if="tab === 'entry'"
          v-model:entryView="entryView"
          v-model:pickerQuery="pickerQuery"
          v-model:activeMemberId="activeMemberId"
          v-model:activeQueue="activeQueue"
          v-model:showTriple="showTriple"
          :members="members"
          :filtered-members="filteredMembers"
          :filtered-queues="filteredQueues"
          :row-by-member="rowByMember"
          :queue-totals-all="queueTotalsAll"
          :active-member="activeMember"
          :member-summary="memberSummary"
          :member-queue-rows="memberQueueRows"
          :queue-rows="queueRows"
          :queue-totals="queueTotals"
          :active-queue-config="activeQueueConfig"
          :active-price="activePrice"
          :constants="constants"
          @set-cell="setCell"
          @go-tab="tab = $event"
        />

        <!-- 员工名单：一个月只填一次的固定项 -->
        <PerfRosterPanel
          v-else-if="tab === 'roster'"
          v-model:bulkOpen="bulkOpen"
          v-model:bulkText="bulkText"
          v-model:promptRef="promptRef"
          :members="members"
          :row-by-member="rowByMember"
          :bulk-message="bulkMessage"
          @add-member="addMember"
          @bulk-add="bulkAdd"
          @remove-member="removeMember"
          @apply-hours="applyHoursToAll"
        />

        <!-- 队列 KPI -->
        <PerfQueuesPanel
          v-else-if="tab === 'queues'"
          :queues="queues"
          :constants="constants"
          :check-hours="checkHours"
          :queue-totals-all="queueTotalsAll"
          :summary="summary"
          :queue-form="queueForm"
          :highlighted-queue="highlightedQueue"
          @open-form="openQueueForm"
          @cancel-form="cancelQueueForm"
          @submit="submitQueue"
          @remove-queue="removeQueue"
          @reset-queues="resetQueues"
        />

        <!-- 数据可视化：多角度看全组 -->
        <PerfVizPanel
          v-else-if="tab === 'viz'"
          v-model:rankBy="rankBy"
          :rank-options="rankOptions"
          :ranked="ranked"
          :viz-stats="vizStats"
          :pay-stacks="payStacks"
          :queue-stats="queueStats"
          :viz-matrix="vizMatrix"
          :viz-scatter="vizScatter"
          :deviations="deviations"
          :summary="summary"
        />

        <!-- 单日计算：对应文档里的表一，独立于月度数据，只存浏览器 -->
        <PerfDailyPanel v-else-if="tab === 'daily'" :queues="queues" :constants="constants" />

        <!-- 导入 -->
        <PerfImportPanel
          v-else-if="tab === 'import'"
          v-model:activeQueue="activeQueue"
          v-model:importText="importText"
          :queues="queues"
          :members="members"
          :import-rows="importRows"
          :import-busy="importBusy"
          :import-message="importMessage"
          :import-plan="importPlan"
          @parse="parsePasted"
          @apply="applyImport"
          @cancel="importRows = []"
          @pick-file="processImageFile"
        />

        <!-- 说明 -->
        <PerfAboutPanel v-else :constants="constants" @reset-constants="resetConstants" />
      </main>
    </div>
  </section>
</template>
