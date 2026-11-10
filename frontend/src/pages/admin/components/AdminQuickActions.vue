<script setup>
// 创作管理 · 快捷入口。所有动作都转发给对应的 store，页面本身不写业务。
import { askLogin } from '@/app/useGuard'
import { go } from '@/app/usePageNav'
import { useArticlesStore } from '@/stores/articles'
import { useAuthStore } from '@/stores/auth'
import { useDiariesStore } from '@/stores/diaries'
import { useMusicStore } from '@/stores/music'

const articles = useArticlesStore()
const diaries = useDiariesStore()
const music = useMusicStore()
const auth = useAuthStore()

function writeDiary() {
  go('diary')
  diaries.openNew()
}

/** 绩效计算器要登录（/admin 本身没有路由守卫，所以这里也得挡一次）。 */
function openPerf() {
  if (!auth.isLoggedIn) return askLogin('绩效计算器')
  go('perf')
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
      <button @click="openPerf">绩效计算器 →</button>
    </div>
    <p v-if="music.adminUploadMessage" class="error-message">{{ music.adminUploadMessage }}</p>
  </section>
</template>
