<script setup>
// 工具箱：工具类页面的统一入口。
//
// 以前「绩效计算器」孤零零挂在「更多」里，以后每加一个工具就要多占一格菜单。
// 现在工具都从这里进：加新工具 = 在 tools 数组里加一项，并给它建一个页面。
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { go } from '@/app/usePageNav'

/** 工具清单。`id` 必须同时是路由名（app/routes.js）。 */
const tools = [
  {
    id: 'perf',
    name: '绩效计算器',
    note: '按队列标准工时核算审核量、完成度与工资，可导出 Excel。',
    tag: '已上线',
  },
]

/** 预留位：让页面看起来是「会长大的工具箱」，而不是只有一个按钮的空白页。 */
const planned = ['图片批处理', '文本对比', '二维码生成']
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

      <div v-for="name in planned" :key="name" class="tools-card is-planned">
        <span class="tools-card-top">
          <span class="tools-card-name">{{ name }}</span>
          <span class="tools-card-tag">规划中</span>
        </span>
        <span class="tools-card-note">还没做，先占个位置。</span>
        <span class="tools-card-go">敬请期待</span>
      </div>
    </div>
  </section>
</template>
