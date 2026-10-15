<script setup>
// 顶部栏：面包屑 + 日期 + 主题切换 + 搜索入口 + 头像入口。
import { nextTick } from 'vue'
import { useIsDark } from '@/app/theme'
import { currentPageLabel, go } from '@/app/usePageNav'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

const auth = useAuthStore()
const profile = useProfileStore()
const isDark = useIsDark()

const todayDisplay = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

/**
 * 搜索按钮落在日记页的搜索框上。两个元素分属不同组件（顶栏 / 日记页筛选条），
 * 用一个模块级的 ref 互相引用会平白多一层耦合，这里直接按类名找——它是个唯一的标签。
 */
function focusDiarySearch() {
  go('diary')
  nextTick(() => document.querySelector('.diary-toolbar .search-input')?.focus())
}
</script>

<template>
  <header class="topbar">
    <div class="breadcrumb"><span>我的空间</span><b>/</b><strong>{{ currentPageLabel }}</strong></div>
    <div class="top-actions">
      <span class="today-date">✳ &nbsp;{{ todayDisplay }}</span>
      <button class="icon-button" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" @click="isDark = !isDark">{{ isDark ? '☼' : '☾' }}</button>
      <button class="icon-button search-button" aria-label="搜索日记" @click="focusDiarySearch">⌕</button>
      <button
        class="top-avatar"
        :aria-label="auth.isLoggedIn ? '内容管理' : '登录账号'"
        @click="go(auth.isLoggedIn ? 'admin' : 'account')"
      >
        <img v-if="profile.profileAvatarSrc" :src="profile.profileAvatarSrc" alt="" />
        <span v-else>唯</span>
      </button>
    </div>
  </header>
</template>
