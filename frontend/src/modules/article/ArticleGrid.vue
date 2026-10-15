<script setup>
// 文章卡片网格。`page` 形态在文章列表页用，多一个 .article-grid-page 类（列的密度不同）。
import ArticleCard from './ArticleCard.vue'

defineProps({
  items: { type: Array, default: () => [] },
  page: { type: Boolean, default: false },
  variant: { type: String, default: 'preview' },
})
defineEmits(['open'])
</script>

<template>
  <div class="article-grid" :class="{ 'article-grid-page': page }">
    <ArticleCard
      v-for="(article, index) in items"
      :key="article.id"
      :article="article"
      :index="index"
      :variant="variant"
      @open="$emit('open', $event)"
    />
  </div>
</template>
