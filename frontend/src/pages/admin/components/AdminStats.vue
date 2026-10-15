<script setup>
// 创作管理的四个数字。数据直接来自各 store，不再在页面里拼一个临时数组。
import { computed } from 'vue'
import { vReveal } from '@/composables/motion'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'
import { useMediaStore } from '@/stores/media'
import { useMusicStore } from '@/stores/music'

const articles = useArticlesStore()
const diaries = useDiariesStore()
const media = useMediaStore()
const music = useMusicStore()

const stats = computed(() => [
  { label: '文章', value: articles.articles.length, note: '文章和分类' },
  { label: '日记', value: diaries.diaries.length, note: '公开与私密分开管理' },
  { label: '相册', value: media.galleryItems.length, note: '图片存储在对象存储' },
  { label: '音乐', value: music.musicItems.length, note: '本地音频或 HTTPS 直链' },
])
</script>

<template>
  <div class="stats-grid">
    <article v-for="(stat, index) in stats" :key="stat.label" v-reveal="{ delay: index * 80 }">
      <small>{{ stat.label }}</small>
      <strong>{{ stat.value }}</strong>
      <span>{{ stat.note }}</span>
    </article>
  </div>
</template>
