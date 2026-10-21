<script setup>
// 首页：**整个世界**，不是「页面里放一块卡片」。
//
// 结构只有三层：
//   1. 一层固定在视口上的 3D 夜空（HeroScene），整页都在它里面滚动；
//   2. 一层压暗用的渐变，保证下面几段文字在任何一帧上都读得清；
//   3. 直接排在世界里的内容：开场 → 01 最近的故事 → 02 去别处 → 03 日子。
//
// 没有卡片、没有面板、没有玻璃 dock。导航是一行字，内容就是排版。
// 页面本身仍然只做编排：数据从 store 取，动作调 store 的方法。
import { computed, ref } from 'vue'
import PageFooter from '@/modules/page/PageFooter.vue'
import { go } from '@/app/usePageNav'
import { useIsDark } from '@/app/theme'
import { vReveal } from '@/composables/motion'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'
import { useMediaStore } from '@/stores/media'
import { useMusicStore } from '@/stores/music'
import { useProfileStore } from '@/stores/profile'
import HeroScene from './components/HeroScene.vue'
import DayGlass from './components/DayGlass.vue'

const articles = useArticlesStore()
const diaries = useDiariesStore()
const media = useMediaStore()
const music = useMusicStore()
const profile = useProfileStore()
/** 白天主题不是把夜空提亮：它换的是一整套「光」的配色（纸、雾、紫），见 home-stage.css。 */
const isDark = useIsDark()

/** 首屏星体用哪批日记：和「日记碎片」同一条规则，访客不该看到一片空星空。 */
const heroEntries = computed(() => (
  diaries.homeShowsOwnDiaries ? diaries.diaries : diaries.publicDiaries
).slice(0, 12))

const latest = computed(() => articles.articles.slice(0, 3))
const recentDiaries = computed(() => diaries.homeDiaries)
const dayCount = computed(() => 128 + diaries.diaries.length)
/** 省电模式不下载 three，只留 CSS 的天空。 */
const useScene = computed(() => !music.lowPower)

const tip = ref(null)

function startDiary() {
  go('diary')
  diaries.openNew()
}
</script>

<template>
  <DayGlass v-if="!isDark" />
  <section v-else class="world">
    <HeroScene
      v-if="useScene"
      :key="isDark ? 'night' : 'day'"
      class="world-scene"
      :entries="heroEntries"
      @hover="tip = $event"
      @open="diaries.openReader"
    />
    <div class="world-sky" aria-hidden="true"></div>

    <div class="world-content">
      <section class="world-intro">
        <div class="world-eyebrow">A LITTLE SPACE FOR MYSELF</div>
        <h1>把日子写成<br /><em>喜欢的样子。</em></h1>
        <p class="world-lead">你好，我是{{ profile.profileName }}。这里收集生活里的小小闪光，<br class="desktop-only" />也收藏那些不想忘记的瞬间。</p>
        <div class="world-actions">
          <button class="world-cta" @click="startDiary">写下一篇日记 <span>↗</span></button>
          <button class="world-link" @click="go('about')">关于我 →</button>
        </div>
        <div class="world-hint"><span class="world-hint-dot"></span>拖动旋转 · 点亮一颗星</div>
      </section>

      <section class="world-chapter" v-reveal>
        <header class="world-chapter-head">
          <span class="world-chapter-no">01</span>
          <h2>最近的故事</h2>
          <button class="world-more" @click="go('articles')">全部文章 ↗</button>
        </header>
        <ol class="world-stories">
          <li v-for="(article, index) in latest" :key="article.id">
            <button @click="articles.open(article)">
              <span class="world-story-no">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="world-story-copy">
                <strong>{{ article.title }}</strong>
                <small>{{ article.excerpt }}</small>
              </span>
              <span class="world-story-date">{{ article.date }}</span>
            </button>
          </li>
        </ol>
      </section>

      <section class="world-chapter" v-reveal>
        <header class="world-chapter-head">
          <span class="world-chapter-no">02</span>
          <h2>去别处</h2>
        </header>
        <nav class="world-doors" aria-label="其他页面">
          <button @click="go('diary')"><em>日记</em><small>{{ diaries.diaries.length }} 篇</small></button>
          <button @click="go('gallery')"><em>相册</em><small>{{ media.allPhotoCount }} 张</small></button>
          <button @click="go('music')"><em>音乐</em><small>{{ music.playableTracks.length }} 首</small></button>
        </nav>
      </section>

      <section class="world-chapter" v-reveal>
        <header class="world-chapter-head">
          <span class="world-chapter-no">03</span>
          <h2>日子</h2>
          <button class="world-more" @click="go('diary')">全部日记 ↗</button>
        </header>
        <ul class="world-diary">
          <li v-for="entry in recentDiaries" :key="entry.id">
            <button @click="diaries.openReader(entry)">
              <span class="world-diary-date">{{ entry.date.slice(5) }}</span>
              <strong>{{ entry.title }}</strong>
              <small>{{ entry.content.slice(0, 56) }}{{ entry.content.length > 56 ? '…' : '' }}</small>
            </button>
          </li>
        </ul>
      </section>

      <PageFooter :name="profile.profileName" :note="`第 ${dayCount} 个日子 · 持续记录中`" />
    </div>

    <div v-if="tip" class="world-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
      <span class="world-tip-date">{{ tip.entry.date }}</span>
      <strong>{{ tip.entry.title }}</strong>
      <small>{{ tip.entry.excerpt }}…</small>
    </div>

    <!-- 画布里的星体对读屏/键盘不可见，日记仍要能从这里打开 -->
    <ul class="world-a11y">
      <li v-for="entry in heroEntries" :key="entry.id">
        <button type="button" @click="diaries.openReader(entry)">打开日记：{{ entry.title }}</button>
      </li>
    </ul>
  </section>
</template>

