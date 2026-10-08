import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) 员工 × 队列 矩阵
const scriptAnchor = '// ---- 单日计算'
const computed = `/** 员工 × 队列 矩阵：一格里是某人在某队列的审核量。系统就这两部分,这张图直接表达它。 */
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

`
const at = s.indexOf(scriptAnchor)
if (at < 0) { console.log('SCRIPT ANCHOR MISSING'); process.exit(1) }
s = s.slice(0, at) + computed + s.slice(at)

// 2) 模板：插在散点图之前
const tplAnchor = `          <!-- 四、效率 × 完成度 散点 -->`
const tpl = `          <!-- 四、员工 × 队列 矩阵 -->
          <article class="viz-card wide">
            <h4>员工 × 队列 矩阵 <em>颜色越深审核量越大,一眼看出谁在哪个队列上</em></h4>
            <div v-if="!vizMatrix.rows.length" class="viz-empty">还没有数据</div>
            <div v-else class="matrix-wrap">
              <table class="matrix">
                <thead>
                  <tr>
                    <th class="matrix-corner">队列 \\ 员工</th>
                    <th v-for="(name, i) in vizMatrix.cols" :key="i" class="matrix-col">{{ name.split(/[.\\s]/)[0] }}</th>
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

`
if (!s.includes(tplAnchor)) { console.log('TPL ANCHOR MISSING'); process.exit(1) }
s = s.replace(tplAnchor, tpl + tplAnchor)

// 3) 样式
const cssAt = s.lastIndexOf('</style>')
const css = `/* 员工 × 队列 矩阵热力图 */
.matrix-wrap{overflow-x:auto;padding-bottom:4px}
.matrix{border-collapse:separate;border-spacing:3px;font-size:11px}
.matrix th{font-weight:600;color:var(--muted);font-size:10px;white-space:nowrap;padding:0 6px;text-align:center}
.matrix-corner{text-align:left!important;font-weight:400!important}
.matrix-row{text-align:right!important;color:var(--ink)!important;font-family:var(--serif);font-size:11.5px!important}
.matrix-col{max-width:58px;overflow:hidden;text-overflow:ellipsis}
.matrix-cell{padding:0}
.matrix-chip{display:block;min-width:52px;padding:5px 7px;border-radius:7px;text-align:right;color:var(--ink);font-variant-numeric:tabular-nums;cursor:default;transition:transform .2s ease}
.matrix-chip:hover{transform:scale(1.06)}
.matrix-empty{display:block;min-width:52px;text-align:center;color:color-mix(in srgb,var(--ink) 22%,transparent)}
.matrix-total{text-align:right!important;color:var(--accent)!important;font-variant-numeric:tabular-nums}

`
fs.writeFileSync(f, s.slice(0, cssAt) + css + s.slice(cssAt), 'utf8')
console.log('员工 × 队列 矩阵已加入')
