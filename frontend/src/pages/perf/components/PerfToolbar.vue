<script setup>
// 顶部工具条：月份、数据来源选择、同步状态、导出与返回。
// 自己不持有状态，改月份/切账号/导出/返回都交给 PerfPage。
defineProps({
  month: { type: String, default: '' },
  workspaces: { type: Array, default: () => [] },
  activeOwnerId: { type: [String, Number], default: null },
  syncState: { type: String, default: '' },
  syncMessage: { type: String, default: '' },
  syncLabel: { type: String, default: '' },
  memberCount: { type: Number, default: 0 },
})
defineEmits(['update:month', 'select', 'export', 'export-html', 'back'])
</script>

<template>
  <header class="perf-bar">
    <div class="perf-bar-left">
      <span class="perf-mark">¥</span>
      <div><strong>绩效计算器</strong><small>审核小组月度绩效</small></div>
      <input class="perf-month" type="month" :value="month" aria-label="月份" @input="$emit('update:month', $event.target.value)" />
      <label v-if="workspaces.length > 1" class="perf-owner-pick">
        <span>数据来源</span>
        <select :value="activeOwnerId" aria-label="选择要查看的账号数据" @change="$emit('select', $event.target.value)">
          <option v-for="item in workspaces" :key="item.ownerId" :value="item.ownerId">{{ item.ownerName || `账号 ${item.ownerId}` }}</option>
        </select>
      </label>
    </div>
    <div class="perf-bar-right">
      <span class="perf-sync" :class="syncState">{{ syncMessage || syncLabel }}</span>
      <button class="perf-btn" :disabled="!memberCount" @click="$emit('export')">导出 Excel</button>
      <button class="perf-btn" :disabled="!memberCount" title="导出一份能直接双击打开的报告：数据总览 + 数据可视化" @click="$emit('export-html')">导出 HTML</button>
      <button class="perf-btn primary" @click="$emit('back')">← 返回博客</button>
    </div>
  </header>
</template>
