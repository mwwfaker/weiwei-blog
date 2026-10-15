<script setup>
// 文章阅读弹窗。页眉是「分类 · 日期 + 关闭」，和日记阅读弹窗不同，所以走 ModalShell 的 bare 模式。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useArticlesStore } from '@/stores/articles'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ article: { type: Object, required: true } })
defineEmits(['close', 'edit', 'remove'])

const articles = useArticlesStore()
const auth = useAuthStore()
</script>

<template>
  <ModalShell
    bare
    as="article"
    card-class="diary-reading article-reading"
    backdrop-class="article-reader-backdrop"
    close-label="关闭阅读"
    @close="$emit('close')"
  >
    <div class="reading-toolbar">
      <span>{{ props.article.category }} <i>·</i> {{ props.article.date }}</span>
      <button class="modal-close" aria-label="关闭阅读" @click="$emit('close')">×</button>
    </div>
    <img
      v-if="articles.articleImage(props.article)"
      class="reading-image"
      :src="articles.articleImage(props.article)"
      :alt="props.article.title"
    />
    <h1>{{ props.article.title }}</h1>
    <p class="reader-excerpt">{{ props.article.excerpt }}</p>
    <div class="reading-tags"><span v-for="tag in props.article.tags" :key="tag"># {{ tag }}</span></div>
    <p class="article-body">{{ props.article.content || props.article.excerpt }}</p>
    <div v-if="auth.isLoggedIn && props.article.mine" class="reading-actions">
      <button class="button-secondary danger-text" @click="$emit('remove', props.article.id)">删除</button>
      <button class="button-primary" @click="$emit('edit', props.article)">编辑文章</button>
    </div>
  </ModalShell>
</template>
