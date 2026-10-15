<script setup>
// 「单日计算」：对应文档里的表一，独立于月度数据，只存浏览器。
// 这一块的状态（日期、工时、各队列当天输入）只被自己用到，所以整体交给 usePerfDaily。
import { toRef } from 'vue'
import { usePerfDaily } from '../composables/usePerfDaily'
import { hoursText, money, percent, price } from '../composables/format.js'

const props = defineProps({
  queues: { type: Array, default: () => [] },
  constants: { type: Object, default: () => ({}) },
})

const { daily, resetDaily, setDaily, dailyRows, dailyTotals } = usePerfDaily({
  queues: toRef(props, 'queues'),
  constants: toRef(props, 'constants'),
})
</script>

<template>
  <section class="perf-panel">
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
</template>
