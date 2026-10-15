<script setup>
// 首页：主视觉 + 最近三篇文章 + 日记碎片与引言。
//
// 只做编排，不持有任何状态——文章、日记、资料各自去自己的 store 取。
import ArticleGrid from '@/modules/article/ArticleGrid.vue'
import PageFooter from '@/modules/page/PageFooter.vue'
import SectionHeading from '@/modules/page/SectionHeading.vue'
import { go } from '@/app/usePageNav'
import { vReveal } from '@/composables/motion'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'
import { useProfileStore } from '@/stores/profile'
import DiaryPreview from './components/DiaryPreview.vue'
import HeroCard from './components/HeroCard.vue'
import QuoteCard from './components/QuoteCard.vue'

const articles = useArticlesStore()
const diaries = useDiariesStore()
const profile = useProfileStore()
</script>

<template>
  <section class="page-content home-page">
    <HeroCard />

    <SectionHeading
      kicker="FRESHLY WRITTEN"
      title="最近的故事"
      action-label="看看所有文章"
      @action="go('articles')"
    />
    <ArticleGrid :items="articles.articles.slice(0, 3)" @open="articles.open" />

    <div class="lower-grid" v-reveal>
      <DiaryPreview />
      <QuoteCard />
    </div>

    <PageFooter :name="profile.profileName" note="把平凡的日子，慢慢过成喜欢的样子。" />
  </section>
</template>
