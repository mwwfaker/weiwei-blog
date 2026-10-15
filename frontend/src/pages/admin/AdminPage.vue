<script setup>
// 创作管理页：内容概览 + 可见范围设置 + 快捷入口。
//
// 未登录时这一页只是「看看有什么」，唯一的按钮是去登录。
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { go } from '@/app/usePageNav'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import AdminQuickActions from './components/AdminQuickActions.vue'
import AdminSettingsPanel from './components/AdminSettingsPanel.vue'
import AdminStats from './components/AdminStats.vue'

const auth = useAuthStore()
const library = useLibraryStore()

const subtitle = () => (auth.isLoggedIn
  ? `账号：${auth.user.displayName} · 内容保存在云端账号里（Supabase）。看到的公开内容所有人都能看，只有你自己账号里的内容能改。`
  : '未登录时全站只能查看；公开内容对所有人可见，登录后才能新增和修改自己账号里的内容。')

async function signOut() {
  await library.logout()
  go('account')
}
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="YOUR CONTENT LIBRARY"
      title="创作管理"
      :subtitle="subtitle()"
      :rule="false"
    >
      <button v-if="!auth.isLoggedIn" class="button-primary" @click="go('account')">登录后开始记录 ↗</button>
      <button v-else class="button-secondary" @click="signOut">退出账号</button>
    </InnerPageHeader>

    <AdminStats />

    <div class="admin-panels">
      <AdminSettingsPanel />
      <AdminQuickActions />
    </div>
  </section>
</template>
