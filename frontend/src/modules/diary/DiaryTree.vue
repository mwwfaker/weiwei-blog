<script setup>
// 日记的「时间树」：一条**从下往上**的时间轴，日记像挂件一样挂在轴上。
//
// 为什么是树而不是列表：日记天然属于时间。列表把时间压成一列日期文字，
// 树把时间变成一条能看见的轴——越往上越新，越往下越早，一眼看得到自己写了多久。
//
// 几个刻意的决定：
//   · **左右不是每帧随机的**。真用 Math.random() 的话，任何一次重渲染（搜索、切标签、
//     可见范围一变）所有挂件都会左右横跳。所以按 id 做哈希 → 同一个 id 永远同一侧，
//     看起来乱、但稳定。哈希还会**避免连续三篇同侧**，否则一边堆成一坨、另一边空着。
//   · **入场方向由所在侧决定**：左边的日记从右往左滑入、右边的从左往右滑入，
//     也就是「从树干上展开到自己的位置」。手机上是单侧布局（树干靠左），
//     所以那一边统一从树干往右展开。
//   · 逐条入场交给 `v-reveal`（IntersectionObserver）：滚到哪条哪条才动，
//     51 篇一起播会像整页抖一下；它同时负责 `prefers-reduced-motion` 与
//     「没有 IntersectionObserver 就直接显示」的兜底。
//   · **增删日记时让树真的长高 / 变矮**：用 TransitionGroup 折叠节点自身的高度
//     （max-height → 0），而不是靠 FLIP 位移补间。原因是删除时 Vue 会先把要走的
//     那个节点留在 DOM 里播 leave，等它播完才移除——那时其余节点的位置才变，
//     而那一刻已经没有新的更新了，FLIP 补不上，树干会在移除瞬间「啪」地缩一截。
//     高度折叠是连续的，后面的挂件一路滑上来，树干（bottom:0）跟着连续变短。
//
// 卡片本身复用 DiaryCard：操作行、可见范围标记、点击阅读的行为与列表页完全一致，
// 树只是换了一种摆放方式。
import { computed } from 'vue'
import DiaryCard from './DiaryCard.vue'
import { vReveal } from '@/composables/motion'

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

    out.push({ entry, side, yearLabel, delay: (index % 5) * 70 })
  })
  return out
})
</script>

<template>
  <div class="diary-tree">
    <div class="diary-tree-axis" aria-hidden="true"></div>
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
        <span v-if="node.yearLabel" class="diary-tree-year">{{ node.yearLabel }}</span>
        <div class="diary-tree-hang">
          <DiaryCard
            :entry="node.entry"
            :show-actions="showActions"
            :show-visibility="showVisibility"
            @open="$emit('open', $event)"
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
