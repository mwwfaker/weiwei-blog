<script setup>
// 标签星图。字体大小按标签在列表里的序号循环取档（12 / 15 / 18 / 21px），
// 不去统计真实词频——那样同一批标签每次改动都会整块重排，反而不好读。
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { go } from '@/app/usePageNav'
import { useArticlesStore } from '@/stores/articles'

const articles = useArticlesStore()

function openTag(tag) {
  articles.tagFilter = tag
  go('articles')
}
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="WORDS THAT FIND THEIR WAY"
      title="标签星图"
      mark="＃"
      subtitle="一点一点，把相关的灵感串起来。"
    />

    <div class="tag-cloud">
      <button
        v-for="(tag, index) in articles.tagNames"
        :key="tag"
        :style="{ '--tag-size': `${12 + (index % 4) * 3}px` }"
        @click="openTag(tag)"
      ># {{ tag }} <small>{{ articles.articles.filter((item) => item.tags?.includes(tag)).length }}</small></button>
    </div>
  </section>
</template>
