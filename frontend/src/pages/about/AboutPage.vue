<script setup>
// 关于我。这是路由表里没有匹配时也会落到的页面（见 app/pageRegistry.js），
// 所以它不能依赖任何「必须先访问过某个页面」的状态。
//
// 版面：左边一张图（带一句印章式小话），右边是自我介绍 + 三条数据 + 最近在写的东西。
// 数据都来自已有 store，不新增接口：文章数、日记数、照片数、歌数，以及最近三篇。
import { computed } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'
import { useMediaStore } from '@/stores/media'
import { useMusicStore } from '@/stores/music'

const profile = useProfileStore()
const articles = useArticlesStore()
const diaries = useDiariesStore()
const media = useMediaStore()
const music = useMusicStore()

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1100&q=85'

/** 四个数字都取「访客看得见的那一份」，和首页的计数口径一致。 */
const stats = computed(() => [
  { label: '篇文章', value: articles.articles.length, to: 'articles' },
  { label: '篇日记', value: diaries.homeShowsOwnDiaries ? diaries.diaries.length : diaries.publicDiaries.length, to: 'diary' },
  { label: '张照片', value: media.allPhotoCount, to: 'gallery' },
  { label: '首歌', value: music.playableTracks.length, to: 'music' },
])

const latest = computed(() => articles.articles.slice(0, 3))
</script>

<template>
  <section class="page-content inner-page about-page">
    <div class="about-card">
      <div class="about-image">
        <img :src="profile.profileAvatarSrc || FALLBACK_IMAGE" alt="清晨的光" />
        <span>你好，欢迎来我的小世界。</span>
      </div>

      <div class="about-copy">
        <div class="section-kicker">A NOTE ABOUT ME <span></span></div>
        <h1>你好，我是{{ profile.profileName }}<em>。</em></h1>
        <p class="about-lead">{{ profile.profileBio }}</p>
        <p class="about-body">
          我相信，每一个认真度过的日子，都值得被好好记下。于是有了这个小小的角落，
          放文章、照片、日记，还有那些不一定重要却舍不得忘记的事。
        </p>

        <div class="about-tags"><span>☕ 慢生活</span><span>✈ 在路上</span><span>✿ 爱记录</span></div>

        <div class="about-stats">
          <button v-for="item in stats" :key="item.label" class="about-stat" @click="$router.push({ name: item.to })">
            <strong>{{ item.value }}</strong>
            <small>{{ item.label }}</small>
          </button>
        </div>

        <button class="button-primary" @click="profile.openEditor()">编辑个人资料 <span>↗</span></button>
      </div>
    </div>

    <!-- 最近在写：把「我写什么」直接摊在关于页上，比再写一段自我介绍更有用 -->
    <section v-if="latest.length" class="about-recent">
      <div class="about-recent-head">
        <div class="section-kicker">RECENTLY WRITTEN <span></span></div>
        <h2>最近在写</h2>
        <button class="about-recent-more" @click="$router.push({ name: 'articles' })">全部文章 ↗</button>
      </div>
      <ul>
        <li v-for="article in latest" :key="article.id">
          <button @click="articles.selectedArticle = article">
            <time>{{ (article.articleDate || '').slice(0, 10) }}</time>
            <strong>{{ article.title }}</strong>
            <small>{{ (article.excerpt || '').slice(0, 52) }}{{ (article.excerpt || '').length > 52 ? '…' : '' }}</small>
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>
