<script setup>
// 文章导入确认弹窗：先把 Word / 文本拆成一篇篇草稿让人核对，确认后才写入数据库。
//
// 拆分规则不在这里，在 services/articleImport.js——那部分是纯函数，能离线对拍。
// 关掉窗口不会丢内容：草稿留在 store 的 importReview 里，重新打开还在。
//
// 类名全部复用日记导入那套（`.import-*`）：两边的核对界面本来就该长一样，
// 复制一份样式只会让以后改一处漏一处。
import { computed, ref } from 'vue'
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useArticlesStore } from '@/stores/articles'

const articles = useArticlesStore()

const total = computed(() => articles.importReview.length)
const publicCount = computed(() => articles.importReview.filter((entry) => entry.visibility === 'PUBLIC').length)
const categoryNames = computed(() => articles.categoryNames)

/**
 * 封面选择：一个隐藏的 file input 服务所有草稿。
 * 每篇一个 input 也行，但那样要管 N 个 ref；这里只记住「这次是给哪一篇选的」。
 */
const coverPicker = ref(null)
const coverTarget = ref(null)

function pickCover(entry) {
  coverTarget.value = entry
  coverPicker.value?.click()
}

function onCoverPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file && coverTarget.value) articles.chooseImportCover(file, coverTarget.value)
  coverTarget.value = null
}
</script>

<template>
  <ModalShell
    close-label="关闭导入确认"
    card-class="import-card"
    kicker="READY TO PUBLISH · 文章导入器"
    :title="`确认导入的 ${total} 篇文章`"
    @close="articles.importDialog = false"
  >
    <div class="import-bulk">
      <div class="import-bulk-copy">
        <strong>统一设置</strong>
        <small>一次把下面 {{ total }} 篇都设成一样，之后再按篇微调。</small>
      </div>
      <div class="import-bulk-actions">
        <button :class="{ active: articles.importVisibility === 'PUBLIC' }" @click="articles.applyImportVisibility('PUBLIC')">◉ 全部公开</button>
        <button :class="{ active: articles.importVisibility === 'PRIVATE' }" @click="articles.applyImportVisibility('PRIVATE')">◌ 全部仅自己</button>
      </div>
    </div>

    <div class="import-bulk import-bulk-fields">
      <label class="import-bulk-field">
        <span>统一分类</span>
        <input
          :value="articles.importCategory"
          list="article-import-categories"
          placeholder="分类名"
          @change="articles.applyImportCategory($event.target.value.trim() || '日常片段')"
        />
      </label>
      <label class="import-bulk-field">
        <span>统一标签（逗号分隔）</span>
        <input
          :value="articles.importTags.join('，')"
          placeholder="日常，随笔"
          @change="articles.applyImportTags($event.target.value.split(/[，,\s]+/).filter(Boolean))"
        />
      </label>
      <datalist id="article-import-categories">
        <option v-for="name in categoryNames" :key="name" :value="name" />
      </datalist>
    </div>

    <p class="import-hint">
      共 {{ total }} 篇，其中 <b>{{ publicCount }}</b> 篇会公开。标题按文档里最浅那一级标题切分，
      正文可在这里直接改；确认后才会保存。
    </p>

    <div class="import-list">
      <article v-for="(entry, index) in articles.importReview" :key="entry.id" class="import-item">
        <div class="import-item-head">
          <span class="import-item-index">{{ index + 1 }}</span>
          <input v-model="entry.title" class="import-item-title" aria-label="文章标题" />
          <button class="import-item-drop" aria-label="移除这一篇" @click="articles.dropImportDraft(entry.id)">×</button>
        </div>
        <div class="import-item-meta">
          <label class="import-item-date">分类<input v-model="entry.category" /></label>
          <button
            class="import-visibility"
            :class="{ 'is-public': entry.visibility === 'PUBLIC' }"
            @click="articles.toggleImportVisibility(entry)"
          >{{ entry.visibility === 'PUBLIC' ? '◉ 公开给访客' : '◌ 仅自己可见' }}</button>
          <small>来自 {{ entry.source }}</small>
        </div>
        <!-- 封面：和「写文章」里那套一样能上传。导入的文章同样需要封面，
             否则列表和阅读页都只有一片空白。每篇单独配。 -->
        <div class="import-item-cover">
          <img v-if="articles.articleImage(entry)" :src="articles.articleImage(entry)" :alt="entry.title" />
          <span v-else class="import-item-cover-empty">无封面</span>
          <button type="button" class="import-item-cover-pick" @click="pickCover(entry)">
            {{ articles.articleImage(entry) ? '换一张' : '选择封面' }}
          </button>
          <button
            v-if="articles.articleImage(entry)"
            type="button"
            class="import-item-cover-clear"
            @click="entry.image = ''"
          >移除</button>
        </div>
        <textarea v-model="entry.content" rows="7" aria-label="文章正文"></textarea>
      </article>
    </div>

    <div class="modal-actions">
      <!-- 一个隐藏的 input 服务所有草稿，避免给每篇都挂一个 ref -->
      <input ref="coverPicker" type="file" accept="image/*" hidden @change="onCoverPicked" />
      <span v-if="articles.importing">正在写入数据库… {{ articles.importSaved }} / {{ total }}</span>
      <span v-else>支持 .docx / .txt / .md · 标题按文档里最浅那一级标题切，目录会自动剔掉；封面可逐篇选</span>
      <!-- 写入期间必须禁用：一次点击会发很多请求，能再点一下就会存进两份一模一样的内容。 -->
      <button class="button-primary" :disabled="!total || articles.importing" @click="articles.confirmImport()">
        {{ articles.importing ? `保存中 ${articles.importSaved} / ${total}` : `确认并保存 ${total} 篇` }} &nbsp;↗
      </button>
    </div>
  </ModalShell>
</template>
