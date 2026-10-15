<script setup>
// 文章阅读弹窗。版面走 ReadingSheet：页眉（分类·日期 + 关闭）固定，正文独立滚动；
// 正文里是「封面图 → 标题 → 摘要 → 标签 → 正文」这条流，跟着滚动走。
//
// 字号与行距在 styles/polish-and-light-theme.css 的「阅读」一节里统一调——
// 和日记阅读共用同一套阅读体验，改一处两边都变。
import ReadingSheet from '@/modules/modal/ReadingSheet.vue'
import { useArticlesStore } from '@/stores/articles'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ article: { type: Object, required: true } })
defineEmits(['close', 'edit', 'remove'])

const articles = useArticlesStore()
const auth = useAuthStore()
</script>

<template>
  <ReadingSheet
    card-class="article-reading"
    backdrop-class="article-reader-backdrop"
    close-label="关闭阅读"
    :count-text="props.article.content || props.article.excerpt"
    @close="$emit('close')"
  >
    <template #head>
      <div class="reading-toolbar">
        <span>{{ props.article.category }} <i>·</i> {{ props.article.date }}</span>
      </div>
    </template>

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

    <template v-if="auth.isLoggedIn && props.article.mine" #actions>
      <div class="reading-actions">
        <button class="button-secondary danger-text" @click="$emit('remove', props.article.id)">删除</button>
        <button class="button-primary" @click="$emit('edit', props.article)">编辑文章</button>
      </div>
    </template>
  </ReadingSheet>
</template>
