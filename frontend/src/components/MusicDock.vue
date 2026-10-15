<script setup>
// 右下角的音乐盒，两种形态：
//   · 收起（默认）—— 一颗会转的小唱片，缩在最右边，不挡视线；播放时唱片一圈圈转、
//     并且轻微呼吸放大，暂停就停住。
//   · 展开 —— 鼠标滑上去（或键盘聚焦进来）向左展开成完整卡片：曲名、进度、上一首/下一首、音量入口。
//
// 为什么不用「一直是大卡片」或「点了才开」：收起态必须一眼能看出在不在播放，而完整控件只在
// 鼠标真的过来时才占地方。
//
// 性能上刻意避开了上一版的坑：那块旧卡片在过渡的同一个元素上带着 backdrop-filter，
// 每帧都要重新模糊一遍背景，尺寸一变就掉帧。这里过渡的只有宽高、圆角和两层内容的透明度，
// 背景是实色；两层各自是固定尺寸，展开过程中卡片里的文字不会跟着宽度反复回流。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatClock } from '../services/lyrics'

const props = defineProps({
  playing: { type: Boolean, default: false },
  title: { type: String, default: '' },
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  hasTrack: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle', 'prev', 'next', 'seek', 'open'])

const hovered = ref(false)
// 触屏没有「悬停」这回事，点一下就把卡片钉住，再点一下的收起按钮才收回去。
const pinned = ref(false)
const hoverCapable = ref(true)
let hoverQuery
let hoverQueryHandler

const expanded = computed(() => hovered.value || pinned.value)
const progress = computed(() => (props.duration > 0 ? Math.min(100, (props.currentTime / props.duration) * 100) : 0))

function onEnter() { hovered.value = true }
function onLeave() {
  hovered.value = false
  if (hoverCapable.value) pinned.value = false
}
// 焦点在卡片内部移动时不该收起，只有焦点真的离开整块才收。
function onFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) onLeave()
}
function onMiniActivate() {
  // 桌面端悬停本身就会展开，圆盘上这一下留给最常用的「播放 / 暂停」。
  if (hoverCapable.value) emit('toggle')
  else pinned.value = !pinned.value
}

function seekAt(event) {
  if (!props.duration) return
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  emit('seek', ratio * props.duration)
}

onMounted(() => {
  hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
  hoverCapable.value = hoverQuery.matches
  hoverQueryHandler = (event) => {
    hoverCapable.value = event.matches
    if (!event.matches) hovered.value = false
  }
  hoverQuery.addEventListener('change', hoverQueryHandler)
})
// 生命周期钩子只在 setup 的同步阶段登记。写在 onMounted 里面是「注册时实例刚好还在」的
// 偶然行为，换个时机就会变成「no active component instance」警告。
onUnmounted(() => {
  if (hoverQuery && hoverQueryHandler) hoverQuery.removeEventListener('change', hoverQueryHandler)
})
</script>

<template>
  <section
    class="music-dock"
    :class="expanded ? 'is-expanded' : 'is-collapsed'"
    aria-label="音乐播放器"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onEnter"
    @focusout="onFocusOut"
  >
    <!-- 收起态：会转的唱片 + 播放时跳动的电平柱。点一下播放 / 暂停（触屏则展开）。 -->
    <button
      class="music-dock-mini"
      :aria-label="playing ? '暂停音乐' : '播放音乐'"
      :title="playing ? '暂停' : '播放'"
      @click="onMiniActivate"
    >
      <span class="music-dock-mini-disc" :class="{ 'is-playing': playing }">
        <span class="music-dock-vinyl" :class="{ spinning: playing }" aria-hidden="true">♫</span>
      </span>
      <span class="music-dock-eq" :class="{ active: playing }" aria-hidden="true">
        <i v-for="n in 4" :key="n" :style="{ '--n': n }"></i>
      </span>
    </button>

    <!-- 展开态：完整的小卡片，从右边向左露出来。 -->
    <div class="music-dock-full" :aria-hidden="!expanded">
      <div class="music-dock-top">
        <span class="music-dock-art" aria-hidden="true">
          <span class="music-dock-vinyl" :class="{ spinning: playing }">♫</span>
        </span>
        <span class="music-dock-copy">
          <strong :title="title">{{ title || '还没有选择曲目' }}</strong>
          <small>
            <template v-if="!hasTrack">去音乐页选一首</template>
            <template v-else>{{ playing ? '正在播放' : '已暂停' }} · {{ formatClock(currentTime) }} / {{ formatClock(duration) }}</template>
          </small>
        </span>
        <button v-if="!hoverCapable" class="music-dock-collapse" aria-label="收起播放器" @click="pinned = false">⌄</button>
        <button class="music-dock-open" aria-label="打开音乐收藏" title="打开音乐收藏" @click="emit('open')">↗</button>
      </div>

      <div
        class="music-dock-bar"
        :class="{ 'is-disabled': !hasTrack }"
        role="slider"
        :aria-valuenow="Math.round(progress)"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="播放进度"
        @click="seekAt"
      >
        <div :style="{ width: `${progress}%` }"></div>
      </div>

      <div class="music-dock-controls">
        <button class="music-dock-skip" aria-label="上一首" :disabled="!hasTrack" @click="emit('prev')">⏮</button>
        <button class="music-dock-toggle" :class="{ isPlaying: playing }" :aria-label="playing ? '暂停' : '播放'" @click="emit('toggle')">
          <span v-if="playing">Ⅱ</span><span v-else>▶</span>
        </button>
        <button class="music-dock-skip" aria-label="下一首" :disabled="!hasTrack" @click="emit('next')">⏭</button>
        <span class="music-dock-hint">{{ hasTrack ? (playing ? '正在播放' : '已暂停') : '未选择曲目' }}</span>
      </div>
    </div>
  </section>
</template>
