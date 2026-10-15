<script setup>
// 内页统一的标题区：kicker + 主标题 + 一句说明，右侧放该页自己的操作按钮。
//
// 15 个内页原来各自抄了一遍四层嵌套的 div，改一次标题字号要改 15 处。
// 差异只有三处，都做成了 prop：kicker 后面那条小横线、标题后缀符号、右侧插槽。
//
// v-reveal 在组件内部 import，而不是靠全局注册：渲染测试会单独挂载组件，那时没有全局指令。
import { vReveal } from '@/composables/motion'

defineProps({
  kicker: { type: String, default: '' },
  title: { type: String, default: '' },
  /** 主标题后面的装饰符号，例如 ✧ / ◈ / ♫。留空就不渲染。 */
  mark: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  /** 创作管理页的 kicker 后面没有那条小横线。 */
  rule: { type: Boolean, default: true },
})
</script>

<template>
  <div class="inner-title-row" v-reveal>
    <div>
      <div class="section-kicker">{{ kicker }} <span v-if="rule"></span></div>
      <h1>{{ title }} <em v-if="mark">{{ mark }}</em></h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <slot />
  </div>
</template>
