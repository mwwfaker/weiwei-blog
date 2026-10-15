<script setup>
// 「数据可视化」：关键指标、薪资构成、队列分布、矩阵、散点、相对均值、可排序明细。
// 这一块全是派生数据，统计口径统一放在 composables/usePerfViz.js，这里只负责画。
import { money, percent } from '../composables/format.js'
import { queueListOf } from '../composables/rows.js'

defineProps({
  rankOptions: { type: Array, default: () => [] },
  ranked: { type: Array, default: () => [] },
  vizStats: { type: Object, default: () => ({}) },
  payStacks: { type: Array, default: () => [] },
  queueStats: { type: Array, default: () => [] },
  vizMatrix: { type: Object, default: () => ({ cols: [], rows: [], max: 0 }) },
  vizScatter: { type: Object, default: () => ({ empty: true }) },
  deviations: { type: Array, default: () => [] },
  summary: { type: Object, default: () => ({}) },
})
const rankBy = defineModel('rankBy', { type: String, default: 'total' })
</script>

<template>
  <section class="perf-panel viz-panel">
    <!-- 一、关键指标 -->
    <div class="viz-stats">
      <div class="viz-stat"><small>总支出</small><strong>¥ {{ money(vizStats.total) }}</strong></div>
      <div class="viz-stat"><small>人均</small><strong>¥ {{ money(vizStats.average) }}</strong></div>
      <div class="viz-stat"><small>中位数</small><strong>¥ {{ money(vizStats.median) }}</strong></div>
      <div class="viz-stat up"><small>最高</small><strong>¥ {{ money(vizStats.max) }}</strong><span>{{ vizStats.maxName }}</span></div>
      <div class="viz-stat down"><small>最低</small><strong>¥ {{ money(vizStats.min) }}</strong><span>{{ vizStats.minName }}</span></div>
      <div class="viz-stat"><small>审核总量</small><strong>{{ (summary.auditCount || 0).toLocaleString('en-US') }}</strong></div>
      <div class="viz-stat"><small>加权效率</small><strong>{{ percent(summary.efficiency) }}</strong></div>
      <div class="viz-stat"><small>平均完成度</small><strong>{{ percent(vizStats.averageCompletion) }}</strong></div>
    </div>

    <div class="viz-grid">
      <!-- 二、薪资构成堆叠条 -->
      <article class="viz-card">
        <h4>薪资构成 <em>每人一段,四部分叠起来</em></h4>
        <div class="viz-legend">
          <span><i style="background:#8b6ce0"></i>审核</span>
          <span><i style="background:#4aa8c0"></i>补时</span>
          <span><i style="background:#46b06a"></i>加班</span>
          <span><i style="background:#e0a13f"></i>三薪</span>
        </div>
        <div class="viz-rows">
          <div v-for="row in payStacks" :key="row.id" class="viz-row">
            <span class="viz-name">{{ row.name }}</span>
            <div class="viz-track">
              <div v-for="seg in row.segments" :key="seg.key" class="viz-seg" :style="{ width: seg.width + '%', background: seg.color }" :title="seg.label + ' ¥' + money(seg.value)"></div>
            </div>
            <span class="viz-val">¥ {{ money(row.total) }}</span>
          </div>
        </div>
      </article>

      <!-- 三、队列分布 -->
      <article class="viz-card">
        <h4>队列分布 <em>哪些队列在产钱</em></h4>
        <div v-if="!queueStats.length" class="viz-empty">还没有队列数据</div>
        <div v-else class="viz-rows">
          <div v-for="q in queueStats.slice(0, 10)" :key="q.name" class="viz-row">
            <span class="viz-name">{{ q.name }}</span>
            <div class="viz-track">
              <div class="viz-seg" :style="{ width: q.barPercent + '%', background: 'linear-gradient(90deg,#7a52d8,#a97cf0)' }" :title="q.auditCount + ' 条'"></div>
            </div>
            <span class="viz-val">{{ q.auditCount.toLocaleString('en-US') }} · ¥{{ money(q.pay) }}</span>
          </div>
        </div>
      </article>

      <!-- 四、员工 × 队列 矩阵 -->
      <article class="viz-card wide">
        <h4>员工 × 队列 矩阵 <em>颜色越深审核量越大,一眼看出谁在哪个队列上</em></h4>
        <div v-if="!vizMatrix.rows.length" class="viz-empty">还没有数据</div>
        <div v-else class="matrix-wrap">
          <table class="matrix">
            <thead>
              <tr>
                <th class="matrix-corner">队列 \ 员工</th>
                <th v-for="(name, i) in vizMatrix.cols" :key="i" class="matrix-col">{{ name.split(/[.\s]/)[0] }}</th>
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

      <!-- 四、效率 × 完成度 散点 -->
      <article class="viz-card wide">
        <h4>效率 × 完成度 <em>气泡越大工资越高,虚线是平均值,右上角最好</em></h4>
        <div v-if="vizScatter.empty" class="viz-empty">还没有可比较的数据</div>
        <svg v-else class="viz-scatter" :viewBox="`0 0 ${vizScatter.W} ${vizScatter.H}`" preserveAspectRatio="xMidYMid meet">
          <!-- 四象限底色 -->
          <rect :x="vizScatter.avgX" :y="vizScatter.T" :width="vizScatter.W - vizScatter.R - vizScatter.avgX" :height="vizScatter.avgY - vizScatter.T" class="quad best" />
          <rect :x="vizScatter.L" :y="vizScatter.T" :width="vizScatter.avgX - vizScatter.L" :height="vizScatter.avgY - vizScatter.T" class="quad" />
          <rect :x="vizScatter.avgX" :y="vizScatter.avgY" :width="vizScatter.W - vizScatter.R - vizScatter.avgX" :height="vizScatter.H - vizScatter.B - vizScatter.avgY" class="quad" />
          <rect :x="vizScatter.L" :y="vizScatter.avgY" :width="vizScatter.avgX - vizScatter.L" :height="vizScatter.H - vizScatter.B - vizScatter.avgY" class="quad" />

          <!-- 网格与刻度 -->
          <g v-for="t in vizScatter.xTicks" :key="'xt' + t.v">
            <line :x1="t.x" :y1="vizScatter.T" :x2="t.x" :y2="vizScatter.H - vizScatter.B" class="grid" />
            <text :x="t.x" :y="vizScatter.H - vizScatter.B + 14" class="tick" text-anchor="middle">{{ t.label }}</text>
          </g>
          <g v-for="t in vizScatter.yTicks" :key="'yt' + t.v">
            <line :x1="vizScatter.L" :y1="t.y" :x2="vizScatter.W - vizScatter.R" :y2="t.y" class="grid" />
            <text :x="vizScatter.L - 8" :y="t.y + 3" class="tick" text-anchor="end">{{ t.label }}</text>
          </g>

          <!-- 坐标轴 -->
          <line :x1="vizScatter.L" :y1="vizScatter.H - vizScatter.B" :x2="vizScatter.W - vizScatter.R" :y2="vizScatter.H - vizScatter.B" class="axis" />
          <line :x1="vizScatter.L" :y1="vizScatter.T" :x2="vizScatter.L" :y2="vizScatter.H - vizScatter.B" class="axis" />
          <text :x="(vizScatter.W + vizScatter.L) / 2" :y="vizScatter.H - 6" class="axislabel" text-anchor="middle">审核效率（标准AHT ÷ 实际AHT）</text>
          <text :x="14" :y="vizScatter.H / 2" class="axislabel" text-anchor="middle" :transform="`rotate(-90 14 ${vizScatter.H / 2})`">完成度</text>

          <!-- 平均值十字 -->
          <line :x1="vizScatter.avgX" :y1="vizScatter.T" :x2="vizScatter.avgX" :y2="vizScatter.H - vizScatter.B" class="avgline" />
          <line :x1="vizScatter.L" :y1="vizScatter.avgY" :x2="vizScatter.W - vizScatter.R" :y2="vizScatter.avgY" class="avgline" />

          <!-- 象限说明 -->
          <text v-for="(q, i) in vizScatter.quadrants" :key="'q' + i" :x="q.x" :y="q.y" class="quadlabel" :text-anchor="q.anchor">{{ q.text }}</text>

          <!-- 数据点 -->
          <g v-for="(p, i) in vizScatter.points" :key="p.id" class="dotgroup" :style="{ animationDelay: (i % 9) * 0.32 + 's' }">
            <title>{{ p.tip }}</title>
            <circle :cx="p.x" :cy="p.y" :r="p.r" class="dot" :class="{ over: p.overX || p.overY }" />
            <text
              v-if="p.show"
              :x="p.x"
              :y="p.labelAbove ? p.y - p.r - 6 : p.y + p.r + 13"
              class="dotlabel"
              text-anchor="middle"
            >{{ p.short }}</text>
          </g>
        </svg>
      </article>

      <!-- 五、相对团队均值 -->
      <article class="viz-card wide">
        <h4>相对团队均值 <em>越往右越高,竖线是人均</em></h4>
        <div class="viz-rows">
          <div v-for="row in deviations" :key="row.id" class="viz-row dev">
            <span class="viz-name">{{ row.name }}</span>
            <div class="viz-dev-track">
              <div class="viz-dev-mid"></div>
              <div
                class="viz-dev-bar"
                :class="{ neg: row.delta < 0 }"
                :style="row.delta >= 0 ? { left: '50%', width: row.width + '%' } : { right: '50%', width: row.width + '%' }"
              ></div>
            </div>
            <span class="viz-val" :class="{ neg: row.delta < 0 }">{{ row.delta >= 0 ? '+' : '−' }}¥{{ money(Math.abs(row.delta)) }}</span>
          </div>
        </div>
      </article>
    </div>

    <!-- 六、可排序明细 -->
    <div class="perf-view-toggle">
      <span class="perf-hint">明细按</span>
      <button v-for="opt in rankOptions" :key="opt.id" :class="{ active: rankBy === opt.id }" @click="rankBy = opt.id">{{ opt.label }}</button>
    </div>
    <div class="perf-list">
      <table class="perf-grid">
        <thead>
          <tr>
            <th class="rank-col">#</th>
            <th>员工</th>
            <th class="bar-col">对比</th>
            <th class="num">审核量</th>
            <th>队列</th>
            <th class="num">审核效率</th>
            <th class="num">完成度</th>
            <th class="num">月实际工时</th>
            <th class="num">审核工资</th>
            <th class="num">合计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in ranked" :key="row.member.id">
            <td class="rank-col"><span class="rank-badge" :class="{ top1: index === 0, top3: index < 3 }">{{ index + 1 }}</span></td>
            <td class="name">{{ row.member.name || '（未命名）' }}</td>
            <td class="bar-col"><div class="viz-bar"><div :style="{ width: row.barPercent + '%' }"></div></div></td>
            <td class="num">{{ (row.result.auditCount || 0).toLocaleString('en-US') }}</td>
            <td class="viz-queues">
              <span v-for="q in queueListOf(row)" :key="q" class="queue-pill">{{ q }}</span>
              <span v-if="!queueListOf(row).length" class="muted">—</span>
            </td>
            <td class="num" :class="{ good: row.result.efficiency >= 1 }">{{ percent(row.result.efficiency) }}</td>
            <td class="num">{{ percent(row.result.completion) }}</td>
            <td class="num muted">{{ (row.result.actualHours || 0).toFixed(2) }} h</td>
            <td class="num muted">¥ {{ money(row.result.auditPay) }}</td>
            <td class="num total">¥ {{ money(row.result.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
