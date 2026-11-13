<script setup>
// 留言板。
//
// 留言存在数据库里（`guestbook_messages`）：**谁都能读，也不用登录就能写**。
// 页面只负责「加载 → 展示 / 空状态 / 失败提示」和一行表单。
import { onMounted } from 'vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { useGuestbookStore } from '@/stores/guestbook'

const guestbook = useGuestbookStore()

onMounted(() => {
  if (!guestbook.loaded) guestbook.load()
})
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
      <textarea v-model="guestbook.messageDraft.content" maxlength="500" rows="3" placeholder="写下你的留言…"></textarea>
      <button class="button-primary" :disabled="guestbook.loading">留下这句话 ↗</button>
    </form>

    <div v-if="guestbook.loading && !guestbook.loaded" class="message-empty">
      <span aria-hidden="true">···</span>
      <p>正在取留言…</p>
    </div>

    <div v-else-if="guestbook.error && !guestbook.messages.length" class="message-empty">
      <span aria-hidden="true">⚠</span>
      <p>留言没能取到：{{ guestbook.error }}</p>
      <button class="button-secondary" @click="guestbook.load()">再试一次</button>
    </div>

    <div v-else-if="guestbook.messages.length" class="message-list">
      <article v-for="(message, index) in guestbook.messages" :key="message.id" class="message-card">
        <span class="message-avatar">{{ (message.name || '?').slice(0, 1) }}</span>
        <div>
          <div class="message-meta"><strong>{{ message.name }}</strong><time>{{ message.date }}</time></div>
          <p>{{ message.content }}</p>
        </div>
        <span class="message-index">{{ String(index + 1).padStart(2, '0') }}</span>
      </article>
    </div>

    <div v-else class="message-empty">
      <span aria-hidden="true">✉</span>
      <p>还没有人留言。你是第一个。</p>
    </div>
  </section>
</template>
