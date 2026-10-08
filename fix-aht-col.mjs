import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) 加一个「这个人做了哪些队列」的辅助函数
const anchor = '/** 一个人跨队列时的加权平均 AHT（给总表用）。 */'
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }
const helper = `/** 一个人做过的队列，按审核量从多到少。跨队列平均 AHT 没有意义（各队列标准 AHT 差上百倍），
 *  所以界面上展示「他做了哪些队列」而不是一个平均出来的 AHT。 */
function queueListOf(row) {
  return row.result.lines
    .filter((line) => line.numbers.auditCount > 0)
    .sort((a, b) => b.numbers.auditCount - a.numbers.auditCount)
    .map((line) => line.entry.queue)
}

`
s = s.replace(anchor, helper + anchor)

// 2) 可视化明细表：把「实际AHT」换成「队列」
s = s.replace('<th class="num">实际AHT</th>', '<th>队列</th>')
s = s.replace('                <td class="num muted">{{ rowAvgAht(row, \'actualAht\') || \'—\' }}</td>',
  `                <td class="viz-queues">
                  <span v-for="q in queueListOf(row)" :key="q" class="queue-pill">{{ q }}</span>
                  <span v-if="!queueListOf(row).length" class="muted">—</span>
                </td>`)

// 3) Excel 总表同理：那两个平均 AHT 换成队列清单
s = s.replace("'审核效率', '完成度', '月要求工时'", "'审核效率', '完成度', '月要求工时'")
s = s.replace("const summaryHead = ['姓名', '邮箱', '队列数', '审核量', '其中三薪日', '计件量', '标准AHT', '实际AHT',",
              "const summaryHead = ['姓名', '邮箱', '队列', '审核量', '其中三薪日', '计件量', '队列数',")
s = s.replace(`      m.name || '', m.email || '', r.lines.length, r.auditCount, r.tripleCount, r.pieceCount,
      rowAvgAht(row, 'standardAht'), rowAvgAht(row, 'actualAht'),`,
`      m.name || '', m.email || '', queueListOf(row).join('、'), r.auditCount, r.tripleCount, r.pieceCount,
      r.lines.length,`)

// 4) 样式：队列小药丸
const cssAt = s.lastIndexOf('</style>')
const css = `/* 明细表里的队列小药丸 */
.viz-queues{display:flex;gap:4px;flex-wrap:wrap}
.queue-pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent)}
.perf-grid .muted{color:var(--muted)}

`
fs.writeFileSync(f, s.slice(0, cssAt) + css + s.slice(cssAt), 'utf8')
console.log('已把「跨队列平均AHT」换成「队列清单」')
