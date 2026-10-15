<script setup>
// 导入确认弹窗：先把文件拆成一篇篇草稿让人核对，确认后才写入数据库。
//
// 一个「整合日记」txt 里往往装着几十篇（按日期头隔开），所以这里有两层可见范围控制：
//   顶层「统一发布权限」一次写进所有草稿（几十篇逐篇点太累）；
//   每篇自己的按钮再单独改，用来处理「其中某一篇不想公开」。
// 拆分规则不在这里，在 services/diaryImport.js——那部分是纯函数，能离线对拍。
//
// 关闭窗口不会丢内容：草稿留在 store 的 importReview 里，重新打开还在。
import { computed } from 'vue'
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useDiariesStore } from '@/stores/diaries'

const diaries = useDiariesStore()

const total = computed(() => diaries.importReview.length)
const publicCount = computed(() => diaries.importReview.filter((entry) => entry.visibility === 'PUBLIC').length)
</script>

<template>
  <ModalShell
    close-label="关闭导入确认"
    card-class="import-card"
    kicker="READY TO KEEP"
    :title="`确认导入的 ${total} 篇日记`"
    @close="diaries.importDialog = false"
  >
    <div class="import-bulk">
      <div class="import-bulk-copy">
        <strong>统一发布权限</strong>
        <small>一次把下面 {{ total }} 篇都设成同一个可见范围，之后再按篇微调。</small>
      </div>
      <div class="import-bulk-actions">
        <button :class="{ active: diaries.importVisibility === 'PUBLIC' }" @click="diaries.applyImportVisibility('PUBLIC')">◉ 全部公开</button>
        <button :class="{ active: diaries.importVisibility === 'PRIVATE' }" @click="diaries.applyImportVisibility('PRIVATE')">◌ 全部仅自己</button>
      </div>
    </div>

    <p class="import-hint">
      共 {{ total }} 篇，其中 <b>{{ publicCount }}</b> 篇会公开。可以先逐篇检查、修改标题与正文，确认后才会保存。
    </p>

    <div class="import-list">
      <article v-for="(entry, index) in diaries.importReview" :key="entry.id" class="import-item">
        <div class="import-item-head">
          <span class="import-item-index">{{ index + 1 }}</span>
          <input v-model="entry.title" class="import-item-title" aria-label="日记标题" />
          <button class="import-item-drop" aria-label="移除这一篇" @click="diaries.dropImportDraft(entry.id)">×</button>
        </div>
        <div class="import-item-meta">
          <label class="import-item-date">日期<input v-model="entry.date" type="date" /></label>
          <button
            class="import-visibility"
            :class="{ 'is-public': entry.visibility === 'PUBLIC' }"
            @click="diaries.toggleImportVisibility(entry)"
          >{{ entry.visibility === 'PUBLIC' ? '◉ 公开给访客' : '◌ 仅自己可见' }}</button>
          <small>来自 {{ entry.source }}</small>
        </div>
        <textarea v-model="entry.content" rows="6" aria-label="日记内容"></textarea>
      </article>
    </div>

    <div class="modal-actions">
      <span>支持 .txt 和 .docx · 一个文件里装多篇会按日期自动拆开</span>
      <button class="button-primary" :disabled="!total" @click="diaries.confirmImport()">确认并保存 {{ total }} 篇 &nbsp;↗</button>
    </div>
  </ModalShell>
</template>
