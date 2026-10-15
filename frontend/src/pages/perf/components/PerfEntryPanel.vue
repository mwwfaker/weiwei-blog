<script setup>
// 「数据总览」：左边选人/选队列，右边填每个人的 AHT 与审核量。
// 面板只读上面传下来的行数据；所有写入（setCell / 切标签页 / 重置）都 emit 回 PerfPage，
// 因为改的是 members / entries，得连着本地存储与云端同步一起走。
//
// 注意：下面那个「已填 N」在拆分前一直是空的——`filledCount` 从来没有定义过。
// 现在按当前队列里填了审核量的人数算出来（见 filledCount）。
import { computed } from 'vue'
import { ahtOf, entryNumbers } from '@/services/perf'
import { hoursText, money, percent, price } from '../composables/format.js'

const props = defineProps({
  members: { type: Array, default: () => [] },
  filteredMembers: { type: Array, default: () => [] },
  filteredQueues: { type: Array, default: () => [] },
  rowByMember: { type: Map, default: () => new Map() },
  queueTotalsAll: { type: Map, default: () => new Map() },
  activeMember: { type: Object, default: null },
  memberSummary: { type: Object, default: null },
  memberQueueRows: { type: Array, default: () => [] },
  queueRows: { type: Array, default: () => [] },
  queueTotals: { type: Object, default: () => ({}) },
  activeQueueConfig: { type: Object, default: null },
  activePrice: { type: Object, default: () => ({}) },
  constants: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['set-cell', 'go-tab', 'reset-member-data', 'reset-member-triple-count'])

/** 「已填」= 当前队列里真的填了审核量的人数。行数据由父级传下来，这里只数一遍。 */
const filledCount = computed(() => props.queueRows.filter((row) => row.numbers && row.numbers.auditCount).length)

/** 当前这个人身上还有没有三薪日的审核量：没有就别让「重置三薪审核量」看着像能点。 */
const hasTripleCount = computed(() => props.memberQueueRows.some((row) => Number(row.entry?.tripleCount)))

// 两种视图、搜索词、选中的对象都是父级的状态，这里只做双向绑定。
const entryView = defineModel('entryView', { type: String, default: 'byMember' })
const pickerQuery = defineModel('pickerQuery', { type: String, default: '' })
const activeMemberId = defineModel('activeMemberId', { type: String, default: '' })
const activeQueue = defineModel('activeQueue', { type: String, default: '' })
const showTriple = defineModel('showTriple', { type: Boolean, default: false })

/** 直接改格子：没有这条记录时由 PerfPage 按需创建，所以可以像表格一样随手填。 */
function setCell(memberId, field, raw, queue) {
  emit('set-cell', memberId, field, raw, queue)
}

/** 重置都只清数据、不动名单，确认框与具体清哪些字段在 PerfPage 里（云端保存也跟着那边走）。 */
function resetMemberData() {
  if (props.activeMember) emit('reset-member-data', props.activeMember.id)
}
function resetTripleCount() {
  if (props.activeMember) emit('reset-member-triple-count', props.activeMember.id)
}
</script>

<template>
  <section class="perf-panel split-panel">
    <div v-if="!members.length" class="perf-empty">
      <h3>先在「员工名单」里把人加进来</h3>
      <p>名单建好以后，回到这里就能左边点人、右边填数据。</p>
      <div class="perf-empty-actions"><button class="perf-btn primary" @click="emit('go-tab', 'roster')">去员工名单</button></div>
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
            <!-- 重置只针对当前选中的这个人；清哪些字段、保留什么都由 PerfPage 决定并确认 -->
            <div class="perf-overview-bar">
              <button class="perf-btn" :disabled="!hasTripleCount" title="把这个人在所有队列里填的「其中三薪日」清零（审核量不动）" @click="resetTripleCount">重置三薪审核量</button>
              <button class="perf-btn" title="清掉抽调/加班/三薪时长，以及他在所有队列里的审核量与其中三薪日" @click="resetMemberData">重置该员工数据</button>
              <span class="perf-hint">两个按钮都只清数据：姓名、邮箱、队列归属、实际 AHT 会保留。</span>
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
</template>
