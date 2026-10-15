<script setup>
// 文章分类页。点一张卡片 = 设好分类筛选并跳到文章列表页。
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { go } from '@/app/usePageNav'
import { useArticlesStore } from '@/stores/articles'

const articles = useArticlesStore()
const SYMBOLS = ['✳', '✧', '◈', '⌁']

function openCategory(category) {
  articles.categoryFilter = category
  go('articles')
}
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="A LIBRARY OF IDEAS"
      title="文章分类"
      mark="◈"
      subtitle="给灵感安一个小小的家。"
    >
      <button class="button-primary" @click="articles.create()">＋ &nbsp;写文章</button>
    </InnerPageHeader>

    <div class="taxonomy-grid">
      <button
        v-for="(category, index) in articles.categoryNames"
        :key="category"
        class="taxonomy-card"
        @click="openCategory(category)"
      >
        <span class="taxonomy-number">0{{ index + 1 }}</span>
        <span class="taxonomy-symbol">{{ SYMBOLS[index % SYMBOLS.length] }}</span>
        <strong>{{ category }}</strong>
        <small>{{ articles.articles.filter((item) => item.category === category).length }} 篇故事</small>
        <i>↗</i>
      </button>
    </div>
  </section>
</template>
