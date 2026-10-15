<script setup>
// 朋友们：友链卡片 + 添加表单。和留言板一样，目前只存在本机。
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { useGuestbookStore } from '@/stores/guestbook'

const guestbook = useGuestbookStore()
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="GOOD PEOPLE, GOOD PLACES"
      title="朋友们"
      mark="↔"
      subtitle="一些值得拜访的地方，也欢迎交换友链。"
    />

    <div class="friends-grid">
      <a
        v-for="friend in guestbook.friendLinks"
        :key="friend.name"
        :href="friend.url"
        target="_blank"
        rel="noopener noreferrer"
        class="friend-card"
      >
        <span class="friend-mark">{{ friend.name.slice(0, 1) }}</span>
        <span><strong>{{ friend.name }}</strong><small>{{ friend.note }}</small></span>
        <i>↗</i>
      </a>

      <form class="friend-request" @submit.prevent="guestbook.addFriend()">
        <strong>添加一个新朋友</strong>
        <input v-model="guestbook.friendDraft.name" placeholder="博客名称" required />
        <input v-model="guestbook.friendDraft.url" placeholder="网站地址 https://…" type="url" required />
        <input v-model="guestbook.friendDraft.note" placeholder="一句介绍" />
        <button class="button-secondary">添加友链 ↗</button>
      </form>
    </div>
  </section>
</template>
