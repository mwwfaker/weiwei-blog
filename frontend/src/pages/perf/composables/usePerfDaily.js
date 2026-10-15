// 「单日计算」这一块：对应文档里的表一，独立于月度数据，只存本机。
// 状态（date/hours/entries…）只被这一块用，所以跟着面板走，不进 PerfPage。
import { computed, ref, watch } from 'vue'
import { DEFAULT_REQUIRED_HOURS, entryNumbers } from '@/services/perf'
import { readStoredJson, writeStoredJson } from '@/services/storage'

const DAILY_KEY = 'weiwei-blog-perf-daily-v1'

export function usePerfDaily({ queues, constants }) {
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

  return { daily, resetDaily, setDaily, dailyRows, dailyTotals }
}
