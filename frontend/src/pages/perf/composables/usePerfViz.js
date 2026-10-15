// 「数据可视化」这一块的统计：排名、薪资构成、队列分布、矩阵、散点、相对均值。
// 只读 computedAll / queueTotalsAll / queues 几份派生数据，不持有自己的状态。
import { computed, ref } from 'vue'
import { money, percent } from './format.js'

export function usePerfViz({ computedAll, queueTotalsAll, queues }) {
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

  return {
    rankBy,
    rankOptions,
    ranked,
    numeric,
    vizStats,
    payStacks,
    queueStats,
    vizScatter,
    deviations,
    vizMatrix,
  }
}
