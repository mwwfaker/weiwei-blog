<script setup>
// 日记页的筛选条：我的 / 公开两个标签、范围筛选、搜索框、篇数。
//
// 原来「我的日记」和「公开日记」是两个页面（两个路由）。并成一个页面后，
// 切换靠这里的状态，地址栏始终是 #/diary。
import { useAuthStore } from '@/stores/auth'
import { useDiariesStore } from '@/stores/diaries'

const diaries = useDiariesStore()
const auth = useAuthStore()

const scopes = [
  { id: 'ALL', label: '全部日记' },
  { id: 'PRIVATE', label: '仅自己' },
  { id: 'PUBLIC', label: '已公开' },
]
</script>

<template>
  <div class="diary-toolbar">
    <div class="diary-filters">
      <button v-if="auth.isLoggedIn" :class="{ active: diaries.showMyDiary }" @click="diaries.diaryTab = 'mine'">我的日记</button>
      <button v-if="auth.isLoggedIn" :class="{ active: !diaries.showMyDiary }" @click="diaries.diaryTab = 'public'">公开日记</button>
      <template v-if="diaries.showMyDiary">
        <button
          v-for="scope in scopes"
          :key="scope.id"
          :class="{ active: diaries.diaryScope === scope.id }"
          @click="diaries.diaryScope = scope.id"
        >{{ scope.label }}</button>
      </template>
    </div>

    <label v-if="diaries.showMyDiary" class="search-input-wrap">
      <span>⌕</span>
      <input v-model="diaries.search" class="search-input" placeholder="搜索日记标题、内容或标签…" />
    </label>

    <span class="diary-count">{{ diaries.showMyDiary ? diaries.filteredDiaries.length : diaries.publicDiaries.length }} 篇</span>
  </div>
</template>
