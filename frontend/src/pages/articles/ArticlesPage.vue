<script setup>
// 文章列表页：分类筛选 + 搜索 + 网格。
//
// 分类胶囊上的数字来自真实的文章列表，不是写死的。
import { computed, ref } from 'vue'
import ArticleGrid from '@/modules/article/ArticleGrid.vue'
import EmptyState from '@/modules/page/EmptyState.vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { useArticlesStore } from '@/stores/articles'

const articles = useArticlesStore()

const importPicker = ref(null)

const list = computed(() => articles.visibleArticles.filter((entry) => `${entry.title} ${entry.content || ''}`.toLowerCase().includes(articles.search.toLowerCase())))
const countOf = (category) => articles.articles.filter((item) => item.category === category).length

/** Word / 文本导入：解析出来的草稿交给 store，核对弹窗由应用外壳挂载。 */
async function onImportPicked(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (files.length) await articles.parseImportFiles(files)
}
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="STORIES & THOUGHTS"
      title="文章宇宙"
      mark="✧"
      subtitle="从灵感草稿到正式发布，慢慢构建你的内容世界。"
    >
      <div class="article-actions">
        <button class="button-secondary" @click="importPicker?.click()">⇧ &nbsp;导入 Word</button>
        <input
          ref="importPicker"
          type="file"
          accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          multiple
          hidden
          @change="onImportPicked"
        />
        <button class="button-primary" @click="articles.create()">＋ &nbsp;写文章</button>
      </div>
    </InnerPageHeader>

    <div class="article-toolbar">
      <span>文章分类</span>
      <div class="category-pills">
        <button :class="{ active: !articles.categoryFilter }" @click="articles.categoryFilter = ''">全部 <small>{{ articles.articles.length }}</small></button>
        <button
          v-for="category in articles.categoryNames"
          :key="category"
          :class="{ active: articles.categoryFilter === category }"
          @click="articles.categoryFilter = category"
        >{{ category }} <small>{{ countOf(category) }}</small></button>
      </div>
      <input v-model="articles.search" placeholder="搜索文章标题或正文…" aria-label="搜索文章" />
    </div>

    <ArticleGrid :items="list" page variant="full" @open="articles.open" />

    <EmptyState
      v-if="!articles.visibleArticles.length"
      icon="✧"
      title="还没有内容"
      text="创建一篇文章，开启你的创作。"
      action-label="写文章"
      @action="articles.create()"
    />
  </section>
</template>
