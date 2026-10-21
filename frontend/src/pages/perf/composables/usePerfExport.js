// 导出：Excel（xlsx）与 HTML（**网站的可浏览静态版**）。
//
// HTML 那份不是一张大表，而是照网站的浏览方式做的：
//   上面四个导航（数据总览 / 数据可视化 / 员工名单 / 队列 KPI），
//   数据总览里还能切「按员工 / 按队列」——左边点人，右边是他各个队列的数据；
//   左边点队列，右边是该队列的全员。导航用的是导出文件里自带的一小段原生 JS
//   （reportHtml.js 的 NAV_SCRIPT），不联网、不依赖任何库。
//
// 数据怎么来的：
//   · 数据总览的每一格内容都由网站自己的 PerfEntryPanel 渲染（一个员工一份 / 一个队列一份），
//     我们把它的 .perf-split-body 抠出来放进各自的「页」里；
//   · 员工名单 / 队列 KPI / 数据可视化 直接渲染对应面板；
//   · 渲染完统一「冻结」：输入框换成文字、工具条与按钮删掉。
//
// 三件事必须记住：
//   1. 冻结必须在**活的** DOM 上做（Vue 写的是 el.value，不走 HTML 属性），且要在取 innerHTML 之前。
//   2. 挂出来的 DOM 不能塞回页面：挂到游离的 div 上、取完就 unmount。
//   3. 导出文档没有 .perf-tool（100dvh + overflow:hidden）的定高，面板里「自己滚」的容器
//      会塌成一条线 → 展开规则写在 perf.css 第 17 节。
import { createApp, h } from 'vue'
import { entryNumbers } from '@/services/perf'
import perfCss from '../perf.css?inline'
import { downloadText } from '@/app/download'
import { cash, escapeHtml, fmtInt, reportBody } from './reportHtml.js'
import { pctText } from './format.js'
import { queueListOf } from './rows.js'
import PerfEntryPanel from '../components/PerfEntryPanel.vue'
import PerfQueuesPanel from '../components/PerfQueuesPanel.vue'
import PerfRosterPanel from '../components/PerfRosterPanel.vue'
import PerfVizPanel from '../components/PerfVizPanel.vue'

const EMPTY_TOTALS = { auditCount: 0, standardHours: 0, hours: 0, efficiency: 0, pay: 0 }

/**
 * 把页面上的「可操作」变成「只读」：输入框换成文字，工具条、按钮、左栏清单全删掉。
 * 左栏清单之所以删掉，是因为导出时我们会按员工/按队列**各建一份**，面板自带的那份是死的。
 */
const CHROME = '.perf-picker, .perf-view-toggle, .perf-overview-bar, .perf-empty-actions'
function freezePanel(root) {
  for (const node of root.querySelectorAll(CHROME)) node.remove()
  for (const cell of root.querySelectorAll('.perf-grid .act')) cell.remove()
  for (const field of [...root.querySelectorAll('input, textarea, select')]) {
    const text = document.createElement('span')
    // 保留 .perf-cell 那套样式（底色、圆角、对齐），只是不再是输入框
    text.className = `${field.className} static`
    const value = field.value
    // 空的格子显示占位符（页面里它是 placeholder="—" / "0"），和屏幕上看到的一致
    text.textContent = value !== '' && value != null ? value : (field.getAttribute('placeholder') || '—')
    field.replaceWith(text)
  }
  // 兜底：面板里剩下的按钮一个都不留（导航按钮是我们自己另建的）
  for (const button of [...root.querySelectorAll('button')]) button.remove()
}

/** 渲染一个面板，冻结后返回根节点（调用方自己决定取哪一块）。 */
function renderFrozen(component, props) {
  const host = document.createElement('div')
  const app = createApp({ render: () => h(component, props) })
  app.mount(host)
  freezePanel(host)
  const box = document.createElement('div')
  box.innerHTML = host.innerHTML
  app.unmount()
  return box
}

/** 只要面板的右半边（汇总条 + 表 + 工资构成），不要它自带的左栏与视图切换。 */
function renderSplitBody(component, props) {
  const box = renderFrozen(component, props)
  return (box.querySelector('.perf-split-body') || box).innerHTML
}

/** 把 perf.css 用到的 CSS 变量按「当前主题」解析出来写进 :root。 */
function collectTokens(css) {
  const names = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]))
  const computed = getComputedStyle(document.documentElement)
  const declarations = []
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim()
    if (value) declarations.push(`${name}:${value}`)
  }
  const scheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  return `:root{color-scheme:${scheme};${declarations.join(';')}}`
}

/** 整份独立 HTML。字体走 Google Fonts，离线时退回系统字体。 */
function docHtml({ title, tokens, css, body }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>${tokens}</style>
<style>${css.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body class="perf-report-body">
${body}
</body>
</html>
`
}

export function usePerfExport({
  computedAll, summary, month,
  members, queues, constants, checkHours, rowByMember, queueTotalsAll,
  queueRowsOf, queueRowsFor, queueTotalsFor, viz,
}) {
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

  /** 左栏「按员工」：一行一个人，金额是他本月合计（和网站左栏一样）。 */
  function memberListHtml() {
    const items = members.value.map((member, index) => {
      const result = rowByMember.value.get(member.id)?.result
      return `<button${index === 0 ? ' class="active"' : ''} data-key="m-${escapeHtml(member.id)}">
<span class="pk-name">${escapeHtml(member.name || member.email || '（未命名）')}</span>
<span class="pk-meta">${fmtInt(result?.auditCount)} 条</span>
<span class="pk-money">¥ ${cash(result?.total)}</span>
</button>`
    })
    return `<div class="perf-picker-list" data-list="byMember">${items.join('')}</div>`
  }

  /** 左栏「按队列」：一行一个队列，金额是该队列本月工资。 */
  function queueListHtml() {
    const items = queues.value.map((queue, index) => {
      const bucket = queueTotalsAll.value.get(queue.name) || {}
      return `<button${index === 0 ? ' class="active"' : ''} data-key="q-${escapeHtml(queue.name)}">
<span class="pk-name">${escapeHtml(queue.name)}</span>
<span class="pk-meta">KPI ${queue.kpi || '—'}</span>
<span class="pk-money">¥ ${cash(bucket.pay)}</span>
</button>`
    })
    return `<div class="perf-picker-list" data-list="byQueue" hidden>${items.join('')}</div>`
  }

  /** 一页 = 一个人 / 一个队列的右半边内容；第一页默认可见，其余 hidden。 */
  function paneHtml(view, key, active, html) {
    return `<div class="perf-pane" data-pane="${view}" data-key="${escapeHtml(key)}"${active ? '' : ' hidden'}>${html}</div>`
  }

  /** 四、数据总览：网站上那套「左栏 + 右表」，按员工与按队列各一套，用导航脚本切换。 */
  function entryTabHtml() {
    if (!members.value.length) {
      return '<div class="perf-empty"><h3>还没有员工</h3><p>先在「员工名单」里把人加进来。</p></div>'
    }
    const viewToggle = `<div class="perf-view-toggle">
<button data-view="byMember" class="active">按员工</button>
<button data-view="byQueue">按队列</button>
<span class="perf-hint">左边点一个人，右边是他在各个队列的数据；切到「按队列」则相反。</span>
</div>`

    const memberPanes = members.value.map((member, index) => {
      const html = renderSplitBody(PerfEntryPanel, {
        members: members.value,
        filteredMembers: members.value,
        filteredQueues: queues.value,
        rowByMember: rowByMember.value,
        queueTotalsAll: queueTotalsAll.value,
        activeMember: member,
        memberSummary: rowByMember.value.get(member.id)?.result || null,
        memberQueueRows: queueRowsOf(member),
        queueRows: [],
        queueTotals: EMPTY_TOTALS,
        activeQueueConfig: null,
        activePrice: {},
        constants: constants.value,
        entryView: 'byMember',
        // 报告要看全：不管页面上三薪列是不是收起的
        showTriple: true,
      })
      return paneHtml('byMember', `m-${member.id}`, index === 0, html)
    })

    const queuePanes = queues.value.map((queue) => {
      const rows = queueRowsFor(queue.name)
      const html = renderSplitBody(PerfEntryPanel, {
        members: members.value,
        filteredMembers: members.value,
        filteredQueues: queues.value,
        rowByMember: rowByMember.value,
        queueTotalsAll: queueTotalsAll.value,
        activeMember: members.value[0],
        memberSummary: null,
        memberQueueRows: [],
        queueRows: rows,
        queueTotals: queueTotalsFor(rows),
        activeQueueConfig: queue,
        activePrice: entryNumbers({ auditCount: 0, actualAht: 0 }, { requiredHours: checkHours.value }, queue, constants.value),
        constants: constants.value,
        entryView: 'byQueue',
        activeQueue: queue.name,
        showTriple: true,
      })
      // 页面打开时是「按员工」，所以所有「按队列」的页先藏着（脚本切过去时才显示第一页）
      return paneHtml('byQueue', `q-${queue.name}`, false, html)
    })

    return `${viewToggle}
<div class="perf-split">
<aside class="perf-picker">${memberListHtml()}${queueListHtml()}</aside>
<div class="perf-split-body">${memberPanes.join('')}${queuePanes.join('')}</div>
</div>`
  }

  /** 二、数据可视化：面板原样，排序按钮在冻结时已删掉。 */
  function vizTabHtml() {
    return renderFrozen(PerfVizPanel, {
      rankOptions: viz.rankOptions.value,
      ranked: viz.ranked.value,
      vizStats: viz.vizStats.value,
      payStacks: viz.payStacks.value,
      queueStats: viz.queueStats.value,
      vizMatrix: viz.vizMatrix.value,
      vizScatter: viz.vizScatter.value,
      deviations: viz.deviations.value,
      summary: summary.value,
      rankBy: viz.rankBy.value,
    }).innerHTML
  }

  /** 三、员工名单。 */
  function rosterTabHtml() {
    return renderFrozen(PerfRosterPanel, {
      members: members.value,
      rowByMember: rowByMember.value,
      bulkMessage: '',
      bulkOpen: false,
      bulkText: '',
      promptRef: '',
    }).innerHTML
  }

  /** 四、队列 KPI。 */
  function queuesTabHtml() {
    return renderFrozen(PerfQueuesPanel, {
      queues: queues.value,
      constants: constants.value,
      checkHours: checkHours.value,
      queueTotalsAll: queueTotalsAll.value,
      summary: summary.value,
      queueForm: { open: false, name: '', kpi: '', error: '' },
      highlightedQueue: '',
    }).innerHTML
  }

  /** 导出 HTML：四块内容 → 外壳（含导航脚本）→ 内联样式 → 下载。 */
  function exportHtml() {
    const body = reportBody({
      month: month.value,
      generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      summary: summary.value,
      tabs: [
        { id: 'entry', label: '数据总览', html: entryTabHtml() },
        { id: 'viz', label: '数据可视化', html: vizTabHtml() },
        { id: 'roster', label: '员工名单', html: rosterTabHtml() },
        { id: 'queues', label: '队列 KPI', html: queuesTabHtml() },
      ],
    })
    const html = docHtml({
      title: `绩效 · ${month.value || '未选月份'}`,
      tokens: collectTokens(perfCss),
      css: perfCss,
      body,
    })
    downloadText(html, `绩效_${month.value || 'export'}.html`, 'text/html;charset=utf-8')
    return true
  }

  return { exportWorkbook, exportHtml }
}
