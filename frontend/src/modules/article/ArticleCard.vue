<script setup>
// 文章卡片。首页用 preview 形态（序号 01/02/03 + 阅读时长），文章列表页用 full 形态
// （两位序号 + 「阅读 ↗」提示 + 标签）。两者只差三处文案，共用一套结构与样式类。
import { useArticlesStore } from '@/stores/articles'
import { vReveal } from '@/composables/motion'

const props = defineProps({
  article: { type: Object, required: true },
  index: { type: Number, default: 0 },
  variant: { type: String, default: 'preview' },
})
defineEmits(['open'])

const articles = useArticlesStore()
</script>

<template>
  <article class="article-card" v-reveal="{ delay: props.index * 90 }" @click="$emit('open', article)">
    <div class="article-image-wrap">
      <img v-if="articles.articleImage(article)" :src="articles.articleImage(article)" :alt="article.title" />
      <span v-else class="cover-placeholder">唯唯园</span>
      <span class="image-index">{{ variant === 'full' ? String(index + 1).padStart(2, '0') : `0${index + 1}` }}</span>
      <span class="image-open">{{ variant === 'full' ? '阅读 ↗' : '↗' }}</span>
    </div>
    <div class="article-info">
      <div class="article-meta"><span>{{ article.category }}</span><i>·</i><time>{{ article.date }}</time></div>
      <h3>{{ article.title }}</h3>
      <p>{{ article.excerpt }}</p>
      <div class="article-footer">
        <span v-if="variant === 'full'">{{ (article.tags || []).slice(0, 2).map((tag) => `#${tag}`).join('  ') || '文章' }}</span>
        <span v-else>{{ article.read }}</span>
        <span class="read-arrow">→</span>
      </div>
    </div>
  </article>
</template>
