<script setup>
// 时光归档：把文章和日记按「年-月」混在一条时间线上。
//
// 日记的日期是 2026-09-30 形态，文章是 2026.09.18 形态，所以两边各自归一化再合并。
import { computed } from 'vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'

const articles = useArticlesStore()
const diaries = useDiariesStore()

const articleMonth = (item) => item.date?.slice(0, 7)
const diaryMonth = (item) => item.date?.slice(0, 7).replace('-', '.')

const months = computed(() => [...new Set([
  ...articles.articles.map(articleMonth),
  ...diaries.diaries.map(diaryMonth),
])].sort().reverse())

const articlesOf = (month) => articles.articles.filter((item) => articleMonth(item) === month)
const diariesOf = (month) => diaries.diaries.filter((item) => diaryMonth(item) === month)
const total = computed(() => articles.articles.length + diaries.diaries.length)
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="A TIMELINE OF MY DAYS"
      title="时光归档"
      mark="◷"
      subtitle="走过的日子，都在这里留下了印记。"
    >
      <span class="privacy-pill">{{ total }} 件记录</span>
    </InnerPageHeader>

    <div class="archive-timeline">
      <div v-for="month in months" :key="month" class="archive-month">
        <h2>{{ month }}</h2>
        <div
          v-for="article in articlesOf(month)"
          :key="`a-${article.id}`"
          class="archive-event"
          @click="articles.open(article)"
        >
          <span class="archive-type">文章</span>
          <strong>{{ article.title }}</strong>
          <time>{{ article.date.slice(-2) }}</time>
        </div>
        <div
          v-for="entry in diariesOf(month)"
          :key="`d-${entry.id}`"
          class="archive-event"
          @click="diaries.openReader(entry)"
        >
          <span class="archive-type diary-type">日记 · {{ entry.visibility === 'PUBLIC' ? '公开' : '仅自己' }}</span>
          <strong>{{ entry.title }}</strong>
          <time>{{ entry.date.slice(-2) }}</time>
        </div>
      </div>
    </div>
  </section>
</template>
