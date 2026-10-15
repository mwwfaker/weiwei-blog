<script setup>
// 日记的「时间树」：一条**从下往上**的时间轴，日记像挂件一样挂在轴上。
//
// 为什么是树而不是列表：日记天然属于时间。列表把时间压成一列日期文字，
// 树把时间变成一条能看见的轴——越往上越新，越往下越早，一眼看得到自己写了多久。
//
// ---- 枝叶的疏密跟着写作量走 -------------------------------------------------
// 「写的多的时间段枝繁叶茂」不是装饰，是这棵树想表达的第二层信息：
// 每篇日记按**前后 21 天内有多少篇**算一个 0~1 的茂盛度，挂在卡片对面的那半边。
// 于是 2023 年 6 月那片（13 篇）会明显浓密，2025 年那篇（全年只有它）几乎光秃——
// 密度不是均匀铺的，是数据给的。
// 下限留 0.2：完全光秃的树干看着像没长起来。
//
// ---- 右边那条时间表 ---------------------------------------------------------
// 半透明的年份刻度，位置**不是按时间均分、而是量出来的**：每到一个新年份，
// 取那一年第一篇挂在轴上的实际像素位置。按时间均分的话，卡片高度不一，
// 刻度和日记就会对不上，那这条表也就没用了。窗口尺寸变化要重新量。
//
// ---- 其余几个刻意的决定 -----------------------------------------------------
//   · **树干是矢量、不是贴图**。高度由日记篇数决定、会一直加，贴图纵向平铺在接缝处会露馅；
//     而且贴图只有一种色，伺候不了深浅两套主题——这里描边走 currentColor，跟着主题变。
//     试过更写实的一版（双描边做圆柱感 + 粗的弯曲枝），观感反而「不自然」，
//     和站点 2026 编辑风的平、软对不上，所以只保留这一条有机曲线。
//     也试过螺旋版（挂件绕轴盘旋而上），不如这版，已撤回。
//   · **左右不是每帧随机的**。真用 Math.random() 的话，任何一次重渲染（搜索、切标签、
//     可见范围一变）所有挂件都会左右横跳。所以按 id 做 FNV-1a 哈希 → 同一个 id 永远同一侧，
//     看起来乱、但稳定。哈希还会**避免连续三篇同侧**，否则一边堆成一坨、另一边空着。
//   · **入场方向由所在侧决定**：左边的日记从右往左滑入、右边的从左往右滑入，
//     也就是「从树干上展开到自己的位置」。手机上是单侧布局（树干靠左），
//     所以那一边统一从树干往右展开。
//   · 逐条入场交给 `v-reveal`（IntersectionObserver）：滚到哪条哪条才动，
//     51 篇一起播会像整页抖一下；它同时负责 `prefers-reduced-motion` 与
//     「没有 IntersectionObserver 就直接显示」的兜底。
//   · **增删日记时让树真的长高 / 变矮**：用 TransitionGroup 折叠节点自身的高度
//     （max-height → 0），而不是靠 FLIP 位移补间。删除时 Vue 会先把要走的节点留在
//     DOM 里播 leave，等它播完才移除——那一刻其余节点的位置才变，而已经没有新的更新了，
//     FLIP 补不上，树干会在移除瞬间「啪」地缩一截。高度折叠是连续的。
//
// 卡片本身复用 DiaryCard：操作行、可见范围标记、点击阅读的行为与列表页完全一致。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DiaryCard from './DiaryCard.vue'
// prefersReducedMotion 挂在 motion 聚合对象上（不是具名导出），跟着仓库既有用法走
import { motion, vReveal } from '@/composables/motion'

/** 茂盛度的统计窗口：前后多少天之内算「同一阵子」。 */
const LUSH_WINDOW_DAYS = 21
const DAY_MS = 86400000

const props = defineProps({
  entries: { type: Array, required: true },
  showActions: { type: Boolean, default: false },
  showVisibility: { type: Boolean, default: false },
})
defineEmits(['open', 'edit', 'toggle-visibility', 'export', 'remove'])

/**
 * 同一个 id 永远落在同一侧（稳定），但看起来是乱的。
 *
 * 用 FNV-1a + 一次雪崩扰动，而不是「累加取奇偶」：后者对连续的 id
 * （101、102、103……）会退化成 **LRLRLRLR** 的拉链——看着是规律，不是随机。
 */
function sideOf(entry, index) {
  const key = String(entry?.id ?? entry?.date ?? index)
  let hash = 2166136261
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 15
  hash = Math.imul(hash, 2246822507)
  hash ^= hash >>> 13
  return (hash >>> 0) % 2 === 0 ? 'left' : 'right'
}

/** 每篇的茂盛度 0~1：前后 21 天里篇数越多越浓。 */
const lushness = computed(() => {
  const times = props.entries.map((entry) => {
    const stamp = Date.parse(String(entry?.date || ''))
    return Number.isNaN(stamp) ? null : stamp
  })
  const counts = times.map((stamp) => {
    if (stamp == null) return 1
    return times.reduce((total, other) => (
      other != null && Math.abs(other - stamp) <= LUSH_WINDOW_DAYS * DAY_MS ? total + 1 : total
    ), 0)
  })
  const peak = Math.max(1, ...counts)
  return counts.map((count) => {
    const norm = peak > 1 ? (count - 1) / (peak - 1) : 0
    // 下限 0.2：完全光秃的树干看着像没长起来
    return Number((0.2 + 0.8 * norm ** 0.65).toFixed(3))
  })
})

const nodes = computed(() => {
  const out = []
  let lastSide = ''
  let run = 0
  let lastYear = ''
  props.entries.forEach((entry, index) => {
    let side = sideOf(entry, index)
    if (side === lastSide) run += 1
    else { run = 1; lastSide = side }
    // 连续三篇同侧就翻一个：不让任何一边连成一串
    if (run >= 3) { side = side === 'left' ? 'right' : 'left'; run = 1; lastSide = side }

    const year = String(entry?.date || '').slice(0, 4)
    const yearLabel = year && year !== lastYear ? `${year}` : ''
    if (year) lastYear = year

    out.push({
      entry,
      side,
      yearLabel,
      lush: lushness.value[index] ?? 0.2,
      delay: (index % 5) * 70,
    })
  })
  return out
})

/**
 * 右边时间表的刻度：**一篇一条**（不是一年一条）。用户要能大致判断时间，
 * 也要能细化到每一篇，所以刻度就是日记本身，当前那一篇把完整日期显示出来。
 *
 * 刻度的位置**不按树里的像素坐标排**，而是按篇序号等距：树可以上万像素高，
 * 直接映射到 420px 的带子上会挤成一条缝，一篇都分不出来。
 * 像素位置（`tops`）只用来算「当前读到哪一篇」和点击跳转。
 */
const root = ref(null)
/** 每篇挂件在树里的像素位置，挂载后量。 */
const tops = ref([])
/**
 * 当前读到第几篇，**可以是小数**（落在两篇之间就取中间值）。
 * 时间表靠它把「当前这一篇」摆到正中，所以必须连续，否则每翻一篇就跳一格，很生硬。
 */
const activeIndex = ref(0)
let observer = null
let frame = 0

/** 刻度之间的间距（px）。太小挤成一片，太大一屏看不到几篇。 */
const TICK_STEP = 26

const ticks = computed(() => props.entries.map((entry, index) => {
  const date = String(entry?.date || '')
  const prev = String(props.entries[index - 1]?.date || '')
  return {
    index,
    label: date.replace(/-/g, '.'),
    year: date.slice(0, 4),
    // 跨年那一篇要标出来，否则一列日期里看不出年份从哪儿断的
    yearStart: Boolean(date) && date.slice(0, 4) !== prev.slice(0, 4),
  }
}))

function measureTicks() {
  const el = root.value
  if (!el) return
  tops.value = [...el.querySelectorAll('.diary-tree-node')].map((node) => node.offsetTop)
  syncActive()
}

/**
 * 把「视口上偏下一点那条线」换算成树里的位置，再看它落在哪两篇之间。
 * 线取 42% 而不是正中：视线停在屏幕中上部，用正中会永远慢半拍。
 */
function syncActive() {
  const el = root.value
  const list = tops.value
  if (!el || !list.length) return
  const focus = (globalThis.innerHeight || 800) * 0.42
  const current = (globalThis.scrollY || 0) + focus - el.getBoundingClientRect().top
  if (current <= list[0]) { activeIndex.value = 0; return }
  const last = list.length - 1
  if (current >= list[last]) { activeIndex.value = last; return }
  for (let i = 0; i < last; i += 1) {
    if (current >= list[i] && current < list[i + 1]) {
      const span = list[i + 1] - list[i] || 1
      activeIndex.value = i + (current - list[i]) / span
      return
    }
  }
}

function onScroll() {
  if (frame) return
  frame = globalThis.requestAnimationFrame(() => { frame = 0; syncActive() })
}

/** 点刻度 → 滚到那一篇。留一点上边距，别让卡片贴在顶栏底下。 */
function jumpTo(index) {
  const el = root.value?.querySelectorAll('.diary-tree-node')?.[index]
  if (!el) return
  const target = (globalThis.scrollY || 0) + el.getBoundingClientRect().top - (globalThis.innerHeight || 800) * 0.24
  globalThis.scrollTo({ top: Math.max(0, target), behavior: motion.prefersReducedMotion() ? 'auto' : 'smooth' })
}

onMounted(() => {
  measureTicks()
  // 卡片高度会随窗口宽度回流（正文换行），刻度的像素位置也得跟着重算
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(() => measureTicks())
    observer.observe(root.value)
  }
  globalThis.addEventListener('scroll', onScroll, { passive: true })
  globalThis.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  globalThis.removeEventListener('scroll', onScroll)
  globalThis.removeEventListener('resize', onScroll)
  if (frame) globalThis.cancelAnimationFrame(frame)
})
watch(() => props.entries, () => nextTick(measureTicks))
</script>

<template>
  <div ref="root" class="diary-tree">
    <!-- 树干：一段会微微蜿蜒的曲线，纵向拉伸填满整棵树。
         描边必须 non-scaling-stroke —— 容器是被纵向拉伸的，不带它笔画会被拉成一根根竖条；
         蜿蜒幅度也只能给到 ±2px，再大挂在轴上的「结」就对不上树干了。
         上下用 mask 淡出：树干从地里长出来，也不该在最上面被硬切一刀。 -->
    <svg class="diary-tree-trunk" viewBox="0 0 16 1200" preserveAspectRatio="none" aria-hidden="true">
      <path class="diary-tree-bark" d="M8 0 C5.4 150 10.6 300 8 450 C5.4 600 10.6 750 8 900 C5.4 1050 10.6 1150 8 1200" />
      <path class="diary-tree-grain" d="M5.6 0 C3 200 8.6 400 5.6 600 C3 800 8.6 1000 5.6 1200" />
      <path class="diary-tree-grain" d="M10.4 0 C13 200 7.4 400 10.4 600 C13 800 7.4 1000 10.4 1200" />
    </svg>

    <!-- 剪影水印：极淡的一整棵树压在卡片后面，只给纵深，不参与布局也不接指针事件。
         拆成两半是有原因的：树冠不能跟着树的高度纵向拉伸（会被拉成一根长条），
         所以树冠单独一张、按固定尺寸钉在顶部；树干与枝那半边才用 preserveAspectRatio="none"
         拉伸，并且靠 non-scaling-stroke 保持粗细不变。 -->
    <div class="diary-tree-silhouette" aria-hidden="true">
      <svg class="diary-tree-canopy" viewBox="0 0 400 240">
        <g>
          <ellipse cx="200" cy="152" rx="120" ry="74" />
          <ellipse cx="116" cy="112" rx="78" ry="56" />
          <ellipse cx="284" cy="112" rx="82" ry="58" />
          <ellipse cx="200" cy="76" rx="88" ry="54" />
          <ellipse cx="150" cy="44" rx="52" ry="36" />
          <ellipse cx="258" cy="52" rx="48" ry="34" />
        </g>
      </svg>
      <svg class="diary-tree-limbs" viewBox="0 0 400 1000" preserveAspectRatio="none">
        <path class="diary-tree-limb" d="M200 1000 C196 780 204 560 200 340 C198 220 200 120 200 0" />
        <path class="diary-tree-limb" d="M200 640 C150 590 116 540 92 470" />
        <path class="diary-tree-limb" d="M200 500 C250 452 288 404 312 336" />
        <path class="diary-tree-limb" d="M200 830 C158 792 130 752 112 700" />
        <path class="diary-tree-limb" d="M200 330 C246 292 276 250 296 196" />
      </svg>
    </div>

    <!-- 右边的时间表：一条**居中聚焦**的窄带，一格就是一篇日记。
         当前读到的那一篇摆正中间（显示完整日期），上下按固定步长排开，越靠边越淡
         （渐隐交给 CSS 的 mask，不是逐条算透明度）。跨年那一篇标出年份。
         点一条就滚到那一篇。没有 JS（或还没量到）时整条不渲染，
         否则会留下一排飘在空中的日期。 -->
    <div v-if="ticks.length" class="diary-tree-ruler">
      <div class="diary-tree-ruler-track">
        <button
          v-for="tick in ticks"
          :key="tick.index"
          type="button"
          class="diary-tree-tick"
          :class="{ 'is-active': Math.round(activeIndex) === tick.index, 'is-year': tick.yearStart }"
          :style="{ top: `calc(50% + ${((tick.index - activeIndex) * TICK_STEP).toFixed(1)}px)` }"
          :aria-label="`跳到 ${tick.label} 的日记`"
          @click="jumpTo(tick.index)"
        >
          <span class="diary-tree-tick-line" aria-hidden="true"></span>
          <span class="diary-tree-tick-date">{{ tick.label }}</span>
          <span class="diary-tree-tick-year">{{ tick.year }}</span>
        </button>
      </div>
    </div>

    <TransitionGroup name="tree" tag="ol" class="diary-tree-nodes">
      <li
        v-for="node in nodes"
        :key="node.entry.id"
        v-reveal="{ delay: node.delay }"
        class="diary-tree-node"
        :class="[node.side === 'left' ? 'is-left' : 'is-right', { 'is-year': node.yearLabel }]"
      >
        <span class="diary-tree-knot" aria-hidden="true"></span>
        <span class="diary-tree-twig" aria-hidden="true"></span>
        <!-- 枝叶：挂在卡片对面的那半边，浓密程度由这一阵子的写作量决定。
             四片叶子的出现阈值错开（--lush 越大露出的越多），所以稀疏的一段
             只冒出一点、密集的一段才是一整簇。 -->
        <svg
          class="diary-tree-foliage"
          :class="node.side === 'left' ? 'is-right' : 'is-left'"
          viewBox="0 0 130 96"
          :style="{ '--lush': node.lush }"
          aria-hidden="true"
        >
          <path class="diary-tree-leaf-branch" d="M0 88 C28 84 56 68 80 40" />
          <ellipse class="diary-tree-leaf" cx="42" cy="70" rx="18" ry="11" />
          <ellipse class="diary-tree-leaf" cx="70" cy="48" rx="20" ry="12" />
          <ellipse class="diary-tree-leaf" cx="98" cy="26" rx="15" ry="9" />
          <ellipse class="diary-tree-leaf" cx="22" cy="84" rx="13" ry="8" />
        </svg>
        <span v-if="node.yearLabel" class="diary-tree-year">{{ node.yearLabel }}</span>
        <div class="diary-tree-hang">
          <DiaryCard
            :entry="node.entry"
            :show-actions="showActions"
            :show-visibility="showVisibility"
            @open="$emit('open', $event, node.side)"
            @edit="$emit('edit', $event)"
            @toggle-visibility="$emit('toggle-visibility', $event)"
            @export="$emit('export', $event)"
            @remove="$emit('remove', $event)"
          />
        </div>
      </li>
    </TransitionGroup>
  </div>
</template>
