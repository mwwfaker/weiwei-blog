<script setup>
// 白天主题的首页：玻璃光学（Glass Optics）。
//
// 整页是一块被光穿过的工作台：底色是浅色光场，内容是几层真的会反光的玻璃。
// 指针在整页上移动时，整页的光斑跟着走，首屏那叠玻璃还会轻微转向。
// 纯 DOM/CSS：白天切主题是瞬时的，也不和夜里的 three 抢 GPU。
import { computed, ref } from 'vue'
import { go } from '@/app/usePageNav'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'
import { useMediaStore } from '@/stores/media'
import { useMusicStore } from '@/stores/music'
import { useProfileStore } from '@/stores/profile'

const articles = useArticlesStore()
const diaries = useDiariesStore()
const media = useMediaStore()
const music = useMusicStore()
const profile = useProfileStore()

const latest = computed(() => articles.articles.slice(0, 3))
const recentDiaries = computed(() => diaries.homeDiaries)
const dayCount = computed(() => 128 + diaries.diaries.length)

const root = ref(null)
const tilt = ref({ x: 0, y: 0 })
const light = ref({ x: 50, y: 30 })

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function onMove(event) {
  const box = root.value?.getBoundingClientRect()
  if (!box) return
  const px = clamp((event.clientX - box.left) / box.width, 0, 1)
  const py = clamp((event.clientY - box.top) / box.height, 0, 1)
  light.value = { x: px * 100, y: py * 100 }
  tilt.value = {
    x: clamp((0.5 - py) * 18, -10, 10),
    y: clamp((px - 0.5) * 22, -13, 13),
  }
}

function onLeave() {
  tilt.value = { x: 0, y: 0 }
  light.value = { x: 50, y: 30 }
}

function startDiary() {
  go('diary')
  diaries.openNew()
}
</script>

<template>
  <section
    ref="root"
    class="glass-home"
    :style="{ '--lx': `${light.x}%`, '--ly': `${light.y}%`, '--rx': `${tilt.x}deg`, '--ry': `${tilt.y}deg` }"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <div class="glass-field" aria-hidden="true"></div>
    <div class="glass-light" aria-hidden="true"></div>

    <div class="glass-inner">
      <section class="glass-hero">
        <div class="glass-copy">
          <div class="glass-eyebrow">A LITTLE SPACE FOR MYSELF</div>
          <h1>把日子写成<br /><em>喜欢的样子。</em></h1>
          <p class="glass-lead">你好，我是{{ profile.profileName }}。这里收集生活里的小小闪光，也收藏那些不想忘记的瞬间。</p>
          <div class="glass-actions">
            <button class="glass-cta" @click="startDiary">写下一篇日记 <span>↗</span></button>
            <button class="glass-link" @click="go('about')">关于我 →</button>
          </div>
          <div class="glass-meta">第 {{ dayCount }} 个日子 · 持续记录中</div>
        </div>

        <div class="glass-stage">
          <div class="glass-shard shard-a" aria-hidden="true"></div>
          <div class="glass-shard shard-b" aria-hidden="true"></div>
          <div class="glass-pane pane-back" aria-hidden="true"></div>
          <div class="glass-pane pane-mid" aria-hidden="true"></div>
          <div class="glass-pane pane-front">
            <span class="pane-wordmark">唯唯园</span>
            <span class="pane-caption">WEIWEI'S LITTLE GARDEN</span>
          </div>
          <button v-if="recentDiaries[0]" class="glass-chip" @click="diaries.openReader(recentDiaries[0])">
            <span class="chip-date">{{ recentDiaries[0].date }}</span>
            <span class="chip-title">{{ recentDiaries[0].title }}</span>
            <span class="chip-go">打开 ↗</span>
          </button>
        </div>
      </section>

      <section class="glass-section">
        <header class="glass-head">
          <span class="glass-no">01</span>
          <h2>最近的故事</h2>
          <button class="glass-more" @click="go('articles')">全部文章 ↗</button>
        </header>
        <div class="glass-panel">
          <ol class="glass-stories">
            <li v-for="(article, index) in latest" :key="article.id">
              <button @click="articles.open(article)">
                <span class="story-no">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="story-copy"><strong>{{ article.title }}</strong><small>{{ article.excerpt }}</small></span>
                <span class="story-date">{{ article.date }}</span>
              </button>
            </li>
          </ol>
        </div>
      </section>

      <section class="glass-section">
        <header class="glass-head">
          <span class="glass-no">02</span>
          <h2>去别处</h2>
        </header>
        <nav class="glass-doors" aria-label="其他页面">
          <button class="glass-door" @click="go('diary')"><em>日记</em><small>{{ diaries.diaries.length }} 篇</small><i>↗</i></button>
          <button class="glass-door" @click="go('gallery')"><em>相册</em><small>{{ media.allPhotoCount }} 张</small><i>↗</i></button>
          <button class="glass-door" @click="go('music')"><em>音乐</em><small>{{ music.playableTracks.length }} 首</small><i>↗</i></button>
        </nav>
      </section>

      <section class="glass-section">
        <header class="glass-head">
          <span class="glass-no">03</span>
          <h2>日子</h2>
          <button class="glass-more" @click="go('diary')">全部日记 ↗</button>
        </header>
        <div class="glass-panel">
          <ul class="glass-diary">
            <li v-for="entry in recentDiaries" :key="entry.id">
              <button @click="diaries.openReader(entry)">
                <span class="diary-date">{{ entry.date.slice(5) }}</span>
                <strong>{{ entry.title }}</strong>
                <small>{{ entry.content.slice(0, 54) }}{{ entry.content.length > 54 ? '…' : '' }}</small>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <footer class="glass-footer">
        <span>Made with ♡ by {{ profile.profileName }}</span>
        <span>第 {{ dayCount }} 个日子 · 持续记录中</span>
      </footer>
    </div>
  </section>
</template>
