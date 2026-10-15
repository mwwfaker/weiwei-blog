<script setup>
// 首页主视觉：标题、两个入口、右侧的装饰画。
import { go } from '@/app/usePageNav'
import { vReveal } from '@/composables/motion'
import { useDiariesStore } from '@/stores/diaries'
import { useProfileStore } from '@/stores/profile'

const diaries = useDiariesStore()
const profile = useProfileStore()

function startDiary() {
  go('diary')
  diaries.openNew()
}
</script>

<template>
  <div class="hero-card" v-reveal>
    <div class="hero-copy">
      <div class="eyebrow"><span class="eyebrow-line"></span> A LITTLE SPACE FOR MYSELF</div>
      <h1>把日子写成<br /><em>喜欢的样子。</em></h1>
      <p>
        你好，我是{{ profile.profileName }}。这里收集生活里的小小闪光，
        <br class="desktop-only" />也收藏那些不想忘记的瞬间。
      </p>
      <div class="hero-buttons">
        <button class="button-primary" @click="startDiary">写下一篇日记 <span>↗</span></button>
        <button class="button-text" @click="go('about')">关于我 <span>→</span></button>
      </div>
      <div class="hero-meta">
        <span class="meta-line"></span>
        <span>记下第 <strong>{{ 128 + diaries.diaries.length }}</strong> 个日子</span>
        <span class="meta-divider">·</span>
        <span>持续记录中</span>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
      <div class="sun-disc"></div><div class="art-label label-top">little moments</div><div class="art-label label-bottom">vol. 06 &nbsp; / &nbsp; the soft days</div>
      <div class="art-spark spark-one">✳</div><div class="art-spark spark-two">✧</div><div class="art-spark spark-three">·</div>
      <div class="art-ribbon"></div><div class="art-ribbon ribbon-two"></div>
      <div class="art-stamp"><span>W</span><small>EST. 2021</small></div>
    </div>
    <div class="hero-index"><span>01</span><i></i><span>04</span></div>
  </div>
</template>
