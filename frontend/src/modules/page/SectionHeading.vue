<script setup>
// 「最近的故事」这一类带右侧链接的二级标题。
import { vReveal } from '@/composables/motion'

defineProps({
  kicker: { type: String, default: '' },
  title: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
})
defineEmits(['action'])
</script>

<template>
  <div class="section-heading" v-reveal>
    <div>
      <div class="section-kicker">{{ kicker }} <span></span></div>
      <h2>{{ title }}</h2>
    </div>
    <button v-if="actionLabel" class="view-all" @click="$emit('action')">{{ actionLabel }} <span>↗</span></button>
  </div>
</template>
