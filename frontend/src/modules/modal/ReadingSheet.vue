<script setup>
// 阅读类「对话框」的共用外壳：**表头与底部操作固定，只有正文滚动**，
// 并且自带入场 / 退场动效——这就是那份「对话框模板」，别的弹窗要用同一套直接套它。
//
// 动效（动效时长写在 JS 里，通过 CSS 变量下发给样式，避免两边各写一个数字对不上）：
//   · 进场：桌面从右侧滑入到中央，手机从下往上滑入（带一点点过冲，滑得「有手感」）
//   · 退场：卡片模糊、发白、上浮并消散，同时铺一层尘埃粒子——点关闭、点叉、点空白页
//     走的是同一条路径（都进 requestClose）。
//   · `prefers-reduced-motion` 或 `motion=false` 时不做动效，直接关。
//
// 关键点：**退场动画必须由这个组件自己播完再 emit('close')**。
// 外层一般是 `v-if`，所以如果一上来就 emit，父组件立刻把它从 DOM 摘掉，
// 动画根本没有机会开始——这正是原来文章阅读弹窗要靠外层 <Transition> 的原因。
//
// 这套退场时序（时长常量、量位置、兜底、等粒子飞完）在 `composables/useDustClose.js`，
// 全屏看图（`modules/media/GalleryViewer.vue`）复用的是同一份。
//
// 版面（head / 正文 / actions 三个插槽）与外观各归各，日记和文章各有自己的样式节。
import { computed, ref } from 'vue'
import { useDustClose } from '@/composables/useDustClose'
import DustBurst from './DustBurst.vue'

const props = defineProps({
  cardClass: { type: [String, Array, Object], default: '' },
  backdropClass: { type: [String, Array, Object], default: '' },
  closeLabel: { type: String, default: '关闭阅读' },
  /**
   * 用来算字数的正文。传了就在右下角显示「共 N 字」——
   * 放在外壳里算，是因为日记和文章要的是同一个数字口径（去掉空白后的字符数），
   * 各写一遍迟早会出现一处算了空白、一处没算。
   */
  countText: { type: String, default: '' },
  /** 关掉入场 / 化灰动效（系统开了「减少动态效果」时自动关）。 */
  motion: { type: Boolean, default: true },
  /**
   * 从哪一边滑进来：`'right'`（默认）/ `'left'`。
   * 调用方按「用户点的那张卡片在哪一侧」传，弹窗就从那一侧展开，
   * 视线不用跨过整屏去找它。手机端不看这个值——窄屏一律从下往上。
   */
  from: { type: String, default: 'right' },
})
const emit = defineEmits(['close'])

const charCount = computed(() => String(props.countText || '').replace(/\s/g, '').length)

/** 只做左右两档；写了别的值也按右边处理，免得一个笔误让弹窗从屏幕外永远飞进来。 */
const fromClass = computed(() => (props.from === 'left' ? 'is-from-left' : 'is-from-right'))

const card = ref(null)
// 退场的时序与粒子层都在 useDustClose 里（全屏看图用的是同一套）。
// 关键点：**动画跑完才 emit('close')** —— 外层一般是 `v-if`，一上来就 emit 的话
// 父组件立刻把它从 DOM 摘掉，动画根本没有机会开始。
const { closing, dustRect, dustCount, requestClose, ENTER_MS, DUST_HOLD_MS, DUST_MS } = useDustClose({
  target: card,
  motion: () => props.motion,
  // 三条关闭路径（叉、点空白、调用方主动关）都走这里，行为一致。
  onClose: () => emit('close'),
})

defineExpose({ requestClose })
</script>

<template>
  <div
    class="modal-backdrop reading-backdrop"
    :class="[backdropClass, { 'is-dusting': closing }]"
    :style="{ '--enter-ms': ENTER_MS + 'ms', '--dust-ms': DUST_MS + 'ms' }"
    @click.self="requestClose"
  >
    <article ref="card" class="modal-card reading-sheet" :class="[cardClass, fromClass, { 'is-dusting': closing }]">
      <header class="reading-head">
        <slot name="head" />
        <button class="modal-close reading-close" :aria-label="closeLabel" @click="requestClose">×</button>
      </header>
      <div class="reading-scroll">
        <slot />
      </div>
      <footer v-if="$slots.actions || charCount" class="reading-foot">
        <slot name="actions" />
        <span v-if="charCount" class="reading-count">共 {{ charCount }} 字</span>
      </footer>
    </article>
    <DustBurst v-if="closing && dustRect" :rect="dustRect" :hold="DUST_HOLD_MS" :count="dustCount" />
  </div>
</template>
