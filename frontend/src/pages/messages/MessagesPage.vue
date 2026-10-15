<script setup>
// 留言板。留言目前只存在本机（localStorage），所以提示语写的是「已添加到预览」。
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { useGuestbookStore } from '@/stores/guestbook'

const guestbook = useGuestbookStore()
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="LEAVE A LITTLE NOTE"
      title="留言板"
      mark="✉"
      subtitle="留下一句话，让这个小世界热闹一点。"
    >
      <span class="privacy-pill">{{ guestbook.messages.length }} 条留言</span>
    </InnerPageHeader>

    <form class="guestbook-form" @submit.prevent="guestbook.saveMessage()">
      <input v-model="guestbook.messageDraft.name" maxlength="30" placeholder="你的昵称" />
      <textarea v-model="guestbook.messageDraft.content" maxlength="400" rows="3" placeholder="写下你的留言…"></textarea>
      <button class="button-primary">留下这句话 ↗</button>
    </form>

    <div class="message-list">
      <article v-for="(message, index) in guestbook.messages" :key="message.id" class="message-card">
        <span class="message-avatar">{{ message.name.slice(0, 1) }}</span>
        <div>
          <div class="message-meta"><strong>{{ message.name }}</strong><time>{{ message.date }}</time></div>
          <p>{{ message.content }}</p>
        </div>
        <span class="message-index">{{ String(index + 1).padStart(2, '0') }}</span>
      </article>
    </div>
  </section>
</template>
