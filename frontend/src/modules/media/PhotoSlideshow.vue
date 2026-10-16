<script setup>
// 电影感播放：把这一批照片一张张**慢慢推近、淡入淡出**地放过一遍。
//
// 为什么不是简单的轮播：照片在暗底上缓慢推近（Ken Burns）+ 长淡入，观感才像"放映"
// 而不是"翻页"。每张停留 5 秒，淡入 1.4 秒 —— 推近的动画时长（6s）要略长于停留时间，
// 这样切换时它还在走，不会有"停下来再切"的顿感。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  photos: { type: Array, required: true },
  /** 从哪一张开始播。 */
  start: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const HOLD_MS = 5000

const index = ref(Math.min(Math.max(props.start, 0), Math.max(props.photos.length - 1, 0)))
const playing = ref(true)
let timer = null

const current = computed(() => props.photos[index.value] || null)
const total = computed(() => props.photos.length)

function next(step = 1) {
  if (!total.value) return
  index.value = (index.value + step + total.value) % total.value
}

function schedule() {
  clearInterval(timer)
  if (!playing.value) return
  timer = setInterval(() => next(1), HOLD_MS)
}

function togglePlay() {
  playing.value = !playing.value
  schedule()
}

function onKey(event) {
  if (event.key === 'Escape') emit('close')
  else if (event.key === 'ArrowRight') { next(1); schedule() }
  else if (event.key === 'ArrowLeft') { next(-1); schedule() }
  else if (event.key === ' ') { event.preventDefault(); togglePlay() }
}

onMounted(() => {
  schedule()
  globalThis.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  globalThis.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="slideshow" @click.self="emit('close')">
    <Transition name="cine" mode="out-in">
      <img v-if="current" :key="current.id" class="slideshow-image" :src="current.image" :alt="current.caption" />
    </Transition>

    <div class="slideshow-caption">
      <strong>{{ current?.caption }}</strong>
      <p v-if="current?.description">{{ current.description }}</p>
      <span>{{ index + 1 }} / {{ total }}</span>
    </div>

    <div class="slideshow-bar">
      <button class="slideshow-button" aria-label="上一张" @click="next(-1); schedule()">‹</button>
      <button class="slideshow-button" @click="togglePlay">{{ playing ? '暂停' : '继续' }}</button>
      <button class="slideshow-button" aria-label="下一张" @click="next(1); schedule()">›</button>
      <button class="slideshow-button" @click="emit('close')">退出</button>
    </div>

    <p class="slideshow-hint">空格 暂停 / 继续 · ← → 翻页 · Esc 退出</p>
  </div>
</template>
