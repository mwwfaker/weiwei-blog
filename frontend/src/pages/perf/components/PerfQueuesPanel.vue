<script setup>
// 「队列 KPI」：给每个队列一个名字和一个 KPI，标准 AHT 与单价都由 KPI 算出来。
// 队列的增删改由 PerfPage 负责（要同时清理 entries 并同步云端），这里只发起意图。
//
// 注意：「恢复默认」以前点了没反应——`resetQueues` 从来没有定义过。现在它 emit 给 PerfPage 执行。
import { ahtOf, entryNumbers } from '@/services/perf'
import { money, price } from '../composables/format.js'

defineProps({
  queues: { type: Array, default: () => [] },
  constants: { type: Object, default: () => ({}) },
  checkHours: { type: Number, default: 0 },
  queueTotalsAll: { type: Map, default: () => new Map() },
  summary: { type: Object, default: () => ({}) },
  queueForm: { type: Object, default: () => ({ open: false, name: '', kpi: '', error: '' }) },
  highlightedQueue: { type: String, default: '' },
})
const emit = defineEmits(['open-form', 'cancel-form', 'submit', 'remove-queue', 'reset-queues'])

function openQueueForm() { emit('open-form') }
function cancelQueueForm() { emit('cancel-form') }
function submitQueue() { emit('submit') }
function removeQueue(name) { emit('remove-queue', name) }
</script>

<template>
  <section class="perf-panel">
    <div class="perf-overview-bar">
      <button class="perf-btn primary" @click="openQueueForm">＋ 添加队列</button>
      <button class="perf-btn" @click="emit('reset-queues')">恢复默认</button>
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
      单价按 <code>(1800 × 标准AHT) ÷ (月要求工时 × 3600 × 0.85)</code> 计算，所以它会随每个人的月要求工时不同而不同，
      表里显示的是按 {{ checkHours }} 小时算出来的参考值；实际计算时用的是每个人自己的月要求工时。
    </p>
  </section>
</template>
