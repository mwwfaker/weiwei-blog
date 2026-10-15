<script setup>
// 「计算说明」：公式、可调常数、数据存放位置。纯展示 + 常数就地编辑。
// 「恢复默认」以前点了没反应——`resetConstants` 从来没有定义过。现在它 emit 给 PerfPage 执行。
// （就地编辑改的是 constants 这个对象的属性，不是替换 prop 本身，所以不需要 emit。）
defineProps({
  constants: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['reset-constants'])
</script>

<template>
  <section class="perf-panel">
    <div class="perf-card">
      <h3>计算公式</h3>
      <ul class="perf-formulas">
        <li><code>标准 AHT = ROUND(24480 ÷ KPI, 2)</code><span>KPI 是每月手改的输入值（「队列 KPI」里改）。</span></li>
        <li><code>单价 = (1800 × 标准AHT) ÷ (月要求工时 × 3600 × 0.85)</code><span>用的是四舍五入到两位小数之后的 AHT；月要求工时是每人各自的。</span></li>
        <li><code>审核工资 = (审核量 − 三薪日审核量) × 单价</code><span>三薪那天按时长固定给钱，那天的审核量要从计件里剔除，否则同一批活会被付两次。三薪列默认收起来，需要时点「显示三薪列」。效率与完成度仍按全部审核量算，因为它们衡量的是实际干了多少活。</span></li>
        <li><code>标准总时长 = 标准AHT × 审核量</code>　<code>实际总时长 = 实际AHT × 审核量</code></li>
        <li><code>月实际工时 = 实际总时长 ÷ 3600</code><span>算出来的，不用填。</span></li>
        <li><code>月度审核效率 = 标准总时长 ÷ 实际总时长</code><span>小组汇总用加权（Σ标准 ÷ Σ实际）。</span></li>
        <li><code>完成度 = Σ(审核量 × 标准AHT) ÷ (((月要求工时 + 加班时长) × 0.85 − 抽调时长) × 3600)</code><span>分子就是标准总时长。抽调会从可用时间里扣掉，所以被抽调得多反而显得完成度高。</span></li>
        <li><code>补时工资 = 审核工资 × 抽调时长 × 0.85 ÷ 月实际工时</code></li>
        <li><code>加班工资 = 加班时长 × 加班单价</code>　<code>三薪工资 = 三薪时长 × 三薪单价</code></li>
        <li><code>合计 = 审核工资 + 补时工资 + 加班工资 + 三薪工资</code></li>
      </ul>
    </div>
    <div class="perf-card">
      <h3>可调常数</h3>
      <div class="perf-constants">
        <label>金额基准<input type="number" v-model.number="constants.baseAmount" /></label>
        <label>系数<input type="number" step="0.01" v-model.number="constants.factor" /></label>
        <label>KPI 常数<input type="number" v-model.number="constants.kpiBase" /></label>
        <label>加班单价 / 工时<input type="number" v-model.number="constants.overtimeRate" /></label>
        <label>三薪单价 / 工时<input type="number" v-model.number="constants.tripleRate" /></label>
        <button class="perf-btn" @click="emit('reset-constants')">恢复默认</button>
      </div>
    </div>
    <div class="perf-card">
      <h3>数据存放</h3>
      <p class="perf-hint">存在本机浏览器（键名前缀 <code>weiwei-blog-perf-</code>）。数据不敏感，需要的话可以再搬到服务器。</p>
    </div>
  </section>
</template>
