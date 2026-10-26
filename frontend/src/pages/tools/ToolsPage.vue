<script setup>
// 工具箱：工具类页面的统一入口。
//
// 以前「绩效计算器」孤零零挂在「更多」里，以后每加一个工具就要多占一格菜单。
// 现在工具都从这里进：加新工具 = 在 tools 数组里加一项，并给它建一个页面。
// 只列真正做完了的工具——「规划中」的占位卡已经删了，它们只会让页面显得空而假。
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { go } from '@/app/usePageNav'

/** 工具清单。`id` 必须同时是路由名（app/routes.js）。 */
const tools = [
  {
    id: 'clipboard',
    name: '快捷复制',
    note: '按工作表整理常用内容；导入一条是单卡，多条自动成组，点击即可复制。',
    tag: '已上线',
  },
  {
    id: 'perf',
    name: '绩效计算器',
    note: '按队列标准工时核算审核量、完成度与工资，可导出 Excel。',
    tag: '已上线',
  },
]
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="UTILITIES"
      title="工具箱"
      mark="▦"
      subtitle="平时真正会用到的小工具，都收在这里。以后新加的工具也放这一页。"
    />

    <div class="tools-grid">
      <button v-for="tool in tools" :key="tool.id" class="tools-card" @click="go(tool.id)">
        <span class="tools-card-top">
          <span class="tools-card-name">{{ tool.name }}</span>
          <span class="tools-card-tag">{{ tool.tag }}</span>
        </span>
        <span class="tools-card-note">{{ tool.note }}</span>
        <span class="tools-card-go">打开 ↗</span>
      </button>
    </div>
  </section>
</template>
