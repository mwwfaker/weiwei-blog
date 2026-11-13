<script setup>
// 关于我。这是路由表里没有匹配时也会落到的页面（见 app/pageRegistry.js），
// 所以它不能依赖任何「必须先访问过某个页面」的状态。
//
// 2026-11 只做了**版面与字号**上的整理：两张栏的比例、图片圆角与悬停、
// 引言与正文的两级字号、标签描边。没有往页面上加新内容——
// 文章数、日记数这类数字在首页已经到处都是，这里再加只会显得臃肿。
import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1100&q=85'
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
          我相信，每一个认真度过的日子，都值得被好好记下。于是有了这个小小的角落，放文章、照片、日记，还有那些不一定重要却舍不得忘记的事。
        </p>
        <div class="about-tags"><span>☕ 慢生活</span><span>✈ 在路上</span><span>✿ 爱记录</span></div>
        <button class="button-primary" @click="profile.openEditor()">编辑个人资料 <span>↗</span></button>
      </div>
    </div>
  </section>
</template>
