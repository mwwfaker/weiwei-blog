<script setup>
// 导入确认弹窗：先让人核对标题和正文，再写入数据库。
// 关闭窗口不会丢内容——草稿留在 store 的 importReview 里，重新打开还在。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useDiariesStore } from '@/stores/diaries'

const diaries = useDiariesStore()
</script>

<template>
  <ModalShell
    close-label="关闭导入确认"
    card-class="import-card"
    kicker="READY TO KEEP"
    title="确认导入的日记"
    @close="diaries.importDialog = false"
  >
    <p class="import-hint">已读取 {{ diaries.importReview.length }} 篇内容。你可以先检查并修改标题与正文，确认后才会保存。</p>
    <article v-for="entry in diaries.importReview" :key="entry.id" class="import-item">
      <small>来自 {{ entry.source }}</small>
      <input v-model="entry.title" aria-label="日记标题" />
      <textarea v-model="entry.content" rows="5" aria-label="日记内容"></textarea>
    </article>
    <div class="modal-actions">
      <span>支持 .txt 和 .docx · 可一次导入多篇</span>
      <button class="button-primary" @click="diaries.confirmImport()">确认并保存 &nbsp;↗</button>
    </div>
  </ModalShell>
</template>
