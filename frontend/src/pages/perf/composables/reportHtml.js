// 「导出 HTML」的文档外壳：页头 + 四个导航 + 四块面板 + 页脚 + 一小段导航脚本。
//
// 导出的文件就是网站的**浏览模式**：上面四个导航（数据总览 / 数据可视化 / 员工名单 / 队列 KPI），
// 数据总览里还能切「按员工 / 按队列」——左边点人，右边是他的各个队列；左边点队列，右边是该队列的全员。
// 区别只有一个：格子里的数字是死的，不能改。
//
// 这个文件是**纯字符串**：不碰 DOM、不 import Vue。面板标记由 usePerfExport.js 渲染好传进来。
import { pctText } from './format.js'

/** 整数带千分位。 */
export const fmtInt = (value) => (Number(value) || 0).toLocaleString('en-US')

/** 金额两位小数 + 千分位（页面上的 money() 不带千分位，文档为了好读单独一份）。 */
export const cash = (value) => Number(Number(value) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 姓名、邮箱、队列名都是用户输入，拼进标记前必须转义。 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 导航脚本：切标签页、切「按员工/按队列」、点左栏的某一项。
 * 只用 data-* 属性找目标，不依赖任何库；整份文件双击就能用，不发请求。
 */
const NAV_SCRIPT = `
(function () {
  var root = document.querySelector('.perf-report')
  if (!root) return
  var all = function (selector, scope) { return Array.prototype.slice.call((scope || root).querySelectorAll(selector)) }

  function activeView(section) {
    var button = section.querySelector('.perf-view-toggle button.active')
    return button ? button.dataset.view : null
  }

  function selectItem(section, button) {
    var view = activeView(section)
    all('button', button.parentNode).forEach(function (other) {
      other.classList.toggle('active', other === button)
    })
    all('.perf-pane', section).forEach(function (pane) {
      pane.hidden = !(pane.dataset.pane === view && pane.dataset.key === button.dataset.key)
    })
  }

  function setView(section, button) {
    all('.perf-view-toggle button', section).forEach(function (other) {
      other.classList.toggle('active', other === button)
    })
    var view = button.dataset.view
    all('[data-list]', section).forEach(function (list) { list.hidden = list.dataset.list !== view })
    var first = section.querySelector('[data-list="' + view + '"] button')
    if (first) selectItem(section, first)
  }

  root.addEventListener('click', function (event) {
    var target = event.target
    var tabButton = target.closest('.perf-tabs button')
    if (tabButton) {
      all('.perf-tabs button').forEach(function (other) { other.classList.toggle('active', other === tabButton) })
      all('.perf-tab-panel').forEach(function (panel) { panel.hidden = panel.dataset.tab !== tabButton.dataset.tab })
      return
    }
    var viewButton = target.closest('.perf-view-toggle button')
    if (viewButton) { setView(viewButton.closest('.perf-tab-panel'), viewButton); return }
    var item = target.closest('.perf-picker-list button')
    if (item) selectItem(item.closest('.perf-tab-panel'), item)
  })
})()
`

/**
 * 整份文档的 <body> 内容。
 *
 * @param {object} input
 * @param {string} input.month       月份，例如 "2026-10"
 * @param {string} input.generatedAt 导出时间（已格式化）
 * @param {object} input.summary     computeAll 的 summary（页头那行合计）
 * @param {Array}  input.tabs        [{ id, label, html }]；第一块默认显示
 */
export function reportBody({ month, generatedAt, summary, tabs = [] }) {
  const s = summary || {}
  const nav = tabs.map((tab, index) => `<button data-tab="${tab.id}"${index === 0 ? ' class="active"' : ''}>${escapeHtml(tab.label)}</button>`).join('')
  const panels = tabs.map((tab, index) => `<section class="perf-tab-panel" data-tab="${tab.id}"${index === 0 ? '' : ' hidden'}>
${tab.html}
</section>`).join('\n')
  return `<div class="perf-report">
  <header class="perf-report-head">
    <div class="perf-report-title">
      <span class="perf-mark">¥</span>
      <div>
        <strong>绩效计算器</strong>
        <small>审核小组月度绩效 · ${escapeHtml(month || '未选月份')}</small>
      </div>
    </div>
    <div class="perf-report-meta">
      <span>员工 <b>${s.headcount || 0} 人</b></span>
      <span>审核量 <b>${fmtInt(s.auditCount)} 条</b></span>
      <span>加权效率 <b>${pctText(s.efficiency)}</b></span>
      <span>合计 <b>¥ ${cash(s.total)}</b></span>
      <span>导出时间 <b>${escapeHtml(generatedAt)}</b></span>
    </div>
  </header>

  <nav class="perf-tabs">${nav}</nav>

${panels}

  <footer class="perf-report-foot">由「绩效计算器」导出 · 数据只在本机与自己的账号里，这份文件不连服务器。</footer>
  <script>${NAV_SCRIPT}</script>
</div>`
}
