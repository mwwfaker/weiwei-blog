// 导出 Excel：整个绩效页只有顶部工具条的「导出 Excel」用得到，逻辑整块搬过来。
import { queueListOf } from './rows.js'
import { pctText } from './format.js'

export function usePerfExport({ computedAll, summary, month }) {
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

  return { exportWorkbook }
}
