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
// 版面（head / 正文 / actions 三个插槽）与外观各归各，日记和文章各有自己的样式节。
import { computed, ref } from 'vue'
import DustBurst from './DustBurst.vue'

/** 进场时长（毫秒）。只用于样式里的动画，不需要 JS 等待。 */
const ENTER_MS = 560
/**
 * 退场前的静止时长（毫秒）。
 * 一上来就化灰会「看不见」——眼睛需要一拍才反应过来要发生什么，
 * 所以先定住不动、再开始消散。别调大：超过 ~250ms 就会被当成卡住了。
 */
const DUST_HOLD_MS = 180
/** 退场总时长（毫秒）。必须覆盖「静止 + 消散 + 最后一批粒子飞完」，JS 要等它跑完再交差。 */
const DUST_MS = 1320

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
const closing = ref(false)
const dustRect = ref(null)
const dustCount = ref(420)

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/** 窄屏粒子给少一些：几百个带发光阴影的圆点在小手机上不划算。 */
const particleCount = () => (typeof matchMedia === 'function' && matchMedia('(min-width: 761px)').matches ? 420 : 240)

/**
 * 三条关闭路径（叉、点空白、代码里主动关）都走这里。
 * 动画跑完才 emit，父组件那时才把组件摘掉。
 */
function requestClose() {
  if (closing.value) return
  if (!props.motion || reducedMotion()) { emit('close'); return }
  closing.value = true
  dustCount.value = particleCount()

  // 粒子层要有地方铺。正常情况用卡片的实际位置；万一量不到（ref 没就绪等），
  // 退回一块屏幕中央的区域——**宁可铺得不准，也不能一声不响地什么都不显示**。
  const rect = card.value?.getBoundingClientRect?.()
  if (rect && rect.width > 1 && rect.height > 1) {
    dustRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  } else {
    const vw = globalThis.innerWidth || 1024
    const vh = globalThis.innerHeight || 768
    dustRect.value = { left: vw * 0.16, top: vh * 0.12, width: vw * 0.68, height: vh * 0.62 }
  }
  globalThis.setTimeout(() => emit('close'), DUST_MS)
}

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
