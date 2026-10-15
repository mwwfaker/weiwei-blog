<script setup>
// 创作管理 · 快捷入口。所有动作都转发给对应的 store，页面本身不写业务。
import { go } from '@/app/usePageNav'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'
import { useMusicStore } from '@/stores/music'

const articles = useArticlesStore()
const diaries = useDiariesStore()
const music = useMusicStore()

function writeDiary() {
  go('diary')
  diaries.openNew()
}
</script>

<template>
  <section class="admin-panel">
    <div class="admin-panel-title">
      <div><small>QUICK CREATE</small><h2>去管理内容</h2></div>
      <span class="admin-spark">✦</span>
    </div>
    <div class="quick-actions">
      <button @click="articles.create()">＋ 写文章</button>
      <button @click="writeDiary">＋ 写日记</button>
      <button @click="go('gallery')">整理相册 →</button>
      <button @click="go('music')">管理音乐 →</button>
      <button @click="go('perf')">绩效计算器 →</button>
    </div>
    <p v-if="music.adminUploadMessage" class="error-message">{{ music.adminUploadMessage }}</p>
  </section>
</template>
