// 员工 × 队列 的取数辅助：可视化的明细表和 Excel 导出共用，所以单独放一份。

/** 一个人做过的队列，按审核量从多到少。跨队列平均 AHT 没有意义（各队列标准 AHT 差上百倍），
 *  所以界面上展示「他做了哪些队列」而不是一个平均出来的 AHT。 */
export function queueListOf(row) {
  return row.result.lines
    .filter((line) => line.numbers.auditCount > 0)
    .sort((a, b) => b.numbers.auditCount - a.numbers.auditCount)
    .map((line) => line.entry.queue)
}

/** 一个人跨队列时的加权平均 AHT（给总表用）。 */
export function rowAvgAht(row, key) {
  let weighted = 0
  let total = 0
  for (const line of row.result.lines) {
    weighted += (line.numbers[key] || 0) * (line.numbers.auditCount || 0)
    total += line.numbers.auditCount || 0
  }
  return total > 0 ? Number((weighted / total).toFixed(2)) : 0
}
